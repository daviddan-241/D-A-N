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

1. Push this repo to GitHub (already done).
2. In Render dashboard → **New** → **Blueprint** → connect the repo.
3. Render reads `render.yaml` and creates three services automatically:
   - `dan-api-server` — Express API (Docker)
   - `dan-ui` — React frontend (static site, always free)
   - `dan-devbox` — Browser terminal + AI agents (Docker)
4. Set these secrets in each service's Environment settings:
   - `dan-api-server`: `DATABASE_URL`, `SESSION_SECRET`
   - `dan-devbox`: `WEB_TERMINAL_USER`, `WEB_TERMINAL_PASS`
5. For UptimeRobot: ping `https://<your-dan-api-server>.onrender.com/api/healthz` every 5 min.

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
