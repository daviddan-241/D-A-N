#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# auto-install.sh — lightweight first-boot setup
#
# WHAT THIS DOES (safe for 512 MB Render free tier):
#   • Agent memory directory init
#   • rockyou.txt wordlist (small, ~130 MB compressed → streamed direct to disk)
#   • Nuclei templates update
#   • Fix ownership of home directory
#
# WHAT THIS DELIBERATELY DOES NOT DO:
#   • Start Ollama server  — that process alone uses 200-400 MB RAM
#   • Pull Ollama models   — phi3:mini = 2.2 GB; way over free-tier limit
#   • Install aider        — heavy pip build; use manually: pip3 install aider-chat
#   • Install BeEF         — Ruby bundler, slow, RAM-intensive
#   • Download SecLists    — multi-GB; use manually: git clone --depth=1 ...
#   • Install Metasploit   — pre-baked in Docker image via apt
#   • Install Playwright   — pre-baked in Docker image
#
# To use Ollama via SSH:
#   ollama serve &          # ~15s to start; uses 200-400 MB RAM
#   ollama pull phi3:mini   # 2.2 GB download — needs disk space
#   ollama run phi3:mini
#
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

LOG="${LOG_DIR:-/var/log/ssh-container}/auto-install.log"
INSTALL_FLAG="/home/${DEV_USER:-devuser}/.dan_extras_installed"
DEV_USER="${DEV_USER:-devuser}"
HOME_DIR="/home/${DEV_USER}"

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [AUTO-INSTALL] $*" | tee -a "${LOG}"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [AUTO-INSTALL] WARN: $*" | tee -a "${LOG}" >&2; }

log "=== D.A.N. first-boot lightweight setup starting ==="
log "Follow progress: tail -f ${LOG}"

# ── Memory guard ──────────────────────────────────────────────────────────────
# Abort if free RAM is dangerously low. On Render free tier (512 MB), by the
# time this script runs the container already has Node.js + sshd + bore +
# ttyd consuming ~200 MB. Leave room for those processes.
FREE_MB=$(awk '/^MemAvailable/ { printf "%d", $2/1024 }' /proc/meminfo 2>/dev/null || echo 999)
log "Available RAM: ${FREE_MB} MB"
if [[ "${FREE_MB}" -lt 80 ]]; then
  warn "Only ${FREE_MB} MB free — skipping all installs to avoid OOM."
  warn "Connect via SSH and run tools manually when RAM is available."
  exit 0
fi

# ── Agent memory directory ────────────────────────────────────────────────────
log "Setting up agent memory directories ..."
sudo -u "${DEV_USER}" mkdir -p \
  "${HOME_DIR}/.dan/memory" \
  "${HOME_DIR}/.dan/sessions" \
  "${HOME_DIR}/.dan/notes" \
  "${HOME_DIR}/tools" \
  "${HOME_DIR}/projects" \
  "${HOME_DIR}/wordlists" \
  "${HOME_DIR}/captures" \
  "${HOME_DIR}/reports" \
  2>>"${LOG}" || true

if [[ -f /scripts/agent-memory.sh ]]; then
  sudo -u "${DEV_USER}" bash /scripts/agent-memory.sh init 2>>"${LOG}" \
    && log "Agent memory initialized" \
    || warn "agent-memory.sh init failed (non-fatal)"
fi

# ── rockyou.txt — small enough to stream, needed for password cracking ────────
ROCKYOU="${HOME_DIR}/wordlists/rockyou.txt"
if [[ ! -f "${ROCKYOU}" ]]; then
  # Check RAM again — curl + gunzip needs ~50 MB headroom
  FREE_NOW=$(awk '/^MemAvailable/ { printf "%d", $2/1024 }' /proc/meminfo 2>/dev/null || echo 0)
  if [[ "${FREE_NOW}" -gt 100 ]]; then
    log "Downloading rockyou.txt (~130 MB compressed, streamed) ..."
    mkdir -p "${HOME_DIR}/wordlists"
    curl -fsSL --max-time 120 \
      "https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt" \
      -o "${ROCKYOU}" 2>>"${LOG}" \
      && chown "${DEV_USER}:${DEV_USER}" "${ROCKYOU}" \
      && log "rockyou.txt ready at ${ROCKYOU}" \
      || warn "rockyou.txt download failed — grab it manually via SSH: curl -L <url> -o ~/wordlists/rockyou.txt"
  else
    warn "Low RAM (${FREE_NOW} MB) — skipping rockyou.txt download"
  fi
else
  log "rockyou.txt already present"
fi

# ── Nuclei templates — update if nuclei is installed ─────────────────────────
if command -v nuclei &>/dev/null; then
  log "Updating nuclei templates ..."
  sudo -u "${DEV_USER}" nuclei -update-templates -silent 2>>"${LOG}" \
    && log "Nuclei templates updated" \
    || warn "Nuclei template update failed (non-fatal)"
fi

# ── Fix ownership ─────────────────────────────────────────────────────────────
log "Fixing home directory ownership ..."
chown -R "${DEV_USER}:${DEV_USER}" "${HOME_DIR}" 2>/dev/null || \
  chown -R 1000:1000 "${HOME_DIR}" 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────────────────────────
touch "${INSTALL_FLAG}"
chown "${DEV_USER}:${DEV_USER}" "${INSTALL_FLAG}" 2>/dev/null || \
  chown 1000:1000 "${INSTALL_FLAG}" 2>/dev/null || true

log "=== First-boot setup complete ==="
log ""
log "Tools available immediately (baked into image):"
log "  nmap hydra hashcat john nikto sqlmap gobuster ffuf subfinder"
log "  nuclei httpx dnsx waybackurls gau impacket scapy mitmproxy"
log "  pwntools sherlock theHarvester recon-ng bore ttyd cloudflared"
log "  gcc python3 ruby nodejs go git vim tmux screen curl wget"
log ""
log "Ollama (local AI) — run manually via SSH to avoid OOM:"
log "  ollama serve &           # start the server (uses ~200-400 MB RAM)"
log "  ollama pull phi3:mini    # 2.2 GB model — fast, small"
log "  ollama run phi3:mini     # interactive chat"
log ""
log "Wordlists:"
log "  ~/wordlists/rockyou.txt  (if downloaded above)"
log "  Install SecLists: git clone --depth=1 https://github.com/danielmiessler/SecLists ~/wordlists/SecLists"
log ""
log "aider (AI coding):"
log "  pip3 install --user aider-chat"
log "  aider --model ollama/phi3:mini"
