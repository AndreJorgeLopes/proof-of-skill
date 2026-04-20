---
id: FEAT-p95-hooks
title: "p95 sampling hooks for skill completions"
priority: P1
category: features
status: in-review
depends_on:
  - FEAT-monitor-skill
estimated_effort: M
files_to_touch:
  - hooks/skill-complete.sh
  - config/default.yaml
---

# p95 Sampling Hooks

## Context

Once a skill is registered for monitoring via `/monitor-skill`, something needs to actually observe skill invocations in the background and periodically run evals. Claude Code supports hooks -- shell scripts that execute on specific lifecycle events. A hook that fires after every skill completion can sample a fraction of invocations and run a quick eval to detect quality degradation before it becomes widespread.

The name "p95" refers to the goal: maintaining 95th-percentile quality across all monitored skills by catching the 5% of invocations where things go wrong.

## Problem Statement

1. **No runtime observation**: Skills execute and complete without any quality feedback loop. A skill could silently degrade across dozens of invocations before anyone notices
2. **No sampling mechanism**: Running a full eval after every skill invocation would be prohibitively slow and expensive. A lightweight sampling strategy is needed
3. **No connection to monitoring config**: `/monitor-skill` writes config, but nothing reads it to act on it
4. **No score capture**: Even when an eval is triggered, there is no mechanism to record the score for trend analysis

## Desired Outcome

- A Claude Code hook that fires after skill completions
- The hook samples 1-in-N invocations (default: 1-in-20, configurable)
- When sampled, it runs `tessl eval --quick` against the skill's registered scenarios
- Eval scores are recorded (consumed by `FEAT-sqlite-store`)
- If the score drops below the skill's threshold, a notification is triggered (consumed by `FEAT-non-disruptive-notify`)

## Implementation Guide

### Step 1: Create the hook script

Create `hooks/skill-complete.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Hook: fires after a skill completion event in Claude Code
# Purpose: p95 quality sampling for monitored skills

PROOF_DIR="${PROOF_OF_SKILL_DIR:-$HOME/.proof-of-skill}"
CONFIG="$PROOF_DIR/monitored-skills.json"
METRICS_DB="$PROOF_DIR/metrics.db"

# Exit early if no monitored skills config exists
[[ -f "$CONFIG" ]] || exit 0

# Extract skill name from hook arguments
# Claude Code passes the skill name as an environment variable or argument
SKILL_NAME="${SKILL_NAME:-$1}"
[[ -n "$SKILL_NAME" ]] || exit 0

# Check if this skill is monitored
SKILL_CONFIG=$(jq -r ".skills[\"$SKILL_NAME\"] // empty" "$CONFIG")
[[ -n "$SKILL_CONFIG" ]] || exit 0

# Sampling decision: 1-in-N
SAMPLE_RATE=$(echo "$SKILL_CONFIG" | jq -r '.sample_rate // 20')
RANDOM_NUM=$((RANDOM % SAMPLE_RATE))
[[ "$RANDOM_NUM" -eq 0 ]] || exit 0

# We've been sampled! Run the eval
SCENARIOS_PATH=$(echo "$SKILL_CONFIG" | jq -r '.scenarios_path')
THRESHOLD=$(echo "$SKILL_CONFIG" | jq -r '.threshold // 85')

# Run eval in background to avoid blocking the user
SCORE=$(tessl eval --quick --scenarios "$SCENARIOS_PATH" 2>/dev/null | tail -1 | grep -oE '[0-9]+')

# Record the score (stdout for now, FEAT-sqlite-store will add DB writes)
echo "{\"skill\":\"$SKILL_NAME\",\"score\":$SCORE,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"sampled\":true}" \
  >> "$PROOF_DIR/scores.jsonl"

# Check threshold
if [[ "$SCORE" -lt "$THRESHOLD" ]]; then
  # Write degradation event for the notifier to pick up
  echo "{\"skill\":\"$SKILL_NAME\",\"score\":$SCORE,\"threshold\":$THRESHOLD,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    >> "$PROOF_DIR/degradations.jsonl"
fi
```

### Step 2: Create the default configuration

Create `config/default.yaml`:

```yaml
# proof-of-skill default configuration

sampling:
  # 1-in-N invocations are sampled for eval
  rate: 20
  # Minimum seconds between evals for the same skill (debounce)
  min_interval_seconds: 300

eval:
  # Default quality threshold (percentage)
  threshold: 85
  # Eval mode: --quick for sampling, --full for scheduled runs
  mode: quick
  # Maximum eval duration before timeout (seconds)
  timeout: 120

storage:
  # Base directory for all proof-of-skill data
  base_dir: ~/.proof-of-skill
  # Metrics database filename (SQLite)
  db_file: metrics.db
  # Scores log (append-only, pre-SQLite fallback)
  scores_log: scores.jsonl
  # Degradation events log
  degradations_log: degradations.jsonl

notifications:
  # Whether to notify on degradation
  enabled: true
  # Minimum score drop to trigger notification
  min_drop: 10
  # Cooldown between notifications for the same skill (seconds)
  cooldown_seconds: 3600
```

### Step 3: Hook installation

The hook needs to be registered with Claude Code's hook system. Create an installation function:

```bash
# Install the hook into Claude Code's settings
# This adds the skill-complete hook to .claude/settings.json

install_hook() {
  local settings="$HOME/.claude/settings.json"
  local hook_path="$(cd "$(dirname "$0")" && pwd)/hooks/skill-complete.sh"

  # Use jq to add or update the hook
  jq --arg path "$hook_path" \
    '.hooks["skill-complete"] = {"command": $path, "enabled": true}' \
    "$settings" > "$settings.tmp" && mv "$settings.tmp" "$settings"
}
```

### Step 4: Debounce and rate limiting

The hook should respect the `min_interval_seconds` config to avoid running evals too frequently for the same skill:

1. Before running an eval, check `$PROOF_DIR/last-eval-<skill-name>.timestamp`
2. If the file exists and the timestamp is within the debounce window, skip this sample
3. After running an eval, update the timestamp file
4. This prevents scenarios where rapid skill invocations trigger multiple concurrent evals

## Acceptance Criteria

- [ ] `hooks/skill-complete.sh` exists and is executable
- [ ] The hook reads `~/.proof-of-skill/monitored-skills.json` to determine which skills are monitored
- [ ] The hook implements 1-in-N sampling with configurable rate (default: 1-in-20)
- [ ] When sampled, the hook runs `tessl eval --quick` with the skill's registered scenarios
- [ ] Eval scores are appended to `~/.proof-of-skill/scores.jsonl` with timestamp and skill name
- [ ] When score < threshold, a degradation event is written to `~/.proof-of-skill/degradations.jsonl`
- [ ] The hook exits immediately (exit 0) for non-monitored skills
- [ ] The hook exits immediately when no `monitored-skills.json` exists
- [ ] Debounce logic prevents multiple evals for the same skill within `min_interval_seconds`
- [ ] `config/default.yaml` contains all configurable values with sensible defaults
- [ ] The hook runs in the background and does not block the user's current workflow
- [ ] The hook handles errors gracefully (missing tessl, invalid config, eval timeout)
- [ ] Hook installation script correctly updates Claude Code's settings

## Technical Notes

- Claude Code hooks receive context about the completed action. Check the Claude Code documentation for the exact hook API: what environment variables are set, what arguments are passed, and how to register custom hooks
- The `tessl eval --quick` command is expected to output a score on its last line. Verify the exact output format and parse accordingly
- `$RANDOM` in bash is 15-bit (0-32767). For a 1-in-20 sample, `$RANDOM % 20 == 0` gives approximately 5% sampling. This is adequate for the purpose
- The `scores.jsonl` file is a transitional format. Once `FEAT-sqlite-store` is implemented, scores will be written directly to SQLite. The JSONL file serves as a fallback and migration source
- Consider adding a `PROOF_OF_SKILL_DEBUG=1` environment variable that logs sampling decisions for troubleshooting
- The hook must be POSIX-compatible enough to work on macOS (zsh default) and Linux (bash). Use `#!/usr/bin/env bash` and avoid bashisms where possible
- If `tessl` is not installed or not in PATH, the hook should silently skip (not crash Claude Code)

## Verification

```bash
# 1. Verify hook is executable
chmod +x hooks/skill-complete.sh
ls -la hooks/skill-complete.sh
# Expect: -rwxr-xr-x permissions

# 2. Test with a monitored skill (force sample by setting rate=1)
# First, register a skill:
# /monitor-skill create-skill
# Then modify sample_rate to 1 in monitored-skills.json for testing

SKILL_NAME=create-skill bash hooks/skill-complete.sh
# Expect: Score appended to ~/.proof-of-skill/scores.jsonl

# 3. Verify score was recorded
tail -1 ~/.proof-of-skill/scores.jsonl | jq .
# Expect: {"skill":"create-skill","score":N,"timestamp":"...","sampled":true}

# 4. Test with non-monitored skill
SKILL_NAME=nonexistent bash hooks/skill-complete.sh
echo $?
# Expect: exit code 0, no output, no score recorded

# 5. Test debounce
SKILL_NAME=create-skill bash hooks/skill-complete.sh
SKILL_NAME=create-skill bash hooks/skill-complete.sh
# Expect: Only first invocation runs eval (within debounce window)

# 6. Verify config is valid
python3 -c "import yaml; yaml.safe_load(open('config/default.yaml'))"
# Expect: No errors
```
