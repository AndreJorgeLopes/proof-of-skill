---
id: FEAT-sqlite-store
title: "Embedded SQLite metrics store"
priority: P1
category: features
status: in-review
pr: "#5"
depends_on:
  - FEAT-p95-hooks
estimated_effort: M
files_to_touch:
  - core/metrics-store.ts
---

# Embedded SQLite Metrics Store

## Context

The p95 sampling hooks generate eval scores, degradation events, and invocation records. Currently these are written to append-only JSONL files, which are simple but lack queryability: you cannot efficiently ask "what was the average score for skill X over the last 7 days?" or "how many invocations triggered a degradation event this month?" without reading and parsing the entire file.

proof-of-skill needs a structured, queryable store that is invisible to the user -- no servers to start, no ports to configure, no databases to provision. SQLite embedded at `~/.proof-of-skill/metrics.db` is the natural choice: zero-config, single-file, and capable of handling the query patterns needed for dashboards and trend analysis.

## Problem Statement

1. **JSONL is write-only**: The current append-only log files are simple to write but impossible to query efficiently. Any consumer (dashboard, notifier, optimizer) must parse the entire file
2. **No aggregation capability**: Questions like "average score over time" or "invocation count per day" require full-file scans and custom aggregation code
3. **No schema enforcement**: JSONL files accept any shape of data. A malformed line corrupts downstream consumers silently
4. **No migration path**: As proof-of-skill evolves, the data schema will change. JSONL has no built-in migration mechanism

## Desired Outcome

- A single SQLite database at `~/.proof-of-skill/metrics.db`
- Zero-config: the database is created automatically on first write
- Schema includes tables for: invocations, eval_scores, degradation_events, optimization_events
- A TypeScript module (`core/metrics-store.ts`) exposing a clean API for reads and writes
- The module handles schema creation, migrations, and connection pooling
- All downstream features (dashboard, notifier, optimizer) consume this API instead of reading files

## Implementation Guide

### Step 1: Define the database schema

```sql
-- Schema v1 for proof-of-skill metrics

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  was_sampled BOOLEAN NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eval_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  scenario_count INTEGER,
  eval_mode TEXT NOT NULL DEFAULT 'quick', -- 'quick' or 'full'
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS degradation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT 0,
  resolved BOOLEAN NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS optimization_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name TEXT NOT NULL,
  trigger_score INTEGER NOT NULL,
  result_score INTEGER,
  optimization_type TEXT NOT NULL, -- 'auto', 'manual', 'ralph-loop'
  session_id TEXT,
  duration_seconds INTEGER,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_eval_scores_skill_ts ON eval_scores(skill_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_invocations_skill_ts ON invocations(skill_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_degradation_skill ON degradation_events(skill_name, resolved);
CREATE INDEX IF NOT EXISTS idx_optimization_skill ON optimization_events(skill_name, timestamp);
```

### Step 2: Implement the metrics store module

Create `core/metrics-store.ts`:

```typescript
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';

const PROOF_DIR = process.env.PROOF_OF_SKILL_DIR || resolve(process.env.HOME!, '.proof-of-skill');
const DB_PATH = resolve(PROOF_DIR, 'metrics.db');

export interface EvalScore {
  skill_name: string;
  score: number;
  scenario_count?: number;
  eval_mode: 'quick' | 'full';
  timestamp: string;
}

export interface Invocation {
  skill_name: string;
  timestamp: string;
  was_sampled: boolean;
  duration_ms?: number;
}

export interface DegradationEvent {
  skill_name: string;
  score: number;
  threshold: number;
  timestamp: string;
}

export interface OptimizationEvent {
  skill_name: string;
  trigger_score: number;
  result_score?: number;
  optimization_type: 'auto' | 'manual' | 'ralph-loop';
  session_id?: string;
  duration_seconds?: number;
  timestamp: string;
}

export class MetricsStore {
  private db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    // Ensure directory exists
    const dir = resolve(dbPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  // ... write methods, read methods, aggregation queries
}
```

### Step 3: Implement write methods

```typescript
recordInvocation(inv: Invocation): void
recordEvalScore(score: EvalScore): void
recordDegradation(event: DegradationEvent): void
recordOptimization(event: OptimizationEvent): void
resolveDegradation(skillName: string): void
```

Each method uses a prepared statement for performance. Writes are wrapped in transactions when batching.

### Step 4: Implement read and aggregation methods

```typescript
// Recent scores for a skill
getRecentScores(skillName: string, limit?: number): EvalScore[]

// Average score over a time window
getAverageScore(skillName: string, since: string): number | null

// Score trend (is it improving, declining, or stable?)
getScoreTrend(skillName: string, windowDays?: number): 'improving' | 'declining' | 'stable'

// Invocation count per skill
getInvocationCounts(since?: string): Record<string, number>

// Unresolved degradation events
getUnresolvedDegradations(): DegradationEvent[]

// Optimization history
getOptimizationHistory(skillName: string): OptimizationEvent[]

// Daily aggregates for charting
getDailyAggregates(skillName: string, days?: number): Array<{
  date: string;
  avg_score: number;
  invocation_count: number;
  degradation_count: number;
}>
```

### Step 5: Migration system

```typescript
private migrate(): void {
  const currentVersion = this.getSchemaVersion();
  const migrations = [
    { version: 1, sql: SCHEMA_V1 },
    // Future migrations added here
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      this.db.exec(migration.sql);
      this.setSchemaVersion(migration.version);
    }
  }
}
```

### Step 6: Update the p95 hook to use the store

Once the store exists, update `hooks/skill-complete.sh` to call the store instead of writing JSONL:

```bash
# Replace JSONL writes with store calls
node -e "
  const { MetricsStore } = require('./core/metrics-store');
  const store = new MetricsStore();
  store.recordEvalScore({
    skill_name: '$SKILL_NAME',
    score: $SCORE,
    eval_mode: 'quick',
    timestamp: new Date().toISOString()
  });
"
```

Alternatively, provide a CLI wrapper: `proof-of-skill record-score --skill X --score Y`

## Acceptance Criteria

- [ ] `core/metrics-store.ts` exports a `MetricsStore` class
- [ ] The database is created automatically at `~/.proof-of-skill/metrics.db` on first instantiation
- [ ] The parent directory `~/.proof-of-skill/` is created if it does not exist
- [ ] Schema includes tables: `invocations`, `eval_scores`, `degradation_events`, `optimization_events`, `schema_version`
- [ ] WAL mode is enabled for concurrent read/write performance
- [ ] Write methods exist for all four event types: invocation, eval score, degradation, optimization
- [ ] Read methods support: recent scores, average score, score trend, invocation counts, unresolved degradations, optimization history, daily aggregates
- [ ] The migration system applies schema changes incrementally and idempotently
- [ ] Existing JSONL data can be imported into the new SQLite schema (migration script)
- [ ] The store handles concurrent access gracefully (WAL mode + busy timeout)
- [ ] All timestamps are stored in ISO 8601 UTC format
- [ ] The module has no external service dependencies (no network calls, no servers)

## Technical Notes

- **SQLite library**: Use `better-sqlite3` for synchronous, high-performance access. It is the standard for embedded SQLite in Node.js/TypeScript projects. Avoid `sql.js` (WASM-based, slower) or `sqlite3` (callback-based, harder to use)
- **WAL mode**: Write-Ahead Logging allows concurrent readers and a single writer without blocking. Essential since the hook writes while the dashboard reads
- **Prepared statements**: Use prepared statements for all repeated queries. `better-sqlite3` makes this easy with `.prepare()`. This matters for the hook path where latency is critical
- **Busy timeout**: Set `this.db.pragma('busy_timeout = 5000')` to handle lock contention gracefully rather than throwing immediately
- **Data retention**: Consider adding a cleanup method that prunes records older than N days (configurable, default 90 days). The database should not grow unbounded
- **Testing**: The constructor accepts a custom `dbPath`. For tests, use `:memory:` or a temp file to avoid polluting the user's real database
- **JSONL migration**: Include a one-time migration script that reads `scores.jsonl` and `degradations.jsonl`, imports into SQLite, and renames the files to `.jsonl.migrated`
- **Type safety**: All TypeScript interfaces should be strict. Use `as const` for enum-like fields. Consider using `zod` for runtime validation of data coming from the hook (which writes via shell)

## Verification

```bash
# 1. Verify module compiles
npx tsc core/metrics-store.ts --noEmit
# Expect: No errors

# 2. Verify database is created on first use
node -e "
  const { MetricsStore } = require('./core/metrics-store');
  const store = new MetricsStore('/tmp/test-proof.db');
  console.log('DB created');
"
ls -la /tmp/test-proof.db
# Expect: File exists

# 3. Verify write and read
node -e "
  const { MetricsStore } = require('./core/metrics-store');
  const store = new MetricsStore('/tmp/test-proof.db');
  store.recordEvalScore({
    skill_name: 'test-skill',
    score: 92,
    eval_mode: 'quick',
    timestamp: new Date().toISOString()
  });
  const scores = store.getRecentScores('test-skill');
  console.log(JSON.stringify(scores, null, 2));
"
# Expect: Array with one entry, score: 92

# 4. Verify schema version tracking
sqlite3 /tmp/test-proof.db "SELECT * FROM schema_version;"
# Expect: version=1, applied_at=<timestamp>

# 5. Verify aggregation
node -e "
  const { MetricsStore } = require('./core/metrics-store');
  const store = new MetricsStore('/tmp/test-proof.db');
  const trend = store.getScoreTrend('test-skill');
  console.log('Trend:', trend);
"
# Expect: 'stable' (only one data point)

# 6. Cleanup
rm /tmp/test-proof.db
```
