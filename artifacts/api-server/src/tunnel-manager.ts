/**
 * TunnelManager — owns the bore process lifecycle inside Node.js.
 *
 * Unlike the shell-script approach, bore's stdout/stderr are piped directly
 * here, so the assigned port appears in memory the instant bore logs it.
 * No log-file polling, no regex timing races, no watchdog loops.
 *
 * Call initTunnel() once at startup. Use restartTunnel() from the API route.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import { logger } from "./lib/logger";

export type TunnelStatus = "off" | "starting" | "live" | "retrying";
export type TunnelMode = "tor" | "direct" | "off";

export interface TunnelState {
  port: string | null;
  pid: number | null;
  restarts: number;
  mode: TunnelMode;
  status: TunnelStatus;
  startedAt: string | null;
}

const DEV_USER = process.env["DEV_USER"] ?? "devuser";
const HOME_DIR = `/home/${DEV_USER}`;
const LOG_DIR = "/var/log/ssh-container";

// Patterns tried in priority order — bore output varies across versions.
const PORT_PATTERNS = [
  /bore[.]pub:(\d+)/,
  /remote_port=(\d+)/,
  /Listening at [^\s]+:(\d+)/i,
  /port[ =:](\d{4,5})/i,
];

function extractPort(text: string): string | null {
  for (const re of PORT_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function canUseTorsocks(): boolean {
  // Render containers don't allow Tor (no raw network / NAT rules).
  // bore.pub also actively rejects Tor exit-node connections as anti-abuse.
  // Always go direct — it's faster and more reliable.
  return false;
}

function isBoreAlive(): boolean {
  try {
    execSync("pgrep -x bore", { stdio: "ignore", timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

function killAllBore(): void {
  try {
    execSync("pkill -x bore", { stdio: "ignore", timeout: 2000 });
  } catch {
    /* no matching process */
  }
  if (_proc) {
    try {
      _proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    _proc = null;
  }
}

function writeConnectFile(port: string): void {
  const cmd = `ssh -p ${port} ${DEV_USER}@bore.pub`;
  try {
    fs.mkdirSync(HOME_DIR, { recursive: true });
    fs.writeFileSync(`${HOME_DIR}/.dan_ssh_connect`, `${cmd}\n`);
  } catch {
    /* best-effort */
  }
}

// ── Module state ──────────────────────────────────────────────────────────────
const _state: TunnelState = {
  port: null,
  pid: null,
  restarts: 0,
  mode: "off",
  status: "off",
  startedAt: null,
};
let _proc: ChildProcess | null = null;
let _restartTimer: ReturnType<typeof setTimeout> | null = null;
let _enabled = false;

function scheduleRestart(delayMs: number): void {
  if (_restartTimer) return;
  _restartTimer = setTimeout(() => {
    _restartTimer = null;
    if (!_enabled) return;
    _state.restarts++;
    spawnBore(false); // always direct on auto-restart (Tor often blocked)
  }, delayMs);
}

function spawnBore(useTor: boolean): void {
  killAllBore();
  _state.port = null;
  _state.pid = null;
  _state.status = "starting";
  _state.mode = useTor ? "tor" : "direct";
  _state.startedAt = new Date().toISOString();

  // bore.pub is a PUBLIC server — it runs with NO server-side secret.
  // Passing --secret to a server that has none causes immediate HMAC rejection
  // and bore exits with code 1 every time.  Only pass --secret when pointing
  // at your own private bore server (e.g. BORE_SERVER=my.server.com).
  const boreServer = process.env["BORE_SERVER"] ?? "bore.pub";
  const secret = process.env["BORE_SECRET"] ?? "";
  const boreArgs = ["local", "22", "--to", boreServer];
  if (secret && boreServer !== "bore.pub") boreArgs.push("--secret", secret);

  const bin = useTor ? "torsocks" : "bore";
  const args = useTor ? ["bore", ...boreArgs] : boreArgs;

  logger.info({ bin, args }, "TunnelManager: spawning bore");

  let child: ChildProcess;
  try {
    child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    logger.warn({ err }, "TunnelManager: spawn failed");
    _state.status = "retrying";
    if (useTor) {
      spawnBore(false);
      return;
    }
    scheduleRestart(5000);
    return;
  }

  _proc = child;
  _state.pid = child.pid ?? null;

  const onData = (chunk: Buffer) => {
    const text = chunk.toString();
    // Also write to log file for human debugging: tail -f bore.log
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.appendFileSync(`${LOG_DIR}/bore.log`, text);
    } catch {
      /* ignore */
    }
    if (!_state.port) {
      const port = extractPort(text);
      if (port) {
        _state.port = port;
        _state.status = "live";
        logger.info({ port, mode: _state.mode }, "TunnelManager: port acquired");
        writeConnectFile(port);
      }
    }
  };

  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  // If running via Tor and no port after 8s, fall back to direct.
  let torTimeout: ReturnType<typeof setTimeout> | null = null;
  if (useTor) {
    torTimeout = setTimeout(() => {
      torTimeout = null;
      if (_state.status !== "live" && _enabled) {
        logger.warn("TunnelManager: Tor bore timed out — retrying direct");
        spawnBore(false);
      }
    }, 8000);
  }

  child.on("exit", (code) => {
    if (torTimeout) {
      clearTimeout(torTimeout);
      torTimeout = null;
    }
    logger.warn({ code }, "TunnelManager: bore exited");
    if (_proc === child) {
      _proc = null;
      _state.port = null;
      _state.pid = null;
      _state.status = "retrying";
    }
    if (_enabled) {
      const delay = Math.min(
        3000 * Math.pow(1.5, Math.min(_state.restarts, 8)),
        30000,
      );
      scheduleRestart(delay);
    }
  });

  child.on("error", (err) => {
    logger.warn({ err }, "TunnelManager: bore process error");
    if (useTor) spawnBore(false);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns current tunnel state (immutable copy). */
export function getTunnelState(): Readonly<TunnelState> {
  // Fallback: if we have no port but the connect file has one, read it.
  // This handles the window between container start and Node.js init.
  if (!_state.port) {
    try {
      const raw = fs.readFileSync(`${HOME_DIR}/.dan_ssh_connect`, "utf8").trim();
      const m = raw.match(/-p\s+(\d+)/);
      if (m?.[1]) {
        _state.port = m[1];
        _state.status = "live";
        _state.mode = "direct";
      }
    } catch {
      /* connect file absent */
    }
  }
  return { ..._state };
}

/** Kill bore and respawn immediately. Resets restart counter. */
export function restartTunnel(): void {
  if (_restartTimer) {
    clearTimeout(_restartTimer);
    _restartTimer = null;
  }
  _enabled = true;
  _state.restarts = 0;
  spawnBore(canUseTorsocks());
}

/**
 * Called once at server startup.
 * If BORE_ENABLE=yes: adopts an existing bore process if it already has a
 * port, otherwise spawns a fresh one with piped output.
 */
export function initTunnel(): void {
  if (process.env["BORE_ENABLE"] !== "yes") return;
  _enabled = true;
  logger.info("TunnelManager: initializing");

  // Adopt entrypoint.sh's bore if it already acquired a port
  try {
    const raw = fs
      .readFileSync(`${HOME_DIR}/.dan_ssh_connect`, "utf8")
      .trim();
    const m = raw.match(/-p\s+(\d+)/);
    if (m?.[1] && isBoreAlive()) {
      _state.port = m[1];
      _state.status = "live";
      _state.mode = "direct";
      logger.info({ port: _state.port }, "TunnelManager: adopted existing bore port");
      return;
    }
  } catch {
    /* connect file absent — fall through to spawn */
  }

  spawnBore(canUseTorsocks());
}
