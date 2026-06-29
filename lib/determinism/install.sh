#!/usr/bin/env bash
# Install the determinism-fix library to ~/.claude/lib/determinism so any skill can
# source it. Idempotent. Run from anywhere.
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST="${1:-$HOME/.claude/lib/determinism}"
mkdir -p "$DST/functions"
cp "$SRC"/functions/*.sh "$DST/functions/"
cp "$SRC"/index.json "$SRC"/CONTRACT.md "$DST/"
chmod +x "$DST"/functions/*.sh 2>/dev/null || true
echo "installed $(ls "$DST"/functions/*.sh | wc -l | tr -d ' ') determinism functions -> $DST"
echo "skills source via:  for f in $DST/functions/*.sh; do . \"\$f\"; done"
