import { Router, type IRouter } from "express";
import { execSync } from "node:child_process";
import fs from "node:fs";

const router: IRouter = Router();

const DEV_USER = process.env.DEV_USER || "devuser";
const HOME_DIR = `/home/${DEV_USER}`;
const LOG_DIR = "/var/log/ssh-container";

function isProcessRunning(name: string): boolean {
  try {
    execSync(`pgrep -x ${name}`, { stdio: "ignore" });
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

export default router;
