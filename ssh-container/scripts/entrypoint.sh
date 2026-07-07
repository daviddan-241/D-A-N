#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Container entrypoint — runs as root, drops to sshd
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG_DIR="/var/log/ssh-container"
LOG_FILE="${LOG_DIR}/startup.log"
DEV_USER="${DEV_USER:-devuser}"

# ── Logging helpers ───────────────────────────────────────────────────────────
log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [INFO]  $*" | tee -a "${LOG_FILE}"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [WARN]  $*" | tee -a "${LOG_FILE}" >&2; }
err()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" | tee -a "${LOG_FILE}" >&2; }

# ── Ensure log directory exists ───────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
chmod 750 "${LOG_DIR}"
log "=== DevBox container starting ==="
log "Timestamp: $(date -u)"
log "Hostname:  $(hostname)"
log "DEV_USER:  ${DEV_USER}"

# ─────────────────────────────────────────────────────────────────────────────
# 1. SSH Host Keys
# ─────────────────────────────────────────────────────────────────────────────
HOST_KEY_DIR="/etc/ssh/host_keys"
log "Checking SSH host keys in ${HOST_KEY_DIR} ..."
mkdir -p "${HOST_KEY_DIR}"
chmod 700 "${HOST_KEY_DIR}"

generate_key() {
  local type="$1"
  local bits="$2"
  local keyfile="${HOST_KEY_DIR}/ssh_host_${type}_key"
  if [[ ! -f "${keyfile}" ]]; then
    log "Generating ${type} host key ..."
    if [[ -n "${bits}" ]]; then
      ssh-keygen -q -t "${type}" -b "${bits}" -N "" -f "${keyfile}"
    else
      ssh-keygen -q -t "${type}" -N "" -f "${keyfile}"
    fi
    chmod 600 "${keyfile}"
    chmod 644 "${keyfile}.pub"
    log "Generated: ${keyfile}"
  else
    log "Reusing existing ${type} host key."
  fi
}

generate_key rsa    4096
generate_key ed25519 ""
generate_key ecdsa  521

# ─────────────────────────────────────────────────────────────────────────────
# 2. Ensure devuser home structure is correct
# ─────────────────────────────────────────────────────────────────────────────
HOME_DIR="/home/${DEV_USER}"
SSH_DIR="${HOME_DIR}/.ssh"

log "Ensuring home directory structure for ${DEV_USER} ..."
mkdir -p "${HOME_DIR}"
mkdir -p "${SSH_DIR}"

# Create authorized_keys if it doesn't exist
if [[ ! -f "${SSH_DIR}/authorized_keys" ]]; then
  touch "${SSH_DIR}/authorized_keys"
  log "Created empty authorized_keys. Add your public key to: ${SSH_DIR}/authorized_keys"
  warn "No SSH public key installed — you will not be able to log in until you add one."
  warn "Add your key: docker exec devbox bash -c \"echo 'ssh-ed25519 AAAA...' >> /home/${DEV_USER}/.ssh/authorized_keys\""
fi

# Check if there are actually any keys
KEY_COUNT=$(grep -c 'ssh-' "${SSH_DIR}/authorized_keys" 2>/dev/null || true)
if [[ "${KEY_COUNT}" -eq 0 ]]; then
  warn "authorized_keys is empty. Container will start but SSH login will fail."
  warn "To add your key:"
  warn "  docker exec devbox bash -c \"echo 'YOUR_PUBLIC_KEY' >> /home/${DEV_USER}/.ssh/authorized_keys\""
else
  log "Found ${KEY_COUNT} authorized key(s)."
fi

# Set strict permissions (SSH requires these)
chmod 755 "${HOME_DIR}"
chmod 700 "${SSH_DIR}"
chmod 600 "${SSH_DIR}/authorized_keys"
chown -R "${DEV_USER}:${DEV_USER}" "${HOME_DIR}"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Firewall (ufw)
# ─────────────────────────────────────────────────────────────────────────────
log "Configuring firewall ..."
/firewall-init.sh 2>&1 | tee -a "${LOG_FILE}" || warn "Firewall init failed (may be normal in some environments)"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Start fail2ban
# ─────────────────────────────────────────────────────────────────────────────
if command -v fail2ban-server &>/dev/null; then
  log "Starting fail2ban ..."
  mkdir -p /var/run/fail2ban
  # fail2ban needs rsyslog or we use its own log
  fail2ban-server -b -x -l "${LOG_DIR}/fail2ban.log" 2>>"${LOG_FILE}" || \
    warn "fail2ban failed to start (may lack required permissions in some environments)"
else
  warn "fail2ban not found, skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Patch AllowUsers to match the actual DEV_USER at runtime
# ─────────────────────────────────────────────────────────────────────────────
log "Patching AllowUsers in sshd_config to: ${DEV_USER} ..."
# Replace any existing AllowUsers directive (handles both build-time default
# 'devuser' and any custom DEV_USER value set via environment at runtime).
sed -i "s/^AllowUsers .*/AllowUsers ${DEV_USER}/" /etc/ssh/sshd_config
# If the directive was somehow absent, append it
if ! grep -q "^AllowUsers " /etc/ssh/sshd_config; then
  echo "AllowUsers ${DEV_USER}" >> /etc/ssh/sshd_config
fi
log "AllowUsers set to: ${DEV_USER}"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Validate sshd config
# ─────────────────────────────────────────────────────────────────────────────
log "Validating sshd configuration ..."
if ! /usr/sbin/sshd -t 2>>"${LOG_FILE}"; then
  err "sshd configuration is invalid. Aborting."
  exit 1
fi
log "sshd configuration OK."

# ─────────────────────────────────────────────────────────────────────────────
# 6. Print connection info
# ─────────────────────────────────────────────────────────────────────────────
log "==================================================================="
log " DevBox SSH Server is starting"
log "==================================================================="
log " User:  ${DEV_USER}"
log " Port:  22 (mapped via docker-compose to host port)"
log " Auth:  Public-key only (password login disabled)"
log " Keys:  ${SSH_DIR}/authorized_keys"
log "==================================================================="
log " Connect:  ssh -p <host_port> ${DEV_USER}@<host_ip>"
log " Add key:  docker exec devbox sh -c \"echo 'YOUR_PUB_KEY' >> ${SSH_DIR}/authorized_keys\""
log "==================================================================="

# ─────────────────────────────────────────────────────────────────────────────
# 7. Start sshd in foreground
# ─────────────────────────────────────────────────────────────────────────────
log "Starting sshd ..."
exec /usr/sbin/sshd -D -e 2>&1 | tee -a "${LOG_DIR}/sshd.log"
