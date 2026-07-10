import { Router, type IRouter } from "express";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";

const router: IRouter = Router();

const DEV_USER = process.env.DEV_USER || "devuser";
const HOME_DIR = `/home/${DEV_USER}`;
const LOG_DIR = "/var/log/ssh-container";

let restartInFlight = false;

function isProcessRunning(name: string): boolean {
  try {
    execSync(`pgrep -x ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function killProcess(name: string): void {
  try {
    execSync(`pkill -x ${name}`, { stdio: "ignore" });
  } catch {
    // no matching process — nothing to kill
  }
}

function readTrimmed(path: string): string | null {
  try {
    return fs.readFileSync(path, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function readWatchdogStats(): { restartCount: number; lastRestartAt: string | null; status: string } | null {
  try {
    const raw = fs.readFileSync(`${LOG_DIR}/bore-watchdog-stats.json`, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countAuthorizedKeys(): number {
  const content = readTrimmed(`${HOME_DIR}/.ssh/authorized_keys`);
  if (!content) return 0;
  return content
    .split("\n")
    .filter((line) => /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp|sk-)/.test(line.trim())).length;
}

router.get("/status", (_req, res) => {
  const sshdRunning = isProcessRunning("sshd");
  const boreRunning = isProcessRunning("bore");
  const cloudflaredRunning = isProcessRunning("cloudflared");
  const authorizedKeys = countAuthorizedKeys();
  const boreConnectCommand = readTrimmed(`${HOME_DIR}/.dan_ssh_connect`);
  const autoInstallDone = fs.existsSync(`${HOME_DIR}/.dan_extras_installed`);
  const autoInstallLog = readTrimmed(`${LOG_DIR}/auto-install.log`);
  const autoInstallRunning = !autoInstallDone && isProcessRunning("auto-install.sh");

  res.json({
    ssh: {
      running: sshdRunning,
      configured: authorizedKeys > 0,
      authorizedKeys,
    },
    tunnel: {
      bore: {
        enabled: process.env.BORE_ENABLE === "yes",
        running: boreRunning,
        connectCommand: boreConnectCommand,
        watchdog: readWatchdogStats(),
      },
      cloudflare: {
        enabled: Boolean(process.env.CLOUDFLARE_TUNNEL_TOKEN),
        running: cloudflaredRunning,
      },
    },
    autoInstall: {
      enabled: process.env.AUTO_INSTALL_EXTRAS === "yes",
      done: autoInstallDone,
      running: autoInstallRunning,
      lastLogLine: autoInstallLog ? autoInstallLog.split("\n").slice(-1)[0] : null,
    },
    timestamp: new Date().toISOString(),
  });
});

router.post("/status/restart-tunnel", (_req, res) => {
  if (process.env.BORE_ENABLE !== "yes") {
    res.status(400).json({ error: "BORE_ENABLE is not set to 'yes' — nothing to restart." });
    return;
  }
  if (restartInFlight) {
    res.status(409).json({ error: "A tunnel restart is already in progress." });
    return;
  }

  restartInFlight = true;
  killProcess("bore");

  const boreSecret = process.env.BORE_SECRET || "";

  // Route through Tor (torsocks) if available — same policy as entrypoint.sh
  const hasTorsocks = (() => {
    try { execSync("command -v torsocks", { stdio: "ignore" }); return true; }
    catch { return false; }
  })();

  const cmd    = hasTorsocks ? "torsocks" : "bore";
  const args   = hasTorsocks ? ["bore", "local", "22", "--to", "bore.pub"] : ["local", "22", "--to", "bore.pub"];
  if (boreSecret) args.push("--secret", boreSecret);

  const logFd = fs.openSync(`${LOG_DIR}/bore.log`, "a");
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();

  setTimeout(() => {
    fs.closeSync(logFd);
    const running = isProcessRunning("bore");
    if (running) {
      try {
        const log = fs.readFileSync(`${LOG_DIR}/bore.log`, "utf8");
        const match = log.match(/port (\d+)/g);
        const port = match ? match[match.length - 1].replace("port ", "") : null;
        if (port) {
          const cmd = `ssh -p ${port} ${DEV_USER}@bore.pub`;
          fs.writeFileSync(`${HOME_DIR}/.dan_ssh_connect`, `${cmd}\n`);
        }
      } catch {
        // best-effort — status endpoint will just show "starting" if this fails
      }
    }
    restartInFlight = false;
  }, 3000);

  res.json({ restarting: true });
});

export default router;
