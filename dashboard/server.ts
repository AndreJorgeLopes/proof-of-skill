/**
 * Minimal HTTP server for the proof-of-skill dashboard.
 *
 * - Serves static files (index.html, charts.js)
 * - Exposes /api/dashboard JSON endpoint querying MetricsStore
 * - Configurable port via PROOF_OF_SKILL_PORT (default 3095)
 * - No Express, no framework — pure http.createServer
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MetricsStore } from '../core/metrics-store.js';
import type {
  EvalScore,
  DegradationEvent,
  OptimizationEvent,
  ScoreTrend,
} from '../core/metrics-store.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env['PROOF_OF_SKILL_PORT'] || '3095', 10);

// ---------------------------------------------------------------------------
// Dashboard data types
// ---------------------------------------------------------------------------

interface SkillSummary {
  name: string;
  latestScore: number | null;
  trend: ScoreTrend;
  recentScores: number[];
  invocationCount: number;
  hasDegradation: boolean;
  isNearMiss: boolean;
}

interface DashboardData {
  timestamp: string;
  summary: {
    totalSkills: number;
    avgScore: number | null;
    activeDegradations: number;
    nearMissCount: number;
  };
  skills: SkillSummary[];
  invocations: Record<string, number>;
  scores: Array<{ skill_name: string; score: number; timestamp: string }>;
  degradations: DegradationEvent[];
  optimizations: OptimizationEvent[];
}

// ---------------------------------------------------------------------------
// Dashboard query helpers (work on top of MetricsStore without modifying it)
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLD = 85;
const NEAR_MISS_MARGIN = 5;

function getMonitoredSkillNames(store: MetricsStore): string[] {
  // Discover skills from invocations and eval_scores tables
  const invocationCounts = store.getInvocationCounts();
  const skillNames = new Set(Object.keys(invocationCounts));

  // Also pick up skills that have scores but may not have invocations
  // We use getRecentScores with a large limit to discover — this is a
  // local dashboard so the data volume is small
  // We rely on the invocation counts plus any skills in degradation events
  const degradations = store.getUnresolvedDegradations();
  for (const d of degradations) {
    skillNames.add(d.skill_name);
  }

  return [...skillNames].sort();
}

function getAllRecentScores(
  store: MetricsStore,
  skillNames: string[],
  limit: number = 30,
): Array<{ skill_name: string; score: number; timestamp: string }> {
  const allScores: Array<{ skill_name: string; score: number; timestamp: string }> = [];
  for (const name of skillNames) {
    const scores = store.getRecentScores(name, limit);
    for (const s of scores) {
      allScores.push({
        skill_name: s.skill_name,
        score: s.score,
        timestamp: s.timestamp,
      });
    }
  }
  // Sort by timestamp ascending for charting
  allScores.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return allScores;
}

function getAllOptimizations(
  store: MetricsStore,
  skillNames: string[],
): OptimizationEvent[] {
  const all: OptimizationEvent[] = [];
  for (const name of skillNames) {
    all.push(...store.getOptimizationHistory(name));
  }
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return all;
}

function computeNearMissCount(
  store: MetricsStore,
  skillNames: string[],
  threshold: number = DEFAULT_THRESHOLD,
  margin: number = NEAR_MISS_MARGIN,
): number {
  let count = 0;
  for (const name of skillNames) {
    const recent = store.getRecentScores(name, 1);
    if (recent.length > 0) {
      const latest = recent[0]!.score;
      if (latest >= threshold && latest < threshold + margin) {
        count++;
      }
    }
  }
  return count;
}

function computeAvgScore(
  store: MetricsStore,
  skillNames: string[],
): number | null {
  const invocationCounts = store.getInvocationCounts();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const name of skillNames) {
    const recent = store.getRecentScores(name, 1);
    if (recent.length > 0) {
      const weight = invocationCounts[name] ?? 1;
      weightedSum += recent[0]!.score * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

function buildSkillSummaries(
  store: MetricsStore,
  skillNames: string[],
  degradations: DegradationEvent[],
  threshold: number = DEFAULT_THRESHOLD,
): SkillSummary[] {
  const invocationCounts = store.getInvocationCounts();
  const degradedSkills = new Set(degradations.map((d) => d.skill_name));

  return skillNames.map((name) => {
    const recentScores = store.getRecentScores(name, 20);
    const latestScore = recentScores.length > 0 ? recentScores[0]!.score : null;
    const trend = store.getScoreTrend(name, 30);
    const isNearMiss =
      latestScore !== null &&
      latestScore >= threshold &&
      latestScore < threshold + NEAR_MISS_MARGIN;

    return {
      name,
      latestScore,
      trend,
      // Return scores oldest-first for sparklines
      recentScores: recentScores.map((s) => s.score).reverse(),
      invocationCount: invocationCounts[name] ?? 0,
      hasDegradation: degradedSkills.has(name),
      isNearMiss,
    };
  });
}

function buildDashboardData(store: MetricsStore): DashboardData {
  const skillNames = getMonitoredSkillNames(store);
  const degradations = store.getUnresolvedDegradations();
  const invocationCounts = store.getInvocationCounts();
  const allScores = getAllRecentScores(store, skillNames, 30);
  const allOptimizations = getAllOptimizations(store, skillNames);
  const nearMissCount = computeNearMissCount(store, skillNames);
  const avgScore = computeAvgScore(store, skillNames);

  const skills = buildSkillSummaries(store, skillNames, degradations);

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalSkills: skillNames.length,
      avgScore,
      activeDegradations: degradations.length,
      nearMissCount,
    },
    skills,
    invocations: invocationCounts,
    scores: allScores,
    degradations,
    optimizations: allOptimizations,
  };
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function serveStatic(res: ServerResponse, filePath: string, contentType: string): void {
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const store = new MetricsStore();

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? '/';

  if (url === '/api/dashboard') {
    try {
      const data = buildDashboardData(store);
      const json = JSON.stringify(data);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return;
  }

  if (url === '/' || url === '/index.html') {
    serveStatic(res, resolve(__dirname, 'index.html'), MIME_TYPES['.html']!);
    return;
  }

  if (url === '/charts.js') {
    serveStatic(res, resolve(__dirname, 'charts.js'), MIME_TYPES['.js']!);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`proof-of-skill dashboard: http://localhost:${PORT}`);
});
