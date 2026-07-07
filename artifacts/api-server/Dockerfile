# ─────────────────────────────────────────────────────────────────────────────
# D.A.N. API Server — Render-ready Dockerfile
# Multi-stage: build the full monorepo with pnpm, then run the esbuild bundle.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# Enable corepack so pnpm is available without a separate install step
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /workspace

# Copy workspace manifests first (layer-cache friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Copy only the packages the api-server depends on
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all workspace deps (needed to resolve workspace: links)
RUN pnpm install --frozen-lockfile

# Build api-server — esbuild bundles everything into dist/
RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Copy the self-contained esbuild output (no node_modules needed)
COPY --from=builder /workspace/artifacts/api-server/dist ./dist

# Render injects $PORT at runtime — the server reads it from process.env.PORT
EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
