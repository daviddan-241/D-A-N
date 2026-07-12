import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { initTunnel } from "./tunnel-manager";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Bore tunnel manager ───────────────────────────────────────────────────────
// Start/adopt bore immediately so the port appears as fast as possible.
// initTunnel() is a no-op when BORE_ENABLE !== "yes".
initTunnel();

// ── Embedded web terminal (ttyd) ──────────────────────────────────────────────
// ttyd runs on TTYD_INTERNAL_PORT; this app proxies /webterm to it.
// Two critical fixes for iOS Safari iframes:
//   1. The Authorization header must be injected for BOTH the initial HTTP
//      request AND the WebSocket upgrade — iOS blocks 401 challenges in iframes.
//   2. The pathRewrite must apply consistently so ttyd's asset requests work.
let terminalProxy: ReturnType<typeof createProxyMiddleware> | undefined;
const ttydPort = process.env["TTYD_INTERNAL_PORT"];
const ttydUser = process.env["WEB_TERMINAL_USER"] ?? "dan";
const ttydPass = process.env["WEB_TERMINAL_PASS"] ?? "changeme";
const ttydAuthHeader = `Basic ${Buffer.from(`${ttydUser}:${ttydPass}`).toString("base64")}`;

if (ttydPort) {
  // ttyd runs without --credential (auth removed to fix iOS Safari blank terminal).
  // The terminal is only reachable via this HTTPS proxy — no extra auth needed.
  // No pathRewrite: WebSocket from xterm.js connects to ws://<host>/ws directly;
  // the server.on('upgrade') handler in index.ts forwards all upgrades here.
  terminalProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${ttydPort}`,
    changeOrigin: true,
    ws: true,
    pathFilter: (pathname: string) => pathname.startsWith("/webterm"),
    pathRewrite: { "^/webterm": "" },
    on: {
      error: (err, _req, res) => {
        logger.warn({ err }, "ttyd proxy error");
        const r = res as express.Response;
        if (r && typeof r.status === "function") {
          r.status(502).json({ error: "terminal proxy error" });
        }
      },
    },
  });
  app.use(terminalProxy);
  logger.info({ ttydPort }, "Web terminal proxy enabled at /webterm");
}

// ── Terminal availability probe ───────────────────────────────────────────────
import http from "node:http";

app.get("/api/terminal-ping", (_req, res) => {
  if (!ttydPort) {
    res.json({
      available: false,
      reason:
        "TTYD_INTERNAL_PORT not set — web terminal only runs in the Render container",
    });
    return;
  }
  let replied = false;
  const reply = (body: { available: boolean; reason?: string }) => {
    if (replied) return;
    replied = true;
    res.json(body);
  };
  const probe = http.get(
    {
      host: "127.0.0.1",
      port: Number(ttydPort),
      path: "/",
      timeout: 2000,
      headers: { Authorization: ttydAuthHeader },
    },
    (r) => {
      probe.destroy();
      const ok =
        r.statusCode !== undefined &&
        r.statusCode >= 200 &&
        r.statusCode < 400;
      reply({
        available: ok,
        ...(!ok && { reason: `ttyd returned HTTP ${r.statusCode}` }),
      });
    },
  );
  probe.on("error", (err) =>
    reply({ available: false, reason: `ttyd not reachable: ${err.message}` }),
  );
  probe.on("timeout", () => {
    probe.destroy();
    reply({ available: false, reason: "ttyd timed out" });
  });
});

// ── Static frontend (dan-ui) ──────────────────────────────────────────────────
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^\/(?!api|webterm).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
  logger.info({ publicDir }, "Serving bundled frontend");
}

export { terminalProxy };
export default app;
