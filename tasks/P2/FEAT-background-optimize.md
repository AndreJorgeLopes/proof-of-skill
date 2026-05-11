---
id: FEAT-background-optimize
title: "Background optimization sessions via agent-deck"
priority: P2
category: features
status: done
depends_on:
  - FEAT-non-disruptive-notify
estimated_effort: L
files_to_touch:
  - core/optimizer.ts
---

# Background Optimization Sessions

## Context

When the notifier detects skill degradation and the user chooses option 1 (background optimization), a fully autonomous session needs to run the ralph-loop: evaluate the skill, diagnose failures, fix the SKILL.md, and re-evaluate until the score meets the threshold. This session must run without any user interaction -- the user should be able to continue their work while the optimization happens in the background.

agent-deck provides the session management infrastructure. `claude --resume` provides the ability to start a Claude Code session with a pre-defined task. The optimizer ties these together into a self-healing loop.

## Problem Statement

1. **No autonomous optimization**: When degradation is detected, someone must manually investigate failures, read eval output, edit the SKILL.md, and re-run evals. This is time-consuming and breaks flow
2. **No structured diagnosis**: Even when a user decides to fix a degraded skill, they must manually interpret eval failures and determine what went wrong. There is no systematic diagnosis step
3. **No convergence guarantee**: Without a structured loop (eval -> diagnose -> fix -> re-eval), manual fixes may not converge. A user might fix one failure and introduce another
4. **No session management**: Running optimization in the foreground ties up the user's terminal. There is no way to run it in the background and check on it later

## Desired Outcome

- A background optimization process that runs the full ralph-loop autonomously
- The process is spawned via agent-deck as a background session
- The loop runs: `tessl eval` -> diagnose failures -> fix SKILL.md -> `tessl eval` until score >= threshold or max iterations reached
- The user can check optimization status at any time without entering the session
- Optimization results are recorded in the SQLite metrics store

## Implementation Guide

### Step 1: Create the optimizer module

Create `core/optimizer.ts`:

```typescript
import { MetricsStore, OptimizationEvent } from './metrics-store';
import { resolve } from 'path';

export interface OptimizationConfig {
  skillName: string;
  skillPath: string;
  scenariosPath: string;
  targetScore: number;
  maxIterations: number;   // default: 5
  evalMode: 'quick' | 'full'; // default: 'full' for optimization
}

export interface OptimizationResult {
  skillName: string;
  startScore: number;
  endScore: number;
  iterations: number;
  converged: boolean;
  changes: string[]; // summary of each iteration's changes
  duration: number;  // total seconds
}

export class Optimizer {
  private store: MetricsStore;

  constructor(store: MetricsStore) {
    this.store = store;
  }

  /**
   * Generate the prompt that drives the autonomous optimization session.
   * This prompt is passed to claude --resume or agent-deck as the task definition.
   */
  generateOptimizationPrompt(config: OptimizationConfig): string {
    return `
You are running an autonomous skill optimization loop for "${config.skillName}".

## Task
Improve the skill at ${config.skillPath} until its eval score reaches ${config.targetScore} or higher.

## Process (ralph-loop)
Repeat up to ${config.maxIterations} times:

1. **Evaluate**: Run \`tessl eval --scenarios ${config.scenariosPath}\` and capture the score
2. **Diagnose**: Read the eval output carefully. For each failing scenario:
   - Identify what the skill was supposed to do
   - Identify what it actually did
   - Classify the failure type (missing instruction, ambiguous wording, wrong constraint, missing edge case handling)
3. **Fix**: Edit ${config.skillPath} to address the diagnosed failures. Make minimal, targeted changes. Do not rewrite sections that are already working.
4. **Re-evaluate**: Run the eval again. If score >= ${config.targetScore}, stop. Otherwise, continue to next iteration.

## Constraints
- Do NOT ask for user input. This is a fully autonomous session.
- Do NOT modify the eval scenarios. Only modify the SKILL.md.
- Do NOT make speculative changes. Every edit must be traceable to a specific eval failure.
- After each iteration, output a one-line summary: "Iteration N: score X -> Y, fixed: <what you fixed>"
- If after ${config.maxIterations} iterations the score has not reached ${config.targetScore}, output a summary of remaining failures and stop.

## Final Output
When done, output a JSON summary:
\`\`\`json
{
  "skill": "${config.skillName}",
  "start_score": <initial>,
  "end_score": <final>,
  "iterations": <count>,
  "converged": <true|false>,
  "changes": ["iteration 1: ...", "iteration 2: ..."]
}
\`\`\`
    `.trim();
  }

  /**
   * Spawn a background optimization session via agent-deck.
   */
  async spawnBackground(config: OptimizationConfig): Promise<string> {
    // Generate the prompt
    // Create agent-deck session
    // Return session ID
  }

  /**
   * Check the status of a running optimization session.
   */
  async checkStatus(sessionId: string): Promise<'running' | 'completed' | 'failed'> {
    // Query agent-deck for session status
  }

  /**
   * Parse the optimization result from a completed session.
   */
  async getResult(sessionId: string): Promise<OptimizationResult | null> {
    // Read session output
    // Parse the JSON summary
    // Record in metrics store
  }
}
```

### Step 2: Implement agent-deck session spawning

```typescript
async spawnBackground(config: OptimizationConfig): Promise<string> {
  const prompt = this.generateOptimizationPrompt(config);
  const sessionName = `pos-optimize-${config.skillName}-${Date.now()}`;

  // Write prompt to a temp file for agent-deck
  const promptFile = resolve(PROOF_DIR, 'prompts', `${sessionName}.md`);
  writeFileSync(promptFile, prompt);

  // Spawn via agent-deck
  const { stdout } = await exec(
    `agent-deck create --name "${sessionName}" --prompt-file "${promptFile}" --background`
  );

  const sessionId = parseSessionId(stdout);

  // Record optimization start event
  this.store.recordOptimization({
    skill_name: config.skillName,
    trigger_score: config.targetScore, // will be updated with actual start score
    optimization_type: 'auto',
    session_id: sessionId,
    timestamp: new Date().toISOString()
  });

  return sessionId;
}
```

### Step 3: Implement status checking

```typescript
async checkStatus(sessionId: string): Promise<{
  status: 'running' | 'completed' | 'failed';
  lastOutput?: string;
}> {
  const { stdout } = await exec(`agent-deck status ${sessionId}`);
  // Parse agent-deck status output
  // Return structured status with last line of output
}
```

The user can check status via:
```bash
# Quick status check
proof-of-skill optimize-status grill-me
# Output: "Optimization for grill-me: running (iteration 3/5, score: 78 -> 82)"

# Or check all running optimizations
proof-of-skill optimize-status
# Output: table of all active optimization sessions
```

### Step 4: Implement result parsing and recording

When a session completes, parse its output for the JSON summary and record the result:

```typescript
async getResult(sessionId: string): Promise<OptimizationResult | null> {
  const { stdout } = await exec(`agent-deck output ${sessionId}`);

  // Find the JSON summary block in the output
  const jsonMatch = stdout.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;

  const result = JSON.parse(jsonMatch[1]) as OptimizationResult;

  // Record completion in metrics store
  this.store.recordOptimization({
    skill_name: result.skillName,
    trigger_score: result.startScore,
    result_score: result.endScore,
    optimization_type: 'auto',
    session_id: sessionId,
    duration_seconds: result.duration,
    timestamp: new Date().toISOString()
  });

  // If converged, resolve the degradation event
  if (result.converged) {
    this.store.resolveDegradation(result.skillName);
  }

  return result;
}
```

### Step 5: Fallback for environments without agent-deck

If agent-deck is not installed, fall back to `claude --resume`:

```typescript
async spawnFallback(config: OptimizationConfig): Promise<string> {
  const prompt = this.generateOptimizationPrompt(config);

  // Output the command for the user to run in a separate terminal
  const command = `claude --resume "${prompt.replace(/"/g, '\\"')}"`;

  console.log('agent-deck not found. Run this in a separate terminal:');
  console.log(command);

  return 'manual'; // no session tracking available
}
```

## Acceptance Criteria

- [ ] `core/optimizer.ts` exports an `Optimizer` class with `spawnBackground()`, `checkStatus()`, and `getResult()` methods
- [ ] `generateOptimizationPrompt()` produces a prompt that drives the full ralph-loop without user interaction
- [ ] The generated prompt includes: eval command, diagnosis instructions, fix constraints, iteration summary format, and final JSON output format
- [ ] Background sessions are created via agent-deck with a descriptive session name
- [ ] The prompt is written to a file (not passed inline) to handle long prompts safely
- [ ] Optimization start events are recorded in the SQLite store immediately upon spawning
- [ ] Optimization completion events (with result scores) are recorded when the session finishes
- [ ] `checkStatus()` returns the current state of a running optimization
- [ ] `getResult()` parses the JSON summary from completed sessions and records the result
- [ ] If optimization converges (score >= threshold), the degradation event is marked as resolved
- [ ] If agent-deck is not installed, a fallback `claude --resume` command is provided
- [ ] Maximum iteration count is configurable (default: 5) to prevent runaway sessions
- [ ] The optimizer never modifies eval scenarios -- only the SKILL.md

## Technical Notes

- **ralph-loop**: The name comes from the pattern of iterative improvement: test -> diagnose -> fix -> retest. It is the same pattern used by `/create-skill` in its REFACTOR phase, but here it runs autonomously
- **agent-deck sessions**: agent-deck creates isolated terminal sessions. The session runs as a separate process and can be checked on or attached to later. Verify the exact CLI syntax for creating background sessions, checking status, and reading output
- **Prompt engineering**: The optimization prompt is critical. It must be specific enough that the LLM does not deviate (e.g., no scenario editing, no speculative changes) but flexible enough to handle diverse failure modes. Test the prompt manually before automating
- **Convergence detection**: The LLM parses its own eval output to determine the score. This is imperfect -- the prompt should include explicit instructions on how to extract the score from tessl output. Consider adding a helper script that wraps tessl and outputs just the score
- **Session cleanup**: Completed optimization sessions should be cleaned up after results are recorded. Add a `cleanup()` method that removes prompt files and agent-deck sessions older than N days
- **Git safety**: The optimization session modifies SKILL.md files. Consider having the session create a git branch for its changes so the user can review before merging. The prompt could include: "Create a branch `optimize/<skill-name>` for your changes"
- **Concurrency**: Do not run multiple optimizations for the same skill simultaneously. Check for existing running sessions before spawning a new one

## Verification

```bash
# 1. Generate and review the optimization prompt
node -e "
  const { Optimizer } = require('./core/optimizer');
  const { MetricsStore } = require('./core/metrics-store');
  const optimizer = new Optimizer(new MetricsStore());
  const prompt = optimizer.generateOptimizationPrompt({
    skillName: 'test-skill',
    skillPath: 'skills/test-skill/SKILL.md',
    scenariosPath: '~/.proof-of-skill/scenarios/test-skill.yaml',
    targetScore: 85,
    maxIterations: 5,
    evalMode: 'full'
  });
  console.log(prompt);
"
# Expect: Well-structured prompt with all ralph-loop steps

# 2. Spawn a background optimization (requires agent-deck)
node -e "
  const { Optimizer } = require('./core/optimizer');
  const { MetricsStore } = require('./core/metrics-store');
  const optimizer = new Optimizer(new MetricsStore());
  optimizer.spawnBackground({...}).then(id => console.log('Session:', id));
"
# Expect: Session ID printed, agent-deck session created

# 3. Check status of running optimization
node -e "
  const { Optimizer } = require('./core/optimizer');
  const { MetricsStore } = require('./core/metrics-store');
  const optimizer = new Optimizer(new MetricsStore());
  optimizer.checkStatus('session-id').then(s => console.log(s));
"
# Expect: { status: 'running', lastOutput: 'Iteration 2: score 71 -> 78, fixed: ...' }

# 4. Test fallback without agent-deck
# Temporarily rename agent-deck binary
# Run spawnBackground()
# Expect: claude --resume command printed to console

# 5. Verify metrics recording
sqlite3 ~/.proof-of-skill/metrics.db \
  "SELECT * FROM optimization_events ORDER BY timestamp DESC LIMIT 5;"
# Expect: Optimization events with session IDs and scores
```
