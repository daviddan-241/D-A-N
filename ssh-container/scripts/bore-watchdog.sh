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

extract_port() {
  grep -oP '(?:remote_port=|bore\.pub:|port[ =])\K[0-9]+' "${LOG_DIR}/bore.log" 2>/dev/null | tail -1
}

# Tracks whether the last successful start used Tor or went direct, so
# repeated restarts don't keep retrying a Tor path that bore.pub is actively
# refusing (many public relays block Tor exit nodes as anti-abuse policy).
# Once a direct connection is needed, stick with direct.
LAST_MODE_FILE="${LOG_DIR}/.bore-last-mode"
FORCE_DIRECT=0
[[ -f "${LAST_MODE_FILE}" && "$(cat "${LAST_MODE_FILE}" 2>/dev/null)" == "direct" ]] && FORCE_DIRECT=1

start_bore() {
  local cmd_base=(local 22 --to bore.pub)
  [[ -n "${BORE_SECRET}" ]] && cmd_base+=(--secret "${BORE_SECRET}")
  local mode="direct"
  local pid=""

  if [[ "${FORCE_DIRECT}" -eq 0 ]] && command -v torsocks &>/dev/null; then
    log "starting: torsocks bore ${cmd_base[*]}"
    torsocks bore "${cmd_base[@]}" >>"${LOG_DIR}/bore.log" 2>&1 &
    pid=$!
    sleep 4
    if kill -0 "${pid}" 2>/dev/null && [[ -n "$(extract_port)" ]]; then
      mode="tor"
    else
      log "bore via Tor failed (bore.pub likely blocks Tor exit nodes) — switching to direct for future restarts"
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
      pid=""
      FORCE_DIRECT=1
    fi
  fi

  if [[ -z "${pid}" ]]; then
    log "starting: bore ${cmd_base[*]}"
    bore "${cmd_base[@]}" >>"${LOG_DIR}/bore.log" 2>&1 &
    pid=$!
    sleep 3
    kill -0 "${pid}" 2>/dev/null || pid=""
  fi

  BORE_PID="${pid}"
  if [[ -n "${pid}" ]]; then
    echo "${mode}" > "${LAST_MODE_FILE}" 2>/dev/null || true
    local port
    port=$(extract_port)
    if [[ -n "${port}" ]]; then
      echo "ssh -p ${port} ${DEV_USER}@bore.pub" > "${HOME_DIR}/.dan_ssh_connect"
      chown "${DEV_USER}:${DEV_USER}" "${HOME_DIR}/.dan_ssh_connect" 2>/dev/null || true
      log "bore up (PID ${pid}, mode: ${mode}) — port ${port}"
      write_stats "up"
    else
      log "bore up (PID ${pid}, mode: ${mode}) but port not yet found in log"
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
