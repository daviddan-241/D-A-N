#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# dotfiles-sync.sh — GitHub persistence for Render's zero-disk free tier
#
# On boot:
#   1. Clones/pulls DOTFILES_REPO  → ~/dotfiles  (shell config, keys, settings)
#   2. Clones/pulls PROJECTS_REPO  → ~/projects  (your code)
#   3. Registers a cron job that auto-pushes changes every 30 min
#
# Required env vars (set in Render dashboard):
#   GITHUB_TOKEN   — personal access token with repo scope
#   DOTFILES_REPO  — e.g. github.com/you/dan-dotfiles  (no https://)
#   PROJECTS_REPO  — e.g. github.com/you/dan-projects   (optional)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GITHUB_TOKEN="${GITHUB_TOKEN:-}"
DOTFILES_REPO="${DOTFILES_REPO:-}"
PROJECTS_REPO="${PROJECTS_REPO:-}"
DEV_USER="${DEV_USER:-devuser}"
HOME_DIR="/home/${DEV_USER}"

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [SYNC] $*"; }
warn() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [SYNC] WARN: $*" >&2; }

if [[ -z "${GITHUB_TOKEN}" ]]; then
  warn "GITHUB_TOKEN not set — GitHub sync disabled"
  exit 0
fi

# ── Git auth helper ───────────────────────────────────────────────────────────
authed_url() {
  local repo="$1"
  # Strip any existing protocol prefix, then inject token
  repo="${repo#https://}"
  repo="${repo#http://}"
  echo "https://${GITHUB_TOKEN}@${repo}"
}

# ── Clone or pull a repo ──────────────────────────────────────────────────────
sync_repo() {
  local repo_url="$1"
  local target_dir="$2"
  local label="$3"

  local auth_url
  auth_url="$(authed_url "${repo_url}")"

  if [[ -d "${target_dir}/.git" ]]; then
    log "Pulling ${label} (${target_dir}) ..."
    git -C "${target_dir}" pull --ff-only 2>&1 \
      && log "${label} up to date." \
      || warn "${label} pull failed — may have local divergence"
  else
    log "Cloning ${label} → ${target_dir} ..."
    mkdir -p "$(dirname "${target_dir}")"
    git clone --depth=1 "${auth_url}" "${target_dir}" 2>&1 \
      && log "${label} cloned." \
      || warn "${label} clone failed — check token + repo name"
  fi
}

# ── Configure git identity (needed for commits) ───────────────────────────────
git config --global user.email "dan@localhost" 2>/dev/null || true
git config --global user.name  "D.A.N." 2>/dev/null || true

# ── 1. Dotfiles ───────────────────────────────────────────────────────────────
if [[ -n "${DOTFILES_REPO}" ]]; then
  DOTFILES_DIR="${HOME_DIR}/dotfiles"
  sync_repo "${DOTFILES_REPO}" "${DOTFILES_DIR}" "dotfiles"

  # Run install script if present
  if [[ -f "${DOTFILES_DIR}/install.sh" ]]; then
    log "Running dotfiles/install.sh ..."
    bash "${DOTFILES_DIR}/install.sh" 2>&1 \
      && log "dotfiles installed." \
      || warn "dotfiles/install.sh failed — continuing"
  fi

  # Symlink common dotfiles into home if present
  for f in .bashrc .zshrc .vimrc .tmux.conf .gitconfig; do
    if [[ -f "${DOTFILES_DIR}/${f}" && ! -L "${HOME_DIR}/${f}" ]]; then
      cp "${HOME_DIR}/${f}" "${HOME_DIR}/${f}.bak.$(date +%s)" 2>/dev/null || true
      ln -sf "${DOTFILES_DIR}/${f}" "${HOME_DIR}/${f}"
      log "Linked: ${f}"
    fi
  done

  # ── Guard: keep the built-in D.A.N. prompt/aliases loading no matter what ──
  # If the dotfiles repo ships its own .bashrc (common — it was likely
  # auto-pushed from an earlier boot before bashrc_extra existed or was last
  # updated), the symlink above replaces the Docker image's freshly-baked
  # .bashrc wholesale, silently reverting prompt/alias fixes on every deploy
  # even though the image itself was rebuilt correctly. bashrc_extra is
  # always copied into $HOME independently of .bashrc (see Dockerfile), so
  # just make sure whatever .bashrc ends up in place actually sources it.
  if [[ -L "${HOME_DIR}/.bashrc" ]] && ! grep -qF '.bashrc_extra' "${HOME_DIR}/.bashrc" 2>/dev/null; then
    {
      echo ""
      echo "# D.A.N.: always load built-in prompt/aliases, even over a synced dotfiles .bashrc"
      echo '[ -f ~/.bashrc_extra ] && source ~/.bashrc_extra'
    } >> "${HOME_DIR}/.bashrc"
    log "dotfiles .bashrc didn't source .bashrc_extra — appended it so D.A.N.'s prompt/aliases still load"
  fi

  # Restore SSH authorized_keys if stored in dotfiles
  if [[ -f "${DOTFILES_DIR}/.ssh/authorized_keys" ]]; then
    mkdir -p "${HOME_DIR}/.ssh"
    cp "${DOTFILES_DIR}/.ssh/authorized_keys" "${HOME_DIR}/.ssh/authorized_keys"
    chmod 700 "${HOME_DIR}/.ssh"
    chmod 600 "${HOME_DIR}/.ssh/authorized_keys"
    log "SSH authorized_keys restored from dotfiles."
  fi
fi

# ── 2. Projects ───────────────────────────────────────────────────────────────
if [[ -n "${PROJECTS_REPO}" ]]; then
  PROJECTS_DIR="${HOME_DIR}/projects"
  sync_repo "${PROJECTS_REPO}" "${PROJECTS_DIR}" "projects"
fi

# ── 3. Register auto-push cron (every 30 min) ─────────────────────────────────
CRON_SCRIPT="${HOME_DIR}/.dan_autopush.sh"
cat > "${CRON_SCRIPT}" << 'AUTOPUSH'
#!/bin/bash
# D.A.N. auto-push — runs every 30 min via cron
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
DEV_USER="${DEV_USER:-devuser}"
HOME_DIR="/home/${DEV_USER}"
LOG="/var/log/ssh-container/autopush.log"

push_repo() {
  local dir="$1"
  local label="$2"
  [[ ! -d "${dir}/.git" ]] && return
  cd "${dir}"
  # Stage everything except secrets
  git add -A 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "auto-save $(date -u '+%Y-%m-%dT%H:%M:%SZ')" 2>/dev/null || true
    git push 2>/dev/null \
      && echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [AUTOPUSH] Pushed ${label}" >> "${LOG}" \
      || echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [AUTOPUSH] WARN: push ${label} failed" >> "${LOG}"
  fi
}

push_repo "${HOME_DIR}/dotfiles" "dotfiles"
push_repo "${HOME_DIR}/projects" "projects"
AUTOPUSH

chmod +x "${CRON_SCRIPT}"

# Install cron job (if cron is available)
if command -v crontab &>/dev/null; then
  # Preserve existing crontab, add our job if not already present
  (crontab -l 2>/dev/null | grep -v dan_autopush; \
   echo "*/30 * * * * GITHUB_TOKEN=${GITHUB_TOKEN} DEV_USER=${DEV_USER} bash ${CRON_SCRIPT}") \
  | crontab -
  log "Auto-push cron registered (every 30 min)"
fi

log "=== GitHub persistence sync complete ==="
log "  dotfiles: ${HOME_DIR}/dotfiles"
log "  projects: ${HOME_DIR}/projects"
log "  auto-push: every 30 min (check /var/log/ssh-container/autopush.log)"
log "  manual push: git-sync (alias)"
