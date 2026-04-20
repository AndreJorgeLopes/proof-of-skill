---
id: FEAT-monitor-skill
title: "/monitor-skill command with auto/manual scenarios"
priority: P1
category: features
status: in-review
depends_on: []
estimated_effort: M
files_to_touch:
  - skills/monitor-skill/SKILL.md
---

# /monitor-skill Command

## Context

proof-of-skill currently has `/create-skill` for building new skills through a TDD process. Once a skill is created and passes its initial eval, there is no mechanism to ensure it continues performing well over time. Model updates, prompt drift, dependency changes, and evolving usage patterns can all silently degrade a skill that once scored 95%.

The project needs a way to register any existing skill for ongoing quality monitoring. This is the bridge between "skill was created" and "skill stays reliable."

## Problem Statement

1. **No post-creation monitoring**: After `/create-skill` produces a skill with a passing eval score, there is no way to track whether that score holds over time
2. **No baseline capture**: When a user decides to monitor a skill, there is no snapshot of its current quality level to compare against future measurements
3. **Scenario authoring friction**: Users who want to add custom eval scenarios must currently write them manually in tessl format. There is no guided experience
4. **No auto-generation**: For users who just want monitoring without writing scenarios, there is no way to automatically generate meaningful eval scenarios from the skill's SKILL.md content

## Desired Outcome

- A `/monitor-skill` command that takes a skill name and optionally user-provided eval scenarios
- The command registers the skill for p95 sampling (consumed by `FEAT-p95-hooks`)
- If no scenarios are provided, the command auto-generates them from the skill's SKILL.md
- If scenarios are provided, the command reviews them against the skill's existing patterns and suggests improvements
- A baseline eval score is captured at registration time

## Implementation Guide

### Step 1: Create the `/monitor-skill` skill file

Create `skills/monitor-skill/SKILL.md`:

```markdown
---
name: monitor-skill
description: Add an existing skill to continuous p95 quality monitoring
---

# /monitor-skill

## Trigger
When the user invokes `/monitor-skill <skill-name> [scenarios...]`

## Step 1: Parse Arguments
- First argument: skill name (required)
- Everything after: optional eval scenarios (free-form text descriptions)
- If no skill name provided, list available skills and ask user to pick one

## Step 2: Locate the Skill
- Search for the skill in: skills/<name>/SKILL.md, ~/.claude/skills/<name>/SKILL.md
- Check tessl.json for registered skill paths
- If not found, report error with suggestions for similar skill names

## Step 3: Generate or Review Scenarios
...
```

### Step 2: Implement scenario auto-generation

When no user scenarios are provided, the command should:

1. Read the skill's SKILL.md file
2. Extract the skill's purpose, trigger conditions, and steps
3. Generate 5-8 eval scenarios targeting:
   - **Happy path**: Standard use case the skill was designed for
   - **Edge case**: Boundary conditions (empty input, very long input, special characters)
   - **Failure mode**: What happens when the skill's dependencies are unavailable
   - **Ambiguity**: Vague or underspecified user input that the skill must handle
   - **Adversarial**: Input that might cause the skill to produce harmful or incorrect output
4. Format scenarios in tessl eval format
5. Present scenarios to the user for review before committing

### Step 3: Implement scenario review for user-provided scenarios

When the user provides their own scenarios, the command should:

1. Parse the free-form text into individual scenario descriptions
2. Compare against the skill's SKILL.md to check for coverage gaps
3. Suggest additional scenarios for uncovered areas
4. Format all scenarios in tessl eval format
5. Let user approve/edit before committing

### Step 4: Capture baseline and register for monitoring

1. Run `tessl eval --quick` against the skill with the final scenario set
2. Record the baseline score, timestamp, and scenario count
3. Write the monitoring config to `~/.proof-of-skill/monitored-skills.json`:

```json
{
  "skills": {
    "grill-me": {
      "skill_path": "skills/grill-me/SKILL.md",
      "scenarios_path": "~/.proof-of-skill/scenarios/grill-me.yaml",
      "baseline_score": 92,
      "baseline_date": "2026-04-09T10:30:00Z",
      "threshold": 85,
      "sample_rate": 20,
      "scenario_count": 6
    }
  }
}
```

### Step 5: Confirmation output

Display to the user:
- Skill name and path
- Number of scenarios (auto-generated vs user-provided)
- Baseline eval score
- Monitoring threshold (default 85%, configurable)
- Sample rate (default 1-in-20, configurable)

## Acceptance Criteria

- [ ] `/monitor-skill grill-me` works end-to-end: locates the skill, auto-generates scenarios, captures baseline, registers for monitoring
- [ ] `/monitor-skill grill-me When given a vague plan, does it push back?` parses the user scenario and includes it alongside auto-generated ones
- [ ] Auto-generated scenarios cover at least: happy path, edge case, and ambiguity categories
- [ ] User-provided scenarios are reviewed against the skill content and coverage gaps are identified
- [ ] Baseline eval score is captured using `tessl eval --quick`
- [ ] Monitoring config is written to `~/.proof-of-skill/monitored-skills.json`
- [ ] Running `/monitor-skill` with no arguments lists available skills and prompts user to pick one
- [ ] Running `/monitor-skill nonexistent-skill` produces a helpful error with suggestions
- [ ] The command is idempotent: running it again on an already-monitored skill updates the config rather than duplicating
- [ ] Scenario files are stored at `~/.proof-of-skill/scenarios/<skill-name>.yaml`
- [ ] Threshold and sample rate are configurable via optional flags or config

## Technical Notes

- The auto-generation step uses the LLM to analyze SKILL.md content. The prompt should be explicit about generating diverse scenario types, not just happy-path variations
- Scenario format must be compatible with `tessl eval` expectations. Check `tessl` documentation for the exact YAML schema
- The `monitored-skills.json` file is the contract between `/monitor-skill` and `FEAT-p95-hooks`. The hooks will read this file to know which skills to sample and what thresholds to apply
- Skill discovery should check both local project skills and user-global skills (`~/.claude/skills/`)
- Consider supporting a `--dry-run` flag that shows what would be registered without writing any files
- The baseline capture step may take 30-60 seconds depending on scenario count. Show a progress indicator

## Verification

```bash
# 1. Register a skill with auto-generated scenarios
# /monitor-skill create-skill
# Expect: 5-8 scenarios generated, baseline score captured, config written

# 2. Register a skill with user-provided scenarios
# /monitor-skill create-skill When given a very vague skill idea, does it interview well?
# Expect: User scenario included, gaps identified, combined set used for baseline

# 3. Verify config was written
cat ~/.proof-of-skill/monitored-skills.json
# Expect: JSON with skill entry, baseline score, scenarios path

# 4. Verify scenarios file
cat ~/.proof-of-skill/scenarios/create-skill.yaml
# Expect: Valid YAML with scenario definitions

# 5. Re-register to verify idempotency
# /monitor-skill create-skill
# Expect: Config updated (not duplicated), new baseline captured

# 6. Test with nonexistent skill
# /monitor-skill totally-fake-skill
# Expect: Error message with suggestions for similar skill names

# 7. Test with no arguments
# /monitor-skill
# Expect: List of available skills with prompt to choose
```
