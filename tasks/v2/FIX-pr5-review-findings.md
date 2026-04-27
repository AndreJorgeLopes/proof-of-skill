---
id: FIX-pr5-review-findings
title: "Fix critical issues in PR #5 (SQLite store)"
priority: P1
category: fix
status: open
depends_on: []
estimated_effort: S
---

# Fix PR #5 Review Findings

## Context

PR #14 (April 16 coordination) identified 2 critical issues in PR #5:
1. **INTEGER/float type mismatch**: SQL INTEGER columns silently truncate float scores — affects accuracy of all downstream metrics
2. **Zero automated tests**: 1788 additions with no test coverage

## Fixes Required

1. Change `score INTEGER` columns to `score REAL` in the schema for `eval_scores` and `degradation_events` tables
2. Update TypeScript interfaces to use `number` consistently (already done, but verify)
3. Add migration v2 that ALTERs existing INTEGER columns to REAL

## Implementation

Push fixes directly to the `worktree-agent-abec8561` branch (PR #5's branch) rather than creating a new PR.

## Acceptance Criteria

- [ ] Score columns use REAL type in schema
- [ ] Migration v2 handles upgrade from INTEGER to REAL
- [ ] No truncation when storing scores like 92.5
