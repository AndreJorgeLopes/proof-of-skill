---
id: CHORE-update-task-statuses
title: "Update v1.0 task statuses to reflect completed PRs"
priority: P1
category: chore
status: done
pr: https://github.com/AndreJorgeLopes/proof-of-skill/pull/14
depends_on: []
estimated_effort: S
files_to_touch:
  - tasks/P1/FEAT-monitor-skill.md
  - tasks/P1/FEAT-p95-hooks.md
  - tasks/P1/FEAT-sqlite-store.md
  - tasks/P1/DOCS-readme.md
  - tasks/P2/FEAT-non-disruptive-notify.md
  - tasks/P2/FEAT-langfuse-adapter.md
  - tasks/P2/FEAT-background-optimize.md
  - tasks/P3/DOCS-contributing.md
  - tasks/P3/FEAT-cross-model-eval.md
  - tasks/P3/FEAT-dashboard.md
---

# Update v1.0 Task Statuses

## Context

All 10 v1.0 tasks have open PRs (#2-#11) from the April 15 autonomous coordination run, but the task files on main still show `status: open`. This creates confusion about what work remains.

## Problem Statement

Task files don't reflect reality. All tasks have been implemented and have PRs, but statuses haven't been updated on main.

## Desired Outcome

- All 10 task files updated with `status: done` and `pr:` field linking to their PR
- DOCS-readme additionally noted as completed on main (README exists)

## Task-to-PR Mapping

| Task | PR |
|------|-----|
| FEAT-monitor-skill | #2 |
| DOCS-contributing | #3 |
| FEAT-p95-hooks | #4 |
| FEAT-sqlite-store | #5 |
| FEAT-non-disruptive-notify | #7 |
| FEAT-langfuse-adapter | #8 |
| FEAT-background-optimize | #9 |
| FEAT-cross-model-eval | #10 |
| FEAT-dashboard | #11 |
| DOCS-readme | N/A (done on main) |
