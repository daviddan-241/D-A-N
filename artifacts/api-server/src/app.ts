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
// TTYD_INTERNAL_PORT and this app proxies /webterm to it (HTTP + WebSocket)
// so the whole product rides on one public $PORT. (Mounted at /webterm, not
// /terminal, because /terminal is the dashboard's own client-side route.)
let terminalProxy: ReturnType<typeof createProxyMiddleware> | undefined;
const ttydPort = process.env["TTYD_INTERNAL_PORT"];
if (ttydPort) {
  terminalProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${ttydPort}`,
    changeOrigin: true,
    ws: true,
    pathFilter: "/webterm",
    pathRewrite: { "^/webterm": "" },
  });
  app.use(terminalProxy);
  logger.info({ ttydPort }, "Web terminal proxy enabled at /webterm");
}

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
