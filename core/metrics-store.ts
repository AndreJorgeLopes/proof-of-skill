/**
 * Embedded SQLite metrics store for proof-of-skill.
 *
 * Provides a structured, queryable store for skill invocations, eval scores,
 * degradation events, and optimization runs. Replaces the append-only JSONL
 * files with a zero-config embedded database at ~/.proof-of-skill/metrics.db.
 *
 * Technical choices:
 * - better-sqlite3 for synchronous, high-performance access
 * - WAL mode for concurrent read/write (hook writes while dashboard reads)
 * - Prepared statements for repeated queries
 * - Busy timeout of 5000ms for lock contention
 * - Schema migration system with version tracking
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Default paths
// ---------------------------------------------------------------------------

const PROOF_DIR =
  process.env['PROOF_OF_SKILL_DIR'] || resolve(homedir(), '.proof-of-skill');
const DEFAULT_DB_PATH = resolve(PROOF_DIR, 'metrics.db');

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface Invocation {
  skill_name: string;
  timestamp: string; // ISO 8601 UTC
  was_sampled: boolean;
  duration_ms?: number;
}

export interface EvalScore {
  id?: number;
  skill_name: string;
  score: number;
  scenario_count?: number;
  eval_mode: 'quick' | 'full';
  timestamp: string; // ISO 8601 UTC
}

export interface DegradationEvent {
  id?: number;
  skill_name: string;
  score: number;
  threshold: number;
  notified?: boolean;
  resolved?: boolean;
  timestamp: string; // ISO 8601 UTC
}

export interface OptimizationEvent {
  id?: number;
  skill_name: string;
  trigger_score: number;
  result_score?: number;
  optimization_type: 'auto' | 'manual' | 'ralph-loop';
  session_id?: string;
  duration_seconds?: number;
  timestamp: string; // ISO 8601 UTC
}

export interface DailyAggregate {
  date: string;
  avg_score: number;
  invocation_count: number;
  degradation_count: number;
}

export type ScoreTrend = 'improving' | 'declining' | 'stable';

// ---------------------------------------------------------------------------
// Schema migrations
// ---------------------------------------------------------------------------

const SCHEMA_V1 = `
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
`;

interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  { version: 1, sql: SCHEMA_V1 },
  // Future migrations are appended here.
];

// ---------------------------------------------------------------------------
// MetricsStore
// ---------------------------------------------------------------------------

export class MetricsStore {
  private db: Database.Database;

  // Prepared statements (lazily initialised after migration)
  private stmtInsertInvocation!: Database.Statement;
  private stmtInsertEvalScore!: Database.Statement;
  private stmtInsertDegradation!: Database.Statement;
  private stmtInsertOptimization!: Database.Statement;
  private stmtResolveDegradation!: Database.Statement;
  private stmtRecentScores!: Database.Statement;
  private stmtAvgScore!: Database.Statement;
  private stmtScoreTrend!: Database.Statement;
  private stmtInvocationCountsAll!: Database.Statement;
  private stmtInvocationCountsSince!: Database.Statement;
  private stmtUnresolvedDegradations!: Database.Statement;
  private stmtOptimizationHistory!: Database.Statement;
  private stmtDailyAggregates!: Database.Statement;

  /**
   * Open (or create) the metrics database.
   *
   * @param dbPath - File path for the SQLite database. Defaults to
   *   `~/.proof-of-skill/metrics.db`. Pass `:memory:` for tests.
   */
  constructor(dbPath: string = DEFAULT_DB_PATH) {
    // Ensure the parent directory exists (skip for in-memory databases).
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);

    // Performance & concurrency pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    this.migrate();
    this.prepareStatements();
  }

  // -----------------------------------------------------------------------
  // Migration system
  // -----------------------------------------------------------------------

  private getSchemaVersion(): number {
    // The schema_version table may not exist yet on a fresh database.
    try {
      const row = this.db
        .prepare('SELECT MAX(version) AS v FROM schema_version')
        .get() as { v: number | null } | undefined;
      return row?.v ?? 0;
    } catch {
      return 0;
    }
  }

  private setSchemaVersion(version: number): void {
    this.db
      .prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)')
      .run(version);
  }

  private migrate(): void {
    const current = this.getSchemaVersion();

    for (const migration of MIGRATIONS) {
      if (migration.version > current) {
        this.db.exec(migration.sql);
        this.setSchemaVersion(migration.version);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Prepared statements
  // -----------------------------------------------------------------------

  private prepareStatements(): void {
    this.stmtInsertInvocation = this.db.prepare(`
      INSERT INTO invocations (skill_name, timestamp, was_sampled, duration_ms)
      VALUES (@skill_name, @timestamp, @was_sampled, @duration_ms)
    `);

    this.stmtInsertEvalScore = this.db.prepare(`
      INSERT INTO eval_scores (skill_name, score, scenario_count, eval_mode, timestamp)
      VALUES (@skill_name, @score, @scenario_count, @eval_mode, @timestamp)
    `);

    this.stmtInsertDegradation = this.db.prepare(`
      INSERT INTO degradation_events (skill_name, score, threshold, timestamp)
      VALUES (@skill_name, @score, @threshold, @timestamp)
    `);

    this.stmtInsertOptimization = this.db.prepare(`
      INSERT INTO optimization_events
        (skill_name, trigger_score, result_score, optimization_type, session_id, duration_seconds, timestamp)
      VALUES
        (@skill_name, @trigger_score, @result_score, @optimization_type, @session_id, @duration_seconds, @timestamp)
    `);

    this.stmtResolveDegradation = this.db.prepare(`
      UPDATE degradation_events
      SET resolved = 1
      WHERE skill_name = ? AND resolved = 0
    `);

    this.stmtRecentScores = this.db.prepare(`
      SELECT id, skill_name, score, scenario_count, eval_mode, timestamp
      FROM eval_scores
      WHERE skill_name = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this.stmtAvgScore = this.db.prepare(`
      SELECT AVG(score) AS avg_score
      FROM eval_scores
      WHERE skill_name = ? AND timestamp >= ?
    `);

    // Returns scores ordered oldest-first for trend calculation
    this.stmtScoreTrend = this.db.prepare(`
      SELECT score
      FROM eval_scores
      WHERE skill_name = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `);

    this.stmtInvocationCountsAll = this.db.prepare(`
      SELECT skill_name, COUNT(*) AS cnt
      FROM invocations
      GROUP BY skill_name
    `);

    this.stmtInvocationCountsSince = this.db.prepare(`
      SELECT skill_name, COUNT(*) AS cnt
      FROM invocations
      WHERE timestamp >= ?
      GROUP BY skill_name
    `);

    this.stmtUnresolvedDegradations = this.db.prepare(`
      SELECT id, skill_name, score, threshold, notified, resolved, timestamp
      FROM degradation_events
      WHERE resolved = 0
      ORDER BY timestamp DESC
    `);

    this.stmtOptimizationHistory = this.db.prepare(`
      SELECT id, skill_name, trigger_score, result_score,
             optimization_type, session_id, duration_seconds, timestamp
      FROM optimization_events
      WHERE skill_name = ?
      ORDER BY timestamp DESC
    `);

    this.stmtDailyAggregates = this.db.prepare(`
      SELECT
        date(e.timestamp) AS date,
        AVG(e.score) AS avg_score,
        COALESCE(i.invocation_count, 0) AS invocation_count,
        COALESCE(d.degradation_count, 0) AS degradation_count
      FROM eval_scores e
      LEFT JOIN (
        SELECT date(timestamp) AS d, COUNT(*) AS invocation_count
        FROM invocations
        WHERE skill_name = @skill_name AND timestamp >= @since
        GROUP BY date(timestamp)
      ) i ON i.d = date(e.timestamp)
      LEFT JOIN (
        SELECT date(timestamp) AS d, COUNT(*) AS degradation_count
        FROM degradation_events
        WHERE skill_name = @skill_name AND timestamp >= @since
        GROUP BY date(timestamp)
      ) d ON d.d = date(e.timestamp)
      WHERE e.skill_name = @skill_name AND e.timestamp >= @since
      GROUP BY date(e.timestamp)
      ORDER BY date(e.timestamp) ASC
    `);
  }

  // -----------------------------------------------------------------------
  // Write methods
  // -----------------------------------------------------------------------

  /** Record a skill invocation. */
  recordInvocation(inv: Invocation): void {
    this.stmtInsertInvocation.run({
      skill_name: inv.skill_name,
      timestamp: inv.timestamp,
      was_sampled: inv.was_sampled ? 1 : 0,
      duration_ms: inv.duration_ms ?? null,
    });
  }

  /** Record an eval score. */
  recordEvalScore(score: EvalScore): void {
    this.stmtInsertEvalScore.run({
      skill_name: score.skill_name,
      score: score.score,
      scenario_count: score.scenario_count ?? null,
      eval_mode: score.eval_mode,
      timestamp: score.timestamp,
    });
  }

  /** Record a degradation event (score dropped below threshold). */
  recordDegradation(event: DegradationEvent): void {
    this.stmtInsertDegradation.run({
      skill_name: event.skill_name,
      score: event.score,
      threshold: event.threshold,
      timestamp: event.timestamp,
    });
  }

  /** Record an optimization event (auto or manual improvement run). */
  recordOptimization(event: OptimizationEvent): void {
    this.stmtInsertOptimization.run({
      skill_name: event.skill_name,
      trigger_score: event.trigger_score,
      result_score: event.result_score ?? null,
      optimization_type: event.optimization_type,
      session_id: event.session_id ?? null,
      duration_seconds: event.duration_seconds ?? null,
      timestamp: event.timestamp,
    });
  }

  /** Mark all unresolved degradation events for a skill as resolved. */
  resolveDegradation(skillName: string): void {
    this.stmtResolveDegradation.run(skillName);
  }

  // -----------------------------------------------------------------------
  // Read / aggregation methods
  // -----------------------------------------------------------------------

  /** Get the most recent eval scores for a skill. */
  getRecentScores(skillName: string, limit: number = 10): EvalScore[] {
    return this.stmtRecentScores.all(skillName, limit) as EvalScore[];
  }

  /** Average score for a skill since a given ISO 8601 timestamp. */
  getAverageScore(skillName: string, since: string): number | null {
    const row = this.stmtAvgScore.get(skillName, since) as {
      avg_score: number | null;
    };
    return row.avg_score;
  }

  /**
   * Determine whether a skill's score is improving, declining, or stable.
   *
   * Uses simple linear regression over the scores within the window.
   * - slope > +2  -> "improving"
   * - slope < -2  -> "declining"
   * - otherwise   -> "stable"
   */
  getScoreTrend(skillName: string, windowDays: number = 30): ScoreTrend {
    const since = new Date(
      Date.now() - windowDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const rows = this.stmtScoreTrend.all(skillName, since) as Array<{
      score: number;
    }>;

    if (rows.length < 2) {
      return 'stable';
    }

    // Simple linear regression: y = score, x = index
    const n = rows.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += rows[i]!.score;
      sumXY += i * rows[i]!.score;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 2) return 'improving';
    if (slope < -2) return 'declining';
    return 'stable';
  }

  /**
   * Get invocation counts grouped by skill name.
   *
   * @param since - Optional ISO 8601 timestamp to filter from. If omitted,
   *   returns all-time counts.
   */
  getInvocationCounts(since?: string): Record<string, number> {
    const rows = since
      ? (this.stmtInvocationCountsSince.all(since) as Array<{
          skill_name: string;
          cnt: number;
        }>)
      : (this.stmtInvocationCountsAll.all() as Array<{
          skill_name: string;
          cnt: number;
        }>);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.skill_name] = row.cnt;
    }
    return result;
  }

  /** Get all unresolved degradation events across all skills. */
  getUnresolvedDegradations(): DegradationEvent[] {
    return this.stmtUnresolvedDegradations.all() as DegradationEvent[];
  }

  /** Get optimization history for a skill (most recent first). */
  getOptimizationHistory(skillName: string): OptimizationEvent[] {
    return this.stmtOptimizationHistory.all(skillName) as OptimizationEvent[];
  }

  /**
   * Get daily aggregates for charting.
   *
   * Returns one row per day with average score, invocation count, and
   * degradation count for the given skill over the last N days.
   */
  getDailyAggregates(
    skillName: string,
    days: number = 30,
  ): DailyAggregate[] {
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    return this.stmtDailyAggregates.all({
      skill_name: skillName,
      since,
    }) as DailyAggregate[];
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }
}
