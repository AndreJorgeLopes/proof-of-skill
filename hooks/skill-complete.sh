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

# ── Hook installation ───────────────────────────────────────────────────

install_hook() {
  local settings="${CLAUDE_SETTINGS:-$HOME/.claude/settings.json}"
  local hook_path
  hook_path="$(cd "$(dirname "$0")" && pwd)/skill-complete.sh"

  if [[ ! -f "$settings" ]]; then
    echo '{}' > "$settings"
  fi

  jq --arg path "$hook_path" \
    '.hooks["skill-complete"] = {"command": $path, "enabled": true}' \
    "$settings" > "$settings.tmp" && mv "$settings.tmp" "$settings"

  echo "Hook installed: $hook_path"
}

# Run install if called with --install flag
if [[ "${1:-}" == "--install" ]]; then
  install_hook
  exit 0
fi

# ── Configuration ────────────────────────────────────────────────────────

PROOF_DIR="${PROOF_OF_SKILL_DIR:-$HOME/.proof-of-skill}"
CONFIG="$PROOF_DIR/monitored-skills.json"

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
SKILL_CONFIG=$(jq -r --arg name "$SKILL_NAME" '.skills[$name] // empty' "$CONFIG" 2>/dev/null || true)
if [[ -z "$SKILL_CONFIG" ]]; then
  debug "Skill '$SKILL_NAME' is not monitored — exiting"
  exit 0
fi

debug "Skill '$SKILL_NAME' is monitored — evaluating sampling"

# Sanitize skill name for filesystem paths (allow only alphanumerics, hyphens, underscores)
SAFE_SKILL_NAME=$(echo "$SKILL_NAME" | tr -cd 'A-Za-z0-9_-')
if [[ -z "$SAFE_SKILL_NAME" ]]; then
  debug "Skill name '$SKILL_NAME' sanitizes to empty — exiting"
  exit 0
fi

# ── Debounce ─────────────────────────────────────────────────────────────
# Skip if we recently ran an eval for this skill.

MIN_INTERVAL=$(echo "$SKILL_CONFIG" | jq -r '.min_interval_seconds // empty' 2>/dev/null || true)
MIN_INTERVAL="${MIN_INTERVAL:-$DEFAULT_MIN_INTERVAL}"

TIMESTAMP_FILE="$PROOF_DIR/last-eval-${SAFE_SKILL_NAME}.timestamp"

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

# Guard against division by zero if config has sample_rate: 0
if [[ "$SAMPLE_RATE" -lt 1 ]]; then
  SAMPLE_RATE=20
fi

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
  set +e
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

  # Run the eval with timeout, capturing output to a secure temp file
  TMPFILE=$(mktemp /tmp/tessl-eval-XXXXXX)
  trap 'rm -f "$TMPFILE"' EXIT

  if command -v timeout &>/dev/null; then
    timeout "$EVAL_TIMEOUT" tessl eval --quick --scenarios "$SCENARIOS_PATH" > "$TMPFILE" 2>/dev/null || {
      debug "tessl eval failed or timed out (exit $?)"
      rm -f "$TMPFILE"
      return 0
    }
  else
    # macOS may not have timeout; portable fallback using background PID + sleep + kill
    tessl eval --quick --scenarios "$SCENARIOS_PATH" 2>/dev/null > "$TMPFILE" &
    local EVAL_PID=$!
    ( sleep "$EVAL_TIMEOUT" && kill "$EVAL_PID" 2>/dev/null ) &
    local WATCHDOG_PID=$!
    if ! wait "$EVAL_PID" 2>/dev/null; then
      kill "$WATCHDOG_PID" 2>/dev/null || true
      wait "$WATCHDOG_PID" 2>/dev/null || true
      rm -f "$TMPFILE"
      debug "tessl eval failed or timed out"
      return 0
    fi
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
  fi

  # Parse score from eval output (last line, extract number)
  SCORE=$(tail -1 "$TMPFILE" | grep -oE '[0-9]+' | head -1 || true)
  rm -f "$TMPFILE"
  if [[ -z "$SCORE" ]]; then
    debug "Could not parse score from eval output"
    return 0
  fi

  debug "Eval complete: score=$SCORE threshold=$THRESHOLD"

  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Record score (use jq for safe JSON construction; use original SKILL_NAME for JSON identity)
  jq -n --arg skill "$SKILL_NAME" --argjson score "$SCORE" --arg ts "$TIMESTAMP" \
    '{skill: $skill, score: $score, timestamp: $ts, sampled: true}' \
    >> "$PROOF_DIR/scores.jsonl"

  # Record degradation if below threshold
  if [[ "$SCORE" -lt "$THRESHOLD" ]]; then
    debug "Score $SCORE < threshold $THRESHOLD — recording degradation"
    BASELINE_SCORE=$(echo "$SKILL_CONFIG" | jq -r '.baseline_score // empty')
    if [[ -n "$BASELINE_SCORE" ]]; then
      DROP=$((BASELINE_SCORE - SCORE))
      jq -n --arg skill "$SKILL_NAME" --argjson score "$SCORE" --argjson threshold "$THRESHOLD" \
        --argjson baseline "$BASELINE_SCORE" --argjson drop "$DROP" --arg ts "$TIMESTAMP" \
        '{skill: $skill, score: $score, threshold: $threshold, baseline_score: $baseline, drop: $drop, timestamp: $ts}' \
        >> "$PROOF_DIR/degradations.jsonl"
    else
      jq -n --arg skill "$SKILL_NAME" --argjson score "$SCORE" --argjson threshold "$THRESHOLD" --arg ts "$TIMESTAMP" \
        '{skill: $skill, score: $score, threshold: $threshold, baseline_score: null, drop: null, timestamp: $ts}' \
        >> "$PROOF_DIR/degradations.jsonl"
    fi
  fi

  debug "Eval recorded for '$SKILL_NAME'"
}

# Update debounce timestamp BEFORE forking to prevent race condition
# where two rapid invocations both pass the debounce check
date +%s > "$TIMESTAMP_FILE"

# Run in background so the hook does not block the user
_run_eval &
disown 2>/dev/null || true

exit 0
