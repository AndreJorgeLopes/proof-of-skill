/**
 * Cross-model evaluation for proof-of-skill.
 *
 * Tests a skill against multiple Claude models (Haiku, Sonnet, Opus by default)
 * to determine model compatibility and surface cost-optimization opportunities.
 *
 * Design decisions:
 * - Sequential model evaluation by default (avoids API rate-limit issues)
 * - Configurable model list: not hardcoded to three models
 * - Results stored with `@model` suffix in skill_name for historical tracking
 * - NO_COLOR respected for heatmap output
 * - Falls back gracefully if `tessl compare-skill-model-performance` is unavailable
 */

import { execSync } from 'node:child_process';
import { MetricsStore } from './metrics-store.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ModelConfig {
  name: string;       // e.g., 'haiku', 'sonnet', 'opus'
  modelId: string;    // e.g., 'claude-haiku-4', 'claude-sonnet-4', 'claude-opus-4'
  costTier: 'low' | 'medium' | 'high';
}

export const DEFAULT_MODELS: ModelConfig[] = [
  { name: 'haiku',  modelId: 'claude-haiku-4',  costTier: 'low' },
  { name: 'sonnet', modelId: 'claude-sonnet-4',  costTier: 'medium' },
  { name: 'opus',   modelId: 'claude-opus-4',    costTier: 'high' },
];

/** Per-model evaluation result. */
export interface ModelEvalResult {
  model: ModelConfig;
  score: number;
  passingScenarios: number;
  totalScenarios: number;
  failedScenarios: string[];
  durationMs: number;
}

/** Aggregated cross-model result for a single skill. */
export interface CrossModelResult {
  skillName: string;
  results: ModelEvalResult[];
  compatibility: Compatibility;
  recommendation: string;
}

export type Compatibility = 'universal' | 'mid-tier+' | 'opus-only' | 'none';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RawEvalOutput {
  score: number;
  passing: number;
  total: number;
  failures: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Score threshold (0-100) at which a model is considered "passing". */
const PASS_THRESHOLD = 85;

// ---------------------------------------------------------------------------
// CrossModelEval
// ---------------------------------------------------------------------------

export class CrossModelEval {
  private store: MetricsStore;

  constructor(store: MetricsStore) {
    this.store = store;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run eval scenarios for a skill across all configured models.
   *
   * Models are evaluated sequentially to avoid API rate-limit issues.
   * Pass a custom model list to test a subset or different model versions.
   */
  async evaluate(
    skillName: string,
    scenariosPath: string,
    models?: ModelConfig[],
  ): Promise<CrossModelResult> {
    const targetModels = models ?? DEFAULT_MODELS;
    const results: ModelEvalResult[] = [];

    for (const model of targetModels) {
      const start = Date.now();
      const raw = await this.runEval(skillName, scenariosPath, model);
      const durationMs = Date.now() - start;

      results.push({
        model,
        score: raw.score,
        passingScenarios: raw.passing,
        totalScenarios: raw.total,
        failedScenarios: raw.failures,
        durationMs,
      });
    }

    const compatibility = this.classifyCompatibility(results);
    const recommendation = this.generateRecommendation(
      skillName,
      results,
      compatibility,
    );

    return { skillName, results, compatibility, recommendation };
  }

  /**
   * Classify a skill's model compatibility based on the pass threshold.
   *
   * - `universal`  — passes on all tiers (low + medium + high)
   * - `mid-tier+`  — passes on medium and high but not low
   * - `opus-only`  — only passes on high-tier models
   * - `none`       — fails on all models
   */
  classifyCompatibility(
    results: ModelEvalResult[],
  ): Compatibility {
    const lowPasses = results.some(
      (r) => r.model.costTier === 'low' && r.score >= PASS_THRESHOLD,
    );
    const midPasses = results.some(
      (r) => r.model.costTier === 'medium' && r.score >= PASS_THRESHOLD,
    );
    const highPasses = results.some(
      (r) => r.model.costTier === 'high' && r.score >= PASS_THRESHOLD,
    );

    if (lowPasses && midPasses && highPasses) return 'universal';
    if (midPasses && highPasses) return 'mid-tier+';
    if (highPasses) return 'opus-only';
    return 'none';
  }

  /**
   * Generate an ASCII heatmap table for one or more cross-model results.
   *
   * Example output:
   * ```
   * Skill                  | Haiku | Sonnet | Opus | Compat
   * -----------------------|-------|--------|------|----------
   * create-skill           |  62   |   88   |  95  | mid-tier+
   * grill-me               |  91   |   93   |  94  | universal
   * ```
   *
   * Scores are ANSI color-coded unless the NO_COLOR env var is set:
   *   green  >= 85
   *   yellow  70-84
   *   red    < 70
   */
  generateHeatmap(results: CrossModelResult[]): string {
    if (results.length === 0) return '';

    // Collect all unique model names (in the order they first appear).
    const modelNames = this.uniqueModelNames(results);

    // Column widths
    const skillColWidth = Math.max(
      'Skill'.length,
      ...results.map((r) => r.skillName.length),
    );
    const scoreColWidth = 7; // " 100  " padded
    const compatColWidth = Math.max(
      'Compat'.length,
      ...results.map((r) => r.compatibility.length),
    );

    const useColor = !process.env['NO_COLOR'];

    // Header row
    const header =
      this.padRight('Skill', skillColWidth) +
      ' | ' +
      modelNames
        .map((m) => this.padCenter(this.capitalize(m), scoreColWidth))
        .join(' | ') +
      ' | ' +
      this.padRight('Compat', compatColWidth);

    // Separator
    const separator =
      '-'.repeat(skillColWidth) +
      '-|-' +
      modelNames
        .map(() => '-'.repeat(scoreColWidth))
        .join('-|-') +
      '-|-' +
      '-'.repeat(compatColWidth);

    // Data rows
    const rows = results.map((r) => {
      const scoreByModel = new Map<string, number>();
      for (const mr of r.results) {
        scoreByModel.set(mr.model.name, mr.score);
      }

      const scoreCells = modelNames.map((name) => {
        const score = scoreByModel.get(name);
        if (score === undefined) {
          return this.padCenter('-', scoreColWidth);
        }
        const scoreStr = String(score);
        const padded = this.padCenter(scoreStr, scoreColWidth);
        return useColor ? this.colorizeScore(padded, score) : padded;
      });

      return (
        this.padRight(r.skillName, skillColWidth) +
        ' | ' +
        scoreCells.join(' | ') +
        ' | ' +
        this.padRight(r.compatibility, compatColWidth)
      );
    });

    return [header, separator, ...rows].join('\n');
  }

  /**
   * Generate an actionable recommendation based on compatibility level.
   *
   * Each recommendation references the specific scenarios that failed so the
   * user knows exactly what to fix.
   */
  generateRecommendation(
    skillName: string,
    results: ModelEvalResult[],
    compatibility: Compatibility,
  ): string {
    switch (compatibility) {
      case 'universal':
        return (
          `"${skillName}" works across all models. ` +
          `Consider using Haiku for cost efficiency.`
        );

      case 'mid-tier+': {
        const haikuFailures =
          results.find((r) => r.model.costTier === 'low')?.failedScenarios ??
          [];
        const failList =
          haikuFailures.length > 0 ? haikuFailures.join(', ') : '(unknown)';
        return (
          `"${skillName}" fails on Haiku (${haikuFailures.length} scenario(s)). ` +
          `Review these failures to make the skill more portable: ${failList}`
        );
      }

      case 'opus-only': {
        const nonOpusFailures = results
          .filter((r) => r.model.costTier !== 'high')
          .flatMap((r) => r.failedScenarios);
        const unique = [...new Set(nonOpusFailures)];
        const failList =
          unique.length > 0 ? unique.join(', ') : '(unknown)';
        return (
          `"${skillName}" only passes on Opus. ` +
          `This skill likely relies on advanced reasoning or nuanced instruction-following. ` +
          `Consider simplifying instructions or adding explicit step-by-step guidance ` +
          `for cheaper models. Failed scenarios: ${failList}`
        );
      }

      case 'none':
        return (
          `"${skillName}" fails on all models. ` +
          `The skill may need fundamental rework.`
        );
    }
  }

  /**
   * Record cross-model results in the MetricsStore for historical tracking.
   *
   * Each model's score is stored with skill_name = `<skillName>@<modelName>`,
   * allowing the dashboard to show cross-model trends over time.
   */
  recordCrossModelResults(result: CrossModelResult): void {
    const now = new Date().toISOString();

    for (const r of result.results) {
      this.store.recordEvalScore({
        skill_name: `${result.skillName}@${r.model.name}`,
        score: r.score,
        eval_mode: 'full',
        scenario_count: r.totalScenarios,
        timestamp: now,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Private: eval execution
  // -----------------------------------------------------------------------

  /**
   * Run eval scenarios for a single model.
   *
   * Strategy:
   * 1. Try `tessl compare-skill-model-performance` (single command, parallel)
   * 2. Fall back to `tessl eval --scenarios <path> --model <modelId>`
   *
   * Both paths parse the JSON output from tessl.
   */
  private async runEval(
    skillName: string,
    scenariosPath: string,
    model: ModelConfig,
  ): Promise<RawEvalOutput> {
    // Attempt 1: tessl compare-skill-model-performance
    if (this.hasTesslCompare()) {
      return this.runTesslCompare(skillName, scenariosPath, model);
    }

    // Attempt 2: tessl eval with --model flag
    return this.runTesslEval(skillName, scenariosPath, model);
  }

  /**
   * Check (once, cached) whether `tessl compare-skill-model-performance`
   * is available.
   */
  private _hasTesslCompare: boolean | undefined;
  private hasTesslCompare(): boolean {
    if (this._hasTesslCompare !== undefined) return this._hasTesslCompare;

    try {
      execSync('tessl compare-skill-model-performance --help', {
        stdio: 'pipe',
        timeout: 5_000,
      });
      this._hasTesslCompare = true;
    } catch {
      this._hasTesslCompare = false;
    }
    return this._hasTesslCompare;
  }

  /**
   * Run `tessl compare-skill-model-performance` for a single model and
   * parse its JSON output.
   */
  private runTesslCompare(
    _skillName: string,
    scenariosPath: string,
    model: ModelConfig,
  ): RawEvalOutput {
    try {
      const stdout = execSync(
        `tessl compare-skill-model-performance --scenarios ${this.shellEscape(scenariosPath)} --model ${this.shellEscape(model.modelId)} --json`,
        { encoding: 'utf-8', timeout: 300_000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      return this.parseTesslOutput(stdout);
    } catch {
      // If compare fails, fall through to sequential eval
      return this.runTesslEval(_skillName, scenariosPath, model);
    }
  }

  /**
   * Run `tessl eval --scenarios <path> --model <modelId>` and parse the
   * JSON output.
   */
  private runTesslEval(
    _skillName: string,
    scenariosPath: string,
    model: ModelConfig,
  ): RawEvalOutput {
    try {
      const stdout = execSync(
        `tessl eval --scenarios ${this.shellEscape(scenariosPath)} --model ${this.shellEscape(model.modelId)} --json`,
        { encoding: 'utf-8', timeout: 300_000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      return this.parseTesslOutput(stdout);
    } catch (err) {
      // If tessl is not installed or the eval fails completely, return a
      // zero-score result so the caller still gets a structured response.
      const message =
        err instanceof Error ? err.message : String(err);
      return {
        score: 0,
        passing: 0,
        total: 0,
        failures: [`eval-error: ${message.slice(0, 200)}`],
      };
    }
  }

  /**
   * Parse tessl JSON output into a normalized RawEvalOutput.
   *
   * Expected shape (tessl convention):
   * ```json
   * {
   *   "score": 85,
   *   "passing": 17,
   *   "total": 20,
   *   "failures": ["scenario-name-1", "scenario-name-2"]
   * }
   * ```
   *
   * Also handles the alternate `{ results: [...] }` wrapper format.
   */
  private parseTesslOutput(stdout: string): RawEvalOutput {
    try {
      const parsed: unknown = JSON.parse(stdout.trim());

      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;

        // Direct shape
        if (typeof obj['score'] === 'number') {
          return {
            score: obj['score'] as number,
            passing:
              typeof obj['passing'] === 'number'
                ? (obj['passing'] as number)
                : 0,
            total:
              typeof obj['total'] === 'number' ? (obj['total'] as number) : 0,
            failures: Array.isArray(obj['failures'])
              ? (obj['failures'] as string[])
              : [],
          };
        }

        // Wrapper shape: { results: [{ scenario, pass }] }
        if (Array.isArray(obj['results'])) {
          const items = obj['results'] as Array<{
            scenario?: string;
            name?: string;
            pass?: boolean;
            passed?: boolean;
            score?: number;
          }>;
          const total = items.length;
          const failures: string[] = [];
          let passingCount = 0;

          for (const item of items) {
            const passed = item.pass ?? item.passed ?? false;
            if (passed) {
              passingCount++;
            } else {
              failures.push(item.scenario ?? item.name ?? 'unknown');
            }
          }

          const score =
            total > 0 ? Math.round((passingCount / total) * 100) : 0;

          return { score, passing: passingCount, total, failures };
        }
      }
    } catch {
      // JSON parse failed — fall through to error return
    }

    return {
      score: 0,
      passing: 0,
      total: 0,
      failures: ['parse-error: unable to parse tessl output'],
    };
  }

  // -----------------------------------------------------------------------
  // Private: formatting helpers
  // -----------------------------------------------------------------------

  private uniqueModelNames(results: CrossModelResult[]): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const r of results) {
      for (const mr of r.results) {
        if (!seen.has(mr.model.name)) {
          seen.add(mr.model.name);
          names.push(mr.model.name);
        }
      }
    }
    return names;
  }

  private padRight(str: string, width: number): string {
    return str + ' '.repeat(Math.max(0, width - str.length));
  }

  private padCenter(str: string, width: number): string {
    const gap = Math.max(0, width - str.length);
    const left = Math.floor(gap / 2);
    const right = gap - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Apply ANSI color to a score string.
   *   green  (>= 85)  — passing
   *   yellow (70-84)   — marginal
   *   red    (< 70)    — failing
   */
  private colorizeScore(text: string, score: number): string {
    if (score >= PASS_THRESHOLD) {
      return `\x1b[32m${text}\x1b[0m`; // green
    }
    if (score >= 70) {
      return `\x1b[33m${text}\x1b[0m`; // yellow
    }
    return `\x1b[31m${text}\x1b[0m`; // red
  }

  /** Escape a string for safe shell interpolation. */
  private shellEscape(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }
}
