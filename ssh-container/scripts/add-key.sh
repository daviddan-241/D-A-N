#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# add-key.sh — add an SSH public key to the running devbox container
# Usage: ./scripts/add-key.sh [public_key_file]
#        ./scripts/add-key.sh ~/.ssh/id_ed25519.pub
#        cat ~/.ssh/id_ed25519.pub | ./scripts/add-key.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="${CONTAINER_NAME:-devbox}"
DEV_USER="${DEV_USER:-devuser}"
AUTH_KEYS="/home/${DEV_USER}/.ssh/authorized_keys"

# Read key from argument or stdin
if [[ $# -ge 1 ]]; then
  KEY_FILE="$1"
  if [[ ! -f "${KEY_FILE}" ]]; then
    echo "Error: file '${KEY_FILE}' not found" >&2
    exit 1
  fi
  PUBLIC_KEY=$(cat "${KEY_FILE}")
else
  echo "Paste your public key (then press Enter + Ctrl+D):"
  PUBLIC_KEY=$(cat)
fi

# Validate it looks like a public key
if ! echo "${PUBLIC_KEY}" | grep -qE '^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp|sk-)'; then
  echo "Error: input does not look like a valid SSH public key" >&2
  exit 1
fi

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: container '${CONTAINER}' is not running." >&2
  echo "Start it with: docker compose up -d" >&2
  exit 1
fi

# Append key if not already present
EXISTING=$(docker exec "${CONTAINER}" cat "${AUTH_KEYS}" 2>/dev/null || echo "")
FINGERPRINT=$(echo "${PUBLIC_KEY}" | ssh-keygen -lf /dev/stdin 2>/dev/null | awk '{print $2}' || echo "unknown")

if echo "${EXISTING}" | grep -qF "${PUBLIC_KEY}"; then
  echo "Key already present (fingerprint: ${FINGERPRINT}). No changes made."
  exit 0
fi

echo "${PUBLIC_KEY}" | docker exec -i "${CONTAINER}" bash -c "cat >> ${AUTH_KEYS}"
echo "✓ Key added (fingerprint: ${FINGERPRINT})"
echo "  Connect with: ssh -p \${SSH_PORT:-2222} ${DEV_USER}@<host>"

# Show key count
KEY_COUNT=$(docker exec "${CONTAINER}" grep -c 'ssh-' "${AUTH_KEYS}" 2>/dev/null || echo "?")
echo "  Total authorized keys: ${KEY_COUNT}"
