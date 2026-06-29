#!/usr/bin/env bash
# score_to_severity <int 0-100> -> stdout drop|suggestion|important|critical (exit 0)
#                                  | error (exit 1, non-integer / out of range)
# The BUCKETING is deterministic (a fixed ladder). The SCORE itself stays AI-produced —
# do NOT determinize the judgment that yields the number (review-skill D15, HIGH risk).
# Ladder: 90-100 critical | 75-89 important | 50-74 suggestion | 0-49 drop.
score_to_severity() {
  local s="${1:-}"
  [[ "$s" =~ ^[0-9]+$ ]] || return 1
  [ "$s" -ge 0 ] && [ "$s" -le 100 ] || return 1
  if   [ "$s" -ge 90 ]; then echo critical
  elif [ "$s" -ge 75 ]; then echo important
  elif [ "$s" -ge 50 ]; then echo suggestion
  else                       echo drop
  fi
}
