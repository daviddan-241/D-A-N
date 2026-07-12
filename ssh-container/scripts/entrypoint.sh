#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# D.A.N. Container Entrypoint
# Starts: SSH host-key generation → firewall → fail2ban → ttyd → sshd
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG_DIR="/var/log/ssh-container"
LOG_FILE="${LOG_DIR}/startup.log"
DEV_USER="${DEV_USER:-devuser}"
DAN_HOSTNAME="${DAN_HOSTNAME:-dan-devbox}"
WEB_TERMINAL_USER="${WEB_TERMINAL_USER:-dan}"
WEB_TERMINAL_PASS="${WEB_TERMINAL_PASS:-changeme}"
AUTO_INSTALL_EXTRAS="${AUTO_INSTALL_EXTRAS:-no}"

# ── Logging helpers ───────────────────────────────────────────────────────────
log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [INFO]  $*" | tee -a "${LOG_FILE}"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [WARN]  $*" | tee -a "${LOG_FILE}" >&2; }
err()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" | tee -a "${LOG_FILE}" >&2; }

mkdir -p "${LOG_DIR}"
chmod 750 "${LOG_DIR}"

# ── Refresh apt package lists ──────────────────────────────────────────────────
# The Docker build removes /var/lib/apt/lists/* after every install step to
# keep the image small, so the lists are empty in the running container.
# Without this, "apt install foo" fails with "Unable to locate package" until
# the user manually runs "sudo apt update" first. Refresh in the background
# so it doesn't add latency to boot — by the time the user's shell opens
# (several seconds later, after ttyd/sshd start), it's normally done.
( apt-get update -qq >>"${LOG_DIR}/apt-update.log" 2>&1 || true ) &

# ── Custom hostname (shows up in the shell prompt as ${DEV_USER}@${DAN_HOSTNAME}) ─
# `hostname` itself often fails on unprivileged containers (Render doesn't
# grant CAP_SYS_ADMIN), so this is best-effort — /etc/hosts is what actually
# makes the name resolve locally.
#
# The shell prompt (bashrc_extra) does NOT rely on bash's \h escape, because
# \h reads the kernel hostname, which on Render is the raw pod ID (e.g.
# "srv-xxxxx-hibernate-...") when the syscall above is denied — that's what
# produced the garbled prompt. Instead we write DAN_HOSTNAME to a profile.d
# file every login shell sources (ttyd, tmux, sshd all go through this),
# so the prompt always shows the friendly name regardless of hostname perms.
if command -v hostname &>/dev/null; then
  hostname "${DAN_HOSTNAME}" 2>/dev/null || true
fi
echo "${DAN_HOSTNAME}" > /etc/hostname 2>/dev/null || true
if ! grep -q "${DAN_HOSTNAME}" /etc/hosts 2>/dev/null; then
  echo "127.0.0.1 ${DAN_HOSTNAME}" >> /etc/hosts 2>/dev/null || true
fi
echo "export DAN_HOSTNAME=\"${DAN_HOSTNAME}\"" > /etc/profile.d/99-dan-hostname.sh 2>/dev/null || true
chmod 644 /etc/profile.d/99-dan-hostname.sh 2>/dev/null || true

log "======================================================================"
log " D.A.N. — Dynamic Access Node — starting"
log "======================================================================"
log " Hostname:  $(hostname 2>/dev/null || echo "${DAN_HOSTNAME}")"
log " User:      ${DEV_USER}"
log " Built on:  Ubuntu 24.04"
log "======================================================================"

# ─────────────────────────────────────────────────────────────────────────────
# 1. SSH Host Keys
# ─────────────────────────────────────────────────────────────────────────────
HOST_KEY_DIR="/etc/ssh/host_keys"
log "Checking SSH host keys in ${HOST_KEY_DIR} ..."
mkdir -p "${HOST_KEY_DIR}"
chmod 700 "${HOST_KEY_DIR}"

generate_key() {
  local type="$1"
  local bits="$2"
  local keyfile="${HOST_KEY_DIR}/ssh_host_${type}_key"
  if [[ ! -f "${keyfile}" ]]; then
    log "Generating ${type} host key ..."
    if [[ -n "${bits}" ]]; then
      ssh-keygen -q -t "${type}" -b "${bits}" -N "" -f "${keyfile}"
    else
      ssh-keygen -q -t "${type}" -N "" -f "${keyfile}"
    fi
    chmod 600 "${keyfile}"
    chmod 644 "${keyfile}.pub"
    log "Generated: ${keyfile}"
  else
    log "Reusing existing ${type} host key."
  fi
}

generate_key rsa    4096
generate_key ed25519 ""
generate_key ecdsa  521

# ─────────────────────────────────────────────────────────────────────────────
# 2. Home directory structure
# ─────────────────────────────────────────────────────────────────────────────
HOME_DIR="/home/${DEV_USER}"
SSH_DIR="${HOME_DIR}/.ssh"

log "Ensuring home directory structure for ${DEV_USER} ..."
mkdir -p "${SSH_DIR}"

if [[ ! -f "${SSH_DIR}/authorized_keys" ]]; then
  touch "${SSH_DIR}/authorized_keys"
fi
chmod 600 "${SSH_DIR}/authorized_keys"

# Render has no `docker exec`, so keys are injected via env vars instead.
# SSH_PUBLIC_KEY   — a single public key (one line)
# SSH_PUBLIC_KEYS  — multiple keys, one per line (use \n in the Render UI)
for VAR_KEY in "${SSH_PUBLIC_KEY:-}" "${SSH_PUBLIC_KEYS:-}"; do
  if [[ -n "${VAR_KEY}" ]]; then
    while IFS= read -r LINE; do
      LINE="$(echo "${LINE}" | xargs)" # trim whitespace
      if [[ -n "${LINE}" ]] && echo "${LINE}" | grep -qE '^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp|sk-)'; then
        if ! grep -qF "${LINE}" "${SSH_DIR}/authorized_keys" 2>/dev/null; then
          echo "${LINE}" >> "${SSH_DIR}/authorized_keys"
          log "Installed SSH public key from env var (fingerprint: $(echo "${LINE}" | ssh-keygen -lf /dev/stdin 2>/dev/null | awk '{print $2}'))"
        fi
      fi
    done <<< "$(echo -e "${VAR_KEY}")"
  fi
done

KEY_COUNT=$(grep -c 'ssh-' "${SSH_DIR}/authorized_keys" 2>/dev/null || true)
if [[ "${KEY_COUNT}" -eq 0 ]]; then
  warn "authorized_keys is empty. SSH login will fail until a key is added."
  warn "  Set SSH_PUBLIC_KEY in the Render dashboard to your public key (cat ~/.ssh/id_ed25519.pub)"
else
  log "Found ${KEY_COUNT} authorized SSH key(s)."
fi

# Go tools for devuser
mkdir -p "${HOME_DIR}/go/bin"
cp /root/go/bin/* "${HOME_DIR}/go/bin/" 2>/dev/null || true
cp /usr/local/bin/gobuster /usr/local/bin/ffuf /usr/local/bin/subfinder \
   /usr/local/bin/httpx /usr/local/bin/nuclei /usr/local/bin/dnsx \
   /usr/local/bin/waybackurls /usr/local/bin/gau 2>/dev/null || true

# Create useful directories in home
mkdir -p "${HOME_DIR}/"{tools,projects,wordlists,captures,reports,.config}
mkdir -p "${HOME_DIR}/agent-memory/"{context,scratch}

# Initialise MEMORY.md if it doesn't exist
if [[ ! -f "${HOME_DIR}/agent-memory/MEMORY.md" ]]; then
  cat > "${HOME_DIR}/agent-memory/MEMORY.md" << 'MEMEOF'
# D.A.N. Agent Memory

Auto-loaded into every aider session via --read.
Use `remember "note"` to append, `recall keyword` to search.

## Persistent Notes
<!-- Agent appends below this line -->

MEMEOF
fi

# Ensure correct ownership & permissions
chmod 755 "${HOME_DIR}"
chmod 700 "${SSH_DIR}"
chmod 600 "${SSH_DIR}/authorized_keys"
chown -R "$(id -u "${DEV_USER}" 2>/dev/null || echo 1000):$(id -g "${DEV_USER}" 2>/dev/null || echo 1000)" "${HOME_DIR}"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Patch AllowUsers dynamically
# ─────────────────────────────────────────────────────────────────────────────
log "Patching AllowUsers in sshd_config → ${DEV_USER} ..."
sed -i "s/^AllowUsers .*/AllowUsers ${DEV_USER}/" /etc/ssh/sshd_config
if ! grep -q "^AllowUsers " /etc/ssh/sshd_config; then
  echo "AllowUsers ${DEV_USER}" >> /etc/ssh/sshd_config
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Tor — start before all outbound services so tunnels and tools are anonymous
# ─────────────────────────────────────────────────────────────────────────────
log "Starting Tor anonymization layer ..."
mkdir -p /var/log/tor /var/lib/tor
chown -R debian-tor:debian-tor /var/log/tor /var/lib/tor 2>/dev/null || true

# Truncate logs BEFORE starting Tor so bootstrap detection has no stale entries
> /var/log/tor/notices.log 2>/dev/null || true
> "${LOG_DIR}/tor.log"

# Run Tor as daemon (no systemd in Docker)
tor --RunAsDaemon 1 \
    --PidFile /var/run/tor.pid \
    >>"${LOG_DIR}/tor.log" 2>&1 || warn "Tor failed to start — check ${LOG_DIR}/tor.log"

# Wait up to 8 s for Tor — Render containers rarely allow it; don't block boot
TOR_READY=0
for i in $(seq 1 4); do
  if grep -q "Bootstrapped 100%" /var/log/tor/notices.log 2>/dev/null || \
     grep -q "Bootstrapped 100%" "${LOG_DIR}/tor.log" 2>/dev/null; then
    TOR_READY=1
    break
  fi
  sleep 2
done

if [[ "${TOR_READY}" -eq 1 ]]; then
  log "Tor bootstrapped — verifying with live connection ..."
  TOR_EXIT_IP=$(curl --socks5-hostname 127.0.0.1:9050 --max-time 15 -s \
    https://api.ipify.org 2>/dev/null || echo "unknown")
  log "  Tor exit IP: ${TOR_EXIT_IP}"

  # ── Try transparent-proxy iptables rules (requires NET_ADMIN cap) ──────────
  # On Render free tier NET_ADMIN is not available; we fall back to env-var
  # proxying (ALL_PROXY set in bashrc_extra and dan-agents.sh).
  if iptables -t nat -N DAN_TOR 2>/dev/null; then
    # Allow Tor process itself to bypass redirect
    iptables -t nat -A DAN_TOR -m owner --uid-owner debian-tor -j RETURN
    # Allow loopback
    iptables -t nat -A DAN_TOR -o lo -j RETURN
    # Redirect DNS (UDP 53) → Tor DNSPort 5353
    iptables -t nat -A DAN_TOR -p udp --dport 53 -j REDIRECT --to-ports 5353
    # Redirect all TCP → Tor TransPort 9040
    iptables -t nat -A DAN_TOR -p tcp --syn -j REDIRECT --to-ports 9040
    iptables -t nat -A OUTPUT -j DAN_TOR
    log "  Transparent proxy active — all egress TCP/DNS forced through Tor"
  else
    warn "  NET_ADMIN not available — using env-var proxy (opt-in via ALL_PROXY)"
    warn "  Run 'tor-check' after login to confirm your exit IP"
  fi
else
  warn "Tor did not fully bootstrap within 8 s — continuing anyway (normal on Render)"
  warn "  Check: tail -f ${LOG_DIR}/tor.log"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Firewall
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring firewall ..."
/firewall-init.sh 2>&1 | tee -a "${LOG_FILE}" || \
  warn "Firewall init failed (may be normal without NET_ADMIN)"

# ─────────────────────────────────────────────────────────────────────────────
# 6. fail2ban
# ─────────────────────────────────────────────────────────────────────────────
if command -v fail2ban-server &>/dev/null; then
  log "Starting fail2ban ..."
  mkdir -p /var/run/fail2ban
  fail2ban-server -b -x -l "${LOG_DIR}/fail2ban.log" 2>>"${LOG_FILE}" || \
    warn "fail2ban failed to start (may lack permissions in some environments)"
else
  warn "fail2ban not available, skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. Validate sshd config
# ─────────────────────────────────────────────────────────────────────────────
log "Validating sshd configuration ..."
if ! /usr/sbin/sshd -t 2>>"${LOG_FILE}"; then
  err "sshd configuration is invalid. Aborting."
  exit 1
fi
log "sshd configuration OK."

# ─────────────────────────────────────────────────────────────────────────────
# 8. Auto-install extras (Metasploit, Amass, etc.) — first boot only
# ─────────────────────────────────────────────────────────────────────────────
INSTALL_FLAG="${HOME_DIR}/.dan_extras_installed"
if [[ "${AUTO_INSTALL_EXTRAS}" == "yes" && ! -f "${INSTALL_FLAG}" ]]; then
  # ── Memory guard: free-tier has 512 MB total. Delay auto-install so bore,
  # sshd, Node.js and ttyd all start first, then check there is enough headroom.
  (
    sleep 30  # let all core services start and bore acquire a port
    FREE_MB=$(awk '/^MemAvailable/ { printf "%d", $2/1024 }' /proc/meminfo 2>/dev/null || echo 999)
    if [[ "${FREE_MB}" -lt 60 ]]; then
      echo "[AUTO-INSTALL] Only ${FREE_MB} MB RAM free — skipping auto-install to avoid OOM."         >> "${LOG_DIR}/auto-install.log"
    else
      echo "[AUTO-INSTALL] ${FREE_MB} MB RAM free — starting lightweight setup."         >> "${LOG_DIR}/auto-install.log"
      /auto-install.sh >> "${LOG_DIR}/auto-install.log" 2>&1
    fi
  ) &
  log "AUTO_INSTALL_EXTRAS=yes — first-boot setup queued (starts in 30s after bore/sshd settle) ..."
  log "Follow: tail -f ${LOG_DIR}/auto-install.log"
else
  log "Skipping extra tool install (set AUTO_INSTALL_EXTRAS=yes to enable on first boot)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9. Start ttyd (web terminal) — internal only, proxied by the app at /webterm
# ─────────────────────────────────────────────────────────────────────────────
# The Node app owns the public $PORT (Render only routes one port per web
# service), so ttyd always binds to a fixed internal port and the Express
# server proxies /webterm to it. See TTYD_INTERNAL_PORT below.
TTYD_INTERNAL_PORT="${TTYD_INTERNAL_PORT:-7681}"
export TTYD_INTERNAL_PORT
if command -v ttyd &>/dev/null; then
  log "Starting ttyd web terminal on 127.0.0.1:${TTYD_INTERNAL_PORT} (internal) ..."

  # ── Create a persistent tmux session as devuser ──────────────────────────
  # ttyd attaches to this session, so the shell survives WebSocket disconnects.
  # When you navigate away in the app and come back, you rejoin the same session.
  # The API server uses `tmux send-keys -t main:0.0` to inject keystrokes from
  # the key bar, bypassing all iOS iframe keyboard limitations.
  su -l "${DEV_USER}" -c "tmux new-session -d -s main 2>/dev/null || true"
  log "  Persistent tmux session 'main' ready for devuser"

  # No --credential: the terminal is only reachable via the app's HTTPS proxy.
  # Adding an extra auth layer caused WebSocket 401 failures in iOS Safari.
  # sudo -u is more reliable than su -l in unprivileged containers.
  ttyd \
    --port "${TTYD_INTERNAL_PORT}" \
    --interface 127.0.0.1 \
    --writable \
    --max-clients 5 \
    --check-origin=false \
    --client-option cursorBlink=true \
    --client-option fontSize=15 \
    --client-option fontFamily="'Menlo','Monaco','Cascadia Mono','Fira Code',monospace" \
    --client-option 'theme={"background":"#0a0a0f","foreground":"#d4d4d4","cursor":"#ff6b2b","cursorAccent":"#0a0a0f","selectionBackground":"rgba(255,107,43,0.25)","black":"#1a1a24","brightBlack":"#3a3a4a","red":"#f07070","brightRed":"#ff8888","green":"#7ec58c","brightGreen":"#9be0a8","yellow":"#d4bb6a","brightYellow":"#e8d080","blue":"#5b9bd5","brightBlue":"#78b4f0","magenta":"#c58bc5","brightMagenta":"#dda0dd","cyan":"#5bc8c8","brightCyan":"#78e0e0","white":"#c0c0cc","brightWhite":"#e8e8f0"}' \
    sudo -u "${DEV_USER}" tmux new-session -A -s main \
    2>>"${LOG_DIR}/ttyd.log" &
  TTYD_PID=$!
  sleep 1
  if kill -0 "${TTYD_PID}" 2>/dev/null; then
    log "ttyd running (PID ${TTYD_PID})"
    log "  Web terminal: https://<your-render-url>/webterm"
    log "  Session persists — navigate away and back to rejoin same shell"
  else
    warn "ttyd failed to start — retrying without tmux"
    ttyd --port "${TTYD_INTERNAL_PORT}" --interface 127.0.0.1 --writable \
      --check-origin=false sudo -u "${DEV_USER}" /bin/bash --login \
      2>>"${LOG_DIR}/ttyd.log" &
    log "Retried ttyd (bare shell fallback)"
  fi
else
  warn "ttyd not found — web terminal unavailable. SSH access still works."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9. Cloudflare Tunnel  — real SSH from anywhere via HTTPS (free)
#    Set CLOUDFLARE_TUNNEL_TOKEN in Render dashboard to activate.
#    Setup: dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create
# ─────────────────────────────────────────────────────────────────────────────
CLOUDFLARE_TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-}"
if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN}" ]] && command -v cloudflared &>/dev/null; then
  log "Starting Cloudflare Tunnel ..."
  cloudflared tunnel --no-autoupdate run --token "${CLOUDFLARE_TUNNEL_TOKEN}" \
    >>"${LOG_DIR}/cloudflared.log" 2>&1 &
  CF_PID=$!
  sleep 2
  if kill -0 "${CF_PID}" 2>/dev/null; then
    log "Cloudflare Tunnel running (PID ${CF_PID})"
    log "  SSH client cmd: ssh -o 'ProxyCommand cloudflared access ssh --hostname %h' ${DEV_USER}@<your-tunnel-hostname>"
    log "  a-shell:        install cloudflared, then use the ProxyCommand above"
    log "  Logs: tail -f ${LOG_DIR}/cloudflared.log"
  else
    warn "Cloudflare Tunnel failed to start — check ${LOG_DIR}/cloudflared.log"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 10. bore TCP tunnel — zero-config SSH fallback (no Cloudflare account needed)
#     Set BORE_ENABLE=yes in Render dashboard to activate.
#
#     NOTE: bore's entire lifecycle (spawn, port capture, auto-restart) is
#     owned by the Node app's TunnelManager (artifacts/api-server/src/
#     tunnel-manager.ts), started in step 14 below. It pipes bore's
#     stdout/stderr directly in-process, so there's no log-file polling or
#     regex timing race. Do NOT also spawn bore here: this used to launch a
#     second, independent `bore local 22 --to bore.pub` process (plus a bash
#     watchdog) a few seconds *before* the Node app started. bore.pub only
#     tolerates one concurrent connection for the same local target, so the
#     Node-managed bore this second process raced against exited with code 1
#     every few seconds forever — the tunnel never came up even though this
#     shell-spawned copy was fine. Only one owner is allowed; that's Node.
# ─────────────────────────────────────────────────────────────────────────────
if [[ "${BORE_ENABLE:-no}" == "yes" ]] && command -v bore &>/dev/null; then
  log "BORE_ENABLE=yes — bore tunnel will be started by the Node app's TunnelManager (not here)."
  log "  SSH: ssh -p <PORT> ${DEV_USER}@bore.pub  (check: cat ~/.dan_ssh_connect once live)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 11. GitHub persistence — pull on boot, auto-push every 30 min
#     Solves Render's zero-disk-persistence on free tier.
#     Set GITHUB_TOKEN + DOTFILES_REPO (and optionally PROJECTS_REPO) in Render.
# ─────────────────────────────────────────────────────────────────────────────
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
DOTFILES_REPO="${DOTFILES_REPO:-}"
PROJECTS_REPO="${PROJECTS_REPO:-}"
if [[ -n "${GITHUB_TOKEN}" ]] && [[ -n "${DOTFILES_REPO}" || -n "${PROJECTS_REPO}" ]]; then
  log "Starting GitHub persistence sync ..."
  sudo -u "${DEV_USER}" env \
    GITHUB_TOKEN="${GITHUB_TOKEN}" \
    DOTFILES_REPO="${DOTFILES_REPO}" \
    PROJECTS_REPO="${PROJECTS_REPO}" \
    DEV_USER="${DEV_USER}" \
    bash /scripts/dotfiles-sync.sh \
    >>"${LOG_DIR}/dotfiles.log" 2>&1 &
  log "GitHub sync running — logs: tail -f ${LOG_DIR}/dotfiles.log"
else
  log "GitHub persistence not configured (set GITHUB_TOKEN + DOTFILES_REPO in Render dashboard)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 12. Start sshd in the background
#     (the Node app below becomes the foreground/PID1-facing process, since
#     Render's health check and public traffic only ever reach $PORT)
# ─────────────────────────────────────────────────────────────────────────────
log "Starting sshd (background) ..."
# Render ephemeral tmpfs wipes /var/run at boot — recreate it.
mkdir -p /var/run/sshd && chmod 755 /var/run/sshd
# sshd daemonizes — the parent PID we capture exits immediately after forking
# the daemon child. Use pgrep to confirm the daemon is actually running.
/usr/sbin/sshd -e >>"${LOG_DIR}/sshd.log" 2>&1 &
sleep 2
if pgrep -x sshd >/dev/null 2>&1; then
  log "sshd running (daemon PID: $(pgrep -x sshd | head -1))"
else
  # Try once more with extra debug output
  warn "sshd daemon not found — retrying with -D (foreground debug)..."
  /usr/sbin/sshd -D -e >>"${LOG_DIR}/sshd.log" 2>&1 &
  sleep 2
  pgrep -x sshd >/dev/null 2>&1 \
    && log "sshd running on retry" \
    || warn "sshd still not running — check ${LOG_DIR}/sshd.log"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 13. Print connection info
# ─────────────────────────────────────────────────────────────────────────────
log "======================================================================"
log " D.A.N. is live"
log "======================================================================"
log " Web app:          https://<your-render-url>  (dashboard + web terminal)"
log " Web Terminal:      https://<your-render-url>/webterm  (auth: ${WEB_TERMINAL_USER} / [WEB_TERMINAL_PASS])"
log " SSH (Cloudflare): ssh -o 'ProxyCommand cloudflared access ssh --hostname %h' ${DEV_USER}@<tunnel-host>"
log " SSH (bore):       ssh -p <PORT> ${DEV_USER}@bore.pub  (check: cat ~/.dan_ssh_connect)"
log " GitHub sync:      cat ${LOG_DIR}/dotfiles.log"
log " Logs dir:         ${LOG_DIR}/"
log "======================================================================"

# ─────────────────────────────────────────────────────────────────────────────
# 14. Start the Node app in the foreground — this is the one process Render
#     routes traffic to. It serves the dashboard UI, the API, and proxies the
#     web terminal (ttyd) at /webterm, all on $PORT.
# ─────────────────────────────────────────────────────────────────────────────
log "Starting D.A.N. app on :${PORT:-8080} ..."
cd /app
exec node --enable-source-maps ./dist/index.mjs 2>&1 | tee -a "${LOG_DIR}/app.log"
