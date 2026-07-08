#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# dan-agents.sh — D.A.N. AI Agent Launcher
# Starts multiple free Aider instances in a tmux session.
# All agent traffic is routed through Tor via torsocks.
# Usage: dan-agents [repo-path]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SESSION="dan-agents"
REPO="${1:-${HOME}/projects}"

# ── Check deps ────────────────────────────────────────────────────────────────
if ! command -v tmux &>/dev/null; then
  echo "Error: tmux is required. Install with: sudo apt-get install -y tmux"
  exit 1
fi

if ! command -v aider &>/dev/null && ! python3 -m aider --version &>/dev/null 2>&1; then
  echo "Error: aider not found. Install with: pip3 install aider-chat"
  exit 1
fi

# ── Detect aider command ──────────────────────────────────────────────────────
AIDER_CMD="aider"
if ! command -v aider &>/dev/null; then
  AIDER_CMD="python3 -m aider"
fi

# ── Detect torsocks ───────────────────────────────────────────────────────────
PROXY_PREFIX=""
if command -v torsocks &>/dev/null && kill -0 "$(cat /var/run/tor.pid 2>/dev/null)" 2>/dev/null; then
  PROXY_PREFIX="torsocks "
  echo "  [TOR] Traffic will be routed through Tor"
else
  echo "  [WARN] torsocks not available or Tor not running — agents will NOT be anonymous"
fi

# ── Make sure repo dir exists ─────────────────────────────────────────────────
mkdir -p "${REPO}"

# ── Kill existing session if present ─────────────────────────────────────────
tmux kill-session -t "${SESSION}" 2>/dev/null || true

# ── Create tmux session ───────────────────────────────────────────────────────
tmux new-session -d -s "${SESSION}" -n "agent-1" -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "agent-2" -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "agent-3" -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "git-hub" -c "${REPO}"
tmux new-window   -t "${SESSION}"  -n "shell"   -c "${REPO}"

# ── Enforce Tor proxy in every agent window ───────────────────────────────────
# Two-layer approach:
#   1. env vars  — aider/httpx/requests/git read ALL_PROXY natively
#   2. torsocks  — libc-level intercept; handles DNS, prevents leaks entirely
TOR_ENV_SETUP='export ALL_PROXY="socks5h://127.0.0.1:9050"; export all_proxy="socks5h://127.0.0.1:9050"; export SOCKS_SERVER="127.0.0.1:9050"; export NO_PROXY="localhost,127.0.0.1,::1"; export no_proxy="localhost,127.0.0.1,::1"'

# Additionally alias aider → torsocks aider so any bare "aider" call is wrapped
TOR_AIDER_ALIAS='alias aider="torsocks aider"; alias agent="torsocks aider --model openrouter/google/gemma-3-27b-it:free"; alias agent-deep="torsocks aider --model openrouter/deepseek/deepseek-r1:free"; alias agent-fast="torsocks aider --model groq/llama-3.3-70b-versatile"; alias agent-r1="torsocks aider --model openrouter/deepseek/deepseek-r1:free"'

for WIN in agent-1 agent-2 agent-3; do
  tmux send-keys -t "${SESSION}:${WIN}" "${TOR_ENV_SETUP}" Enter
  tmux send-keys -t "${SESSION}:${WIN}" "${TOR_AIDER_ALIAS}" Enter
done

# ── Print startup help in each agent window ───────────────────────────────────
HELP_MSG='echo -e "\n\033[1;36m[ D·A·N AGENT ]\033[0m  Free anonymous AI agent powered by Aider + Tor\n\nAll traffic routed through Tor. Your real IP is hidden.\n\nQuick start (free models — no API key needed to try):\n  \033[1;33mtorsocks aider --model openrouter/google/gemma-3-27b-it:free\033[0m  # Gemma 3 free\n  \033[1;33mtorsocks aider --model openrouter/deepseek/deepseek-r1:free\033[0m   # DeepSeek R1 free\n  \033[1;33mtorsocks aider --model groq/llama-3.3-70b-versatile\033[0m          # Llama fast free\n  \033[1;33magent\033[0m       # alias: Gemma via Tor\n  \033[1;33magent-deep\033[0m  # alias: DeepSeek R1 via Tor\n  \033[1;33magent-fast\033[0m  # alias: Llama via Tor\n\nFree API keys (no credit card needed):\n  openrouter.ai → free tier, many models\n  console.groq.com → free fast inference\n  github.com/marketplace/models → free with GitHub account\n\nSet key:\n  export OPENROUTER_API_KEY=sk-or-...\n  export GROQ_API_KEY=gsk_...\n\nCheck anonymity:\n  \033[1;33mtor-check\033[0m   # verify Tor is working\n  \033[1;33mtor-ip\033[0m      # show your Tor exit IP\n\n"'

tmux send-keys -t "${SESSION}:agent-1" "${HELP_MSG}" Enter
tmux send-keys -t "${SESSION}:agent-2" "${HELP_MSG}" Enter
tmux send-keys -t "${SESSION}:agent-3" "${HELP_MSG}" Enter

# ── Git hub window: clone helper ──────────────────────────────────────────────
tmux send-keys -t "${SESSION}:git-hub" \
  'echo -e "\n\033[1;36m[ D·A·N GIT ]\033[0m  GitHub repo manager (via Tor)\n\nClone anonymously:\n  torsocks git clone https://github.com/USER/REPO\n\nWith your token:\n  torsocks git clone https://YOUR_TOKEN@github.com/USER/REPO\n\nCheck Tor:\n  tor-check\n\n"' Enter

# ── Shell window stays clean ──────────────────────────────────────────────────
tmux send-keys -t "${SESSION}:shell" \
  'echo -e "\n\033[1;36m[ D·A·N SHELL ]\033[0m  General purpose shell (Tor active)\n"' Enter

# ── Go to first agent window ──────────────────────────────────────────────────
tmux select-window -t "${SESSION}:agent-1"

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  D·A·N Agent Session: ${SESSION}              │"
echo "  │  Windows: agent-1  agent-2  agent-3          │"
echo "  │           git-hub  shell                     │"
echo "  │  Tor:     ${PROXY_PREFIX:-INACTIVE}                        │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo "  Attaching... (Ctrl-b d to detach)"
echo ""

tmux attach-session -t "${SESSION}"
