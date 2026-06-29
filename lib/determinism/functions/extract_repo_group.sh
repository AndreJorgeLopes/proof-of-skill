#!/usr/bin/env bash
# extract_repo_group <remote-url> -> stdout <group/subgroup> (exit 0)
#                                   | abstain (exit 10) | error (exit 1)
# Strips protocol+host and the trailing repo leaf; returns the group path.
# Abstains when the URL has no group segment (host/repo only) or doesn't parse.
extract_repo_group() {
  local u="${1:-}" path
  [ -n "$u" ] || return 1
  # strip ssh "git@host:" or "https://host/", and trailing ".git"
  path=$(printf '%s' "$u" | sed -E 's|^git@[^:]+:||; s|^[a-z]+://[^/]+/||; s|\.git$||')
  case "$path" in
    */*/*|*/*) printf '%s\n' "${path%/*}"; return 0 ;;  # has group/.../repo
    *)         return 10 ;;                              # no group segment -> AI
  esac
}
