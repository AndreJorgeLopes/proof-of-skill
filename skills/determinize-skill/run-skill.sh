#!/usr/bin/env bash
# Harness for determinize-skill's own promptfoo self-assertions (closes self-audit D4).
# Injects this skill (SKILL.md + references/) then applies it to a target, headless.
#
# promptfoo exec provider calls: run-skill.sh "<input>"
#   <input> form: "apply determinize-skill to <target-skill-path>"
# Env: SKILL_EVAL_MODEL (default sonnet — audits need capability), SKILL_EVAL_TIMEOUT
set -euo pipefail

INPUT="${1:?usage: run-skill.sh 'apply determinize-skill to <path>'}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="${SKILL_EVAL_MODEL:-claude-sonnet-4-6}"
TIMEOUT="${SKILL_EVAL_TIMEOUT:-300}"

# target = last whitespace token of the input
TARGET="${INPUT##* }"

PROMPT="You are running the determinize-skill. Skill definition:

=== SKILL.md ===
$(cat "$DIR/SKILL.md")

=== references/pattern-catalog.md ===
$(cat "$DIR/references/pattern-catalog.md")

=== TASK ===
Apply this skill to the target file: ${TARGET} (read it). Output the audit EXACTLY
in the fixed schema. No prose preamble."

exec env CLAUDECODE="" timeout "$TIMEOUT" claude --model "$MODEL" --print "$PROMPT"
