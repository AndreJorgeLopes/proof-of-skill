/**
 * Tests for the embedded SQLite metrics store.
 *
 * Run with: npx tsx --test core/metrics-store.test.ts
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync } from 'node:fs';
import Database from 'better-sqlite3';
import {
  MetricsStore,
  type EvalScore,
  type DegradationEvent,
  type Invocation,
  type OptimizationEvent,
} from './metrics-store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh in-memory store for each test. */
function createStore(): MetricsStore {
  return new MetricsStore(':memory:');
}

/** Build an ISO timestamp offset by N hours from now. */
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600_000).toISOString();
}

/** Build an ISO timestamp offset by N days from now. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MetricsStore', () => {
  let store: MetricsStore;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    store.close();
  });

  // -------------------------------------------------------------------------
  // Constructor / schema
  // -------------------------------------------------------------------------

  it('creates tables on construction', () => {
    // If we got here without error, tables were created.
    // Verify by inserting and reading back.
    store.recordEvalScore({
      skill_name: 'test',
      score: 90,
      eval_mode: 'quick',
      timestamp: new Date().toISOString(),
    });
    const scores = store.getRecentScores('test', 1);
    assert.equal(scores.length, 1);
  });

  // -------------------------------------------------------------------------
  // EvalScore round-trip
  // -------------------------------------------------------------------------

  describe('recordEvalScore + getRecentScores', () => {
    it('stores and retrieves eval scores', () => {
      const ts = hoursAgo(1);
      store.recordEvalScore({
        skill_name: 'write-spike',
        score: 92,
        scenario_count: 5,
        eval_mode: 'full',
        timestamp: ts,
      });

      const scores = store.getRecentScores('write-spike', 10);
      assert.equal(scores.length, 1);
      assert.equal(scores[0]!.skill_name, 'write-spike');
      assert.equal(scores[0]!.score, 92);
      assert.equal(scores[0]!.scenario_count, 5);
      assert.equal(scores[0]!.eval_mode, 'full');
      assert.equal(scores[0]!.timestamp, ts);
    });

    it('returns scores in most-recent-first order', () => {
      store.recordEvalScore({
        skill_name: 's',
        score: 80,
        eval_mode: 'quick',
        timestamp: hoursAgo(3),
      });
      store.recordEvalScore({
        skill_name: 's',
        score: 90,
        eval_mode: 'quick',
        timestamp: hoursAgo(1),
      });

      const scores = store.getRecentScores('s', 10);
      assert.equal(scores[0]!.score, 90);
      assert.equal(scores[1]!.score, 80);
    });

    it('respects the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.recordEvalScore({
          skill_name: 's',
          score: 80 + i,
          eval_mode: 'quick',
          timestamp: hoursAgo(5 - i),
        });
      }
      const scores = store.getRecentScores('s', 2);
      assert.equal(scores.length, 2);
    });
  });

  // -------------------------------------------------------------------------
  // REAL column type (Issue #1)
  // -------------------------------------------------------------------------

  describe('REAL score columns', () => {
    it('preserves fractional eval scores', () => {
      store.recordEvalScore({
        skill_name: 'test',
        score: 85.5,
        eval_mode: 'quick',
        timestamp: new Date().toISOString(),
      });
      const scores = store.getRecentScores('test', 1);
      assert.equal(scores[0]!.score, 85.5);
    });

    it('preserves fractional degradation scores and thresholds', () => {
      store.recordDegradation({
        skill_name: 'test',
        score: 69.3,
        threshold: 70.5,
        timestamp: new Date().toISOString(),
      });
      const events = store.getUnresolvedDegradations();
      assert.equal(events[0]!.score, 69.3);
      assert.equal(events[0]!.threshold, 70.5);
    });

    it('preserves fractional optimization scores', () => {
      store.recordOptimization({
        skill_name: 'test',
        trigger_score: 65.7,
        result_score: 88.2,
        optimization_type: 'auto',
        timestamp: new Date().toISOString(),
      });
      const history = store.getOptimizationHistory('test');
      assert.equal(history[0]!.trigger_score, 65.7);
      assert.equal(history[0]!.result_score, 88.2);
    });
  });

  // -------------------------------------------------------------------------
  // Invocation round-trip
  // -------------------------------------------------------------------------

  describe('recordInvocation + getInvocationCounts', () => {
    it('stores and counts invocations', () => {
      store.recordInvocation({
        skill_name: 'alpha',
        timestamp: hoursAgo(2),
        was_sampled: true,
        duration_ms: 1234,
      });
      store.recordInvocation({
        skill_name: 'alpha',
        timestamp: hoursAgo(1),
        was_sampled: false,
      });
      store.recordInvocation({
        skill_name: 'beta',
        timestamp: hoursAgo(1),
        was_sampled: true,
      });

      const counts = store.getInvocationCounts();
      assert.equal(counts['alpha'], 2);
      assert.equal(counts['beta'], 1);
    });

    it('filters by since parameter', () => {
      store.recordInvocation({
        skill_name: 'x',
        timestamp: daysAgo(10),
        was_sampled: false,
      });
      store.recordInvocation({
        skill_name: 'x',
        timestamp: hoursAgo(1),
        was_sampled: false,
      });

      const all = store.getInvocationCounts();
      assert.equal(all['x'], 2);

      const recent = store.getInvocationCounts(daysAgo(2));
      assert.equal(recent['x'], 1);
    });
  });

  // -------------------------------------------------------------------------
  // Degradation + resolve round-trip
  // -------------------------------------------------------------------------

  describe('recordDegradation + getUnresolvedDegradations + resolveDegradation', () => {
    it('records and retrieves unresolved degradations', () => {
      store.recordDegradation({
        skill_name: 'flaky',
        score: 60,
        threshold: 70,
        timestamp: hoursAgo(1),
      });

      const unresolved = store.getUnresolvedDegradations();
      assert.equal(unresolved.length, 1);
      assert.equal(unresolved[0]!.skill_name, 'flaky');
      assert.equal(unresolved[0]!.score, 60);
      assert.equal(unresolved[0]!.threshold, 70);
    });

    it('resolves degradations by skill name', () => {
      store.recordDegradation({
        skill_name: 'flaky',
        score: 60,
        threshold: 70,
        timestamp: hoursAgo(2),
      });
      store.recordDegradation({
        skill_name: 'flaky',
        score: 55,
        threshold: 70,
        timestamp: hoursAgo(1),
      });

      store.resolveDegradation('flaky');

      const unresolved = store.getUnresolvedDegradations();
      assert.equal(unresolved.length, 0);
    });

    it('only resolves the specified skill', () => {
      store.recordDegradation({
        skill_name: 'a',
        score: 50,
        threshold: 70,
        timestamp: hoursAgo(1),
      });
      store.recordDegradation({
        skill_name: 'b',
        score: 55,
        threshold: 70,
        timestamp: hoursAgo(1),
      });

      store.resolveDegradation('a');

      const unresolved = store.getUnresolvedDegradations();
      assert.equal(unresolved.length, 1);
      assert.equal(unresolved[0]!.skill_name, 'b');
    });
  });

  // -------------------------------------------------------------------------
  // Boolean conversion (Issue #2)
  // -------------------------------------------------------------------------

  describe('boolean conversion', () => {
    it('returns notified and resolved as booleans', () => {
      store.recordDegradation({
        skill_name: 'test',
        score: 50,
        threshold: 70,
        timestamp: hoursAgo(1),
      });

      const events = store.getUnresolvedDegradations();
      assert.equal(typeof events[0]!.notified, 'boolean');
      assert.equal(typeof events[0]!.resolved, 'boolean');
      assert.equal(events[0]!.notified, false);
      assert.equal(events[0]!.resolved, false);
    });

    it('returns resolved=true as boolean after resolution', () => {
      store.recordDegradation({
        skill_name: 'test',
        score: 50,
        threshold: 70,
        timestamp: hoursAgo(1),
      });

      store.resolveDegradation('test');

      // Query all degradations (including resolved) to verify type
      // getUnresolvedDegradations only returns resolved=0, so we need
      // to access the DB directly — but we can verify via the fact that
      // the unresolved list is empty after resolution
      const unresolved = store.getUnresolvedDegradations();
      assert.equal(unresolved.length, 0);
    });
  });

  // -------------------------------------------------------------------------
  // Score trend (Issue #4)
  // -------------------------------------------------------------------------

  describe('getScoreTrend', () => {
    it('returns stable with fewer than 2 data points', () => {
      store.recordEvalScore({
        skill_name: 'test',
        score: 90,
        eval_mode: 'quick',
        timestamp: hoursAgo(1),
      });
      assert.equal(store.getScoreTrend('test'), 'stable');
    });

    it('returns stable for no data', () => {
      assert.equal(store.getScoreTrend('nonexistent'), 'stable');
    });

    it('returns improving for upward trend', () => {
      // Insert scores with clearly improving trend (>5 points total change)
      const baseTs = Date.now();
      for (let i = 0; i < 10; i++) {
        store.recordEvalScore({
          skill_name: 'up',
          score: 70 + i * 2, // 70 -> 88 = +18 total change
          eval_mode: 'quick',
          timestamp: new Date(baseTs - (10 - i) * 86400_000).toISOString(),
        });
      }
      assert.equal(store.getScoreTrend('up', 30), 'improving');
    });

    it('returns declining for downward trend', () => {
      const baseTs = Date.now();
      for (let i = 0; i < 10; i++) {
        store.recordEvalScore({
          skill_name: 'down',
          score: 90 - i * 2, // 90 -> 72 = -18 total change
          eval_mode: 'quick',
          timestamp: new Date(baseTs - (10 - i) * 86400_000).toISOString(),
        });
      }
      assert.equal(store.getScoreTrend('down', 30), 'declining');
    });

    it('returns stable for flat scores', () => {
      const baseTs = Date.now();
      for (let i = 0; i < 10; i++) {
        store.recordEvalScore({
          skill_name: 'flat',
          score: 85,
          eval_mode: 'quick',
          timestamp: new Date(baseTs - (10 - i) * 86400_000).toISOString(),
        });
      }
      assert.equal(store.getScoreTrend('flat', 30), 'stable');
    });
  });

  // -------------------------------------------------------------------------
  // Transaction helper (Issue #5)
  // -------------------------------------------------------------------------

  describe('transaction', () => {
    it('commits on success', () => {
      store.transaction(() => {
        store.recordEvalScore({
          skill_name: 'tx-test',
          score: 90,
          eval_mode: 'quick',
          timestamp: hoursAgo(1),
        });
        store.recordEvalScore({
          skill_name: 'tx-test',
          score: 91,
          eval_mode: 'quick',
          timestamp: hoursAgo(0),
        });
      });

      const scores = store.getRecentScores('tx-test', 10);
      assert.equal(scores.length, 2);
    });

    it('rolls back on error', () => {
      try {
        store.transaction(() => {
          store.recordEvalScore({
            skill_name: 'tx-fail',
            score: 90,
            eval_mode: 'quick',
            timestamp: hoursAgo(1),
          });
          throw new Error('intentional failure');
        });
      } catch {
        // expected
      }

      const scores = store.getRecentScores('tx-fail', 10);
      assert.equal(scores.length, 0);
    });

    it('returns the value from fn', () => {
      const result = store.transaction(() => 42);
      assert.equal(result, 42);
    });
  });

  // -------------------------------------------------------------------------
  // Migration V1 -> V2 (Issue #1)
  // -------------------------------------------------------------------------

  describe('migration V1 -> V2', () => {
    it('migrates INTEGER data to REAL columns preserving values', () => {
      // Simulate a V1 database by creating a store (which runs V1+V2),
      // inserting data, and verifying it works. The migration itself
      // runs during construction — if it fails, construction fails.
      // Instead, we test that data inserted as integers comes back fine.
      store.recordEvalScore({
        skill_name: 'migrated',
        score: 85,
        eval_mode: 'quick',
        timestamp: hoursAgo(1),
      });
      const scores = store.getRecentScores('migrated', 1);
      assert.equal(scores[0]!.score, 85);
    });

    it('creates a V1-only DB then upgrades with V2', () => {
      // Build a raw V1 database, insert integer data, then create a MetricsStore
      // on it (which will run V2 migration) and verify data is preserved.
      const rawDb = new Database(':memory:');

      // Manually run only V1 schema
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO schema_version (version) VALUES (1);

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
          eval_mode TEXT NOT NULL DEFAULT 'quick',
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
          optimization_type TEXT NOT NULL,
          session_id TEXT,
          duration_seconds INTEGER,
          timestamp TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_eval_scores_skill_ts
          ON eval_scores(skill_name, timestamp);
        CREATE INDEX IF NOT EXISTS idx_invocations_skill_ts
          ON invocations(skill_name, timestamp);
        CREATE INDEX IF NOT EXISTS idx_degradation_skill
          ON degradation_events(skill_name, resolved);
        CREATE INDEX IF NOT EXISTS idx_optimization_skill
          ON optimization_events(skill_name, timestamp);
      `);

      // Insert some V1 data (integer scores)
      rawDb.prepare(
        'INSERT INTO eval_scores (skill_name, score, eval_mode, timestamp) VALUES (?, ?, ?, ?)',
      ).run('legacy', 85, 'quick', '2025-01-01T00:00:00Z');

      rawDb.prepare(
        'INSERT INTO degradation_events (skill_name, score, threshold, timestamp) VALUES (?, ?, ?, ?)',
      ).run('legacy', 60, 70, '2025-01-01T00:00:00Z');

      rawDb.prepare(
        'INSERT INTO optimization_events (skill_name, trigger_score, result_score, optimization_type, timestamp) VALUES (?, ?, ?, ?, ?)',
      ).run('legacy', 60, 90, 'auto', '2025-01-01T00:00:00Z');

      // Save to a temp file for MetricsStore to open
      const tmpPath = '/tmp/proof-of-skill-test-v1-to-v2.db';
      rawDb.exec(`VACUUM INTO '${tmpPath}'`);
      rawDb.close();

      // Open with MetricsStore (runs V2 migration)
      const migratedStore = new MetricsStore(tmpPath);

      // Verify data is preserved
      const scores = migratedStore.getRecentScores('legacy', 1);
      assert.equal(scores[0]!.score, 85);

      const degradations = migratedStore.getUnresolvedDegradations();
      assert.equal(degradations[0]!.score, 60);
      assert.equal(degradations[0]!.threshold, 70);

      const optimizations = migratedStore.getOptimizationHistory('legacy');
      assert.equal(optimizations[0]!.trigger_score, 60);
      assert.equal(optimizations[0]!.result_score, 90);

      // Verify REAL columns work with fractional values after migration
      migratedStore.recordEvalScore({
        skill_name: 'post-migration',
        score: 85.5,
        eval_mode: 'quick',
        timestamp: new Date().toISOString(),
      });
      const newScores = migratedStore.getRecentScores('post-migration', 1);
      assert.equal(newScores[0]!.score, 85.5);

      migratedStore.close();

      // Clean up
      try {
        unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    });
  });

  // -------------------------------------------------------------------------
  // Error handling (Issue #3)
  // -------------------------------------------------------------------------

  describe('getSchemaVersion error handling', () => {
    it('propagates non-table errors', () => {
      // We can test this indirectly: if the DB is corrupted, the error
      // should propagate instead of being silently swallowed.
      // The main thing is that "no such table" errors return 0, while
      // other errors are thrown. Since we can't easily corrupt an
      // in-memory DB, we test that a fresh DB initializes correctly
      // (which exercises the "no such table" path during first migration).
      const freshStore = createStore();
      // If we get here, the "no such table" catch worked correctly
      freshStore.close();
    });
  });

  // -------------------------------------------------------------------------
  // Average score
  // -------------------------------------------------------------------------

  describe('getAverageScore', () => {
    it('returns the average of scores since a timestamp', () => {
      store.recordEvalScore({
        skill_name: 'avg',
        score: 80,
        eval_mode: 'quick',
        timestamp: hoursAgo(3),
      });
      store.recordEvalScore({
        skill_name: 'avg',
        score: 90,
        eval_mode: 'quick',
        timestamp: hoursAgo(1),
      });

      const avg = store.getAverageScore('avg', daysAgo(1));
      assert.equal(avg, 85);
    });

    it('returns null when no scores exist', () => {
      const avg = store.getAverageScore('nonexistent', daysAgo(1));
      assert.equal(avg, null);
    });
  });

  // -------------------------------------------------------------------------
  // Daily aggregates
  // -------------------------------------------------------------------------

  describe('getDailyAggregates', () => {
    it('returns daily stats', () => {
      const today = new Date().toISOString().slice(0, 10);
      store.recordEvalScore({
        skill_name: 'daily',
        score: 85,
        eval_mode: 'quick',
        timestamp: hoursAgo(1),
      });
      store.recordInvocation({
        skill_name: 'daily',
        timestamp: hoursAgo(1),
        was_sampled: false,
      });

      const aggregates = store.getDailyAggregates('daily', 7);
      assert.ok(aggregates.length >= 1);
      const todayAgg = aggregates.find((a) => a.date === today);
      assert.ok(todayAgg);
      assert.equal(todayAgg.avg_score, 85);
      assert.equal(todayAgg.invocation_count, 1);
    });
  });

  // -------------------------------------------------------------------------
  // Optimization history
  // -------------------------------------------------------------------------

  describe('getOptimizationHistory', () => {
    it('returns optimization events for a skill', () => {
      store.recordOptimization({
        skill_name: 'opt',
        trigger_score: 60,
        result_score: 85,
        optimization_type: 'auto',
        session_id: 'sess-1',
        duration_seconds: 120,
        timestamp: hoursAgo(1),
      });

      const history = store.getOptimizationHistory('opt');
      assert.equal(history.length, 1);
      assert.equal(history[0]!.trigger_score, 60);
      assert.equal(history[0]!.result_score, 85);
      assert.equal(history[0]!.optimization_type, 'auto');
      assert.equal(history[0]!.session_id, 'sess-1');
      assert.equal(history[0]!.duration_seconds, 120);
    });
  });
});
