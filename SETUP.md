# D.A.N. Render Setup — Copy/Paste Cheat Sheet

## Docker, not Build/Start commands

Pick **Docker** as the runtime. Do **not** use Render's native "Build Command /
Start Command" flow (that's for a plain Node/Python app). This project needs
`apt-get`, `sshd`, `fail2ban`, `ttyd`, Go, security tools, etc. baked into an
Ubuntu image — only Docker can do that. There is nothing to lose by choosing
Docker: it's on the free plan too, same as native.

## 1. Create the service

Render dashboard → **New → Web Service** → connect `daviddan-241/D-A-N`.

| Field | Value |
|---|---|
| Runtime | **Docker** |
| Dockerfile Path | `ssh-container/Dockerfile` |
| Docker Build Context Directory | `.` (repo root) |
| Instance Type | **Free** |
| Health Check Path (under Advanced) | `/api/healthz` |

Leave Build Command / Start Command blank — Docker uses the `ENTRYPOINT` baked
into the image (`/entrypoint.sh`), you don't set those fields at all.

## 2. Environment variables

Add these in the service's **Environment** tab after it's created:

| Key | Value | Required? |
|---|---|---|
| `NODE_ENV` | `production` | Yes |
| `DATABASE_URL` | Render PostgreSQL **external** connection string | Yes |
| `SESSION_SECRET` | Run `openssl rand -hex 32` locally, paste the result | Yes |
| `WEB_TERMINAL_USER` | e.g. `admin` | Yes |
| `WEB_TERMINAL_PASS` | Run `openssl rand -hex 16`, paste the result | Yes |
| `DEV_USER` | `devuser` | Yes |
| `AUTO_INSTALL_EXTRAS` | `yes` | Recommended (auto-installs Metasploit, SecLists, Sherlock, BeEF on first boot) |
| `SSH_PUBLIC_KEY` | Your SSH public key, one line, starts with `ssh-ed25519` or `ssh-rsa` | Yes, for real SSH |
| `BORE_ENABLE` | `yes` | Yes, for real SSH (gives you a real host:port via bore.pub) |
| `BORE_SECRET` | Any random string, e.g. `openssl rand -hex 12` | Recommended (keeps the same bore.pub port across restarts) |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token from a Cloudflare Zero Trust tunnel | Optional (alternative to bore.pub) |
| `GITHUB_TOKEN` | A GitHub PAT | Optional (enables `dotfiles-sync` / repo persistence) |
| `DOTFILES_REPO` | `https://github.com/<you>/dotfiles.git` | Optional |
| `PROJECTS_REPO` | `https://github.com/<you>/projects.git` | Optional |

### Generating `SSH_PUBLIC_KEY` from a-shell mini (iOS)

```
ssh-keygen -t ed25519 -f ~/dan_key
cat ~/dan_key.pub
```

Copy that output into `SSH_PUBLIC_KEY` on Render. Keep `~/dan_key` (the
private key) on your phone — never paste it anywhere.

## 3. Deploy

Click **Deploy**. First build takes longer (~10-15 min) since it compiles the
full Ubuntu security-tools image; later deploys reuse Docker layer caching and
are much faster.

## 4. Connect

```
ssh -p <port-shown-in-app-logs> devuser@bore.pub
```

The exact port is printed in the Render service logs (and on the app's
Connect page) once `bore` establishes the tunnel after boot.

## 5. Keep it awake (free tier sleeps after inactivity)

Add a free [UptimeRobot](https://uptimerobot.com) monitor pinging
`https://<your-app>.onrender.com/api/healthz` every 5 minutes.
