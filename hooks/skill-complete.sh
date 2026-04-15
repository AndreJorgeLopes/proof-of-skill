#!/usr/bin/env bash
set -euo pipefail

# ── proof-of-skill: p95 sampling hook ────────────────────────────────────
# Fires after a skill completion event in Claude Code.
# Samples 1-in-N invocations and runs a quick eval to detect degradation.
#
# Environment variables:
#   PROOF_OF_SKILL_DIR    — Override base directory (default: ~/.proof-of-skill)
#   PROOF_OF_SKILL_DEBUG  — Set to 1 for verbose debug logging
#   SKILL_NAME            — Name of the skill that just completed
#
# Claude Code hook registration (add to .claude/settings.json):
#   {
#     "hooks": {
#       "PostToolUse": [{
#         "type": "command",
#         "command": "/path/to/hooks/skill-complete.sh",
#         "timeout": 180
#       }]
#     }
#   }
# ─────────────────────────────────────────────────────────────────────────

# ── Configuration ────────────────────────────────────────────────────────

PROOF_DIR="${PROOF_OF_SKILL_DIR:-$HOME/.proof-of-skill}"
CONFIG="$PROOF_DIR/monitored-skills.json"
SCORES_LOG="$PROOF_DIR/scores.jsonl"
DEGRADATIONS_LOG="$PROOF_DIR/degradations.jsonl"

# Defaults (overridden by per-skill config or config/default.yaml)
DEFAULT_SAMPLE_RATE=20
DEFAULT_THRESHOLD=85
DEFAULT_MIN_INTERVAL=300
DEFAULT_EVAL_TIMEOUT=120

# ── Debug helper ─────────────────────────────────────────────────────────

debug() {
  if [[ "${PROOF_OF_SKILL_DEBUG:-0}" == "1" ]]; then
    echo "[proof-of-skill] $*" >&2
  fi
}

# ── Prerequisite checks ─────────────────────────────────────────────────

# Exit early if no monitored skills config exists
if [[ ! -f "$CONFIG" ]]; then
  debug "No config at $CONFIG — exiting"
  exit 0
fi

# Require jq for JSON parsing
if ! command -v jq &>/dev/null; then
  debug "jq not found — exiting"
  exit 0
fi

# ── Extract skill name ───────────────────────────────────────────────────
# Claude Code passes hook context via stdin as JSON. We try to extract
# the skill name from the tool_name or skill_name field. Falls back to
# the SKILL_NAME environment variable or first argument.

SKILL_NAME="${SKILL_NAME:-}"

if [[ -z "$SKILL_NAME" ]]; then
  # Try reading from stdin (Claude Code hook context)
  if [[ ! -t 0 ]]; then
    HOOK_INPUT=$(cat)
    debug "Hook input: $HOOK_INPUT"
    # Extract skill name from the hook context JSON
    # Claude Code PostToolUse passes tool_name; we look for skill invocations
    SKILL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // .skill_name // empty' 2>/dev/null || true)
  fi
fi

# Fall back to first argument
if [[ -z "$SKILL_NAME" ]]; then
  SKILL_NAME="${1:-}"
fi

if [[ -z "$SKILL_NAME" ]]; then
  debug "No skill name found — exiting"
  exit 0
fi

debug "Skill name: $SKILL_NAME"

# ── Check if skill is monitored ──────────────────────────────────────────

SKILL_CONFIG=$(jq -r ".skills[\"$SKILL_NAME\"] // empty" "$CONFIG" 2>/dev/null || true)

if [[ -z "$SKILL_CONFIG" ]]; then
  debug "Skill '$SKILL_NAME' is not monitored — exiting"
  exit 0
fi

debug "Skill '$SKILL_NAME' is monitored"

# ── Parse skill-specific config ──────────────────────────────────────────

SAMPLE_RATE=$(echo "$SKILL_CONFIG" | jq -r ".sample_rate // $DEFAULT_SAMPLE_RATE")
THRESHOLD=$(echo "$SKILL_CONFIG" | jq -r ".threshold // $DEFAULT_THRESHOLD")
SCENARIOS_PATH=$(echo "$SKILL_CONFIG" | jq -r '.scenarios_path // empty')
SKILL_PATH=$(echo "$SKILL_CONFIG" | jq -r '.skill_path // empty')

# Expand ~ in paths
SCENARIOS_PATH="${SCENARIOS_PATH/#\~/$HOME}"

if [[ -z "$SCENARIOS_PATH" ]]; then
  debug "No scenarios_path for '$SKILL_NAME' — exiting"
  exit 0
fi

debug "Sample rate: 1-in-$SAMPLE_RATE | Threshold: $THRESHOLD | Scenarios: $SCENARIOS_PATH"

# ── Sampling decision: 1-in-N ────────────────────────────────────────────

RANDOM_NUM=$((RANDOM % SAMPLE_RATE))

if [[ "$RANDOM_NUM" -ne 0 ]]; then
  debug "Not sampled ($RANDOM_NUM != 0) — exiting"
  exit 0
fi

debug "Sampled! ($RANDOM_NUM == 0)"

# ── Debounce: check last eval timestamp ──────────────────────────────────

TIMESTAMP_FILE="$PROOF_DIR/last-eval-${SKILL_NAME}.timestamp"
MIN_INTERVAL="${DEFAULT_MIN_INTERVAL}"

# Read min_interval from skill config if available
SKILL_MIN_INTERVAL=$(echo "$SKILL_CONFIG" | jq -r '.min_interval_seconds // empty' 2>/dev/null || true)
if [[ -n "$SKILL_MIN_INTERVAL" ]]; then
  MIN_INTERVAL="$SKILL_MIN_INTERVAL"
fi

if [[ -f "$TIMESTAMP_FILE" ]]; then
  LAST_EVAL=$(cat "$TIMESTAMP_FILE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  ELAPSED=$((NOW - LAST_EVAL))

  if [[ "$ELAPSED" -lt "$MIN_INTERVAL" ]]; then
    debug "Debounce: last eval ${ELAPSED}s ago (min: ${MIN_INTERVAL}s) — skipping"
    exit 0
  fi
fi

debug "Debounce passed — proceeding to eval"

# ── Run eval in background ───────────────────────────────────────────────

run_eval() {
  local skill_name="$1"
  local scenarios_path="$2"
  local threshold="$3"
  local eval_timeout="${DEFAULT_EVAL_TIMEOUT}"

  debug "Running eval for '$skill_name'..."

  # Update timestamp immediately to prevent concurrent evals
  mkdir -p "$PROOF_DIR"
  date +%s > "$TIMESTAMP_FILE"

  # Check tessl is available
  if ! command -v tessl &>/dev/null; then
    debug "tessl not found — skipping eval"
    return 0
  fi

  # Check scenarios file exists
  if [[ ! -f "$scenarios_path" ]]; then
    debug "Scenarios file not found: $scenarios_path — skipping eval"
    return 0
  fi

  # Run the eval with timeout
  local eval_output
  if eval_output=$(timeout "$eval_timeout" tessl eval --quick --scenarios "$scenarios_path" 2>/dev/null); then
    debug "Eval output: $eval_output"
  else
    local exit_code=$?
    if [[ "$exit_code" -eq 124 ]]; then
      debug "Eval timed out after ${eval_timeout}s"
    else
      debug "Eval failed with exit code $exit_code"
    fi
    return 0
  fi

  # Extract score from eval output (last line, numeric value)
  local score
  score=$(echo "$eval_output" | tail -1 | grep -oE '[0-9]+' | head -1 || true)

  if [[ -z "$score" ]]; then
    debug "Could not parse score from eval output"
    return 0
  fi

  debug "Score: $score (threshold: $threshold)"

  # Record the score
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  local baseline_score
  baseline_score=$(echo "$SKILL_CONFIG" | jq -r '.baseline_score // empty')

  mkdir -p "$(dirname "$SCORES_LOG")"
  echo "{\"skill\":\"$skill_name\",\"score\":$score,\"threshold\":$threshold,\"baseline_score\":${baseline_score:-null},\"timestamp\":\"$timestamp\",\"sampled\":true}" \
    >> "$SCORES_LOG"

  debug "Score recorded to $SCORES_LOG"

  # Check threshold — write degradation event if below
  if [[ "$score" -lt "$threshold" ]]; then
    local drop=$((threshold - score))
    echo "{\"skill\":\"$skill_name\",\"score\":$score,\"threshold\":$threshold,\"drop\":$drop,\"timestamp\":\"$timestamp\"}" \
      >> "$DEGRADATIONS_LOG"

    debug "DEGRADATION: score $score < threshold $threshold (drop: $drop)"
  fi
}

# Run eval in a background subshell so it does not block the user
run_eval "$SKILL_NAME" "$SCENARIOS_PATH" "$THRESHOLD" &

debug "Eval launched in background (PID: $!)"
exit 0
