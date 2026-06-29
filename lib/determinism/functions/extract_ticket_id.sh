#!/usr/bin/env bash
# extract_ticket_id <string> -> stdout <id> (exit 0) | abstain (exit 10) | error (exit 1)
# Sound: matches only unambiguous known ticket schemes; abstains on unknown OR ambiguous.
# Schemes: JIRA-style PREFIX-NNN (>=2 upper letters), GitHub/GitLab #NNN.
# Edge cases that ABSTAIN (-> AI): digits-first (123-abc), 2+ distinct candidates, no match.
extract_ticket_id() {
  local s="${1:-}" hits n
  [ -n "$s" ] || return 1

  # JIRA-style PREFIX-NUMBER
  hits=$(printf '%s\n' "$s" | grep -oE '[A-Z]{2,}-[0-9]+' | sort -u)
  if [ -n "$hits" ]; then
    n=$(printf '%s\n' "$hits" | grep -c .)
    [ "$n" -eq 1 ] && { printf '%s\n' "$hits"; return 0; }
    return 10   # ambiguous: multiple distinct IDs
  fi

  # GitHub/GitLab issue #NUMBER
  hits=$(printf '%s\n' "$s" | grep -oE '#[0-9]+' | sort -u)
  if [ -n "$hits" ]; then
    n=$(printf '%s\n' "$hits" | grep -c .)
    [ "$n" -eq 1 ] && { printf '%s\n' "${hits#\#}"; return 0; }
    return 10
  fi

  return 10   # unknown scheme -> AI
}
