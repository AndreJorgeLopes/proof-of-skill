---
id: FEAT-async-cross-model-eval
title: "Make cross-model eval truly async with Promise.all"
priority: P2
category: features
status: open
depends_on:
  - FEAT-cross-model-eval
estimated_effort: S
files_to_touch:
  - core/cross-model.ts
origin: "Review finding from PR #10 (May 11, 2026 coordination run)"
---

# Async Cross-Model Eval

## Context

PR #10 (cross-model eval) marks `evaluate()` as `async` but uses synchronous `execFileSync` internally. This blocks the Node.js event loop for up to 15 minutes (3 models × 5 min timeout).

## Problem

1. Event loop blocked during eval — no other work can proceed
2. Method signature promises async behavior but delivers sync
3. Cannot use `Promise.all()` for parallel model evals (would still be sequential)

## Desired Outcome

- Replace `execFileSync` with promisified `execFile`
- Run model evals in parallel via `Promise.all()` (with configurable concurrency limit)
- Wall-clock time drops from ~15 min to ~5 min for 3-model eval

## Implementation Guide

1. Replace `execFileSync` with `util.promisify(child_process.execFile)`
2. Add concurrency limiter (default: 2) to avoid API rate limits
3. Run model evals via `Promise.all()` with limiter
4. Make `PASS_THRESHOLD` configurable (currently hardcoded to 85)

## Acceptance Criteria

- [ ] `evaluate()` is truly async — no `execFileSync` calls
- [ ] Model evals run in parallel (up to concurrency limit)
- [ ] `PASS_THRESHOLD` is configurable via constructor or method parameter
- [ ] Wall-clock time for 3-model eval is ~1x single model (not 3x)
