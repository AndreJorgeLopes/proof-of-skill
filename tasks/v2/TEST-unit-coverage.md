---
id: TEST-unit-coverage
title: "Unit tests for core TypeScript modules"
priority: P1
category: test
status: in-progress
---

# Unit Test Coverage

## Progress

- metrics-store.test.ts added to PR #5 (May 4) covering:
  - Table creation, score round-trips, invocation counts
  - Boolean conversion, REAL precision
  - Degradation lifecycle, trend calculation
  - V1→V2 migration data preservation

## Remaining

- notifier.test.ts (mock stdin/stderr, cooldown, TTY detection)
- migrate-jsonl.test.ts (JSONL parsing, transaction rollback)
