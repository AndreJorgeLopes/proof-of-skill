#!/usr/bin/env bash
# Harness for optimize-skill's promptfoo determinism assertions.
# promptfoo exec provider calls: run-skill.sh "<input>"
#   <input> form: "/optimize-skill <path>"
# Env: SKILL_EVAL_MODEL (default haiku — validate/abort path is cheap)
set -euo pipefail

INPUT="${1:?usage: run-skill.sh '/optimize-skill <path>'}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="${SKILL_EVAL_MODEL:-claude-haiku-4-5-20251001}"
TIMEOUT="${SKILL_EVAL_TIMEOUT:-120}"

PROMPT="You are running the optimize-skill. Skill definition:

$(cat "$DIR/SKILL.md")

=== TASK ===
Execute: ${INPUT}
Run through Step 1 (Parse + validate) only. If any validation check fails,
output a single-line error in this exact format:
  ABORT: <reason>
No prose, no fences, no markdown. If validation passes (tessl logged in,
jq present, path valid, write access confirmed), output:
  VALIDATE_OK: score_field=<jq_expr>
and stop — do not proceed to Step 3 or beyond."

exec env CLAUDECODE="" timeout "$TIMEOUT" claude --model "$MODEL" --print "$PROMPT"
