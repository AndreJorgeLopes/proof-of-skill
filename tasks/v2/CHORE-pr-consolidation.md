---
id: CHORE-pr-consolidation
title: "Consolidate and merge v1.0 PRs in dependency order"
priority: P0
category: chore
status: open
depends_on: []
estimated_effort: M
---

# PR Consolidation and Merge

## Context

As of April 27, 2026 there are 17 open PRs and 0 merged. Multiple autonomous coordination runs (Apr 15, 16, 20, 27) have created PRs, reviewed them, and created follow-up tasks — but nothing has been merged to main. Some tasks have duplicate PRs (e.g., monitor-skill has PR #2 and #15).

## Problem

The growing number of unmerged PRs creates:
1. **Merge conflicts** as PRs drift from main
2. **Duplicate work** across coordination runs
3. **Stale reviews** that become irrelevant
4. **Confusion** about which PR is canonical

## Canonical PR Map

| Task | Canonical PR | Superseded PRs | Status |
|------|-------------|----------------|--------|
| DOCS-readme | (merged to main) | — | Done |
| FEAT-monitor-skill | #15 | #2 | Ready |
| FEAT-p95-hooks | #16 | #4 | Ready |
| FEAT-sqlite-store | #5 | — | Needs review fixes |
| FEAT-non-disruptive-notify | #7 | — | Needs review fixes |
| FEAT-langfuse-adapter | #8 | — | Needs review |
| FEAT-background-optimize | #9 | — | Needs review |
| FEAT-cross-model-eval | #10 | — | Needs review |
| FEAT-dashboard | #11 | — | Needs review |
| DOCS-contributing | #3 | — | Ready |

## Recommended Merge Order

1. PR #15 (monitor-skill) — no dependencies, reviewed and fixed
2. PR #16 (p95-hooks) — depends on monitor-skill
3. PR #5 (sqlite-store) — depends on p95-hooks, needs fixes first
4. PR #3 (CONTRIBUTING.md) — no blockers
5. PR #7 (notifier) — depends on p95-hooks, needs fixes first
6. PR #8 (langfuse) — depends on sqlite-store
7. PR #9 (background-optimize) — depends on notifier
8. PR #10 (cross-model-eval) — depends on monitor-skill
9. PR #11 (dashboard) — depends on sqlite-store

## Superseded PRs to Close

- PR #2 (old monitor-skill) — replaced by #15
- PR #4 (old p95-hooks) — replaced by #16
- PR #6 (old coordination) — superseded by #14, #17
- PR #1 (ImgBot) — stale optimization

## Acceptance Criteria

- [ ] Superseded PRs are closed with a comment pointing to the canonical PR
- [ ] Canonical PRs are merged in dependency order
- [ ] Each merge is verified to not break main
- [ ] Task statuses are updated to `done` as PRs merge
