#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# auto-install.sh — first-boot heavy tool install
# Runs in background when AUTO_INSTALL_EXTRAS=yes
# Installs: Metasploit, SecLists, Ollama + uncensored models, Go tools, etc.
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

# ── Agent memory directory ────────────────────────────────────────────────────
log "Setting up agent memory ..."
sudo -u "${DEV_USER}" bash /scripts/agent-memory.sh init 2>>"${LOG}" || \
  warn "Memory init failed — check /scripts/agent-memory.sh"

# ── Ollama — local uncensored AI (no content filters, no API key needed) ──────
if ! command -v ollama &>/dev/null; then
  log "Installing Ollama (local AI runtime — no API key, no restrictions) ..."
  curl -fsSL https://ollama.ai/install.sh | sh 2>>"${LOG}" \
    && log "Ollama installed." \
    || warn "Ollama install failed — install manually: curl https://ollama.ai/install.sh | sh"
else
  log "Ollama already installed: $(ollama --version 2>/dev/null || true)"
fi

# Start ollama server in the background so we can pull models
if command -v ollama &>/dev/null; then
  log "Starting Ollama server ..."
  ollama serve >>"${LOG}" 2>&1 &
  OLLAMA_PID=$!
  sleep 5  # give it time to start

  # ── Pull uncensored models ────────────────────────────────────────────────
  # dolphin-mistral: uncensored, no system prompt, follows any instruction
  log "Pulling dolphin-mistral (uncensored Mistral — no content filters) ..."
  ollama pull dolphin-mistral 2>>"${LOG}" \
    && log "  dolphin-mistral ready — use: aider --model ollama/dolphin-mistral" \
    || warn "  dolphin-mistral pull failed"

  # llama3.1 for general coding tasks
  log "Pulling llama3.1:8b (fast general purpose) ..."
  ollama pull llama3.1:8b 2>>"${LOG}" \
    && log "  llama3.1:8b ready — use: aider --model ollama/llama3.1:8b" \
    || warn "  llama3.1:8b pull failed"

  # dolphin-llama3: uncensored Llama 3
  log "Pulling dolphin-llama3 (uncensored Llama 3) ..."
  ollama pull dolphin-llama3 2>>"${LOG}" \
    && log "  dolphin-llama3 ready — use: aider --model ollama/dolphin-llama3" \
    || warn "  dolphin-llama3 pull failed"

  # Create symlink so 'ollama' is accessible to devuser
  ln -sf "$(command -v ollama)" /usr/local/bin/ollama 2>/dev/null || true
  log "Ollama models ready. Run 'ollama list' to see installed models."
fi

# ── SecLists (wordlists) ──────────────────────────────────────────────────────
SECLISTS_DIR="${HOME_DIR}/wordlists/SecLists"
if [[ ! -d "${SECLISTS_DIR}" ]]; then
  log "Cloning SecLists wordlists ..."
  torsocks git clone --depth=1 https://github.com/danielmiessler/SecLists.git \
    "${SECLISTS_DIR}" 2>>"${LOG}" \
  && log "SecLists installed at ${SECLISTS_DIR}" \
  || warn "SecLists clone failed (check Tor/network)"
else
  log "SecLists already present at ${SECLISTS_DIR}"
fi

# ── RockYou (classic password list) ──────────────────────────────────────────
ROCKYOU="${HOME_DIR}/wordlists/rockyou.txt"
if [[ ! -f "${ROCKYOU}" ]]; then
  log "Downloading rockyou.txt ..."
  torsocks curl -fsSL \
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
  log "Installing Metasploit Framework (5-10 min) ..."
  curl -fsSL https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb \
    > /tmp/msfinstall 2>>"${LOG}" \
  && chmod 755 /tmp/msfinstall \
  && /tmp/msfinstall 2>>"${LOG}" \
  && log "Metasploit installed." \
  || warn "Metasploit install failed"
else
  log "Metasploit already installed."
fi

# ── Sherlock (OSINT username search) ─────────────────────────────────────────
SHERLOCK_DIR="${HOME_DIR}/tools/sherlock"
if [[ ! -d "${SHERLOCK_DIR}" ]]; then
  log "Installing Sherlock ..."
  torsocks git clone --depth=1 https://github.com/sherlock-project/sherlock.git \
    "${SHERLOCK_DIR}" 2>>"${LOG}" \
  && pip3 install --no-cache-dir --break-system-packages -r "${SHERLOCK_DIR}/requirements.txt" 2>>"${LOG}" \
  && ln -sf "${SHERLOCK_DIR}/sherlock/sherlock.py" /usr/local/bin/sherlock \
  && chmod +x /usr/local/bin/sherlock \
  && log "Sherlock installed." \
  || warn "Sherlock install failed"
fi

# ── SQLMap (latest from git) ──────────────────────────────────────────────────
SQLMAP_DIR="${HOME_DIR}/tools/sqlmap"
if [[ ! -d "${SQLMAP_DIR}" ]]; then
  log "Installing SQLMap from git ..."
  torsocks git clone --depth=1 https://github.com/sqlmapproject/sqlmap.git \
    "${SQLMAP_DIR}" 2>>"${LOG}" \
  && ln -sf "${SQLMAP_DIR}/sqlmap.py" /usr/local/bin/sqlmapgit \
  && log "SQLMap (git) installed at ${SQLMAP_DIR}" \
  || warn "SQLMap git install failed"
fi

# ── BeEF (Browser Exploitation Framework) ─────────────────────────────────────
BEEF_DIR="${HOME_DIR}/tools/beef"
if [[ ! -d "${BEEF_DIR}" ]]; then
  log "Installing BeEF ..."
  torsocks git clone --depth=1 https://github.com/beefproject/beef.git \
    "${BEEF_DIR}" 2>>"${LOG}" \
  && cd "${BEEF_DIR}" \
  && bundle install 2>>"${LOG}" \
  && log "BeEF installed at ${BEEF_DIR}" \
  || warn "BeEF install failed (requires Ruby Bundler)"
fi

# ── impacket ─────────────────────────────────────────────────────────────────
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
log "  Ollama + uncensored models → ollama list"
log "    dolphin-mistral  (uncensored, no content filters)"
log "    dolphin-llama3   (uncensored Llama 3)"
log "    llama3.1:8b      (fast general purpose)"
log "  SecLists wordlists → ~/wordlists/SecLists"
log "  rockyou.txt        → ~/wordlists/rockyou.txt"
log "  Sherlock           → sherlock"
log "  SQLMap (git)       → ~/tools/sqlmap"
log "  Nuclei templates   → updated"
log "  BeEF               → ~/tools/beef"
log "  Metasploit         → msfconsole"
log ""
log "Unrestricted local AI usage:"
log "  agent-local        (dolphin-mistral — no content filters)"
log "  agent-local-l3     (dolphin-llama3 — uncensored Llama 3)"
log "  aider --model ollama/dolphin-mistral"
