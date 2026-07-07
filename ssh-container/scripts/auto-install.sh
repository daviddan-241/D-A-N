#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# auto-install.sh — first-boot heavy tool install
# Runs in background when AUTO_INSTALL_EXTRAS=yes
# Installs: Metasploit, Amass, additional Go tools, SecLists
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG="${LOG_DIR:-/var/log/ssh-container}/auto-install.log"
INSTALL_FLAG="/home/${DEV_USER:-devuser}/.dan_extras_installed"
DEV_USER="${DEV_USER:-devuser}"
HOME_DIR="/home/${DEV_USER}"

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [AUTO-INSTALL] $*" | tee -a "${LOG}"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [AUTO-INSTALL] WARN: $*" | tee -a "${LOG}" >&2; }

log "=== D.A.N. first-boot tool install starting ==="
log "This runs in the background. Follow progress: tail -f ${LOG}"

# ── SecLists (wordlists) ──────────────────────────────────────────────────────
SECLISTS_DIR="${HOME_DIR}/wordlists/SecLists"
if [[ ! -d "${SECLISTS_DIR}" ]]; then
  log "Cloning SecLists wordlists ..."
  git clone --depth=1 https://github.com/danielmiessler/SecLists.git \
    "${SECLISTS_DIR}" 2>>"${LOG}" \
  && log "SecLists installed at ${SECLISTS_DIR}" \
  || warn "SecLists clone failed (check network)"
else
  log "SecLists already present at ${SECLISTS_DIR}"
fi

# ── RockYou (classic password list) ──────────────────────────────────────────
ROCKYOU="${HOME_DIR}/wordlists/rockyou.txt"
if [[ ! -f "${ROCKYOU}" ]]; then
  log "Downloading rockyou.txt ..."
  curl -fsSL \
    "https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt" \
    -o "${ROCKYOU}" 2>>"${LOG}" \
  && log "rockyou.txt installed at ${ROCKYOU}" \
  || warn "rockyou.txt download failed"
fi

# ── Nuclei templates ──────────────────────────────────────────────────────────
if command -v nuclei &>/dev/null; then
  log "Updating Nuclei templates ..."
  sudo -u "${DEV_USER}" nuclei -update-templates 2>>"${LOG}" || \
    warn "Nuclei template update failed"
fi

# ── Metasploit Framework ──────────────────────────────────────────────────────
if ! command -v msfconsole &>/dev/null; then
  log "Installing Metasploit Framework (this takes 5-10 minutes) ..."
  curl -fsSL https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb \
    > /tmp/msfinstall 2>>"${LOG}" \
  && chmod 755 /tmp/msfinstall \
  && /tmp/msfinstall 2>>"${LOG}" \
  && log "Metasploit installed." \
  || warn "Metasploit install failed — install manually: curl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb | bash"
else
  log "Metasploit already installed."
fi

# ── Sherlock (OSINT username search) ─────────────────────────────────────────
SHERLOCK_DIR="${HOME_DIR}/tools/sherlock"
if [[ ! -d "${SHERLOCK_DIR}" ]]; then
  log "Installing Sherlock ..."
  git clone --depth=1 https://github.com/sherlock-project/sherlock.git \
    "${SHERLOCK_DIR}" 2>>"${LOG}" \
  && pip3 install --no-cache-dir --break-system-packages -r "${SHERLOCK_DIR}/requirements.txt" 2>>"${LOG}" \
  && ln -sf "${SHERLOCK_DIR}/sherlock/sherlock.py" /usr/local/bin/sherlock \
  && chmod +x /usr/local/bin/sherlock \
  && log "Sherlock installed." \
  || warn "Sherlock install failed"
fi

# ── SQLMap (ensure latest) ────────────────────────────────────────────────────
SQLMAP_DIR="${HOME_DIR}/tools/sqlmap"
if [[ ! -d "${SQLMAP_DIR}" ]]; then
  log "Installing SQLMap from git ..."
  git clone --depth=1 https://github.com/sqlmapproject/sqlmap.git \
    "${SQLMAP_DIR}" 2>>"${LOG}" \
  && ln -sf "${SQLMAP_DIR}/sqlmap.py" /usr/local/bin/sqlmapgit \
  && log "SQLMap (git) installed at ${SQLMAP_DIR}" \
  || warn "SQLMap git install failed"
fi

# ── BeEF (Browser Exploitation Framework) ─────────────────────────────────────
BEEF_DIR="${HOME_DIR}/tools/beef"
if [[ ! -d "${BEEF_DIR}" ]]; then
  log "Installing BeEF ..."
  git clone --depth=1 https://github.com/beefproject/beef.git \
    "${BEEF_DIR}" 2>>"${LOG}" \
  && cd "${BEEF_DIR}" \
  && bundle install 2>>"${LOG}" \
  && log "BeEF installed at ${BEEF_DIR}" \
  || warn "BeEF install failed (requires Ruby Bundler)"
fi

# ── impacket examples ─────────────────────────────────────────────────────────
log "Checking impacket ..."
python3 -c "import impacket; print('impacket', impacket.__version__)" 2>>"${LOG}" \
  || pip3 install --no-cache-dir --break-system-packages impacket 2>>"${LOG}" \
  || warn "impacket install failed"

# ── Fix ownership ─────────────────────────────────────────────────────────────
log "Fixing ownership of ${HOME_DIR} ..."
chown -R "${DEV_USER}:${DEV_USER}" "${HOME_DIR}"

# ── Mark complete ─────────────────────────────────────────────────────────────
touch "${INSTALL_FLAG}"
chown "${DEV_USER}:${DEV_USER}" "${INSTALL_FLAG}"

log "=== D.A.N. first-boot install complete ==="
log "Tools installed:"
log "  SecLists wordlists → ~/wordlists/SecLists"
log "  rockyou.txt        → ~/wordlists/rockyou.txt"
log "  Sherlock           → sherlock"
log "  SQLMap (git)       → ~/tools/sqlmap"
log "  Nuclei templates   → updated"
log "  BeEF               → ~/tools/beef"
log "  Metasploit         → msfconsole (if install succeeded)"
