#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# remove-key.sh — remove an authorized SSH public key from the running devbox
# Usage: ./scripts/remove-key.sh
#        Presents a numbered list; you pick which key to remove.
#
# Security: deletion is by line-number (not content-grep), so key content
# cannot be interpreted as shell patterns or commands.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="${CONTAINER_NAME:-devbox}"
DEV_USER="${DEV_USER:-devuser}"
AUTH_KEYS="/home/${DEV_USER}/.ssh/authorized_keys"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: container '${CONTAINER}' is not running." >&2
  echo "Start it with: docker compose up -d" >&2
  exit 1
fi

# Fetch every ssh key line, preserving its file line number (needed for safe deletion)
# Format from docker exec: "<file_lineno> <key_type> <pubkey_blob> [comment]"
KEYED_LINES=$(docker exec "${CONTAINER}" \
  grep -nE '^(ssh-|ecdsa-|sk-)' "${AUTH_KEYS}" 2>/dev/null || true)

if [[ -z "${KEYED_LINES}" ]]; then
  echo "No authorized keys installed. Nothing to remove."
  exit 0
fi

# Build indexed arrays of (file_lineno, display_fingerprint, display_comment)
declare -a FILE_LINENOS=()
declare -a FINGERPRINTS=()
declare -a COMMENTS=()

while IFS= read -r entry; do
  [[ -z "${entry}" ]] && continue
  FILE_LNO="${entry%%:*}"
  KEY_CONTENT="${entry#*:}"
  FILE_LINENOS+=("${FILE_LNO}")
  # Compute fingerprint: feed the key through ssh-keygen on the host
  FP=$(echo "${KEY_CONTENT}" | ssh-keygen -lf /dev/stdin 2>/dev/null | awk '{print $2}' || echo "unreadable")
  FINGERPRINTS+=("${FP}")
  CMT=$(echo "${KEY_CONTENT}" | awk '{print $3}')
  COMMENTS+=("${CMT:-<no comment>}")
done <<< "${KEYED_LINES}"

if [[ ${#FILE_LINENOS[@]} -eq 0 ]]; then
  echo "No authorized keys found."
  exit 0
fi

echo "Authorized keys in ${CONTAINER}:"
echo "─────────────────────────────────────────────────────────────────"
for i in "${!FILE_LINENOS[@]}"; do
  printf "  [%d] %s  %s\n" "$((i+1))" "${FINGERPRINTS[$i]}" "${COMMENTS[$i]}"
done
echo "─────────────────────────────────────────────────────────────────"
echo ""
read -rp "Enter the number of the key to remove (or 'q' to quit): " CHOICE

if [[ "${CHOICE}" == "q" || "${CHOICE}" == "Q" ]]; then
  echo "Aborted."
  exit 0
fi

if ! [[ "${CHOICE}" =~ ^[0-9]+$ ]] || \
   [[ "${CHOICE}" -lt 1 ]] || \
   [[ "${CHOICE}" -gt ${#FILE_LINENOS[@]} ]]; then
  echo "Invalid selection '${CHOICE}'. Aborted." >&2
  exit 1
fi

IDX=$((CHOICE - 1))
TARGET_LINE="${FILE_LINENOS[$IDX]}"

echo ""
echo "About to remove:"
echo "  ${FINGERPRINTS[$IDX]}  ${COMMENTS[$IDX]}"
read -rp "Confirm? [y/N] " CONFIRM
if ! [[ "${CONFIRM}" =~ ^[Yy]$ ]]; then
  echo "Aborted — no changes made."
  exit 0
fi

# Delete by line number only — no key content ever reaches a shell pattern
# sed -i "<N>d" deletes line N in-place inside the container
docker exec "${CONTAINER}" \
  sed -i "${TARGET_LINE}d" "${AUTH_KEYS}"

echo "✓ Key removed."
REMAINING=$(docker exec "${CONTAINER}" \
  grep -cE '^(ssh-|ecdsa-|sk-)' "${AUTH_KEYS}" 2>/dev/null || echo "0")
echo "  Remaining authorized keys: ${REMAINING}"
