---
id: TEST-unit-coverage
title: "Add unit tests for TypeScript core modules"
priority: P1
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
  - adapters/__tests__/langfuse.test.ts
---

# Unit Tests for TypeScript Core Modules

## Context

All v1.0 implementation PRs ship without automated tests. For a project whose philosophy is "if your skills aren't tested, they're just suggestions," the absence of unit tests is a critical gap. Every coordination run since April 15 has flagged this.

## Problem

1. PRs #5 (sqlite-store), #7 (notifier), #8 (langfuse) have 4000+ lines of TypeScript with zero test coverage
2. Bugs found in reviews (INTEGER/float mismatch, command injection) would have been caught by tests
3. No confidence that future changes won't break existing functionality

## Scope

- `core/metrics-store.ts` — CRUD operations, aggregation queries, migration system
- `core/notifier.ts` — cooldown logic, notification formatting, option handling
- `adapters/langfuse.ts` — trace recording, score normalization, health check
- `adapters/index.ts` — factory pattern, noop fallback

## Acceptance Criteria

- [ ] Test files exist for all three modules
- [ ] Tests use `:memory:` SQLite for metrics-store (no filesystem)
- [ ] Tests mock Langfuse SDK for adapter tests
- [ ] Tests cover: happy path, edge cases, error handling
- [ ] Tests can be run with `npm test` or `npx vitest`
- [ ] At least 80% line coverage for core modules
