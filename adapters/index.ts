/**
 * Adapter factory for proof-of-skill observability.
 *
 * Usage:
 *   import { createAdapter } from './adapters/index.js';
 *   const adapter = createAdapter();        // reads PROOF_OF_SKILL_ADAPTER env
 *   const adapter = createAdapter('noop');   // explicit type
 *
 * Default behaviour: returns a NoopAdapter that silently discards all data.
 * Set PROOF_OF_SKILL_ADAPTER=langfuse and provide LANGFUSE_PUBLIC_KEY /
 * LANGFUSE_SECRET_KEY to activate the Langfuse backend.
 */

import type { ObservabilityAdapter, HealthCheckResult } from './types.js';
import { LangfuseAdapter } from './langfuse.js';

// Re-export public surface
export type { ObservabilityAdapter, HealthCheckResult } from './types.js';
export type { TraceData, ScoreData, EventData } from './types.js';
export { LangfuseAdapter } from './langfuse.js';

// ---------------------------------------------------------------------------
// Supported adapter types
// ---------------------------------------------------------------------------

export type AdapterType = 'langfuse' | 'noop';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an observability adapter based on the given type or the
 * `PROOF_OF_SKILL_ADAPTER` environment variable.
 *
 * Falls back to NoopAdapter when:
 *   - No type is specified and the env var is unset
 *   - The type is 'langfuse' but credentials are missing (logs a warning once)
 *   - An unknown type is provided
 */
export function createAdapter(type?: AdapterType): ObservabilityAdapter {
  const adapterType =
    type || (process.env['PROOF_OF_SKILL_ADAPTER'] as AdapterType) || 'noop';

  switch (adapterType) {
    case 'langfuse': {
      const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
      const secretKey = process.env['LANGFUSE_SECRET_KEY'];

      if (!publicKey || !secretKey) {
        console.warn(
          '[proof-of-skill] PROOF_OF_SKILL_ADAPTER=langfuse but ' +
            'LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are not set. ' +
            'Falling back to noop adapter.',
        );
        return new NoopAdapter();
      }

      return new LangfuseAdapter();
    }

    case 'noop':
    default:
      return new NoopAdapter();
  }
}

// ---------------------------------------------------------------------------
// NoopAdapter — default when no backend is configured
// ---------------------------------------------------------------------------

export class NoopAdapter implements ObservabilityAdapter {
  async recordTrace(): Promise<void> {
    /* intentionally empty */
  }
  async recordScore(): Promise<void> {
    /* intentionally empty */
  }
  async recordEvent(): Promise<void> {
    /* intentionally empty */
  }
  async flush(): Promise<void> {
    /* intentionally empty */
  }
  async healthCheck(): Promise<HealthCheckResult> {
    return { ok: true, message: 'No adapter configured (noop)' };
  }
}
