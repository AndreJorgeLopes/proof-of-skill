/**
 * Langfuse adapter for proof-of-skill observability.
 *
 * Maps proof-of-skill data to Langfuse's data model:
 *   - Skill invocations -> Langfuse traces
 *   - Eval scores       -> Langfuse scores (normalized 0-1)
 *   - Events            -> Langfuse events (or standalone traces)
 *
 * All operations are fire-and-forget: errors are logged but never thrown,
 * ensuring the adapter never disrupts the primary SQLite write path.
 */

import Langfuse from 'langfuse';
import type {
  ObservabilityAdapter,
  TraceData,
  ScoreData,
  EventData,
  HealthCheckResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LangfuseAdapterConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class LangfuseAdapter implements ObservabilityAdapter {
  private client: Langfuse;
  /**
   * Maps `${skillName}:${timestamp}` to Langfuse trace IDs so that scores
   * and events can be attached to the correct trace after the fact.
   *
   * Entries are evicted after 10 minutes to prevent unbounded growth in
   * long-running processes.
   */
  private traceIds: Map<string, { id: string; createdAt: number }>;
  private static readonly TRACE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(config?: LangfuseAdapterConfig) {
    this.client = new Langfuse({
      publicKey: config?.publicKey || process.env['LANGFUSE_PUBLIC_KEY'],
      secretKey: config?.secretKey || process.env['LANGFUSE_SECRET_KEY'],
      baseUrl:
        config?.baseUrl ||
        process.env['LANGFUSE_HOST'] ||
        'https://cloud.langfuse.com',
    });
    this.traceIds = new Map();
  }

  // -----------------------------------------------------------------------
  // ObservabilityAdapter implementation
  // -----------------------------------------------------------------------

  async recordTrace(data: TraceData): Promise<void> {
    try {
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

      // Store for later score/event attachment
      const key = `${data.skillName}:${data.timestamp}`;
      this.traceIds.set(key, { id: trace.id, createdAt: Date.now() });
      this.evictStaleEntries();
    } catch (error) {
      this.logError('recordTrace', error);
    }
  }

  async recordScore(data: ScoreData): Promise<void> {
    try {
      this.client.score({
        traceId: data.traceId,
        name: 'skill-quality',
        value: data.score / 100, // Normalize 0-100 -> 0-1
        comment: `${data.evalMode} eval, ${data.scenarioCount ?? '?'} scenarios`,
        metadata: {
          source: 'proof-of-skill',
          eval_mode: data.evalMode,
          scenario_count: data.scenarioCount,
          raw_score: data.score,
        },
      });
    } catch (error) {
      this.logError('recordScore', error);
    }
  }

  async recordEvent(data: EventData): Promise<void> {
    try {
      if (data.traceId) {
        // Attach event to existing trace
        this.client.event({
          traceId: data.traceId,
          name: data.name,
          startTime: new Date(data.timestamp),
          metadata: {
            source: 'proof-of-skill',
            skill_name: data.skillName,
            ...data.metadata,
          },
        });
      } else {
        // Create a standalone trace for events without a parent
        this.client.trace({
          name: `event:${data.name}`,
          timestamp: new Date(data.timestamp),
          metadata: {
            source: 'proof-of-skill',
            skill_name: data.skillName,
            event_type: data.name,
            ...data.metadata,
          },
          tags: ['proof-of-skill', 'event', data.skillName],
        });
      }
    } catch (error) {
      this.logError('recordEvent', error);
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushAsync();
    } catch (error) {
      this.logError('flush', error);
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // The Langfuse SDK does not expose a dedicated health endpoint.
      // A successful flush confirms that the client is configured and
      // can reach the backend.
      await this.client.flushAsync();
      return { ok: true, message: 'Langfuse connection successful' };
    } catch (error) {
      return {
        ok: false,
        message: `Langfuse connection failed: ${(error as Error).message}`,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Look up a Langfuse trace ID previously recorded via `recordTrace`.
   * Useful for callers that need to attach scores/events after the fact.
   */
  getTraceId(skillName: string, timestamp: string): string | undefined {
    return this.traceIds.get(`${skillName}:${timestamp}`)?.id;
  }

  /**
   * Remove entries older than TRACE_TTL_MS to prevent memory leaks.
   */
  private evictStaleEntries(): void {
    const cutoff = Date.now() - LangfuseAdapter.TRACE_TTL_MS;
    for (const [key, entry] of this.traceIds) {
      if (entry.createdAt < cutoff) {
        this.traceIds.delete(key);
      }
    }
  }

  private logError(method: string, error: unknown): void {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`[proof-of-skill][LangfuseAdapter.${method}] ${message}`);
  }
}
