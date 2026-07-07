#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Health check — verifies sshd is running and accepting connections
# Called by Docker HEALTHCHECK every 30s
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# 1. Check sshd process is alive
if ! pgrep -x sshd >/dev/null 2>&1; then
  echo "UNHEALTHY: sshd process not found"
  exit 1
fi

# 2. Check sshd is listening on port 22
if ! ss -tlnp 2>/dev/null | grep -q ':22 '; then
  # fallback to netstat if ss is unavailable
  if ! netstat -tlnp 2>/dev/null | grep -q ':22 '; then
    echo "UNHEALTHY: nothing listening on port 22"
    exit 1
  fi
fi

# 3. Verify SSH banner is served (TCP handshake level check)
if command -v nc >/dev/null 2>&1; then
  BANNER=$(echo "" | nc -w 3 127.0.0.1 22 2>/dev/null | head -1 || true)
  if [[ "${BANNER}" != SSH* ]]; then
    echo "UNHEALTHY: SSH banner not received (got: ${BANNER:-<empty>})"
    exit 1
  fi
fi

# 4. Check host key files exist
for KEY_TYPE in rsa ed25519 ecdsa; do
  KEY="/etc/ssh/host_keys/ssh_host_${KEY_TYPE}_key"
  if [[ ! -f "${KEY}" ]]; then
    echo "UNHEALTHY: missing host key ${KEY}"
    exit 1
  fi
done

echo "HEALTHY: sshd running, listening on :22, host keys present"
exit 0
