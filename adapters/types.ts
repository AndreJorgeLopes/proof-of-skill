/**
 * Provider-agnostic observability adapter interface.
 *
 * Defines a minimal contract for emitting skill quality data to external
 * observability backends (Langfuse, Datadog, Honeycomb, etc.). Each backend
 * implements this interface; consumer code is decoupled from any specific
 * provider SDK.
 */

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

export interface TraceData {
  skillName: string;
  timestamp: string; // ISO 8601 UTC
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ScoreData {
  traceId: string;
  skillName: string;
  /** Raw score on the proof-of-skill 0-100 scale. */
  score: number;
  evalMode: 'quick' | 'full';
  scenarioCount?: number;
  timestamp: string; // ISO 8601 UTC
}

export interface EventData {
  traceId?: string;
  name: string;
  skillName: string;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO 8601 UTC
}

export interface HealthCheckResult {
  ok: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface ObservabilityAdapter {
  /**
   * Record a skill invocation as a trace.
   */
  recordTrace(data: TraceData): Promise<void>;

  /**
   * Attach an eval score to a trace.
   */
  recordScore(data: ScoreData): Promise<void>;

  /**
   * Record a significant event (degradation detected, optimization
   * started/completed, etc.).
   */
  recordEvent(data: EventData): Promise<void>;

  /**
   * Flush any buffered data to the backend.
   * Call before process exit to avoid data loss.
   */
  flush(): Promise<void>;

  /**
   * Check if the adapter is configured and the backend is reachable.
   */
  healthCheck(): Promise<HealthCheckResult>;
}
