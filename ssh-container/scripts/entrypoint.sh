#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# D.A.N. Container Entrypoint
# Starts: SSH host-key generation → firewall → fail2ban → ttyd → sshd
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG_DIR="/var/log/ssh-container"
LOG_FILE="${LOG_DIR}/startup.log"
DEV_USER="${DEV_USER:-devuser}"
WEB_TERMINAL_USER="${WEB_TERMINAL_USER:-dan}"
WEB_TERMINAL_PASS="${WEB_TERMINAL_PASS:-changeme}"
AUTO_INSTALL_EXTRAS="${AUTO_INSTALL_EXTRAS:-no}"

# ── Logging helpers ───────────────────────────────────────────────────────────
log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [INFO]  $*" | tee -a "${LOG_FILE}"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [WARN]  $*" | tee -a "${LOG_FILE}" >&2; }
err()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" | tee -a "${LOG_FILE}" >&2; }

mkdir -p "${LOG_DIR}"
chmod 750 "${LOG_DIR}"

log "======================================================================"
log " D.A.N. — Dynamic Access Node — starting"
log "======================================================================"
log " Hostname:  $(hostname)"
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
  warn "No SSH public key installed — add one with: make add-key"
fi

KEY_COUNT=$(grep -c 'ssh-' "${SSH_DIR}/authorized_keys" 2>/dev/null || echo "0")
if [[ "${KEY_COUNT}" -eq 0 ]]; then
  warn "authorized_keys is empty. SSH login will fail until a key is added."
  warn "  docker exec dan-devbox bash -c \"echo 'YOUR_PUB_KEY' >> ${SSH_DIR}/authorized_keys\""
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

# Ensure correct ownership & permissions
chmod 755 "${HOME_DIR}"
chmod 700 "${SSH_DIR}"
chmod 600 "${SSH_DIR}/authorized_keys"
chown -R "${DEV_USER}:${DEV_USER}" "${HOME_DIR}"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Patch AllowUsers dynamically
# ─────────────────────────────────────────────────────────────────────────────
log "Patching AllowUsers in sshd_config → ${DEV_USER} ..."
sed -i "s/^AllowUsers .*/AllowUsers ${DEV_USER}/" /etc/ssh/sshd_config
if ! grep -q "^AllowUsers " /etc/ssh/sshd_config; then
  echo "AllowUsers ${DEV_USER}" >> /etc/ssh/sshd_config
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Firewall
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring firewall ..."
/firewall-init.sh 2>&1 | tee -a "${LOG_FILE}" || \
  warn "Firewall init failed (may be normal without NET_ADMIN)"

# ─────────────────────────────────────────────────────────────────────────────
# 5. fail2ban
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
# 6. Validate sshd config
# ─────────────────────────────────────────────────────────────────────────────
log "Validating sshd configuration ..."
if ! /usr/sbin/sshd -t 2>>"${LOG_FILE}"; then
  err "sshd configuration is invalid. Aborting."
  exit 1
fi
log "sshd configuration OK."

# ─────────────────────────────────────────────────────────────────────────────
# 7. Auto-install extras (Metasploit, Amass, etc.) — first boot only
# ─────────────────────────────────────────────────────────────────────────────
INSTALL_FLAG="${HOME_DIR}/.dan_extras_installed"
if [[ "${AUTO_INSTALL_EXTRAS}" == "yes" && ! -f "${INSTALL_FLAG}" ]]; then
  log "AUTO_INSTALL_EXTRAS=yes — running first-boot tool install (background) ..."
  /auto-install.sh 2>&1 >> "${LOG_DIR}/auto-install.log" &
  echo "Auto-install started in background. Check: tail -f ${LOG_DIR}/auto-install.log"
else
  log "Skipping extra tool install (set AUTO_INSTALL_EXTRAS=yes to enable on first boot)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. Start ttyd (web terminal)
# ─────────────────────────────────────────────────────────────────────────────
if command -v ttyd &>/dev/null; then
  log "Starting ttyd web terminal on :7681 ..."
  ttyd \
    --port 7681 \
    --interface 0.0.0.0 \
    --credential "${WEB_TERMINAL_USER}:${WEB_TERMINAL_PASS}" \
    --writable \
    --max-clients 10 \
    su -l "${DEV_USER}" \
    2>>"${LOG_DIR}/ttyd.log" &
  TTYD_PID=$!
  sleep 1
  if kill -0 "${TTYD_PID}" 2>/dev/null; then
    log "ttyd running (PID ${TTYD_PID})"
    log "  Web terminal: http://<host>:\${TTYD_PORT:-7681}"
    log "  Auth: ${WEB_TERMINAL_USER} / [configured password]"
  else
    warn "ttyd failed to start — check ${LOG_DIR}/ttyd.log"
    # Try simpler invocation
    ttyd --port 7681 --writable su -l "${DEV_USER}" \
      2>>"${LOG_DIR}/ttyd.log" &
    log "Retried ttyd without custom index."
  fi
else
  warn "ttyd not found — web terminal unavailable. SSH access still works."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9. Print connection info
# ─────────────────────────────────────────────────────────────────────────────
HOST_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "<container-ip>")
log "======================================================================"
log " D.A.N. is live"
log "======================================================================"
log " SSH:          ssh -p \${SSH_PORT:-2222} ${DEV_USER}@<host>"
log " Web Terminal: http://<host>:\${TTYD_PORT:-7681}"
log "               (auth: ${WEB_TERMINAL_USER} / [WEB_TERMINAL_PASS])"
log " Key required: add with 'make add-key' on the host"
log " Logs:         /var/log/ssh-container/"
log "======================================================================"

# ─────────────────────────────────────────────────────────────────────────────
# 10. Start sshd in foreground (keeps container alive)
# ─────────────────────────────────────────────────────────────────────────────
log "Starting sshd ..."
exec /usr/sbin/sshd -D -e 2>&1 | tee -a "${LOG_DIR}/sshd.log"
