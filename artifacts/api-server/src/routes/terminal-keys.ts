import { Router, type IRouter } from "express";
import { execFileSync } from "node:child_process";

const router: IRouter = Router();

const DEV_USER = process.env["DEV_USER"] ?? "devuser";
const TMUX_SESSION = "main";

// Map from UI key names → tmux send-keys format
const KEY_MAP: Record<string, string> = {
  escape:   "Escape",
  tab:      "Tab",
  up:       "Up",
  down:     "Down",
  left:     "Left",
  right:    "Right",
  backspace: "BSpace",
  "ctrl+a": "C-a", "ctrl+b": "C-b", "ctrl+c": "C-c",
  "ctrl+d": "C-d", "ctrl+e": "C-e", "ctrl+f": "C-f",
  "ctrl+g": "C-g", "ctrl+h": "C-h", "ctrl+k": "C-k",
  "ctrl+l": "C-l", "ctrl+n": "C-n", "ctrl+o": "C-o",
  "ctrl+p": "C-p", "ctrl+q": "C-q", "ctrl+r": "C-r",
  "ctrl+s": "C-s", "ctrl+t": "C-t", "ctrl+u": "C-u",
  "ctrl+v": "C-v", "ctrl+w": "C-w", "ctrl+x": "C-x",
  "ctrl+y": "C-y", "ctrl+z": "C-z",
  "ctrl+\\": "C-\\",
};

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
    // Send to devuser's tmux session via su — no password needed (NOPASSWD sudo config)
    execFileSync(
      "su",
      ["-l", DEV_USER, "-c", `tmux send-keys -t ${TMUX_SESSION}:0.0 ${tmuxKey}`],
      { timeout: 2000, stdio: "ignore" }
    );
    res.json({ ok: true });
  } catch {
    // Graceful — tmux session may not exist yet (dev mode / container not ready)
    res.status(503).json({ ok: false, reason: "tmux session not available" });
  }
});

export default router;
