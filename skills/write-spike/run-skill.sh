#!/usr/bin/env bash
# promptfoo exec-provider wrapper for write-spike's determinism assertions.
# $1 = the rendered prompt. Clears CLAUDECODE so the nested claude launches (sdk#573).
set -euo pipefail
PROMPT="${1:?usage: run-skill.sh <prompt>}"
MODEL="${SKILL_EVAL_MODEL:-claude-haiku-4-5-20251001}"
TIMEOUT="${SKILL_EVAL_TIMEOUT:-300}"
exec env CLAUDECODE="" timeout "$TIMEOUT" claude --model "$MODEL" --print "$PROMPT"
