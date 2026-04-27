---
id: CHORE-close-superseded-prs
title: "Close superseded and duplicate PRs"
priority: P1
category: chore
status: open
depends_on: []
estimated_effort: S
---

# Close Superseded PRs

## Context

Multiple coordination runs created duplicate PRs for the same tasks. This creates confusion about which PR is canonical.

## PRs to Close

| PR | Reason | Canonical |
|----|--------|-----------|
| #2 | Old monitor-skill, superseded | PR #15 |
| #4 | Old p95-hooks, superseded | PR #16 |
| #6 | Old coordination, superseded | PR #14, #17 |

## Process

For each PR:
1. Add a comment: "Superseded by PR #N — closing in favor of the newer implementation."
2. Close the PR

## Acceptance Criteria

- [ ] PRs #2, #4, #6 are closed with redirect comments
- [ ] No orphaned branches remain
