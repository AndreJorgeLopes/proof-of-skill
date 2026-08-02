---
id: FEAT-gnap-coordination
title: "GNAP-style git-native task locking for autonomous coordination"
priority: P3
category: features
status: open
depends_on: []
estimated_effort: M
files_to_touch:
  - tasks/lock.json
  - docs/coordination-protocol.md
origin: "Research finding — GNAP pattern (May 11, 2026 coordination run)"
---

# Git-Native Task Locking (GNAP-inspired)

## Context

Autonomous coordination runs (scheduled daily) spawn multiple agents working on different tasks in parallel. Currently, there is no locking mechanism — agents could theoretically pick up the same task or create conflicting changes. The GNAP (Git-Native Agent Protocol) pattern uses JSON files in the git repo as a persistent task board (todo/doing/done) with no server needed.

## Desired Outcome

- A `tasks/lock.json` file tracks which tasks are being worked on, by which agent, since when
- Coordination agents check the lock before assigning work
- Locks auto-expire after a configurable TTL (default: 2 hours)
- Lock state is committed to git so it survives process boundaries

## Implementation Guide

```json
{
  "locks": {
    "FEAT-p95-hooks": {
      "agent": "fix-pr16",
      "since": "2026-05-11T09:00:00Z",
      "ttl_seconds": 7200
    }
  },
  "history": [
    {"task": "FEAT-monitor-skill", "agent": "review-pr15", "action": "unlock", "at": "2026-05-11T08:45:00Z"}
  ]
}
```

## Acceptance Criteria

- [ ] `tasks/lock.json` schema defined and documented
- [ ] Lock/unlock operations are atomic (read-modify-write with conflict detection)
- [ ] Locks auto-expire after TTL
- [ ] Coordination agents check lock before dispatching work
- [ ] Lock history provides audit trail
