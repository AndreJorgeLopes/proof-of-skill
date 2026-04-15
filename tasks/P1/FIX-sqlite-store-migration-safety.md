---
id: FIX-sqlite-store-migration-safety
title: "Fix migration safety and type issues in SQLite store"
priority: P1
category: bugfix
status: open
depends_on:
  - FEAT-sqlite-store
estimated_effort: S
files_to_touch:
  - core/metrics-store.ts
  - core/migrate-jsonl.ts
  - package.json
---

# Fix SQLite Store Migration Safety

## Context

Code review of PR #5 (FEAT-sqlite-store) identified migration safety issues, a type mismatch, and a missing dependency that should be fixed.

## Problem Statement

1. **Non-transactional migrations**: Each migration runs `db.exec(sql)` then `setSchemaVersion(version)` as separate operations. If the process crashes between them, the database is in a partially-migrated state with no version record. Future migrations using `ALTER TABLE` would not be idempotent.

2. **Unconditional `markMigrated()` in JSONL migration**: The `migrate-jsonl.ts` script renames `.jsonl` files to `.jsonl.migrated` even if import partially failed. Records that failed to import are silently lost.

3. **`DegradationEvent` type mismatch**: The TypeScript interface and the INSERT statement have inconsistent fields, creating a confusing API.

4. **`tsx` not in devDependencies**: The migration script references `npx tsx` but `tsx` is not listed in `package.json`.

5. **`getDailyAggregates` misses days without evals**: The query is driven by `eval_scores` as the base table, so days with only invocations or degradations but no evals are absent from results.

6. **Score trend slope threshold is scale-dependent**: The linear regression slope threshold of 2 is unitless and not normalized by time or data point count.

## Desired Outcome

- Migrations wrapped in explicit transactions (atomic: either fully applied or fully rolled back)
- JSONL migration only renames files after all records successfully imported
- DegradationEvent interface matches INSERT usage
- `tsx` added to devDependencies
- getDailyAggregates uses a date-spine approach or UNION of all date sources
- Score trend threshold normalized per day or uses percentage change

## Implementation Guide

### Fix 1: Transactional migrations

```typescript
const runMigration = this.db.transaction((m: { version: number; sql: string }) => {
  this.db.exec(m.sql);
  this.setSchemaVersion(m.version);
});
for (const migration of MIGRATIONS) {
  if (migration.version > current) {
    runMigration(migration);
  }
}
```

### Fix 2: Conditional markMigrated

```typescript
const results = importScores(store);
if (results.failed === 0) {
  markMigrated(scoresPath);
} else {
  console.warn(`${results.failed} records failed to import. File not renamed.`);
}
```

### Fix 3: Add tsx dependency

```bash
npm install --save-dev tsx
```

### Fix 4: getDailyAggregates date-spine

Use a UNION of dates from all three tables as the base, then LEFT JOIN each table's aggregates.

## Acceptance Criteria

- [ ] Each migration runs inside a transaction (atomic apply + version update)
- [ ] JSONL migration only renames files when all records imported successfully
- [ ] DegradationEvent interface matches the INSERT parameter usage
- [ ] `tsx` is listed in devDependencies
- [ ] `npx tsc --noEmit` passes after all changes
- [ ] getDailyAggregates returns days that have activity in any table, not just eval_scores
