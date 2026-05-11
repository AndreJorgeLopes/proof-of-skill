---
id: FEAT-cross-model-eval
title: "Cross-model testing across Haiku, Sonnet, Opus"
priority: P3
category: features
status: done
depends_on:
  - FEAT-monitor-skill
estimated_effort: L
files_to_touch:
  - core/cross-model.ts
---

# Cross-Model Eval

## Context

Skills are typically developed and tested against a single model -- usually the model the developer is currently using. But skill behavior can vary significantly across models. A skill that scores 95 on Opus may score 60 on Haiku because it relies on nuanced instruction-following that cheaper models miss. Conversely, a skill that works on Haiku will almost certainly work on more capable models, making it more robust and cost-efficient.

Understanding which models a skill works on is critical for teams that use different models for different tasks, or for developers who want to write skills that are portable across the Claude model family.

## Problem Statement

1. **Single-model blindspot**: Skills are tested on one model and assumed to work on others. This assumption fails silently when a teammate uses a different model
2. **Cost optimization blindspot**: A skill that requires Opus may be over-specified. If the same quality can be achieved with Sonnet or Haiku, the user is overpaying for every invocation
3. **No compatibility data**: There is no structured way to know which skills work on which models without manually testing each combination
4. **No regression detection**: When a model is updated (e.g., Sonnet 3.5 -> Sonnet 4), there is no way to detect whether existing skills are affected

## Desired Outcome

- A `cross-model-eval` command or module that tests a skill against Haiku, Sonnet, and Opus
- Uses `tessl compare-skill-model-performance` or equivalent to run the same eval scenarios across models
- Generates a compatibility heatmap showing scores per skill-model combination
- Flags skills that only pass on expensive models (Opus-dependent skills)
- Provides recommendations for making skills more portable

## Implementation Guide

### Step 1: Create the cross-model eval module

Create `core/cross-model.ts`:

```typescript
import { MetricsStore } from './metrics-store';

export interface ModelConfig {
  name: string;         // e.g., 'haiku', 'sonnet', 'opus'
  modelId: string;      // e.g., 'claude-haiku-4', 'claude-sonnet-4', 'claude-opus-4'
  costTier: 'low' | 'medium' | 'high';
}

export const DEFAULT_MODELS: ModelConfig[] = [
  { name: 'haiku', modelId: 'claude-haiku-4', costTier: 'low' },
  { name: 'sonnet', modelId: 'claude-sonnet-4', costTier: 'medium' },
  { name: 'opus', modelId: 'claude-opus-4', costTier: 'high' },
];

export interface CrossModelResult {
  skillName: string;
  results: Array<{
    model: ModelConfig;
    score: number;
    passingScenarios: number;
    totalScenarios: number;
    failedScenarios: string[]; // names of failing scenarios
    durationMs: number;
  }>;
  compatibility: 'universal' | 'mid-tier+' | 'opus-only' | 'none';
  recommendation: string;
}

export class CrossModelEval {
  private store: MetricsStore;

  constructor(store: MetricsStore) {
    this.store = store;
  }

  /**
   * Run eval scenarios for a skill across all configured models.
   */
  async evaluate(
    skillName: string,
    scenariosPath: string,
    models?: ModelConfig[]
  ): Promise<CrossModelResult> {
    const targetModels = models || DEFAULT_MODELS;
    const results = [];

    for (const model of targetModels) {
      const start = Date.now();
      // Run tessl eval with model override
      const evalResult = await this.runEval(skillName, scenariosPath, model);
      const duration = Date.now() - start;

      results.push({
        model,
        score: evalResult.score,
        passingScenarios: evalResult.passing,
        totalScenarios: evalResult.total,
        failedScenarios: evalResult.failures,
        durationMs: duration,
      });
    }

    const compatibility = this.classifyCompatibility(results);
    const recommendation = this.generateRecommendation(skillName, results, compatibility);

    return { skillName, results, compatibility, recommendation };
  }

  /**
   * Run tessl compare-skill-model-performance if available,
   * otherwise fall back to sequential tessl eval --model calls.
   */
  private async runEval(
    skillName: string,
    scenariosPath: string,
    model: ModelConfig
  ): Promise<{ score: number; passing: number; total: number; failures: string[] }> {
    // Try tessl compare-skill-model-performance first
    // Fall back to: tessl eval --scenarios <path> --model <modelId>
  }
}
```

### Step 2: Implement compatibility classification

```typescript
private classifyCompatibility(
  results: CrossModelResult['results']
): CrossModelResult['compatibility'] {
  const threshold = 85; // from config

  const haikuPasses = results.find(r => r.model.costTier === 'low')?.score >= threshold;
  const sonnetPasses = results.find(r => r.model.costTier === 'medium')?.score >= threshold;
  const opusPasses = results.find(r => r.model.costTier === 'high')?.score >= threshold;

  if (haikuPasses && sonnetPasses && opusPasses) return 'universal';
  if (sonnetPasses && opusPasses) return 'mid-tier+';
  if (opusPasses) return 'opus-only';
  return 'none';
}
```

### Step 3: Generate the compatibility heatmap

```typescript
generateHeatmap(results: CrossModelResult[]): string {
  // ASCII table for terminal output:
  //
  // Skill                  | Haiku | Sonnet | Opus | Compat
  // -----------------------|-------|--------|------|----------
  // create-skill           |  62   |   88   |  95  | mid-tier+
  // grill-me               |  91   |   93   |  94  | universal
  // code-review            |  45   |   72   |  89  | opus-only
  //
  // Color coding: green >= 85, yellow 70-84, red < 70

  let table = '';
  // ... format as aligned ASCII table with ANSI colors
  return table;
}
```

### Step 4: Generate recommendations

```typescript
private generateRecommendation(
  skillName: string,
  results: CrossModelResult['results'],
  compatibility: CrossModelResult['compatibility']
): string {
  switch (compatibility) {
    case 'universal':
      return `"${skillName}" works across all models. Consider using Haiku for cost efficiency.`;

    case 'mid-tier+':
      const haikuFailures = results.find(r => r.model.costTier === 'low')?.failedScenarios || [];
      return `"${skillName}" fails on Haiku (${haikuFailures.length} scenarios). ` +
        `Review these failures to make the skill more portable: ${haikuFailures.join(', ')}`;

    case 'opus-only':
      return `"${skillName}" only passes on Opus. This skill likely relies on advanced reasoning ` +
        `or nuanced instruction-following. Consider simplifying instructions or adding explicit ` +
        `step-by-step guidance for cheaper models.`;

    case 'none':
      return `"${skillName}" fails on all models. The skill may need fundamental rework.`;
  }
}
```

### Step 5: Integration with monitoring

Record cross-model eval results in the metrics store for historical tracking:

```typescript
async recordCrossModelResults(result: CrossModelResult): Promise<void> {
  for (const r of result.results) {
    this.store.recordEvalScore({
      skill_name: `${result.skillName}@${r.model.name}`,
      score: r.score,
      eval_mode: 'full',
      scenario_count: r.totalScenarios,
      timestamp: new Date().toISOString(),
    });
  }
}
```

This allows the dashboard to show cross-model trends over time.

## Acceptance Criteria

- [ ] `core/cross-model.ts` exports a `CrossModelEval` class with an `evaluate()` method
- [ ] The module tests a skill against Haiku, Sonnet, and Opus (configurable model list)
- [ ] Each model eval runs the same scenario set and captures: score, passing/failing scenario count, duration
- [ ] Compatibility is classified as: `universal`, `mid-tier+`, `opus-only`, or `none`
- [ ] A text-based compatibility heatmap is generated showing all skills vs all models
- [ ] Scores are color-coded: green >= 85, yellow 70-84, red < 70
- [ ] Recommendations are generated per skill based on compatibility level
- [ ] Opus-only skills are explicitly flagged with guidance on how to improve portability
- [ ] Results are recorded in the SQLite metrics store for historical tracking
- [ ] The module falls back gracefully if `tessl compare-skill-model-performance` is not available
- [ ] Model list is configurable (not hardcoded to only Haiku/Sonnet/Opus)
- [ ] Failed scenarios per model are listed so the user knows exactly what to fix

## Technical Notes

- **tessl compare-skill-model-performance**: This tessl command may or may not exist yet. Check the tessl CLI docs. If it does not exist, fall back to running `tessl eval` sequentially with a `--model` flag. If neither is available, shell out to the Claude API directly with model overrides
- **Cost implications**: Running evals across 3 models triples the eval cost. Consider making this an explicit opt-in rather than part of regular monitoring. The p95 hooks should NOT trigger cross-model evals -- only the explicit command should
- **Model ID stability**: Model IDs may change (e.g., `claude-3-haiku-20240307` vs `claude-haiku-4`). Use the latest stable identifiers and make them configurable
- **Parallel execution**: Evals for different models are independent and can run in parallel. Use `Promise.all()` to run them concurrently. This reduces wall-clock time from 3x to ~1x
- **Rate limits**: Running 3 concurrent evals may hit API rate limits. Add a configurable concurrency limit (default: 2) and retry with backoff
- **Scenario stability**: Eval scenarios should be deterministic enough that score differences between models reflect genuine capability gaps, not random variation. Consider running each model eval 2-3 times and averaging
- **Haiku baseline**: If a skill passes on Haiku, it is a strong signal of robustness. Consider adding a badge to the README or dashboard for "Haiku-compatible" skills

## Verification

```bash
# 1. Run cross-model eval for a skill
node -e "
  const { CrossModelEval } = require('./core/cross-model');
  const { MetricsStore } = require('./core/metrics-store');
  const eval = new CrossModelEval(new MetricsStore());
  eval.evaluate('create-skill', '~/.proof-of-skill/scenarios/create-skill.yaml')
    .then(r => console.log(JSON.stringify(r, null, 2)));
"
# Expect: Results for each model with scores and compatibility classification

# 2. Verify heatmap output
node -e "
  const { CrossModelEval } = require('./core/cross-model');
  const { MetricsStore } = require('./core/metrics-store');
  const eval = new CrossModelEval(new MetricsStore());
  eval.evaluate('create-skill', '...')
    .then(r => console.log(eval.generateHeatmap([r])));
"
# Expect: Formatted ASCII table with color-coded scores

# 3. Verify opus-only detection
# Create a skill that uses complex multi-step reasoning
# Run cross-model eval
# Expect: compatibility = 'opus-only', recommendation mentions simplification

# 4. Verify results are stored
sqlite3 ~/.proof-of-skill/metrics.db \
  "SELECT * FROM eval_scores WHERE skill_name LIKE '%@%' ORDER BY timestamp DESC LIMIT 10;"
# Expect: Entries like create-skill@haiku, create-skill@sonnet, create-skill@opus

# 5. Verify configurable model list
node -e "
  const { CrossModelEval } = require('./core/cross-model');
  const { MetricsStore } = require('./core/metrics-store');
  const eval = new CrossModelEval(new MetricsStore());
  eval.evaluate('create-skill', '...', [
    { name: 'sonnet', modelId: 'claude-sonnet-4', costTier: 'medium' }
  ]).then(r => console.log(r.results.length));
"
# Expect: 1 (only Sonnet tested)
```
