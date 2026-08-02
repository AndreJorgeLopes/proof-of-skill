---
id: FEAT-persist-optimization-sessions
title: "Persist active optimization sessions in SQLite"
priority: P2
category: features
status: open
depends_on:
  - FEAT-background-optimize
  - FEAT-sqlite-store
estimated_effort: S
files_to_touch:
  - core/optimizer.ts
  - core/metrics-store.ts
origin: "Review finding from PR #9 (May 11, 2026 coordination run)"
---

# Persist Active Optimization Sessions in SQLite

## Context

PR #9 (background optimization) stores active optimization sessions in an in-memory Map. If the process restarts, all tracking is lost — `isOptimizing()` returns false and duplicate sessions can be spawned for the same skill.

## Problem

In-memory tracking means:
1. Process crash loses all active session references
2. Duplicate optimizations can be spawned after restart
3. No visibility into historical session state across process boundaries

## Desired Outcome

- Active optimization sessions are persisted in the SQLite metrics store
- `isOptimizing(skillName)` checks SQLite, not in-memory state
- Process restarts correctly detect running sessions
- Stale sessions (older than configurable TTL) are auto-cleaned

## Implementation Guide

1. Add an `active_sessions` table to the SQLite schema (V3 migration)
2. Write session start/stop events to SQLite instead of in-memory Map
3. Add a cleanup query for sessions older than TTL (default: 2 hours)
4. Update `Optimizer.isOptimizing()` to query SQLite

## Acceptance Criteria

- [ ] Active sessions stored in SQLite, not in-memory
- [ ] `isOptimizing()` survives process restart
- [ ] Stale sessions are auto-cleaned after configurable TTL
- [ ] No duplicate optimization sessions for the same skill
