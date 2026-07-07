#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# dan-agents.sh — D.A.N. AI Agent Launcher
# Starts multiple free Aider instances in a tmux session.
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

# ── Print startup help in each agent window ───────────────────────────────────
HELP_MSG='echo -e "\n\033[1;36m[ D·A·N AGENT ]\033[0m  Free AI agent powered by Aider\n\nQuick start:\n  \033[1;33maider\033[0m                          # uses default model (set OPENAI_API_KEY or OPENROUTER_API_KEY)\n  \033[1;33maider --model openrouter/google/gemma-3-27b-it:free\033[0m  # free via OpenRouter\n  \033[1;33maider --model openrouter/deepseek/deepseek-r1:free\033[0m   # DeepSeek R1 free\n  \033[1;33maider --model groq/llama-3.3-70b-versatile\033[0m          # fast free via Groq\n\nSet your key first:\n  export OPENROUTER_API_KEY=sk-or-...   # get free key: openrouter.ai\n  export GROQ_API_KEY=gsk_...           # get free key: console.groq.com\n  export GITHUB_TOKEN=ghp_...           # GitHub Models (free with GitHub)\n\nMulti-repo:\n  cd ~/projects && git clone https://github.com/you/repo && cd repo && aider\n\n"'

tmux send-keys -t "${SESSION}:agent-1" "${HELP_MSG}" Enter
tmux send-keys -t "${SESSION}:agent-2" "${HELP_MSG}" Enter
tmux send-keys -t "${SESSION}:agent-3" "${HELP_MSG}" Enter

# ── Git hub window: clone helper ──────────────────────────────────────────────
tmux send-keys -t "${SESSION}:git-hub" \
  'echo -e "\n\033[1;36m[ D·A·N GIT ]\033[0m  GitHub repo manager\n\nClone a repo:\n  git clone https://github.com/USER/REPO\n\nWith your token:\n  git clone https://YOUR_TOKEN@github.com/USER/REPO\n\nList your repos (requires gh CLI):\n  gh repo list\n\n"' Enter

# ── Shell window stays clean ──────────────────────────────────────────────────
tmux send-keys -t "${SESSION}:shell" \
  'echo -e "\n\033[1;36m[ D·A·N SHELL ]\033[0m  General purpose shell\n"' Enter

# ── Go to first agent window ──────────────────────────────────────────────────
tmux select-window -t "${SESSION}:agent-1"

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  D·A·N Agent Session: ${SESSION}              │"
echo "  │  Windows: agent-1  agent-2  agent-3          │"
echo "  │           git-hub  shell                     │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo "  Attaching... (Ctrl-b d to detach)"
echo ""

tmux attach-session -t "${SESSION}"
