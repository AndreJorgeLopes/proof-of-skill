#!/usr/bin/env node
/**
 * One-time migration: import JSONL score/degradation files into SQLite.
 *
 * Reads:
 *   ~/.proof-of-skill/scores.jsonl
 *   ~/.proof-of-skill/degradations.jsonl
 *
 * Imports each line into the appropriate SQLite table, then renames the
 * original files to *.jsonl.migrated so they are not processed again.
 *
 * Usage:
 *   npx tsx core/migrate-jsonl.ts
 *   # or after building:
 *   node dist/core/migrate-jsonl.js
 */

import { readFileSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { MetricsStore } from './metrics-store.js';
import type { EvalScore, DegradationEvent } from './metrics-store.js';

const PROOF_DIR =
  process.env['PROOF_OF_SKILL_DIR'] || resolve(homedir(), '.proof-of-skill');

const SCORES_FILE = resolve(PROOF_DIR, 'scores.jsonl');
const DEGRADATIONS_FILE = resolve(PROOF_DIR, 'degradations.jsonl');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a JSONL file into an array of objects. Skips blank / malformed lines. */
function parseJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const lines = readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  const results: T[] = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      console.warn(`Skipping malformed line in ${filePath}: ${line}`);
    }
  }
  return results;
}

/** Safely rename a file, appending .migrated. */
function markMigrated(filePath: string): void {
  if (existsSync(filePath)) {
    const dest = `${filePath}.migrated`;
    renameSync(filePath, dest);
    console.log(`  Renamed ${filePath} -> ${dest}`);
  }
}

// ---------------------------------------------------------------------------
// JSONL record shapes (as written by hooks/skill-complete.sh)
// ---------------------------------------------------------------------------

interface JsonlScore {
  skill: string;
  score: number;
  scenarios?: number;
  mode?: string;
  timestamp: string;
}

interface JsonlDegradation {
  skill: string;
  score: number;
  threshold: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

function migrate(): void {
  console.log('proof-of-skill: JSONL -> SQLite migration');
  console.log(`  Data directory: ${PROOF_DIR}`);

  const store = new MetricsStore(); // uses default path

  // --- Scores ---
  const scores = parseJsonl<JsonlScore>(SCORES_FILE);
  console.log(`  Found ${scores.length} score records in scores.jsonl`);

  let importedScores = 0;
  let scoreFailures = 0;
  for (const s of scores) {
    const evalScore: EvalScore = {
      skill_name: s.skill,
      score: s.score,
      scenario_count: s.scenarios,
      eval_mode: (s.mode === 'full' ? 'full' : 'quick') as 'quick' | 'full',
      timestamp: s.timestamp,
    };
    try {
      store.recordEvalScore(evalScore);
      importedScores++;
    } catch (err) {
      scoreFailures++;
      console.warn(`  Failed to import score record: ${JSON.stringify(s)}`, err);
    }
  }
  console.log(`  Imported ${importedScores} score records`);

  // --- Degradations ---
  const degradations = parseJsonl<JsonlDegradation>(DEGRADATIONS_FILE);
  console.log(
    `  Found ${degradations.length} degradation records in degradations.jsonl`,
  );

  let importedDegradations = 0;
  let degradationFailures = 0;
  for (const d of degradations) {
    const event: DegradationEvent = {
      skill_name: d.skill,
      score: d.score,
      threshold: d.threshold,
      timestamp: d.timestamp,
    };
    try {
      store.recordDegradation(event);
      importedDegradations++;
    } catch (err) {
      degradationFailures++;
      console.warn(
        `  Failed to import degradation record: ${JSON.stringify(d)}`,
        err,
      );
    }
  }
  console.log(`  Imported ${importedDegradations} degradation records`);

  // --- Rename originals (only if ALL records imported successfully) ---
  if (scoreFailures === 0) {
    markMigrated(SCORES_FILE);
  } else {
    console.warn(
      `  ${scoreFailures} score records failed to import from ${SCORES_FILE}. File NOT renamed.`,
    );
  }

  if (degradationFailures === 0) {
    markMigrated(DEGRADATIONS_FILE);
  } else {
    console.warn(
      `  ${degradationFailures} degradation records failed to import from ${DEGRADATIONS_FILE}. File NOT renamed.`,
    );
  }

  store.close();
  console.log('Migration complete.');
}

migrate();
