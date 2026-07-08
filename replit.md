# D.A.N. — Dynamic Access Node

A 24/7 hardened SSH dev container with a cyberpunk web dashboard, free AI coding agents (Aider), and Render-ready Docker deployment. Ships as **one single free Render web service** — dashboard UI, API, web terminal, and SSH devbox all ride on one URL/port.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/dan-ui run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (Render PostgreSQL)

## Deploying to Render (one free service — manual Web Service, no Blueprint)

`render.yaml` is kept in the repo only as a reference for what to enter — it is
**not required**. Create the service by hand in the Render dashboard, no
Blueprint step, no cost beyond the free plan:

1. Render dashboard → **New → Web Service** → connect `daviddan-241/D-A-N`.
2. On the create screen:
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `ssh-container/Dockerfile`
   - **Docker Build Context Directory**: `.` (repo root — it needs `lib/`, `artifacts/api-server/`, and `artifacts/dan-ui/` to build)
   - **Instance Type / Plan**: `Free`
3. Under **Advanced** → **Health Check Path**: `/api/healthz`
4. After the service is created, go to **Environment** and add these one at a time (all free, no Blueprint needed):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` — your Render PostgreSQL external connection string
   - `SESSION_SECRET` — any random string (e.g. `openssl rand -hex 32`)
   - `WEB_TERMINAL_USER` / `WEB_TERMINAL_PASS` — login for the browser terminal at `/webterm`
   - `DEV_USER` = `devuser`
   - `AUTO_INSTALL_EXTRAS` = `yes` — auto-installs Metasploit, SecLists, etc. on first boot
   - `SSH_PUBLIC_KEY` — your SSH public key (required for real SSH — see below)
   - `BORE_ENABLE` = `yes`, `BORE_SECRET` = any string — real SSH tunnel via bore.pub
   - Optional: `CLOUDFLARE_TUNNEL_TOKEN`, `GITHUB_TOKEN` + `DOTFILES_REPO`/`PROJECTS_REPO`
5. Click **Deploy**. Render builds the single Docker image and serves everything on your `*.onrender.com` URL.
6. For UptimeRobot: ping `https://<your-app>.onrender.com/api/healthz` every 5 min to keep the free service from sleeping.

## SSH from anywhere (including a-shell mini) — real SSH, not a simulator

Render free tier is HTTP-only with no persistent disk and no `docker exec`, so
two things had to be solved differently than a normal VPS: **getting a real
TCP port for SSH**, and **installing your key without shell access**.

### Step 1 — add your public key (required, no exec needed)
The container reads `SSH_PUBLIC_KEY` (or `SSH_PUBLIC_KEYS` for multiple, one
per line) from the environment on every boot and appends it to
`~/.ssh/authorized_keys` automatically — no `docker exec` required.
1. Generate a key **on the device you're connecting from** (so the private key
   never has to travel): `ssh-keygen -t ed25519 -C "iphone"`
2. Copy the public key it prints: `cat ~/.ssh/id_ed25519.pub`
3. Paste it into `SSH_PUBLIC_KEY` in the Render dashboard → Environment tab → Save (redeploys automatically)

### Step 2 — get a real TCP port for SSH

**bore.pub (default, zero-config, works immediately)**
- `BORE_ENABLE=yes` is on by default; set `BORE_SECRET=pick-any-string` for a stable port across restarts.
- After boot, open the browser terminal (`/webterm`) or check the logs and run: `cat ~/.dan_ssh_connect` → prints e.g. `ssh -p 12345 devuser@bore.pub`
- From **a-shell mini**: `ssh -p 12345 devuser@bore.pub` — this is a real SSH session with real `sudo`/`apt`, not a simulation.

**Cloudflare Tunnel (optional, permanent hostname, free Cloudflare account)**
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Zero Trust → Networks → Tunnels → **Create tunnel**
2. Copy the tunnel token → paste into `CLOUDFLARE_TUNNEL_TOKEN` on Render
3. In the tunnel dashboard, add a **Public Hostname**: `dan.yourdomain.com` → `ssh://localhost:22`
4. SSH from anywhere: `ssh -o "ProxyCommand cloudflared access ssh --hostname %h" devuser@dan.yourdomain.com`

## Persistence (GitHub auto-sync — survives Render restarts)

Render free tier wipes the container filesystem on every restart. Solution: GitHub as the disk.

1. Create two private GitHub repos:
   - `dan-dotfiles` — shell config, `.ssh/authorized_keys`, vim/tmux config
   - `dan-projects` — your code
2. Set in `dan-devbox` env vars on Render:
   - `GITHUB_TOKEN` — GitHub PAT with `repo` scope ([create one](https://github.com/settings/tokens))
   - `DOTFILES_REPO` — `github.com/daviddan-241/dan-dotfiles`
   - `PROJECTS_REPO` — `github.com/daviddan-241/dan-projects` (optional)
3. On every container boot, dotfiles and projects are pulled automatically.
4. Every 30 min, a cron job commits and pushes any changes back.
5. Manual sync anytime: `git-sync`

**Note:** `SSH_PUBLIC_KEY` (set once on Render) already survives restarts on its own since it's an env var, not a file — GitHub persistence is only needed for your projects/dotfiles, not the key itself.

## AI Agents (Aider — free)

Once SSH'd into the devbox (or via the browser terminal at your Render URL):

```bash
# Get a free API key first — choose one:
#   OpenRouter (free models):  openrouter.ai  → export OPENROUTER_API_KEY=sk-or-...
#   Groq (fast free):          console.groq.com → export GROQ_API_KEY=gsk_...
#   GitHub Models (free):      github.com/settings/tokens → export GITHUB_TOKEN=ghp_...

# Start a single agent
agent           # Gemma 3 27B via OpenRouter (free)
agent-deep      # DeepSeek R1 via OpenRouter (free)
agent-fast      # Llama 3.3 70B via Groq (fast, free)
agent-gh        # GPT-4o via GitHub Models (free with GitHub)

# Start 3 agents at once in tmux windows
agents          # or: dan-agents
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (artifacts/api-server) — also serves the built UI and proxies the web terminal
- UI: React 19 + Vite + shadcn/ui + Tailwind (artifacts/dan-ui)
- DB: PostgreSQL (Render free) + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec)
- Build: esbuild (self-contained bundle)
- SSH container: Ubuntu 24.04 + 50+ security tools + Aider (ssh-container/) — also the final Docker stage for the whole app
- Deployment: render.yaml (single Blueprint service)

## Where things live

- `artifacts/api-server/src/app.ts` — Express app: `/api/*` routes, static UI serving, `/webterm` proxy to ttyd
- `artifacts/dan-ui/src/` — React pages (home, terminal, tools, connect)
- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit manually)
- `ssh-container/Dockerfile` — unified build: stage 1 builds dan-ui + api-server (node:24-alpine), stage 2 bakes them into the Ubuntu devbox image alongside Node.js, sshd, ttyd, and security tools
- `ssh-container/scripts/entrypoint.sh` — boots sshd + ttyd (background), then runs the Node app in the foreground on `$PORT`
- `ssh-container/scripts/dan-agents.sh` — tmux multi-agent launcher
- `render.yaml` — Render Blueprint: one `web` service (`dan`), Docker context = repo root

## Architecture decisions

- Single Render free-tier web service: Render only exposes one $PORT per web service, so the API server is the one foreground process, and it serves the static UI + proxies the web terminal (ttyd, internal-only) at `/webterm`. sshd runs in the background in the same container for real SSH.
- `/webterm` (not `/terminal`) was chosen for the ttyd proxy path specifically to avoid colliding with the dashboard's own client-side `/terminal` page route.
- esbuild bundles the API server into a self-contained dist/ — no node_modules needed in production
- vite.config.ts uses `isBuild` guard so PORT/BASE_PATH don't crash `vite build` in CI
- Aider is pre-installed in the devbox Docker image — no first-boot install needed

## User preferences

- Use Render free tier for hosting — one single free web service, not multiple
- UptimeRobot keeps the free service alive (ping /api/healthz every 5 min)
- Everything must be real — no mocks or hardcoded placeholder data
- Free AI agents only (Aider with OpenRouter/Groq/GitHub Models)

## Gotchas

- Render free tier only routes HTTP to `$PORT` — real SSH rides out over the bore.pub tunnel (on by default) or Cloudflare Tunnel (optional). `SSH_PUBLIC_KEY` must be set on Render or SSH login will fail (no `docker exec` on Render to add a key after the fact).
- `AUTO_INSTALL_EXTRAS=yes` (default) installs Metasploit, SecLists, Sherlock, etc. in the background on first boot — check progress with `tail -f /var/log/ssh-container/auto-install.log`.
- `DATABASE_URL` is managed by Replit's runtime — provide the Render external URL as a secret.
- Run `pnpm --filter @workspace/db run push` after every schema change to sync Render PostgreSQL.
- The Docker build context for `ssh-container/Dockerfile` is the repo root (not `ssh-container/`) — it needs `lib/`, `artifacts/api-server/`, and `artifacts/dan-ui/` to build the web app stage.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
