---
id: FEAT-test-coverage
title: "Unit tests for notifier, Langfuse adapter, and cross-model eval"
priority: P3
category: quality
status: open
depends_on:
  - FEAT-non-disruptive-notify
  - FEAT-langfuse-adapter
  - FEAT-cross-model-eval
estimated_effort: M
files_to_touch:
  - core/notifier.test.ts
  - adapters/langfuse.test.ts
  - core/cross-model.test.ts
origin: "Review findings from PRs #7, #8, #10 (May 11, 2026 coordination run)"
---

# Unit Test Coverage

## Context

Review of PRs #7, #8, and #10 identified missing test files. The task specs all mention tests in their Technical Notes but none of the PRs shipped with test files.

## Desired Outcome

Test files for the three modules with highest risk:

### core/notifier.test.ts
- Cooldown logic with fast-forwarded clock
- NO_COLOR environment variable behavior
- Box rendering output format
- Auto-dismiss timeout behavior (mocked timer)

### adapters/langfuse.test.ts
- Score normalization (0-100 → 0-1)
- Error swallowing (adapter never throws)
- Trace ID mapping and TTL eviction
- Noop factory default

### core/cross-model.test.ts
- Compatibility classification (universal/mid-tier+/opus-only/none)
- Recommendation generation per compatibility level
- Heatmap formatting

## Acceptance Criteria

- [ ] `core/notifier.test.ts` covers cooldown + NO_COLOR + rendering
- [ ] `adapters/langfuse.test.ts` covers normalization + error handling + factory
- [ ] `core/cross-model.test.ts` covers classification + recommendations
- [ ] All tests pass with `npx vitest` or `npx jest`
