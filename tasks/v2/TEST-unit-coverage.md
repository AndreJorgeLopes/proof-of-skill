---
id: TEST-unit-coverage
title: "Add unit tests for TypeScript core modules"
priority: P2
category: testing
status: open
depends_on:
  - FEAT-sqlite-store
  - FEAT-non-disruptive-notify
  - FEAT-langfuse-adapter
estimated_effort: L
files_to_touch:
  - core/__tests__/metrics-store.test.ts
  - core/__tests__/notifier.test.ts
  - adapters/__tests__/langfuse-adapter.test.ts
  - package.json
  - tsconfig.json
---

# Unit Tests for TypeScript Core Modules

## Context

The v1.0 autonomous coordination run (April 15) created 8 implementation PRs with +8,000 lines of TypeScript code across core/metrics-store.ts, core/notifier.ts, core/optimizer.ts, core/cross-model-eval.ts, adapters/, and dashboard/. None of these have unit tests.

## Problem Statement

1. **Zero test coverage**: No unit tests exist for any TypeScript module
2. **Regression risk**: Changes to metrics-store.ts could silently break downstream consumers
3. **Schema migration risk**: SQLite migrations have no automated verification
4. **Confidence gap**: Cannot merge PRs with confidence that modules work correctly

## Desired Outcome

- Vitest test runner configured in package.json
- Unit tests for MetricsStore (CRUD, migrations, aggregation queries)
- Unit tests for Notifier (cooldown logic, threshold detection)
- Unit tests for LangfuseAdapter (trace management, TTL eviction)
- At least 80% coverage on core modules

## Technical Notes

- Project uses ESM (`"type": "module"`) and Node16 resolution
- better-sqlite3 is used for MetricsStore - tests can use in-memory databases
- Notifier writes to stderr - tests should capture/mock stderr
- LangfuseAdapter has TTL eviction - tests should verify memory cleanup
