#!/usr/bin/env bash
set -euo pipefail

# ── proof-of-skill: p95 quality sampling hook ────────────────────────────
# Fires after a skill completion event in Claude Code.
# Samples 1-in-N invocations and runs a quick eval to detect degradation.
#
# Environment:
#   SKILL_NAME              — name of the completed skill (from hook context)
#   PROOF_OF_SKILL_DIR      — override base directory (default: ~/.proof-of-skill)
#   PROOF_OF_SKILL_DEBUG    — set to 1 for verbose logging
#   PROOF_OF_SKILL_SAMPLE   — set to "force" to always sample (testing)

# ── Helpers ──────────────────────────────────────────────────────────────

debug() {
  [[ "${PROOF_OF_SKILL_DEBUG:-0}" == "1" ]] && echo "[proof-of-skill] $*" >&2
  return 0
}

# ── Configuration ────────────────────────────────────────────────────────

PROOF_DIR="${PROOF_OF_SKILL_DIR:-$HOME/.proof-of-skill}"
CONFIG="$PROOF_DIR/monitored-skills.json"

# Load defaults from config/default.yaml sibling (best-effort)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CONFIG="$SCRIPT_DIR/../config/default.yaml"

DEFAULT_SAMPLE_RATE=20
DEFAULT_THRESHOLD=85
DEFAULT_MIN_INTERVAL=300
DEFAULT_EVAL_TIMEOUT=120

# ── Early exits ──────────────────────────────────────────────────────────

# No monitored skills config — nothing to do
if [[ ! -f "$CONFIG" ]]; then
  debug "No monitored-skills.json found at $CONFIG — exiting"
  exit 0
fi

# Extract skill name from environment or first argument
SKILL_NAME="${SKILL_NAME:-${1:-}}"
if [[ -z "$SKILL_NAME" ]]; then
  debug "No SKILL_NAME provided — exiting"
  exit 0
fi

# Verify jq is available
if ! command -v jq &>/dev/null; then
  debug "jq not found — cannot parse config, exiting"
  exit 0
fi

# Check if this skill is monitored
SKILL_CONFIG=$(jq -r ".skills[\"$SKILL_NAME\"] // empty" "$CONFIG" 2>/dev/null || true)
if [[ -z "$SKILL_CONFIG" ]]; then
  debug "Skill '$SKILL_NAME' is not monitored — exiting"
  exit 0
fi

debug "Skill '$SKILL_NAME' is monitored — evaluating sampling"

# ── Debounce ─────────────────────────────────────────────────────────────
# Skip if we recently ran an eval for this skill.

MIN_INTERVAL=$(echo "$SKILL_CONFIG" | jq -r '.min_interval_seconds // empty' 2>/dev/null || true)
MIN_INTERVAL="${MIN_INTERVAL:-$DEFAULT_MIN_INTERVAL}"

TIMESTAMP_FILE="$PROOF_DIR/last-eval-${SKILL_NAME}.timestamp"

if [[ -f "$TIMESTAMP_FILE" ]]; then
  LAST_EVAL=$(cat "$TIMESTAMP_FILE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  ELAPSED=$((NOW - LAST_EVAL))

  if [[ "$ELAPSED" -lt "$MIN_INTERVAL" ]]; then
    debug "Debounce: last eval was ${ELAPSED}s ago (min ${MIN_INTERVAL}s) — skipping"
    exit 0
  fi
fi

# ── Sampling decision ───────────────────────────────────────────────────
# 1-in-N sampling: only proceed if the random draw hits.

SAMPLE_RATE=$(echo "$SKILL_CONFIG" | jq -r '.sample_rate // empty' 2>/dev/null || true)
SAMPLE_RATE="${SAMPLE_RATE:-$DEFAULT_SAMPLE_RATE}"

if [[ "${PROOF_OF_SKILL_SAMPLE:-}" != "force" ]]; then
  RANDOM_NUM=$((RANDOM % SAMPLE_RATE))
  if [[ "$RANDOM_NUM" -ne 0 ]]; then
    debug "Not sampled (drew $RANDOM_NUM, need 0 out of $SAMPLE_RATE)"
    exit 0
  fi
fi

debug "Sampled! Running eval for '$SKILL_NAME'"

# ── Run eval (backgrounded) ─────────────────────────────────────────────
# Everything below here runs in a subshell so the hook returns immediately.

_run_eval() {
  SCENARIOS_PATH=$(echo "$SKILL_CONFIG" | jq -r '.scenarios_path // empty')
  THRESHOLD=$(echo "$SKILL_CONFIG" | jq -r '.threshold // empty')
  THRESHOLD="${THRESHOLD:-$DEFAULT_THRESHOLD}"
  EVAL_TIMEOUT="${DEFAULT_EVAL_TIMEOUT}"

  # Expand tilde in scenarios path
  SCENARIOS_PATH="${SCENARIOS_PATH/#\~/$HOME}"

  # Ensure storage directory exists
  mkdir -p "$PROOF_DIR"

  # Verify tessl is available
  if ! command -v tessl &>/dev/null; then
    debug "tessl not found in PATH — skipping eval"
    return 0
  fi

  # Verify scenarios file exists
  if [[ ! -f "$SCENARIOS_PATH" ]]; then
    debug "Scenarios file not found: $SCENARIOS_PATH — skipping eval"
    return 0
  fi

  # Run the eval with timeout
  EVAL_OUTPUT=""
  if command -v timeout &>/dev/null; then
    EVAL_OUTPUT=$(timeout "$EVAL_TIMEOUT" tessl eval --quick --scenarios "$SCENARIOS_PATH" 2>/dev/null) || {
      debug "tessl eval failed or timed out (exit $?)"
      return 0
    }
  else
    # macOS may not have timeout; fall back to bare eval
    EVAL_OUTPUT=$(tessl eval --quick --scenarios "$SCENARIOS_PATH" 2>/dev/null) || {
      debug "tessl eval failed (exit $?)"
      return 0
    }
  fi

  # Parse score from eval output (last line, extract number)
  SCORE=$(echo "$EVAL_OUTPUT" | tail -1 | grep -oE '[0-9]+' | head -1)
  if [[ -z "$SCORE" ]]; then
    debug "Could not parse score from eval output"
    return 0
  fi

  debug "Eval complete: score=$SCORE threshold=$THRESHOLD"

  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Record score
  echo "{\"skill\":\"$SKILL_NAME\",\"score\":$SCORE,\"timestamp\":\"$TIMESTAMP\",\"sampled\":true}" \
    >> "$PROOF_DIR/scores.jsonl"

  # Record degradation if below threshold
  if [[ "$SCORE" -lt "$THRESHOLD" ]]; then
    debug "Score $SCORE < threshold $THRESHOLD — recording degradation"
    BASELINE_SCORE=$(echo "$SKILL_CONFIG" | jq -r '.baseline_score // empty')
    DROP=""
    if [[ -n "$BASELINE_SCORE" ]]; then
      DROP=$((BASELINE_SCORE - SCORE))
    fi
    echo "{\"skill\":\"$SKILL_NAME\",\"score\":$SCORE,\"threshold\":$THRESHOLD,\"baseline_score\":${BASELINE_SCORE:-null},\"drop\":${DROP:-null},\"timestamp\":\"$TIMESTAMP\"}" \
      >> "$PROOF_DIR/degradations.jsonl"
  fi

  # Update debounce timestamp
  date +%s > "$TIMESTAMP_FILE"

  debug "Eval recorded for '$SKILL_NAME'"
}

# Run in background so the hook does not block the user
_run_eval &
disown 2>/dev/null || true

exit 0
