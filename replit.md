# D.A.N. — Dynamic Access Node

A 24/7 hardened SSH dev container with a cyberpunk web dashboard, free AI coding agents (Aider), and Render-ready Docker deployment.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/dan-ui run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (Render PostgreSQL)

## Deploying to Render

1. Render dashboard → **New → Blueprint** → connect `daviddan-241/D-A-N`.
2. Render reads `render.yaml` and creates three services:
   - `dan-api-server` — Express API (Docker)
   - `dan-ui` — React frontend (static site, always free)
   - `dan-devbox` — Browser terminal + AI agents + SSH tunnel (Docker)
3. Set secrets in each service's Environment tab:
   - `dan-api-server`: `DATABASE_URL`, `SESSION_SECRET`
   - `dan-devbox`: `WEB_TERMINAL_USER`, `WEB_TERMINAL_PASS`, plus SSH/persistence vars below
4. For UptimeRobot: ping `https://<your-api>.onrender.com/api/healthz` every 5 min.

## SSH from anywhere (including a-shell mini) — Render workarounds

Render free tier is HTTP-only with no persistent disk. Two real workarounds are built in:

### Option A — Cloudflare Tunnel (recommended, permanent hostname, free)
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Zero Trust → Networks → Tunnels → **Create tunnel**
2. Copy the tunnel token → paste into `CLOUDFLARE_TUNNEL_TOKEN` in `dan-devbox` env vars on Render
3. In the tunnel dashboard, add a **Public Hostname**: `dan.yourdomain.com` → `ssh://localhost:22`
4. SSH from anywhere:
   ```bash
   # Install cloudflared once on your client (free):  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   ssh -o "ProxyCommand cloudflared access ssh --hostname %h" devuser@dan.yourdomain.com
   ```
5. From **a-shell mini**: install cloudflared via homebrew, then use the same command above.

### Option B — bore.pub (zero-config, works immediately, no account needed)
1. Set `BORE_ENABLE=yes` and `BORE_SECRET=pick-any-string` in `dan-devbox` env vars on Render
2. After the container boots, open the browser terminal and run:
   ```bash
   dan-connect   # prints your SSH command, e.g.:  ssh -p 12345 devuser@bore.pub
   ```
3. From **a-shell mini**: SSH to `bore.pub` on that port — done.
- `BORE_SECRET` makes the port consistent across restarts (same secret → same port)

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

**To persist your SSH key across restarts:** put your `authorized_keys` in `dan-dotfiles/.ssh/authorized_keys` — it gets restored on every boot.

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
- API: Express 5 (artifacts/api-server)
- UI: React 19 + Vite + shadcn/ui + Tailwind (artifacts/dan-ui)
- DB: PostgreSQL (Render free) + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec in lib/api-spec)
- Build: esbuild (self-contained bundle)
- SSH container: Ubuntu 24.04 + 50+ security tools + Aider (ssh-container/)
- Deployment: render.yaml (Blueprint)

## Where things live

- `artifacts/api-server/src/` — Express routes, middleware, app bootstrap
- `artifacts/dan-ui/src/` — React pages (home, terminal, tools, connect)
- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit manually)
- `ssh-container/` — Docker SSH + web terminal container
- `ssh-container/scripts/dan-agents.sh` — tmux multi-agent launcher
- `render.yaml` — Render Blueprint deployment config

## Architecture decisions

- esbuild bundles the API server into a self-contained dist/ — no node_modules needed in production
- ttyd reads `$PORT` from the environment so it binds to Render's injected port automatically
- vite.config.ts uses `isBuild` guard so PORT/BASE_PATH don't crash `vite build` in CI
- Aider is pre-installed in the devbox Docker image — no first-boot install needed

## User preferences

- Use Render free tier for hosting (PostgreSQL + web services)
- UptimeRobot keeps the free services alive (ping /api/healthz every 5 min)
- Everything must be real — no mocks or hardcoded placeholder data
- Free AI agents only (Aider with OpenRouter/Groq/GitHub Models)

## Gotchas

- SSH raw access requires a Render paid plan or a VPS (free tier only routes HTTP). Use the browser terminal (ttyd) for free.
- `DATABASE_URL` is managed by Replit's runtime — provide the Render external URL as a secret.
- Run `pnpm --filter @workspace/db run push` after every schema change to sync Render PostgreSQL.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
