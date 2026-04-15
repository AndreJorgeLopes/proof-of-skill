---
id: FIX-p95-hooks-portability
title: "Fix macOS portability and jq injection in p95 hook"
priority: P1
category: bugfix
status: done
depends_on:
  - FEAT-p95-hooks
estimated_effort: S
files_to_touch:
  - hooks/skill-complete.sh
---

# Fix p95 Hook Portability and Security

## Context

Code review of PR #4 (FEAT-p95-hooks) identified two critical issues that should be fixed before the hook is used in production.

## Problem Statement

1. **`timeout` not available on stock macOS**: The hook uses GNU `timeout` which is not shipped with macOS. This means p95 sampling silently never works on Mac unless the user has Homebrew coreutils installed.

2. **jq injection via `$SKILL_NAME`**: The skill name from Claude Code's hook context is interpolated directly into jq filter strings. A skill name containing quotes or backslashes could break jq parsing or produce invalid JSON output.

3. **Debounce race condition**: The timestamp file is written inside the background subshell, creating a window where two near-simultaneous invocations could both pass debounce.

4. **Dead code**: `SKILL_PATH` is extracted from config but never used.

5. **`set -e` in background subshell**: An unguarded jq call for `baseline_score` could cause early exit under `set -e`.

## Desired Outcome

- Hook works correctly on stock macOS (no Homebrew dependency)
- All jq calls use `--arg` for safe variable interpolation
- JSONL output uses `jq -n` for safe JSON construction
- Debounce timestamp written before forking to prevent races
- Dead code removed
- All jq calls in background function guarded with `|| true`

## Implementation Guide

### Fix 1: Portable timeout wrapper

```bash
run_with_timeout() {
  local timeout_secs="$1"; shift
  if command -v timeout &>/dev/null; then
    timeout "$timeout_secs" "$@"
  elif command -v gtimeout &>/dev/null; then
    gtimeout "$timeout_secs" "$@"
  else
    "$@"  # No timeout available; run without it
  fi
}
```

### Fix 2: Safe jq interpolation

```bash
# Before (vulnerable)
SKILL_CONFIG=$(jq -r ".skills[\"$SKILL_NAME\"] // empty" "$CONFIG")

# After (safe)
SKILL_CONFIG=$(jq -r --arg name "$SKILL_NAME" '.skills[$name] // empty' "$CONFIG")
```

### Fix 3: Move debounce timestamp before fork

```bash
# Write timestamp BEFORE forking
date +%s > "$TIMESTAMP_FILE"
run_eval "$SKILL_NAME" "$SCENARIOS_PATH" "$THRESHOLD" &
```

### Fix 4-5: Remove dead code, guard jq calls

Remove `SKILL_PATH` line. Add `2>/dev/null || true` to `baseline_score` jq call.

## Acceptance Criteria

- [ ] Hook runs correctly on stock macOS (no `timeout` or `gtimeout` required)
- [ ] All `jq` calls use `--arg` for variable interpolation
- [ ] JSONL output lines are valid JSON even with unusual skill names
- [ ] Debounce prevents concurrent evals for the same skill
- [ ] No dead code (`SKILL_PATH` removed)
- [ ] `bash -n hooks/skill-complete.sh` passes

## Verification

```bash
# 1. Syntax check
bash -n hooks/skill-complete.sh

# 2. Test on macOS without timeout
which timeout  # Should not exist on stock macOS
SKILL_NAME=test-skill bash hooks/skill-complete.sh  # Should not error

# 3. Test with unusual skill name
SKILL_NAME='skill"with"quotes' bash hooks/skill-complete.sh  # Should exit cleanly
```
