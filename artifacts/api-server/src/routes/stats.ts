import { Router, type IRouter } from "express";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const router: IRouter = Router();

// Cache tool count — only count once per process lifetime (expensive on first call)
let _cachedToolCount: number | null = null;

const KNOWN_TOOLS = [
  // Network / Recon
  "nmap", "masscan", "arp-scan", "netdiscover", "tcpdump", "tshark",
  // Web
  "gobuster", "ffuf", "wfuzz", "dirb", "nikto", "sqlmap", "whatweb", "httpx",
  // Vuln / Exploit
  "nuclei", "searchsploit", "msfconsole", "msfvenom",
  // Password
  "hydra", "medusa", "john", "hashcat", "hashid",
  // OSINT / Recon
  "subfinder", "dnsx", "amass", "theHarvester",
  // Forensics
  "binwalk", "foremost", "strings", "xxd",
  // Crypto / SSL
  "openssl", "gpg", "sslscan",
  // Network utils
  "netcat", "socat", "proxychains4", "torsocks", "tor",
  // Tunnels
  "bore", "cloudflared",
  // Web terminal
  "ttyd",
  // AI
  "aider", "ollama",
  // Dev
  "git", "python3", "jq", "tmux", "curl", "wget", "vim",
  // Wireless
  "aircrack-ng",
];

function countInstalledTools(): number {
  if (_cachedToolCount !== null) return _cachedToolCount;
  let count = 0;
  for (const tool of KNOWN_TOOLS) {
    try {
      execSync(`command -v ${tool}`, { stdio: "ignore", shell: "/bin/bash" });
      count++;
    } catch {
      // not installed
    }
  }
  _cachedToolCount = count; // real count — no artificial floor
  return _cachedToolCount;
}

function getPlatform(): string {
  try {
    const rel = fs.readFileSync("/etc/os-release", "utf8");
    const match = rel.match(/^PRETTY_NAME="(.+)"/m);
    if (match) return match[1];
  } catch {
    // not Linux
  }
  return os.type() + " " + os.release();
}

// Matches all standard SSH public key types including FIDO/SK keys
const SSH_KEY_RE = /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp|sk-ssh-ed25519|sk-ecdsa-sha2-nistp)/;

function getAuthMode(): string {
  const homeDir = `/home/${process.env.DEV_USER ?? "devuser"}`;
  try {
    const keys = fs.readFileSync(`${homeDir}/.ssh/authorized_keys`, "utf8");
    const count = keys.split("\n").filter(l => SSH_KEY_RE.test(l.trim())).length;
    return count > 0 ? `Key-only (${count})` : "Key-only";
  } catch {
    return "Key-only";
  }
}

router.get("/stats", (_req, res) => {
  res.json({
    status: "online",
    uptime: Math.floor(process.uptime()),
    platform: getPlatform(),
    auth: getAuthMode(),
    toolCount: countInstalledTools(),
    version: "2.0",
    timestamp: new Date().toISOString(),
  });
});

export default router;
