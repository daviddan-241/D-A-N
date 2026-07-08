#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# agent-memory.sh — D.A.N. Persistent Agent Memory System
# Gives aider and all AI agents a persistent memory that survives across
# sessions, reboots, and container restarts (via GitHub persistence).
#
# Usage:
#   remember "I found SQL injection in /api/users — use ' OR 1=1--"
#   recall sql
#   memory              (show full MEMORY.md)
#   memory-edit         (open MEMORY.md in vim)
#   agent-context <dir> (show context for a project dir)
#   agent-save <name>   (save current session as named context)
# ─────────────────────────────────────────────────────────────────────────────

MEMORY_DIR="${HOME}/agent-memory"
MEMORY_FILE="${MEMORY_DIR}/MEMORY.md"
SESSION_LOG="${MEMORY_DIR}/session-log.md"
CONTEXT_DIR="${MEMORY_DIR}/context"
SCRATCH_DIR="${MEMORY_DIR}/scratch"

# ── Initialise directory structure ────────────────────────────────────────────
init_memory() {
  mkdir -p "${MEMORY_DIR}" "${CONTEXT_DIR}" "${SCRATCH_DIR}"

  if [[ ! -f "${MEMORY_FILE}" ]]; then
    cat > "${MEMORY_FILE}" << 'EOF'
# D.A.N. Agent Memory

This file is automatically loaded into every aider session via `--read`.
Add notes here with: `remember "your note"`
Search notes with: `recall <keyword>`

## How to use
- `remember "note"` — append a timestamped note
- `recall <keyword>` — search notes
- `agent-save <name>` — snapshot current project context
- `agent-context <dir>` — load project-specific context

## Persistent Notes
<!-- Agent appends below this line -->

EOF
    echo "[memory] Initialised ${MEMORY_FILE}"
  fi

  if [[ ! -f "${SESSION_LOG}" ]]; then
    cat > "${SESSION_LOG}" << 'EOF'
# D.A.N. Session Log

Chronological record of all agent sessions.
<!-- Sessions appended below -->

EOF
  fi
}

# ── remember: append a note ───────────────────────────────────────────────────
remember() {
  init_memory
  local note="$*"
  if [[ -z "${note}" ]]; then
    echo "Usage: remember <note>"
    return 1
  fi
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- [${ts}] ${note}" >> "${MEMORY_FILE}"
  echo "✓ Saved to ${MEMORY_FILE}"
}

# ── recall: search memory ─────────────────────────────────────────────────────
recall() {
  init_memory
  local query="$*"
  if [[ -z "${query}" ]]; then
    cat "${MEMORY_FILE}"
    return 0
  fi
  echo "=== Memory results for: ${query} ==="
  grep -i --color=always "${query}" "${MEMORY_FILE}" 2>/dev/null || \
    echo "  (nothing found for '${query}')"
}

# ── memory: show or edit ──────────────────────────────────────────────────────
memory() {
  init_memory
  if [[ "${1:-}" == "edit" ]] || [[ "${1:-}" == "-e" ]]; then
    "${EDITOR:-vim}" "${MEMORY_FILE}"
  elif [[ "${1:-}" == "clear" ]]; then
    read -rp "Clear all memory? [y/N] " confirm
    [[ "${confirm}" == "y" ]] && echo "" > "${MEMORY_FILE}" && echo "✓ Cleared"
  elif [[ "${1:-}" == "sync" ]]; then
    bash /scripts/dotfiles-sync.sh && echo "✓ Memory synced to GitHub"
  else
    cat "${MEMORY_FILE}"
  fi
}

# ── agent-save: snapshot context ─────────────────────────────────────────────
agent_save() {
  init_memory
  local name="${1:-unnamed}"
  local ctx_file="${CONTEXT_DIR}/${name}.md"
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  {
    echo "# Context: ${name}"
    echo "Saved: ${ts}"
    echo "CWD: $(pwd)"
    echo ""
    echo "## Git status"
    git log --oneline -10 2>/dev/null || echo "(not a git repo)"
    echo ""
    echo "## Recent commands"
    history 20 2>/dev/null || true
    echo ""
    echo "## Files in CWD"
    ls -la 2>/dev/null || true
  } > "${ctx_file}"

  echo "✓ Context saved to ${ctx_file}"
  remember "Saved context '${name}' at $(pwd)"
}

# ── agent-context: load project context ──────────────────────────────────────
agent_context() {
  init_memory
  local target="${1:-$(basename "$(pwd)")}"
  local ctx_file="${CONTEXT_DIR}/${target}.md"

  if [[ -f "${ctx_file}" ]]; then
    cat "${ctx_file}"
  else
    echo "No saved context for '${target}'"
    echo "Available contexts:"
    ls "${CONTEXT_DIR}/" 2>/dev/null | sed 's/.md$//' | sed 's/^/  /'
  fi
}

# ── log-session: append to session log ───────────────────────────────────────
log_session() {
  init_memory
  local model="${1:-unknown}"
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "## Session ${ts} | model: ${model} | dir: $(pwd)" >> "${SESSION_LOG}"
  echo "  TOR_IP: $(curl --socks5-hostname 127.0.0.1:9050 --max-time 5 -s https://api.ipify.org 2>/dev/null || echo 'unknown')" >> "${SESSION_LOG}"
  echo "" >> "${SESSION_LOG}"
}

# Export functions so subshells (tmux panes) get them
export -f init_memory remember recall memory agent_save agent_context log_session 2>/dev/null || true

# ── CLI dispatch ──────────────────────────────────────────────────────────────
case "${1:-}" in
  init)    init_memory ;;
  remember) shift; remember "$@" ;;
  recall)   shift; recall "$@" ;;
  memory)   shift; memory "$@" ;;
  save)     shift; agent_save "$@" ;;
  context)  shift; agent_context "$@" ;;
  log)      shift; log_session "$@" ;;
  *)
    # When sourced (not executed), just define functions
    if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
      echo "Usage: agent-memory <command> [args]"
      echo "  init                — create memory directory"
      echo "  remember <note>     — save a note"
      echo "  recall <keyword>    — search notes"
      echo "  memory [edit|clear|sync] — view/edit memory"
      echo "  save <name>         — snapshot project context"
      echo "  context <name>      — load project context"
    fi
    ;;
esac
