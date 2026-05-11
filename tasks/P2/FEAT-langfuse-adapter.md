---
id: FEAT-langfuse-adapter
title: "Langfuse adapter for observability traces"
priority: P2
category: features
status: done
depends_on:
  - FEAT-sqlite-store
estimated_effort: M
files_to_touch:
  - adapters/langfuse.ts
---

# Langfuse Adapter

## Context

proof-of-skill collects rich data about skill quality: invocation counts, eval scores, degradation events, and optimization sessions. This data currently lives in a local SQLite database. For teams and individuals who use Langfuse for LLM observability, this data should flow into Langfuse as first-class traces, scores, and events -- making skill quality visible alongside other LLM metrics in a unified dashboard.

The adapter should be provider-agnostic in its interface so that other observability backends (Datadog, Honeycomb, custom) can be added later using the same pattern.

## Problem Statement

1. **Local-only visibility**: Skill quality data is trapped in a local SQLite file. There is no way to view it in existing observability platforms that teams already use
2. **No trace correlation**: Skill invocations happen within larger LLM sessions. Without Langfuse integration, there is no way to correlate skill quality with session-level metrics (latency, token usage, cost)
3. **No team visibility**: In a team setting, individual developers' skill quality data is invisible to others. Langfuse provides the shared dashboard layer
4. **No historical analysis**: While SQLite retains recent data, Langfuse provides long-term retention, search, filtering, and visualization that SQLite alone cannot offer

## Desired Outcome

- A Langfuse adapter that maps proof-of-skill data to Langfuse's data model
- Skill invocations become Langfuse traces
- Eval scores become Langfuse scores attached to those traces
- Optimization events become Langfuse events
- The adapter implements a provider-agnostic interface so other backends can be added
- Configuration is via environment variables or config file, never hardcoded

## Implementation Guide

### Step 1: Define the provider-agnostic interface

```typescript
// adapters/types.ts

export interface ObservabilityAdapter {
  /**
   * Record a skill invocation as a trace.
   */
  recordTrace(data: {
    skillName: string;
    timestamp: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * Attach an eval score to a trace.
   */
  recordScore(data: {
    traceId: string;
    skillName: string;
    score: number;
    evalMode: 'quick' | 'full';
    scenarioCount?: number;
    timestamp: string;
  }): Promise<void>;

  /**
   * Record a significant event (degradation detected, optimization started/completed).
   */
  recordEvent(data: {
    traceId?: string;
    name: string;
    skillName: string;
    metadata: Record<string, unknown>;
    timestamp: string;
  }): Promise<void>;

  /**
   * Flush any buffered data to the backend.
   */
  flush(): Promise<void>;

  /**
   * Check if the adapter is configured and the backend is reachable.
   */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
```

### Step 2: Implement the Langfuse adapter

Create `adapters/langfuse.ts`:

```typescript
import Langfuse from 'langfuse';
import { ObservabilityAdapter } from './types';

export class LangfuseAdapter implements ObservabilityAdapter {
  private client: Langfuse;
  private traceIds: Map<string, string>; // skillInvocationId -> langfuseTraceId

  constructor(config?: {
    publicKey?: string;
    secretKey?: string;
    baseUrl?: string;
  }) {
    this.client = new Langfuse({
      publicKey: config?.publicKey || process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: config?.secretKey || process.env.LANGFUSE_SECRET_KEY,
      baseUrl: config?.baseUrl || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });
    this.traceIds = new Map();
  }

  async recordTrace(data: {
    skillName: string;
    timestamp: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const trace = this.client.trace({
      name: `skill:${data.skillName}`,
      timestamp: new Date(data.timestamp),
      metadata: {
        source: 'proof-of-skill',
        skill_name: data.skillName,
        duration_ms: data.durationMs,
        ...data.metadata,
      },
      tags: ['proof-of-skill', data.skillName],
    });

    // Store trace ID for later score attachment
    this.traceIds.set(`${data.skillName}:${data.timestamp}`, trace.id);
  }

  async recordScore(data: {
    traceId: string;
    skillName: string;
    score: number;
    evalMode: 'quick' | 'full';
    scenarioCount?: number;
    timestamp: string;
  }): Promise<void> {
    this.client.score({
      traceId: data.traceId,
      name: 'skill-quality',
      value: data.score / 100, // Langfuse scores are 0-1
      comment: `${data.evalMode} eval, ${data.scenarioCount || '?'} scenarios`,
      metadata: {
        source: 'proof-of-skill',
        eval_mode: data.evalMode,
        scenario_count: data.scenarioCount,
        raw_score: data.score,
      },
    });
  }

  async recordEvent(data: {
    traceId?: string;
    name: string;
    skillName: string;
    metadata: Record<string, unknown>;
    timestamp: string;
  }): Promise<void> {
    if (data.traceId) {
      this.client.event({
        traceId: data.traceId,
        name: data.name,
        metadata: {
          source: 'proof-of-skill',
          skill_name: data.skillName,
          ...data.metadata,
        },
      });
    } else {
      // Create a standalone trace for events without a parent
      const trace = this.client.trace({
        name: `event:${data.name}`,
        metadata: {
          source: 'proof-of-skill',
          skill_name: data.skillName,
          event_type: data.name,
          ...data.metadata,
        },
        tags: ['proof-of-skill', 'event', data.skillName],
      });
    }
  }

  async flush(): Promise<void> {
    await this.client.flushAsync();
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      // Langfuse SDK does not have a built-in health check
      // Attempt a minimal API call to verify connectivity
      await this.client.flushAsync();
      return { ok: true, message: 'Langfuse connection successful' };
    } catch (error) {
      return {
        ok: false,
        message: `Langfuse connection failed: ${(error as Error).message}`,
      };
    }
  }
}
```

### Step 3: Create the adapter factory

```typescript
// adapters/index.ts

import { ObservabilityAdapter } from './types';
import { LangfuseAdapter } from './langfuse';

export type AdapterType = 'langfuse' | 'noop';

export function createAdapter(type?: AdapterType): ObservabilityAdapter {
  const adapterType = type || process.env.PROOF_OF_SKILL_ADAPTER || 'noop';

  switch (adapterType) {
    case 'langfuse':
      return new LangfuseAdapter();
    case 'noop':
    default:
      return new NoopAdapter(); // does nothing, used when no adapter is configured
  }
}

class NoopAdapter implements ObservabilityAdapter {
  async recordTrace() {}
  async recordScore() {}
  async recordEvent() {}
  async flush() {}
  async healthCheck() { return { ok: true, message: 'No adapter configured (noop)' }; }
}
```

### Step 4: Integrate with the metrics store

Update `core/metrics-store.ts` to emit adapter events alongside SQLite writes:

```typescript
import { createAdapter, ObservabilityAdapter } from '../adapters';

export class MetricsStore {
  private adapter: ObservabilityAdapter;

  constructor(dbPath?: string) {
    // ... existing SQLite setup
    this.adapter = createAdapter();
  }

  async recordEvalScore(score: EvalScore): Promise<void> {
    // Write to SQLite (existing)
    this.insertEvalScore(score);

    // Emit to adapter
    await this.adapter.recordScore({
      traceId: `${score.skill_name}:${score.timestamp}`,
      skillName: score.skill_name,
      score: score.score,
      evalMode: score.eval_mode,
      scenarioCount: score.scenario_count,
      timestamp: score.timestamp,
    });
  }
}
```

### Step 5: Data mapping reference

| proof-of-skill | Langfuse | Notes |
|----------------|----------|-------|
| Skill invocation | Trace | `name: "skill:<name>"`, tagged with `proof-of-skill` |
| Eval score | Score | `name: "skill-quality"`, value normalized to 0-1 |
| Degradation event | Event on trace | `name: "degradation-detected"` |
| Optimization start | Trace | `name: "event:optimization-started"` |
| Optimization complete | Event on trace | `name: "optimization-completed"`, includes result score |

## Acceptance Criteria

- [ ] `adapters/langfuse.ts` exports a `LangfuseAdapter` class implementing `ObservabilityAdapter`
- [ ] `adapters/types.ts` defines the provider-agnostic `ObservabilityAdapter` interface
- [ ] `adapters/index.ts` exports a `createAdapter()` factory function
- [ ] The factory supports `langfuse` and `noop` adapter types
- [ ] The adapter type is configurable via `PROOF_OF_SKILL_ADAPTER` environment variable
- [ ] Langfuse credentials are sourced from environment variables (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`)
- [ ] Skill invocations are recorded as Langfuse traces with appropriate tags and metadata
- [ ] Eval scores are recorded as Langfuse scores (normalized to 0-1) attached to traces
- [ ] Events (degradation, optimization) are recorded as Langfuse events
- [ ] `flush()` ensures all buffered data is sent to Langfuse before process exit
- [ ] `healthCheck()` verifies Langfuse connectivity and returns a structured result
- [ ] The `NoopAdapter` does nothing and is used as the default when no adapter is configured
- [ ] The metrics store emits adapter events alongside SQLite writes (dual-write)
- [ ] The adapter handles Langfuse SDK errors gracefully (log and continue, never crash)

## Technical Notes

- **Langfuse SDK**: Use the `langfuse` npm package (official Node.js SDK). It buffers events internally and flushes them in batches. Call `flushAsync()` before process exit to avoid data loss
- **Score normalization**: Langfuse scores are typically 0-1. proof-of-skill uses 0-100. Divide by 100 when recording, store `raw_score` in metadata for reference
- **Trace ID correlation**: Langfuse generates trace IDs. The adapter must maintain a mapping between proof-of-skill invocation identifiers and Langfuse trace IDs. Use a Map with TTL to avoid memory leaks for long-running processes
- **Dual-write pattern**: Writing to both SQLite and Langfuse means the adapter must not block the SQLite write path. Make adapter calls async and fire-and-forget (with error logging). SQLite is the source of truth; Langfuse is a best-effort mirror
- **Environment detection**: If Langfuse credentials are not configured, `createAdapter()` should return the `NoopAdapter` silently. No warnings on every invocation. Warn once at startup if `PROOF_OF_SKILL_ADAPTER=langfuse` is set but credentials are missing
- **Future adapters**: The `ObservabilityAdapter` interface is intentionally minimal. When adding Datadog or Honeycomb adapters, the same interface should suffice. If it does not, extend the interface in a backward-compatible way (optional methods)
- **Testing**: Mock the Langfuse SDK for unit tests. For integration tests, use Langfuse's self-hosted Docker setup or a test project on Langfuse Cloud

## Verification

```bash
# 1. Verify adapter creation with Langfuse configured
LANGFUSE_PUBLIC_KEY=pk-test LANGFUSE_SECRET_KEY=sk-test \
PROOF_OF_SKILL_ADAPTER=langfuse \
node -e "
  const { createAdapter } = require('./adapters');
  const adapter = createAdapter();
  adapter.healthCheck().then(r => console.log(r));
"
# Expect: { ok: true/false, message: '...' }

# 2. Verify noop adapter is default
node -e "
  const { createAdapter } = require('./adapters');
  const adapter = createAdapter();
  adapter.healthCheck().then(r => console.log(r));
"
# Expect: { ok: true, message: 'No adapter configured (noop)' }

# 3. Verify trace recording (with Langfuse running)
LANGFUSE_PUBLIC_KEY=pk-test LANGFUSE_SECRET_KEY=sk-test \
PROOF_OF_SKILL_ADAPTER=langfuse \
node -e "
  const { createAdapter } = require('./adapters');
  const adapter = createAdapter();
  adapter.recordTrace({
    skillName: 'test-skill',
    timestamp: new Date().toISOString(),
    durationMs: 1500
  }).then(() => adapter.flush()).then(() => console.log('Trace sent'));
"
# Expect: "Trace sent", trace visible in Langfuse dashboard

# 4. Verify score normalization
# In Langfuse dashboard, check that a score of 92 appears as 0.92
# and that metadata contains raw_score: 92

# 5. Verify dual-write does not block
# Record a score with Langfuse intentionally misconfigured (wrong key)
# Expect: SQLite write succeeds, Langfuse error is logged but not thrown
```
