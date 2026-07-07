#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# list-keys.sh — list authorized SSH public keys in the running devbox
# Usage: ./scripts/list-keys.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="${CONTAINER_NAME:-devbox}"
DEV_USER="${DEV_USER:-devuser}"
AUTH_KEYS="/home/${DEV_USER}/.ssh/authorized_keys"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: container '${CONTAINER}' is not running." >&2
  exit 1
fi

echo "Authorized keys for ${DEV_USER} in container ${CONTAINER}:"
echo "─────────────────────────────────────────────────────────"

KEYS=$(docker exec "${CONTAINER}" grep -E '^(ssh-|ecdsa-)' "${AUTH_KEYS}" 2>/dev/null || true)

if [[ -z "${KEYS}" ]]; then
  echo "(no keys installed)"
  exit 0
fi

N=0
while IFS= read -r key; do
  N=$((N+1))
  FINGERPRINT=$(echo "${key}" | ssh-keygen -lf /dev/stdin 2>/dev/null || echo "unreadable")
  COMMENT=$(echo "${key}" | awk '{print $3}')
  TYPE=$(echo "${key}" | awk '{print $1}')
  echo "  [${N}] ${TYPE}  ${FINGERPRINT}  ${COMMENT}"
done <<< "${KEYS}"

echo "─────────────────────────────────────────────────────────"
echo "Total: ${N} key(s)"
