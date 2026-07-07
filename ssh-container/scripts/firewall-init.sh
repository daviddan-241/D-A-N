#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Firewall initialisation using ufw
# Allows only SSH (port 22); denies everything else by default
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [FIREWALL] $*"; }

# ufw may not be functional inside Docker without NET_ADMIN capability
# We try and gracefully fall back if it fails
if ! command -v ufw &>/dev/null; then
  log "ufw not found, skipping firewall setup"
  exit 0
fi

# Check if we have NET_ADMIN (required for iptables/ufw inside Docker)
if ! ip link show lo &>/dev/null 2>&1 || ! iptables -L &>/dev/null 2>&1; then
  log "NET_ADMIN capability not available; skipping ufw (iptables rules not modifiable)"
  log "Host-level firewall should restrict access to the published SSH port instead."
  exit 0
fi

log "Configuring ufw firewall ..."

# Reset to defaults
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp comment 'SSH'

# Enable without prompting
ufw --force enable

ufw status verbose
log "Firewall configured: incoming=deny, SSH=allow."
