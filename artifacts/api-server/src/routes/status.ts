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

// bore-cli's tracing output writes the assigned port as `remote_port=NNNN`
// (no space before "port"), as `listening at bore.pub:NNNN`, or with a loose
// `port NNNN` — matching all three keeps port detection working even if
// bore/tracing changes its exact log wording. The old `/port (\d+)/` pattern
// never matched real bore-cli output, so the dashboard was stuck on
// "starting..." / no port forever even when the tunnel was healthy.
function extractBorePort(log: string): string | null {
  const match = log.match(/(?:remote_port=|bore\.pub:|port[ =])(\d+)/g);
  if (!match) return null;
  const last = match[match.length - 1];
  const digits = last.match(/(\d+)$/);
  return digits ? digits[1] : null;
}

const LAST_MODE_FILE = `${LOG_DIR}/.bore-last-mode`;
const RESTART_LOCK = `${LOG_DIR}/.bore-restart.lock`;

function spawnBore(useTor: boolean, boreSecret: string): ReturnType<typeof spawn> {
  const args = ["local", "22", "--to", "bore.pub"];
  if (boreSecret) args.push("--secret", boreSecret);
  const logFd = fs.openSync(`${LOG_DIR}/bore.log`, "a");
  const child = useTor
    ? spawn("torsocks", ["bore", ...args], { detached: true, stdio: ["ignore", logFd, logFd] })
    : spawn("bore", args, { detached: true, stdio: ["ignore", logFd, logFd] });
  child.unref();
  fs.closeSync(logFd);
  return child;
}

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
  // Suppress the watchdog while we manually manage `bore` so it doesn't
  // kill/spawn the process concurrently and stomp on our state.
  // Lock file stores a Unix seconds timestamp (matches `date +%s` used by
  // bore-watchdog.sh's stale-lock check) — do not switch to milliseconds.
  try { fs.writeFileSync(RESTART_LOCK, String(Math.floor(Date.now() / 1000))); } catch { /* best-effort */ }
  killProcess("bore");

  const boreSecret = process.env.BORE_SECRET || "";
  const hasTorsocks = (() => {
    try { execSync("command -v torsocks", { stdio: "ignore" }); return true; }
    catch { return false; }
  })();
  // If a previous run already learned that Tor gets refused by bore.pub for
  // this container, skip straight to direct — don't keep retrying a path
  // that will only crash-loop again.
  const forceDirect = readTrimmed(LAST_MODE_FILE) === "direct";
  const tryTor = hasTorsocks && !forceDirect;

  spawnBore(tryTor, boreSecret);

  setTimeout(() => {
    const torUp = isProcessRunning("bore") && extractBorePort(readTrimmed(`${LOG_DIR}/bore.log`) || "");
    let mode: "tor" | "direct" | null = tryTor ? (torUp ? "tor" : null) : (isProcessRunning("bore") ? "direct" : null);

    if (tryTor && !torUp) {
      // Tor path didn't come up with a resolvable port — kill it and retry direct.
      killProcess("bore");
      spawnBore(false, boreSecret);
      setTimeout(() => finishRestart("direct"), 3000);
      return;
    }
    finishRestart(mode ?? (tryTor ? "tor" : "direct"));
  }, 4000);

  function finishRestart(mode: string) {
    try {
      const running = isProcessRunning("bore");
      if (running) {
        const log = fs.readFileSync(`${LOG_DIR}/bore.log`, "utf8");
        const port = extractBorePort(log);
        if (port) {
          // Only persist the mode once we have a confirmed, resolvable port —
          // a process that's merely alive shouldn't be recorded as "working".
          fs.writeFileSync(LAST_MODE_FILE, mode);
          const cmd = `ssh -p ${port} ${DEV_USER}@bore.pub`;
          fs.writeFileSync(`${HOME_DIR}/.dan_ssh_connect`, `${cmd}\n`);
        }
      }
    } catch {
      // best-effort — status endpoint will just show "starting" if this fails
    } finally {
      try { fs.unlinkSync(RESTART_LOCK); } catch { /* best-effort */ }
      restartInFlight = false;
    }
  }

  res.json({ restarting: true });
});

export default router;
