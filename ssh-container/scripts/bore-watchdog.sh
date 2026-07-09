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

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [bore-watchdog] $*" >> "${LOG_DIR}/bore.log"; }

start_bore() {
  local cmd=(bore local 22 --to bore.pub)
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
    else
      log "bore up (PID ${BORE_PID}) but port not yet found in log"
    fi
  else
    log "bore failed to start — will retry next cycle"
  fi
}

log "watchdog starting (interval ${CHECK_INTERVAL}s)"

while true; do
  if ! pgrep -x bore >/dev/null 2>&1; then
    log "bore not running — restarting tunnel"
    start_bore
  fi
  sleep "${CHECK_INTERVAL}"
done
