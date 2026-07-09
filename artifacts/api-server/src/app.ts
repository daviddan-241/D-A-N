import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Embedded web terminal (ttyd) ──────────────────────────────────────────────
// In the single-service Render deployment, ttyd runs internally on
// TTYD_INTERNAL_PORT and this app proxies /webterm to it (HTTP + WebSocket).
// ttyd uses HTTP Basic Auth — we inject the Authorization header server-side
// so the browser never sees a 401 challenge (which iOS blocks in iframes).
let terminalProxy: ReturnType<typeof createProxyMiddleware> | undefined;
const ttydPort = process.env["TTYD_INTERNAL_PORT"];
const ttydUser = process.env["WEB_TERMINAL_USER"] ?? "dan";
const ttydPass = process.env["WEB_TERMINAL_PASS"] ?? "changeme";
const ttydAuthHeader = `Basic ${Buffer.from(`${ttydUser}:${ttydPass}`).toString("base64")}`;

if (ttydPort) {
  terminalProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${ttydPort}`,
    changeOrigin: true,
    ws: true,
    pathFilter: "/webterm",
    pathRewrite: { "^/webterm": "" },
    // Inject auth so ttyd never challenges the browser — critical for iOS iframe
    headers: { Authorization: ttydAuthHeader },
  });
  app.use(terminalProxy);
  logger.info({ ttydPort }, "Web terminal proxy enabled at /webterm");
}

// ── Terminal availability probe ───────────────────────────────────────────────
// Lets the UI know whether ttyd is actually reachable before loading the iframe.
import http from "node:http";

app.get("/api/terminal-ping", (_req, res) => {
  if (!ttydPort) {
    res.json({ available: false, reason: "TTYD_INTERNAL_PORT not set — ttyd only runs in the Render container" });
    return;
  }
  // Guard: only one of (response / error / timeout) may send a reply
  let replied = false;
  const reply = (body: { available: boolean; reason?: string }) => {
    if (replied) return;
    replied = true;
    res.json(body);
  };

  const probe = http.get(
    { host: "127.0.0.1", port: Number(ttydPort), path: "/", timeout: 2000,
      headers: { Authorization: ttydAuthHeader } },
    (r) => {
      probe.destroy();
      // 200 or 3xx = ttyd is up and accepting our credentials.
      // 401 = wrong credentials; 5xx = crash. Both mean "not usable".
      const ok = r.statusCode !== undefined && r.statusCode >= 200 && r.statusCode < 400;
      reply({ available: ok, ...(!ok && { reason: `ttyd returned HTTP ${r.statusCode}` }) });
    }
  );
  probe.on("error", (err) => reply({ available: false, reason: `ttyd not reachable: ${err.message}` }));
  probe.on("timeout", () => { probe.destroy(); reply({ available: false, reason: "ttyd timed out" }); });
});

// ── Static frontend (dan-ui) ──────────────────────────────────────────────────
// When bundled together for the single-service deployment, the built dan-ui
// static files live in a `public/` directory alongside this server's dist/.
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
