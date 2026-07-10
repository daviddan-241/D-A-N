#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# bore tunnel watchdog — bore.pub connections can drop over time (idle
# timeouts, network blips). This loop checks every 15s and respawns bore if
# it's not running, rewriting ~/.dan_ssh_connect with the fresh port so the
# dashboard and `cat ~/.dan_ssh_connect` always show a working command.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

DEV_USER="${DEV_USER:-devuser}"
HOME_DIR="/home/${DEV_USER}"
LOG_DIR="${LOG_DIR:-/var/log/ssh-container}"
BORE_SECRET="${BORE_SECRET:-}"
CHECK_INTERVAL="${BORE_WATCHDOG_INTERVAL:-15}"
STATS_FILE="${LOG_DIR}/bore-watchdog-stats.json"

RESTART_COUNT=0

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [bore-watchdog] $*" >> "${LOG_DIR}/bore.log"; }

write_stats() {
  local status="$1"
  cat > "${STATS_FILE}" <<EOF
{"restartCount": ${RESTART_COUNT}, "lastRestartAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')", "status": "${status}"}
EOF
}

start_bore() {
  # Route bore through Tor for anonymity (same as entrypoint)
  local runner="bore"
  command -v torsocks &>/dev/null && runner="torsocks bore"

  local cmd=($runner local 22 --to bore.pub)
  [[ -n "${BORE_SECRET}" ]] && cmd+=(--secret "${BORE_SECRET}")
  log "starting: ${cmd[*]}"
  "${cmd[@]}" >>"${LOG_DIR}/bore.log" 2>&1 &
  BORE_PID=$!
  sleep 3
  if kill -0 "${BORE_PID}" 2>/dev/null; then
    local port
    port=$(grep -oP 'port \K[0-9]+' "${LOG_DIR}/bore.log" 2>/dev/null | tail -1 || echo "")
    if [[ -n "${port}" ]]; then
      echo "ssh -p ${port} ${DEV_USER}@bore.pub" > "${HOME_DIR}/.dan_ssh_connect"
      chown "${DEV_USER}:${DEV_USER}" "${HOME_DIR}/.dan_ssh_connect" 2>/dev/null || true
      log "bore up (PID ${BORE_PID}) — port ${port}"
      write_stats "up"
    else
      log "bore up (PID ${BORE_PID}) but port not yet found in log"
      write_stats "up-no-port"
    fi
  else
    log "bore failed to start — will retry next cycle"
    write_stats "failed"
  fi
}

log "watchdog starting (interval ${CHECK_INTERVAL}s)"
write_stats "watching"

while true; do
  if ! pgrep -x bore >/dev/null 2>&1; then
    RESTART_COUNT=$((RESTART_COUNT + 1))
    log "bore not running — restarting tunnel (restart #${RESTART_COUNT})"
    start_bore
  fi
  sleep "${CHECK_INTERVAL}"
done
