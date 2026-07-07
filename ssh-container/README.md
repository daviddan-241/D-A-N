# DevBox — Hardened SSH Development Container

A production-ready, 24/7 SSH development container built on Ubuntu 24.04.  
Key-only authentication, automatic restart, persistent storage, fail2ban brute-force protection, and a full set of development tools.

---

## Quick Start

```bash
# 1. Clone / copy this directory to your server
cd ssh-container

# 2. Create your environment file
cp .env.example .env
# Edit .env: set DEV_USER, DEV_UID, DEV_GID, SSH_PORT

# 3. One-command setup (build + start + install your SSH key)
make setup

# 4. Connect
ssh -p 2222 devuser@<your-server-ip>
```

---

## Features

| Feature | Details |
|---|---|
| **Authentication** | SSH public-key only — passwords disabled at every layer |
| **Root** | Login disabled; dev user has passwordless sudo |
| **Host keys** | RSA-4096, Ed25519, ECDSA-521 — generated on first start, persisted on a named volume |
| **Brute-force protection** | fail2ban bans IPs after 3 failed attempts for 1 hour |
| **Restart policy** | `unless-stopped` — survives reboots and crashes |
| **Persistent storage** | Home directory, host keys, and logs on named Docker volumes |
| **Health check** | Docker checks every 30 s: sshd process, port 22, SSH banner, key files |
| **Ciphers** | Modern-only: ChaCha20-Poly1305, AES-256-GCM, Curve25519, Ed25519 |
| **Logging** | Structured startup log, sshd log, fail2ban log, all in `/var/log/ssh-container/` |
| **Log rotation** | Daily, 14-day retention, compressed |

---

## Development Tools Included

| Category | Tools |
|---|---|
| Version control | git |
| Languages | python3, pip3, venv |
| Build | build-essential, gcc, make |
| Editors | vim, nano |
| Terminal | tmux, htop |
| File utils | tree, zip, unzip |
| Data / text | jq, ripgrep |
| Network | curl, wget, net-tools, ping, nmap, socat, dnsutils |
| Container | docker (CLI), docker compose |
| Python extras | pipx, black, httpie |

---

## File Layout

```
ssh-container/
├── Dockerfile                      # Main image definition
├── docker-compose.yml              # Service, volumes, networking
├── Makefile                        # Convenience commands
├── .env.example                    # Environment template (copy to .env)
├── .gitignore
├── config/
│   ├── sshd_config                 # Hardened SSH server config
│   ├── motd                        # Login banner
│   ├── bashrc_extra                # Shell aliases, prompt, history
│   ├── fail2ban/
│   │   └── jail.local              # fail2ban SSH jail
│   └── logrotate.d/
│       └── ssh-container           # Log rotation rules
└── scripts/
    ├── entrypoint.sh               # Container start-up: keys, firewall, sshd
    ├── healthcheck.sh              # Docker HEALTHCHECK script
    ├── firewall-init.sh            # ufw firewall setup
    ├── add-key.sh                  # Add an SSH public key
    ├── list-keys.sh                # List authorized keys
    └── remove-key.sh              # Remove a key by comment/fingerprint
```

---

## Environment Variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DEV_USER` | `devuser` | Name of the non-root login user |
| `DEV_UID` | `1000` | User UID (match your host to avoid permission issues on volumes) |
| `DEV_GID` | `1000` | User GID |
| `SSH_PORT` | `2222` | Host port mapped to container port 22 |
| `TZ` | `UTC` | Container timezone |

> **Tip:** run `id` on your host to find the correct UID/GID values.

---

## Managing SSH Keys

### Add your key (one-liner)
```bash
# From the ssh-container directory on your server:
make add-key                          # uses ~/.ssh/id_ed25519.pub or id_rsa.pub

# Or specify a file:
make add-key-file FILE=~/.ssh/id_ed25519.pub

# Or directly:
cat ~/.ssh/id_ed25519.pub | docker exec -i devbox bash -c \
  "cat >> /home/devuser/.ssh/authorized_keys"
```

### List keys
```bash
make list-keys
# or
./scripts/list-keys.sh
```

### Remove a key
```bash
./scripts/remove-key.sh "mykey@laptop"        # by comment
./scripts/remove-key.sh "SHA256:abc123..."    # by fingerprint
```

---

## Common Operations

```bash
make up           # Start container
make down         # Stop container (data preserved)
make restart      # Restart container
make status       # Show health status
make logs         # Follow all logs
make logs-ssh     # Follow SSH auth log
make shell        # bash shell as devuser (without SSH)
make shell-root   # bash shell as root
make ssh          # SSH into container (port from SSH_PORT)
make health       # Run health check manually
make regen-keys   # Regenerate host keys (clients must re-accept)
make clean        # DESTROY ALL DATA — removes volumes
```

---

## Connecting from Your Client

```bash
# Basic connect
ssh -p 2222 devuser@<server-ip>

# With a specific key
ssh -p 2222 -i ~/.ssh/id_ed25519 devuser@<server-ip>

# Recommended: add to ~/.ssh/config
Host devbox
    HostName <server-ip>
    Port     2222
    User     devuser
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then connect with just: `ssh devbox`

---

## Persistent tmux Session (Survive Disconnects)

```bash
# First connect: create a session
tmux new -s main

# Later: reconnect to your running session
ssh devbox
tmux attach -t main

# List sessions
tmux ls
```

---

## Port Forwarding / Tunnels

```bash
# Forward a remote port to your laptop (e.g. a web server running in the container)
ssh -L 8080:localhost:8080 devbox

# SOCKS proxy through the container
ssh -D 1080 devbox

# Reverse tunnel: expose your laptop's port 3000 on the container
ssh -R 9000:localhost:3000 devbox
```

---

## Volumes

| Volume | Mount Path | Contents |
|---|---|---|
| `devbox_home` | `/home/devuser` | All user files — projects, dotfiles, git repos |
| `devbox_host_keys` | `/etc/ssh/host_keys` | SSH server identity keys |
| `devbox_logs` | `/var/log/ssh-container` | Startup, sshd, fail2ban logs |

Volumes survive `docker compose down`. Only `make clean` (or `docker compose down -v`) removes them.

---

## Backup and Restore

```bash
# Backup home directory
docker run --rm -v devbox_home:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/devbox_home_$(date +%Y%m%d).tar.gz -C /data .

# Restore home directory
docker run --rm -v devbox_home:/data -v $(pwd):/backup \
  ubuntu bash -c "cd /data && tar xzf /backup/devbox_home_20240101.tar.gz"

# Backup SSH host keys
docker run --rm -v devbox_host_keys:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/devbox_host_keys_$(date +%Y%m%d).tar.gz -C /data .
```

---

## Security Notes

- **Password auth is disabled** at both the SSH and PAM layers (`PasswordAuthentication no`, `UsePAM no`).  
- **Root login is disabled** (`PermitRootLogin no`; root password locked).  
- **Only modern ciphers** are enabled — weak algorithms (CBC, MD5, DSA, old DH groups) are rejected.  
- **fail2ban** bans IPs after 3 failed auth attempts for 1 hour.  
- **no-new-privileges** security_opt prevents privilege escalation after container start.  
- **Capabilities** are dropped to the minimum set OpenSSH requires.  
- The container runs on an **isolated bridge network** — only the SSH port is published to the host.  
- Host-level firewall (on the Docker host) should further restrict who can reach the published SSH port.

---

## Troubleshooting

**Cannot SSH in — permission denied (publickey)**  
→ You haven't added your key yet: `make add-key`  
→ Check: `make list-keys`

**Host key warning on reconnect**  
→ Someone ran `make regen-keys`. Remove the old entry: `ssh-keygen -R [localhost]:2222`

**Container exits immediately**  
→ sshd config error: `docker run --rm devbox:latest /usr/sbin/sshd -t`  
→ Check logs: `make logs`

**Port 2222 already in use**  
→ Change `SSH_PORT` in `.env` and `docker compose up -d`

**Volume permission issues (files owned by root)**  
→ Set `DEV_UID`/`DEV_GID` in `.env` to match your host user's `id` output, then rebuild: `make build up`

**fail2ban not starting**  
→ Normal in some Docker environments without `NET_ADMIN`. Host-level firewall covers brute-force protection in that case.

---

## Extending the Container

Add packages to the `Dockerfile` `apt-get install` block, then rebuild:

```bash
# Example: add Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
  && apt-get install -y nodejs

make build up
```

To add a persistent service (e.g. a web server), add it to `docker-compose.yml` or run it inside tmux inside the container.
