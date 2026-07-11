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

# ── Aider AI coding assistant ────────────────────────────────────────────────
if ! command -v aider &>/dev/null; then
  log "Installing aider (AI coding assistant) ..."
  pip3 install --no-cache-dir --break-system-packages aider-chat 2>>"${LOG}" \
    && log "  aider installed: $(aider --version 2>/dev/null || echo 'ok')" \
    || warn "  aider pip install failed"
else
  log "aider already installed: $(aider --version 2>/dev/null || true)"
fi

# ── Web browsing tools (text-mode: w3m, lynx, ddgr) ──────────────────────────
log "Installing text-mode web tools (w3m, lynx, ddgr) ..."
apt-get install -y --no-install-recommends w3m lynx 2>>"${LOG}" \
  && log "  w3m + lynx installed" \
  || warn "  w3m/lynx install failed"

pip3 install --no-cache-dir --break-system-packages ddgr 2>>"${LOG}" \
  && log "  ddgr (DuckDuckGo CLI) installed" \
  || warn "  ddgr install failed"

# ── Playwright + Chromium ─────────────────────────────────────────────────────
# Now baked into the image at build time (Dockerfile) so browser automation
# works immediately on connect. Only fall back to installing here if the
# build-time install didn't happen (e.g. an older image).
if command -v playwright &>/dev/null || python3 -m playwright --version &>/dev/null 2>&1; then
  log "Playwright already installed (build-time) — skipping."
else
  warn "Playwright missing — build-time install must have failed. Installing now (slow) ..."
  pip3 install --no-cache-dir --break-system-packages playwright 2>>"${LOG}" \
    && python3 -m playwright install --with-deps chromium 2>>"${LOG}" \
    && log "  Playwright + Chromium installed" \
    || warn "  Playwright/Chromium fallback install failed — browser automation unavailable"
fi

# Install the browser-auto.py wrapper to a system path
if [[ -f /scripts/browser-auto.py ]]; then
  chmod +x /scripts/browser-auto.py
  log "  browser-auto.py installed at /scripts/browser-auto.py"
  log "  Shell commands: browser <url> | browser-click <url> <sel> | browser-fill ..."
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

# ── Metasploit / Sherlock / SQLMap (git) ──────────────────────────────────────
# These are now baked into the image at build time (see Dockerfile) so they're
# available the instant the container boots — no waiting after SSH connect.
# Only fall back to installing here if the build-time step somehow didn't run.
if command -v msfconsole &>/dev/null; then
  log "Metasploit already installed (build-time)."
else
  warn "msfconsole missing — build-time install must have failed. Installing now (5-10 min) ..."
  curl -fsSL https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb \
    > /tmp/msfinstall 2>>"${LOG}" \
  && chmod 755 /tmp/msfinstall \
  && /tmp/msfinstall 2>>"${LOG}" \
  && log "Metasploit installed." \
  || warn "Metasploit install failed"
fi

if command -v sherlock &>/dev/null; then
  log "Sherlock already installed (build-time)."
else
  warn "sherlock missing — build-time install must have failed. Installing now ..."
  SHERLOCK_DIR="${HOME_DIR}/tools/sherlock"
  torsocks git clone --depth=1 https://github.com/sherlock-project/sherlock.git \
    "${SHERLOCK_DIR}" 2>>"${LOG}" \
  && pip3 install --no-cache-dir --break-system-packages -r "${SHERLOCK_DIR}/requirements.txt" 2>>"${LOG}" \
  && ln -sf "${SHERLOCK_DIR}/sherlock/sherlock.py" /usr/local/bin/sherlock \
  && chmod +x /usr/local/bin/sherlock \
  && log "Sherlock installed." \
  || warn "Sherlock install failed"
fi

if command -v sqlmapgit &>/dev/null || [[ -f /opt/sqlmap/sqlmap.py ]]; then
  log "SQLMap (git) already installed (build-time)."
else
  warn "sqlmapgit missing — build-time install must have failed. Installing now ..."
  SQLMAP_DIR="${HOME_DIR}/tools/sqlmap"
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
chown -R "$(id -u "${DEV_USER}" 2>/dev/null || echo 1000):$(id -g "${DEV_USER}" 2>/dev/null || echo 1000)" "${HOME_DIR}"

# ── Mark complete ─────────────────────────────────────────────────────────────
touch "${INSTALL_FLAG}"
chown "$(id -u "${DEV_USER}" 2>/dev/null || echo 1000):$(id -g "${DEV_USER}" 2>/dev/null || echo 1000)" "${INSTALL_FLAG}"

log "=== D.A.N. first-boot install complete ==="
log "Tools baked into the image (available instantly, no wait):"
log "  Metasploit, Sherlock, SQLMap (git), Playwright+Chromium,"
log "  nmap/hydra/hashcat/john/nikto/theHarvester/recon-ng and the rest of the apt security set"
log "Tools installed by this background job:"
log "  Ollama + uncensored models → ollama list"
log "    dolphin-mistral  (uncensored, no content filters)"
log "    dolphin-llama3   (uncensored Llama 3)"
log "    llama3.1:8b      (fast general purpose)"
log "  SecLists wordlists → ~/wordlists/SecLists"
log "  rockyou.txt        → ~/wordlists/rockyou.txt"
log "  Nuclei templates   → updated"
log "  BeEF               → ~/tools/beef"
log ""
log "Unrestricted local AI usage:"
log "  agent-local        (dolphin-mistral — no content filters)"
log "  agent-local-l3     (dolphin-llama3 — uncensored Llama 3)"
log "  aider --model ollama/dolphin-mistral"
