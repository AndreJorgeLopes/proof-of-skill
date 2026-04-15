#!/usr/bin/env bash
set -euo pipefail

# ── proof-of-skill installer ──────────────────────────────────────────────
# curl -fsSL https://raw.githubusercontent.com/AndreJorgeLopes/proof-of-skill/main/install.sh | bash
#
# Installs proof-of-skill skills into Claude Code with auto-update support.
# Safe to re-run: updates existing installation without losing config.

REPO="https://github.com/AndreJorgeLopes/proof-of-skill.git"
INSTALL_DIR="${HOME}/.local/share/proof-of-skill"
SKILLS_DIR="${HOME}/.claude/skills"

info()  { printf "\033[0;34m%s\033[0m\n" "$1"; }
ok()    { printf "\033[0;32m%s\033[0m\n" "$1"; }
warn()  { printf "\033[0;33m%s\033[0m\n" "$1"; }

# ── Prerequisites ─────────────────────────────────────────────────────────

if ! command -v git &>/dev/null; then
  warn "git is required. Install it first."
  exit 1
fi

# ── Clone or update ───────────────────────────────────────────────────────

if [ -d "${INSTALL_DIR}/.git" ]; then
  info "Updating proof-of-skill..."
  git -C "${INSTALL_DIR}" pull --ff-only --quiet 2>/dev/null || {
    warn "Could not fast-forward. Run: cd ${INSTALL_DIR} && git pull"
    exit 1
  }
  ok "Updated to latest version."
else
  info "Installing proof-of-skill..."
  mkdir -p "$(dirname "${INSTALL_DIR}")"
  git clone --quiet "${REPO}" "${INSTALL_DIR}"
  ok "Cloned to ${INSTALL_DIR}"
fi

# ── Symlink skills ────────────────────────────────────────────────────────

mkdir -p "${SKILLS_DIR}"

for skill_dir in "${INSTALL_DIR}"/skills/*/; do
  skill_name=$(basename "${skill_dir}")
  target="${SKILLS_DIR}/${skill_name}"

  if [ -L "${target}" ]; then
    rm "${target}"
  elif [ -d "${target}" ]; then
    warn "Skipping ${skill_name}: directory exists and is not a symlink."
    continue
  fi

  ln -sf "${skill_dir}" "${target}"
done

skill_count=$(find "${INSTALL_DIR}/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
ok "Linked ${skill_count} skills to ${SKILLS_DIR}"

# ── Make hooks executable ─────────────────────────────────────────────────

if [ -d "${INSTALL_DIR}/hooks" ]; then
  chmod +x "${INSTALL_DIR}"/hooks/*.sh 2>/dev/null || true
  ok "Made hooks executable"
fi

# ── Hook registration guidance ────────────────────────────────────────────
# Print instructions for registering the p95 sampling hook and auto-update.

SETTINGS_FILE="${HOME}/.claude/settings.json"
HOOK_PATH="${INSTALL_DIR}/hooks/skill-complete.sh"

echo ""
if [ -f "${HOOK_PATH}" ]; then
  info "p95 sampling hook available at: ${HOOK_PATH}"

  if [ -f "${SETTINGS_FILE}" ] && grep -q "skill-complete" "${SETTINGS_FILE}" 2>/dev/null; then
    ok "p95 hook already registered in settings.json"
  else
    info "To enable p95 quality sampling, add this to ${SETTINGS_FILE}:"
    echo ""
    echo '  "hooks": {'
    echo '    "PostToolUse": [{'
    echo '      "type": "command",'
    echo "      \"command\": \"${HOOK_PATH}\","
    echo '      "timeout": 180'
    echo '    }],'
    echo '    "SessionStart": [{'
    echo '      "type": "command",'
    echo '      "command": "git -C ~/.local/share/proof-of-skill pull --ff-only --quiet 2>/dev/null || true"'
    echo '    }]'
    echo '  }'
    echo ""
  fi
else
  if [ -f "${SETTINGS_FILE}" ]; then
    if ! grep -q "proof-of-skill" "${SETTINGS_FILE}" 2>/dev/null; then
      info "To enable auto-updates, add this hook to ${SETTINGS_FILE}:"
      echo ""
      echo '  "hooks": {'
      echo '    "SessionStart": [{'
      echo '      "type": "command",'
      echo '      "command": "git -C ~/.local/share/proof-of-skill pull --ff-only --quiet 2>/dev/null || true"'
      echo '    }]'
      echo '  }'
      echo ""
      info "Or re-run this installer anytime to update manually."
    fi
  else
    info "Tip: re-run this installer anytime to update, or set up a SessionStart hook for auto-updates."
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────

echo ""
ok "proof-of-skill is ready."
info "Available skills:"
for skill_dir in "${INSTALL_DIR}"/skills/*/; do
  skill_name=$(basename "${skill_dir}")
  echo "  /${skill_name}"
done
echo ""
info "Try it: /create-skill"
