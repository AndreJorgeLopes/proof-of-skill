---
id: FEAT-non-disruptive-notify
title: "Non-disruptive degradation notifications"
priority: P2
category: features
status: in-review
pr: "#7"
depends_on:
  - FEAT-p95-hooks
estimated_effort: M
files_to_touch:
  - core/notifier.ts
---

# Non-Disruptive Degradation Notifications

## Context

The p95 sampling hooks detect when a skill's eval score drops below its configured threshold. When this happens, the user needs to know -- but the notification must not break their current workflow. A developer deep in a complex debugging session should not be interrupted by a modal dialog or a blocking prompt. The notification should be informational, offer actionable next steps, and let the user decide when (or whether) to act.

## Problem Statement

1. **No notification mechanism**: When degradation is detected, an event is written to a file/database, but the user is never informed. They would only discover the issue by manually checking scores
2. **Interruption risk**: A naive notification implementation (blocking prompt, forced context switch) would be worse than no notification at all. Users would disable it immediately
3. **No actionable path**: Even if the user learns about degradation, there is no guided path from "your skill degraded" to "here's how to fix it." The notification should offer concrete next steps
4. **No cooldown**: Without rate limiting, a consistently underperforming skill could spam notifications every time the hook samples it

## Desired Outcome

- When p95 sampling detects a score below threshold, the user is notified inline (not blocking) in their terminal
- The notification shows: skill name, current score, threshold, and score delta from baseline
- The notification offers three options: spawn an agent-deck background session for auto-optimization, get a `claude --resume` command for manual investigation, or skip/dismiss
- Notifications respect a per-skill cooldown to prevent spam
- The user's current work is never interrupted or blocked

## Implementation Guide

### Step 1: Create the notifier module

Create `core/notifier.ts`:

```typescript
import { MetricsStore } from './metrics-store';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const PROOF_DIR = process.env.PROOF_OF_SKILL_DIR || resolve(process.env.HOME!, '.proof-of-skill');

export interface DegradationAlert {
  skillName: string;
  currentScore: number;
  threshold: number;
  baselineScore: number;
  delta: number; // currentScore - baselineScore
  timestamp: string;
}

export interface NotificationOptions {
  cooldownSeconds: number; // default: 3600 (1 hour)
  minScoreDrop: number;    // minimum drop from baseline to notify (default: 10)
}

export class Notifier {
  private store: MetricsStore;
  private cooldownFile: string;

  constructor(store: MetricsStore) {
    this.store = store;
    this.cooldownFile = resolve(PROOF_DIR, 'notification-cooldowns.json');
  }

  async notify(alert: DegradationAlert, options?: Partial<NotificationOptions>): Promise<void> {
    // Check cooldown
    // Format notification
    // Present options
    // Record notification event
  }
}
```

### Step 2: Implement the notification format

The notification should be a compact, visually distinct block that appears in the terminal without requiring user action:

```
┌─────────────────────────────────────────────────────┐
│  proof-of-skill: skill degradation detected         │
│                                                     │
│  Skill:     grill-me                                │
│  Score:     71 (threshold: 85, baseline: 92)        │
│  Drop:      -21 points from baseline                │
│                                                     │
│  Options:                                           │
│  [1] Spawn background optimization (agent-deck)     │
│  [2] Get claude --resume command for manual fix      │
│  [3] Skip (remind me in 1 hour)                     │
└─────────────────────────────────────────────────────┘
```

Key design decisions:
- Use box-drawing characters for visual distinction from regular terminal output
- Keep it to ~10 lines maximum
- Show the score context (current, threshold, baseline, delta) in one line
- Offer exactly 3 options: auto-fix, manual-fix, skip
- Default to skip if no response within 10 seconds (non-blocking)

### Step 3: Implement the three response paths

**Option 1: Background optimization (agent-deck)**

```typescript
async spawnBackgroundOptimization(skillName: string): Promise<void> {
  // Use agent-deck to create a background session
  const sessionName = `proof-of-skill-optimize-${skillName}`;
  const command = [
    'agent-deck', 'create',
    '--name', sessionName,
    '--prompt', `Run ralph-loop optimization for skill "${skillName}": tessl eval → diagnose → fix → re-eval. Target score: ${threshold}. Do not ask for user input.`,
    '--background'
  ].join(' ');

  // Execute and report session ID back to user
  // "Background optimization started: session abc123"
}
```

**Option 2: Resume command**

```typescript
getResumeCommand(skillName: string, score: number): string {
  return `claude --resume "Skill '${skillName}' scored ${score}/${threshold}. Investigate the eval failures and fix the skill."`;
}
```

**Option 3: Skip with cooldown**

```typescript
async skip(skillName: string, cooldownSeconds: number): Promise<void> {
  const cooldowns = this.loadCooldowns();
  cooldowns[skillName] = {
    until: new Date(Date.now() + cooldownSeconds * 1000).toISOString(),
    lastScore: alert.currentScore
  };
  this.saveCooldowns(cooldowns);
}
```

### Step 4: Implement cooldown management

```typescript
private isInCooldown(skillName: string): boolean {
  const cooldowns = this.loadCooldowns();
  const entry = cooldowns[skillName];
  if (!entry) return false;
  return new Date(entry.until) > new Date();
}

private loadCooldowns(): Record<string, { until: string; lastScore: number }> {
  if (!existsSync(this.cooldownFile)) return {};
  return JSON.parse(readFileSync(this.cooldownFile, 'utf-8'));
}
```

### Step 5: Integrate with the p95 hook

Update the hook to call the notifier when a degradation event is recorded:

```bash
# In hooks/skill-complete.sh, after detecting threshold breach:
if [[ "$SCORE" -lt "$THRESHOLD" ]]; then
  node -e "
    const { MetricsStore } = require('./core/metrics-store');
    const { Notifier } = require('./core/notifier');
    const store = new MetricsStore();
    const notifier = new Notifier(store);
    notifier.notify({
      skillName: '$SKILL_NAME',
      currentScore: $SCORE,
      threshold: $THRESHOLD,
      baselineScore: $BASELINE,
      delta: $SCORE - $BASELINE,
      timestamp: new Date().toISOString()
    });
  "
fi
```

## Acceptance Criteria

- [ ] `core/notifier.ts` exports a `Notifier` class with a `notify()` method
- [ ] Notifications are displayed inline in the terminal using box-drawing characters
- [ ] Notifications show: skill name, current score, threshold, baseline score, and delta
- [ ] Three options are presented: background optimization, resume command, skip
- [ ] Option 1 spawns an agent-deck background session with the correct optimization prompt
- [ ] Option 2 outputs a `claude --resume` command the user can copy-paste
- [ ] Option 3 sets a cooldown timer for the skill (default: 1 hour)
- [ ] Notifications respect per-skill cooldowns and do not repeat within the cooldown window
- [ ] Notifications have a `minScoreDrop` filter: only notify if the drop from baseline exceeds the threshold (default: 10 points)
- [ ] If no user response within 10 seconds, the notification auto-dismisses (equivalent to skip)
- [ ] The notification never blocks the user's current Claude Code session
- [ ] Cooldown state is persisted to `~/.proof-of-skill/notification-cooldowns.json`
- [ ] Notification events are recorded in the SQLite store for history tracking

## Technical Notes

- **Non-blocking I/O**: The notification must not use synchronous stdin reads that block the event loop. Use a timeout-based approach: display the notification, wait up to 10 seconds for a keypress, then auto-dismiss. Consider using `readline` with a timeout
- **Terminal detection**: Check if stdout is a TTY before rendering box-drawing characters. If not a TTY (piped output, CI), skip the visual notification and just log the event
- **agent-deck integration**: The background session spawn depends on agent-deck being installed. If it is not available, option 1 should be grayed out with a message: "Install agent-deck for background optimization"
- **claude --resume**: Verify the exact CLI syntax for resuming sessions with a pre-filled prompt. The `--resume` flag may have been renamed or may require additional arguments
- **Cooldown persistence**: Use a simple JSON file for cooldowns rather than the SQLite store. The cooldown file is tiny (one entry per skill) and does not benefit from SQL queries. It also keeps the notifier loosely coupled from the store
- **ANSI colors**: Use ANSI escape codes for the notification border and emphasis. Yellow for the header, red for scores below threshold, green for the resume command. Respect `NO_COLOR` environment variable
- **Testing**: Mock the terminal output and agent-deck spawn for unit tests. Test the cooldown logic with a fast-forwarded clock

## Verification

```bash
# 1. Trigger a notification manually
node -e "
  const { MetricsStore } = require('./core/metrics-store');
  const { Notifier } = require('./core/notifier');
  const store = new MetricsStore();
  const notifier = new Notifier(store);
  notifier.notify({
    skillName: 'test-skill',
    currentScore: 71,
    threshold: 85,
    baselineScore: 92,
    delta: -21,
    timestamp: new Date().toISOString()
  });
"
# Expect: Box notification displayed with skill name, score, and options

# 2. Verify cooldown prevents repeat notification
# Run the same notify() call again immediately
# Expect: No notification (within cooldown window)

# 3. Verify option 1 spawns agent-deck session
# Select option 1 when prompted
# Expect: "Background optimization started: session <id>"

# 4. Verify option 2 prints resume command
# Select option 2 when prompted
# Expect: claude --resume "Skill 'test-skill' scored 71/85..."

# 5. Verify auto-dismiss after timeout
# Do not press any key for 10 seconds
# Expect: Notification disappears, equivalent to skip

# 6. Verify NO_COLOR is respected
NO_COLOR=1 node -e "..." # same as step 1
# Expect: No ANSI colors in output, plain text only
```
