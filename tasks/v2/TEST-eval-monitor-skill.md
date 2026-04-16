---
id: TEST-eval-monitor-skill
title: "Create eval scenarios for /monitor-skill"
priority: P2
category: testing
status: done
pr: https://github.com/AndreJorgeLopes/proof-of-skill/pull/13
depends_on:
  - FEAT-monitor-skill
estimated_effort: S
files_to_touch:
  - docs/eval/monitor-skill-scenarios.md
  - tessl.json
---

# Eval Scenarios for /monitor-skill

## Context

The project has eval scenarios for `/create-skill` and `/write-spike` but none for `/monitor-skill`. This means the newest P1 skill has no empirical quality measurement.

## Problem Statement

`/monitor-skill` (PR #2) was implemented without corresponding eval scenarios. There's no way to measure its quality over time or detect regressions.

## Desired Outcome

- 3+ pressure scenarios in `docs/eval/monitor-skill-scenarios.md`
- `tessl.json` updated to include `skills/monitor-skill` in the skills array
- Scenarios cover: happy path (register a skill), edge cases (nonexistent skill, already monitored), and adversarial (path traversal in skill name)

## Scenario Ideas

1. **Happy path**: "Monitor the create-skill skill" - tests full flow
2. **No arguments**: "/monitor-skill" with no skill name - tests interactive selection
3. **Nonexistent skill**: "Monitor a skill called xyz-fake" - tests error handling
4. **Already monitored**: Run monitor-skill twice on same skill - tests idempotency
5. **Path traversal**: "Monitor skill named ../../etc/passwd" - tests security
