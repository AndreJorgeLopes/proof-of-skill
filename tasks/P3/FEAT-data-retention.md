---
id: FEAT-data-retention
title: "SQLite data retention and cleanup"
priority: P3
category: features
status: open
depends_on:
  - FEAT-sqlite-store
estimated_effort: S
files_to_touch:
  - core/metrics-store.ts
  - config/default.yaml
origin: "Review finding from PR #5 (May 11, 2026 coordination run)"
---

# SQLite Data Retention and Cleanup

## Context

The SQLite metrics store grows unbounded. PR #5's spec Technical Notes suggest a cleanup method that prunes records older than N days. This was flagged as a follow-up in the review.

## Desired Outcome

- Configurable retention period (default: 90 days)
- `cleanup()` method deletes records older than retention period
- Can be called manually or on a schedule
- Preserves at minimum the latest N scores per skill (even if older than retention)

## Acceptance Criteria

- [ ] `MetricsStore.cleanup(retentionDays?: number)` exists
- [ ] Deletes from all 4 tables (invocations, eval_scores, degradation_events, optimization_events)
- [ ] Keeps at least 1 record per skill regardless of age
- [ ] `config/default.yaml` has `retention_days: 90` default
