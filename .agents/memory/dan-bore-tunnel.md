---
name: D.A.N. bore tunnel real-world quirks
description: Facts about the D.A.N. project's Render deployment and bore.pub tunnel that aren't obvious from a quick read of the code.
---

- This project (D.A.N. — Dynamic Access Node) is built to run as a single Docker web service on Render, with sshd/bore/ttyd baked into an Ubuntu image. On Replit, only the web dashboard (`artifacts/dan-ui`) and API (`artifacts/api-server`) run as plain Node dev servers — there is no Docker/sshd/bore here, so "SSH server: not running" / "SSH tunnel: not activated" on the Replit preview is correct/expected, not a bug.
  **Why:** Replit's environment doesn't grant raw sockets/NET_ADMIN or run the Ubuntu container image; this is an architectural mismatch, not a config error.
  **How to apply:** Don't try to "fix" SSH/bore not running when testing on Replit — that only ever works on the actual Render deployment.
- A shell script (`ssh-container/scripts/bore-watchdog.sh`) had a real bug: an unclosed single-quote inside a `grep -oE '[0-9]+` pattern (missing the closing `'`), which swallowed the rest of the file as a string literal and caused massive duplicated/corrupted content. This produced the bore.pub crash-loop seen in Render production logs (`TunnelManager: bore exited`, code 1, every ~30s).
  **Why:** bash doesn't syntax-check multi-hundred-line here-string bugs until runtime; the corruption was invisible in a cursory diff read.
  **How to apply:** When a shell script's file cleanly runs but shows repeated/duplicated blocks when read, check for an unterminated quote in a `grep -oE` pattern — regex character classes like `[0-9]+` need a closing quote before the newline.
