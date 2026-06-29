#!/usr/bin/env bash
# count_commits <rev-range> [repo-dir] -> stdout N (exit 0) | error (exit 1)
# Thin, sound wrapper over git rev-list --count. Errors (bad range, not a repo) -> AI.
# e.g. count_commits "origin/main..HEAD"
count_commits() {
  local range="${1:-}" dir="${2:-.}"
  [ -n "$range" ] || return 1
  git -C "$dir" rev-list --count "$range" 2>/dev/null || return 1
}
