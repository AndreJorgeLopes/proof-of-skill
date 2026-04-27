---
id: FIX-pr7-review-findings
title: "Fix critical issues in PR #7 (notifier)"
priority: P1
category: fix
status: open
depends_on: []
estimated_effort: S
---

# Fix PR #7 Review Findings

## Context

PR #14 (April 16 coordination) identified 2 critical issues in PR #7:
1. **Command injection**: `skillName` passed to `execSync` without sanitization — allows arbitrary command execution
2. **Non-atomic migration**: Migration logic is not transactional

## Fixes Required

1. Sanitize `skillName` by rejecting any value containing shell metacharacters (`; | & $ \` etc.)
2. Use `execFile` instead of `execSync` where possible (no shell interpolation)
3. Wrap migration steps in a transaction

## Implementation

Push fixes directly to the `feat/non-disruptive-notify` branch (PR #7's branch).

## Acceptance Criteria

- [ ] skillName is validated before any shell usage
- [ ] execFile used instead of execSync for command execution
- [ ] No command injection possible via crafted skill names
- [ ] Migration is transactional
