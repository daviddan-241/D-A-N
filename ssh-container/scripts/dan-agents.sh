#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# dan-agents.sh — D.A.N. AI Agent Launcher
# Starts multiple free, anonymous, memory-enabled Aider instances in tmux.
# All traffic routed through Tor. Persistent memory loaded automatically.
# Usage: dan-agents [repo-path]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SESSION="dan-agents"
REPO="${1:-${HOME}/projects}"
MEMORY_FILE="${HOME}/agent-memory/MEMORY.md"

# ── Check deps ────────────────────────────────────────────────────────────────
if ! command -v tmux &>/dev/null; then
  echo "Error: tmux is required. Install with: sudo apt-get install -y tmux"
  exit 1
fi

if ! command -v aider &>/dev/null && ! python3 -m aider --version &>/dev/null 2>&1; then
  echo "Error: aider not found. Install with: pip3 install aider-chat"
  exit 1
fi

AIDER_CMD="aider"
! command -v aider &>/dev/null && AIDER_CMD="python3 -m aider"

# ── Tor check ─────────────────────────────────────────────────────────────────
TOR_ACTIVE=false
if command -v torsocks &>/dev/null && kill -0 "$(cat /var/run/tor.pid 2>/dev/null)" 2>/dev/null; then
  TOR_ACTIVE=true
  echo "  [TOR] ✓ Anonymized — all agent traffic through Tor"
else
  echo "  [WARN] Tor not running — agents will NOT be anonymous"
fi

# ── Ollama check ──────────────────────────────────────────────────────────────
OLLAMA_READY=false
if command -v ollama &>/dev/null && ollama list 2>/dev/null | grep -q "dolphin"; then
  OLLAMA_READY=true
  echo "  [OLLAMA] ✓ Local uncensored models available"
fi

# ── Initialise agent memory ───────────────────────────────────────────────────
bash /scripts/agent-memory.sh init 2>/dev/null || true
MEMORY_FLAG=""
if [[ -f "${MEMORY_FILE}" ]]; then
  MEMORY_FLAG="--read ${MEMORY_FILE}"
  echo "  [MEMORY] ✓ Persistent memory loaded from ${MEMORY_FILE}"
fi

# ── Build aider command with memory ──────────────────────────────────────────
# Free online unrestricted models (Tor-routed)
AIDER_FREE="torsocks ${AIDER_CMD} --model openrouter/deepseek/deepseek-r1:free ${MEMORY_FLAG}"
AIDER_FAST="torsocks ${AIDER_CMD} --model groq/llama-3.3-70b-versatile ${MEMORY_FLAG}"
AIDER_GH="torsocks ${AIDER_CMD} --model github/gpt-4o ${MEMORY_FLAG}"

# Local uncensored (no API key, no content filters, no Tor needed)
AIDER_LOCAL="ollama run dolphin-mistral"
AIDER_LOCAL_CODE="${AIDER_CMD} --model ollama/dolphin-mistral ${MEMORY_FLAG}"
if [[ "${OLLAMA_READY}" == "false" ]]; then
  AIDER_LOCAL_CODE="${AIDER_FREE}"  # fallback to online
fi

# ── Make sure repo dir exists ─────────────────────────────────────────────────
mkdir -p "${REPO}"

# ── Kill existing session ─────────────────────────────────────────────────────
tmux kill-session -t "${SESSION}" 2>/dev/null || true

# ── Create tmux session ───────────────────────────────────────────────────────
tmux new-session -d -s "${SESSION}" -n "agent-free"   -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "agent-local"  -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "agent-fast"   -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "memory"       -c "${HOME}/agent-memory"
tmux new-window   -t "${SESSION}"  -n "git"          -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "shell"        -c "${REPO}"

# ── Enforce Tor + memory env in every pane ────────────────────────────────────
TOR_ENV='export ALL_PROXY="socks5h://127.0.0.1:9050"; export all_proxy="socks5h://127.0.0.1:9050"; export NO_PROXY="localhost,127.0.0.1,::1"; export no_proxy="localhost,127.0.0.1,::1"'
MEMORY_SOURCE='source /scripts/agent-memory.sh 2>/dev/null || true'
AIDER_ALIAS='alias aider="torsocks aider"; alias agent="torsocks aider --model openrouter/deepseek/deepseek-r1:free"; alias agent-fast="torsocks aider --model groq/llama-3.3-70b-versatile"; alias agent-local="aider --model ollama/dolphin-mistral"'

for WIN in agent-free agent-local agent-fast git shell; do
  tmux send-keys -t "${SESSION}:${WIN}" "${TOR_ENV}" Enter
  tmux send-keys -t "${SESSION}:${WIN}" "${MEMORY_SOURCE}" Enter
  tmux send-keys -t "${SESSION}:${WIN}" "${AIDER_ALIAS}" Enter
done

# ── agent-free: DeepSeek R1 via Tor + memory ─────────────────────────────────
tmux send-keys -t "${SESSION}:agent-free" \
'echo -e "\n\033[1;36m[ AGENT-FREE ]\033[0m  DeepSeek R1 (free) + Tor + persistent memory\n\nCommands:\n  \033[1;33magent\033[0m              → DeepSeek R1 (free, Tor-routed)\n  \033[1;33magent-fast\033[0m         → Llama 3.3 70B (free, fast)\n  \033[1;33mremember \"note\"\033[0m    → save to persistent memory\n  \033[1;33mrecall keyword\033[0m     → search memory\n  \033[1;33mtor-check\033[0m          → verify anonymity\n\nMemory file: ~/agent-memory/MEMORY.md (auto-loaded into each session)\n"' Enter

# ── agent-local: uncensored local model ──────────────────────────────────────
tmux send-keys -t "${SESSION}:agent-local" \
'echo -e "\n\033[1;35m[ AGENT-LOCAL ]\033[0m  Uncensored local AI — no API key, no content filters\n\nCommands:\n  \033[1;33magent-local\033[0m        → dolphin-mistral (uncensored Mistral)\n  \033[1;33mollama run dolphin-mistral\033[0m → raw chat\n  \033[1;33mollama list\033[0m        → show available local models\n\n  If Ollama not installed: AUTO_INSTALL_EXTRAS=yes restarts will install it\n  Or manually: curl https://ollama.ai/install.sh | sh && ollama pull dolphin-mistral\n"' Enter

# ── agent-fast: Groq (fast inference) ────────────────────────────────────────
tmux send-keys -t "${SESSION}:agent-fast" \
'echo -e "\n\033[1;33m[ AGENT-FAST ]\033[0m  Groq (fast Llama 3.3 70B) via Tor\n\nSet key: \033[1;33mexport GROQ_API_KEY=gsk_...\033[0m  (free at console.groq.com)\nThen:    \033[1;33magent-fast\033[0m\n"' Enter

# ── memory window ─────────────────────────────────────────────────────────────
tmux send-keys -t "${SESSION}:memory" \
'echo -e "\n\033[1;32m[ MEMORY ]\033[0m  Agent persistent memory\n\nCommands:\n  \033[1;33mmemory\033[0m            → show full memory\n  \033[1;33mremember \"note\"\033[0m   → add note\n  \033[1;33mrecall keyword\033[0m    → search\n  \033[1;33mmemory edit\033[0m       → open in vim\n  \033[1;33mmemory sync\033[0m       → push to GitHub\n  \033[1;33magent-save name\033[0m   → snapshot project context\n  \033[1;33magent-context name\033[0m → load project context\n"; cat ~/agent-memory/MEMORY.md 2>/dev/null || echo "(memory not yet initialised)"' Enter

# ── git window ────────────────────────────────────────────────────────────────
tmux send-keys -t "${SESSION}:git" \
'echo -e "\n\033[1;36m[ GIT ]\033[0m  Anonymous git via Tor\n\n  \033[1;33mtorsocks git clone https://github.com/USER/REPO\033[0m\n  \033[1;33mtorsocks git push\033[0m\n  \033[1;33mtorsocks git pull\033[0m\n"' Enter

tmux select-window -t "${SESSION}:agent-free"

echo ""
echo "  ┌───────────────────────────────────────────────────────┐"
echo "  │  D·A·N Agent Session: ${SESSION}                        │"
echo "  │                                                       │"
echo "  │  agent-free  → DeepSeek R1 (free, Tor-routed)        │"
echo "  │  agent-local → dolphin-mistral (uncensored, offline)  │"
echo "  │  agent-fast  → Llama 3.3 70B via Groq (fast)         │"
echo "  │  memory      → persistent memory viewer/editor        │"
echo "  │  git         → anonymous git operations               │"
echo "  │  shell       → general shell                          │"
echo "  │                                                       │"
echo "  │  Tor: $([ "${TOR_ACTIVE}" == "true" ] && echo "ACTIVE ✓" || echo "INACTIVE ✗")                                  │"
echo "  │  Ollama: $([ "${OLLAMA_READY}" == "true" ] && echo "READY ✓" || echo "installing... (check auto-install log)") │"
echo "  │  Memory: ${MEMORY_FILE}         │"
echo "  └───────────────────────────────────────────────────────┘"
echo ""
echo "  Attaching... (Ctrl-b d to detach, Ctrl-b <n> to switch windows)"
echo ""

tmux attach-session -t "${SESSION}"
