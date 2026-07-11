import { Router, type IRouter } from "express";
import { execFileSync, execSync } from "node:child_process";

const router: IRouter = Router();

const DEV_USER = process.env["DEV_USER"] ?? "devuser";
const TMUX_SESSION = "main";

// Map from UI key names → tmux send-keys format
const KEY_MAP: Record<string, string> = {
  escape:     "Escape",
  tab:        "Tab",
  enter:      "Enter",
  backspace:  "BSpace",
  delete:     "DC",
  home:       "Home",
  end:        "End",
  pageup:     "PPage",
  pagedown:   "NPage",
  up:         "Up",
  down:       "Down",
  left:       "Left",
  right:      "Right",
  // Ctrl combos
  "ctrl+a":   "C-a", "ctrl+b": "C-b", "ctrl+c": "C-c",
  "ctrl+d":   "C-d", "ctrl+e": "C-e", "ctrl+f": "C-f",
  "ctrl+g":   "C-g", "ctrl+h": "C-h", "ctrl+k": "C-k",
  "ctrl+l":   "C-l", "ctrl+n": "C-n", "ctrl+o": "C-o",
  "ctrl+p":   "C-p", "ctrl+q": "C-q", "ctrl+r": "C-r",
  "ctrl+s":   "C-s", "ctrl+t": "C-t", "ctrl+u": "C-u",
  "ctrl+v":   "C-v", "ctrl+w": "C-w", "ctrl+x": "C-x",
  "ctrl+y":   "C-y", "ctrl+z": "C-z",
  "ctrl+\\":  "C-\\",
  // Alt combos
  "alt+b":    "M-b", "alt+f": "M-f", "alt+d": "M-d",
  "alt+.":    "M-.", "alt+/": "M-/",
  "alt+<":    "M-<", "alt+>": "M->",
  // Function keys
  "f1": "F1", "f2": "F2", "f3": "F3", "f4": "F4",
  "f5": "F5", "f6": "F6", "f7": "F7", "f8": "F8",
};

function sendTmuxKey(key: string): void {
  // Use sudo -u instead of su -l for reliability in non-TTY context
  execFileSync(
    "sudo",
    ["-u", DEV_USER, "tmux", "send-keys", "-t", `${TMUX_SESSION}:0.0`, key],
    { timeout: 2000, stdio: "ignore" }
  );
}

// POST /api/terminal/keys — send a named key
router.post("/terminal/keys", (req, res) => {
  const { key } = req.body as { key?: string };
  if (!key || typeof key !== "string") {
    res.status(400).json({ error: "key required" });
    return;
  }

  const tmuxKey = KEY_MAP[key.toLowerCase()];
  if (!tmuxKey) {
    res.status(400).json({ error: `unknown key: ${key}` });
    return;
  }

  try {
    sendTmuxKey(tmuxKey);
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, reason: "tmux session not available" });
  }
});

// POST /api/terminal/text — send arbitrary text (for mobile keyboard input)
router.post("/terminal/text", (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text required" });
    return;
  }
  // Limit to prevent abuse
  if (text.length > 2048) {
    res.status(400).json({ error: "text too long (max 2048 chars)" });
    return;
  }

  try {
    // Use tmux send-keys with the literal string
    execSync(
      `sudo -u ${DEV_USER} tmux send-keys -t ${TMUX_SESSION}:0.0 -- ${JSON.stringify(text)}`,
      { timeout: 3000, stdio: "ignore", shell: "/bin/bash" }
    );
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, reason: "tmux session not available" });
  }
});

export default router;
