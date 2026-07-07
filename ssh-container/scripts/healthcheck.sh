#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# D.A.N. Health Check — verifies sshd + ttyd are running
# Called by Docker HEALTHCHECK every 30s
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [[ "${result}" == "ok" ]]; then
    echo "  [OK]   ${name}"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] ${name}: ${result}"
    FAIL=$((FAIL + 1))
  fi
}

# 1. sshd process
pgrep -x sshd >/dev/null 2>&1 \
  && check "sshd process" "ok" \
  || check "sshd process" "not running"

# 2. sshd listening on port 22
if ss -tlnp 2>/dev/null | grep -q ':22 '; then
  check "sshd :22" "ok"
elif netstat -tlnp 2>/dev/null | grep -q ':22 '; then
  check "sshd :22" "ok"
else
  check "sshd :22" "nothing listening"
fi

# 3. SSH banner
if command -v nc >/dev/null 2>&1; then
  BANNER=$(echo "" | nc -w 3 127.0.0.1 22 2>/dev/null | head -1 || true)
  if [[ "${BANNER}" == SSH* ]]; then
    check "SSH banner" "ok"
  else
    check "SSH banner" "unexpected: ${BANNER:-<empty>}"
  fi
fi

# 4. Host keys present
KEY_OK=true
for KEY_TYPE in rsa ed25519 ecdsa; do
  KEY="/etc/ssh/host_keys/ssh_host_${KEY_TYPE}_key"
  if [[ ! -f "${KEY}" ]]; then
    KEY_OK=false
    check "host key (${KEY_TYPE})" "missing"
  fi
done
[[ "${KEY_OK}" == "true" ]] && check "host keys (rsa/ed25519/ecdsa)" "ok"

# 5. ttyd process (non-critical — warn only)
if pgrep -x ttyd >/dev/null 2>&1; then
  check "ttyd process" "ok"
else
  echo "  [WARN] ttyd: not running (web terminal unavailable — SSH still works)"
fi

# 6. ttyd port 7681 (non-critical)
if ss -tlnp 2>/dev/null | grep -q ':7681 '; then
  check "ttyd :7681" "ok"
else
  echo "  [WARN] ttyd :7681: nothing listening (web terminal may not be up yet)"
fi

# ── Result ────────────────────────────────────────────────────────────────────
echo ""
if [[ ${FAIL} -eq 0 ]]; then
  echo "HEALTHY: ${PASS} checks passed"
  exit 0
else
  echo "UNHEALTHY: ${FAIL} check(s) failed, ${PASS} passed"
  exit 1
fi
