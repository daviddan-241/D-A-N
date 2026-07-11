import { Router, type IRouter } from "express";
import { execSync } from "node:child_process";
import fs from "node:fs";
import {
  getTunnelState,
  restartTunnel,
} from "../tunnel-manager";

const router: IRouter = Router();

const DEV_USER = process.env["DEV_USER"] ?? "devuser";
const HOME_DIR = `/home/${DEV_USER}`;
const LOG_DIR = "/var/log/ssh-container";

function isProcessRunning(name: string): boolean {
  try {
    execSync(`pgrep -x ${name}`, { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function readTrimmed(path: string): string | null {
  try {
    return fs.readFileSync(path, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function countAuthorizedKeys(): number {
  const content = readTrimmed(`${HOME_DIR}/.ssh/authorized_keys`);
  if (!content) return 0;
  return content
    .split("\n")
    .filter((line) =>
      /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp|sk-)/.test(line.trim()),
    ).length;
}

// ── GET /api/status ───────────────────────────────────────────────────────────
router.get("/status", (_req, res) => {
  const sshdRunning = isProcessRunning("sshd");
  const authorizedKeys = countAuthorizedKeys();
  const autoInstallDone = fs.existsSync(`${HOME_DIR}/.dan_extras_installed`);
  const autoInstallLog = readTrimmed(`${LOG_DIR}/auto-install.log`);
  const autoInstallRunning =
    !autoInstallDone && isProcessRunning("auto-install.sh");

  // Bore: use TunnelManager's in-memory state (port captured via pipe, not log file)
  const tunnel = getTunnelState();
  const boreEnabled = process.env["BORE_ENABLE"] === "yes";
  const boreRunning =
    tunnel.status === "live" ||
    tunnel.status === "starting" ||
    tunnel.status === "retrying" ||
    isProcessRunning("bore");
  const connectCommand = tunnel.port
    ? `ssh -p ${tunnel.port} ${DEV_USER}@bore.pub`
    : null;

  // Watchdog stats (legacy file written by bore-watchdog.sh, may be absent)
  let watchdogStats: {
    restartCount: number;
    lastRestartAt: string | null;
    status: string;
  } | null = null;
  try {
    const raw = fs.readFileSync(`${LOG_DIR}/bore-watchdog-stats.json`, "utf8");
    watchdogStats = JSON.parse(raw);
  } catch {
    /* absent — use tunnel manager's restart count instead */
    if (boreEnabled) {
      watchdogStats = {
        restartCount: tunnel.restarts,
        lastRestartAt: tunnel.startedAt,
        status: tunnel.status,
      };
    }
  }

  res.json({
    ssh: {
      running: sshdRunning,
      configured: authorizedKeys > 0,
      authorizedKeys,
    },
    tunnel: {
      bore: {
        enabled: boreEnabled,
        running: boreRunning,
        connectCommand,
        tunnelStatus: tunnel.status,
        watchdog: watchdogStats,
      },
      cloudflare: {
        enabled: Boolean(process.env["CLOUDFLARE_TUNNEL_TOKEN"]),
        running: isProcessRunning("cloudflared"),
      },
    },
    autoInstall: {
      enabled: process.env["AUTO_INSTALL_EXTRAS"] === "yes",
      done: autoInstallDone,
      running: autoInstallRunning,
      lastLogLine: autoInstallLog
        ? autoInstallLog.split("\n").slice(-1)[0]
        : null,
    },
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/tunnel/start ────────────────────────────────────────────────────
// Kills any running bore and spawns a fresh one with piped output.
// Returns immediately; client polls GET /api/status until port appears.
router.post("/tunnel/start", (_req, res) => {
  if (process.env["BORE_ENABLE"] !== "yes") {
    res
      .status(400)
      .json({ error: "BORE_ENABLE=yes is not set on this Render service." });
    return;
  }
  restartTunnel();
  res.json({ restarting: true, message: "Bore tunnel restarting — poll /api/status for port." });
});

// ── POST /api/status/restart-tunnel (legacy alias) ────────────────────────────
router.post("/status/restart-tunnel", (_req, res) => {
  if (process.env["BORE_ENABLE"] !== "yes") {
    res
      .status(400)
      .json({ error: "BORE_ENABLE=yes is not set on this Render service." });
    return;
  }
  restartTunnel();
  res.json({ restarting: true });
});

export default router;
