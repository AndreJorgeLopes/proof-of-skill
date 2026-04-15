/**
 * Background optimization engine for proof-of-skill.
 *
 * Spawns autonomous ralph-loop sessions that iteratively improve a skill's
 * SKILL.md until its eval score meets a target threshold. Sessions run in the
 * background via agent-deck (preferred) or fall back to providing a
 * `claude --resume` command the user can run in a separate terminal.
 *
 * The ralph-loop cycle:
 *   eval -> diagnose failures -> fix SKILL.md -> re-eval
 *
 * Design constraints:
 * - Never modifies eval scenarios -- only the SKILL.md
 * - Creates a git branch (`optimize/<skill>`) for safety
 * - Maximum iterations prevent runaway sessions
 * - Prompt written to temp file (not inline) for long prompt safety
 * - Concurrent optimizations for the same skill are blocked
 * - Events are recorded in the MetricsStore at start and completion
 */

import { execFileSync, spawnSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

import type { MetricsStore, OptimizationEvent } from './metrics-store.js';

// ---------------------------------------------------------------------------
// Default paths
// ---------------------------------------------------------------------------

const PROOF_DIR =
  process.env['PROOF_OF_SKILL_DIR'] || resolve(homedir(), '.proof-of-skill');
const PROMPTS_DIR = resolve(PROOF_DIR, 'prompts');

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface OptimizationConfig {
  skillName: string;
  skillPath: string;
  scenariosPath: string;
  targetScore: number;
  maxIterations: number;  // default: 5
  evalMode: 'quick' | 'full'; // default: 'full' for optimization
}

export interface OptimizationResult {
  skillName: string;
  startScore: number;
  endScore: number;
  iterations: number;
  converged: boolean;
  changes: string[];  // summary of each iteration's changes
  duration: number;   // total seconds
}

export type OptimizationStatus = 'running' | 'completed' | 'failed';

export interface StatusReport {
  status: OptimizationStatus;
  lastOutput?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXEC_OPTS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  timeout: 30_000,
};

/**
 * Run a command with explicit args array (no shell interpolation).
 * Returns trimmed stdout or `null` on error.
 */
function safeExec(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, EXEC_OPTS).trim();
  } catch {
    return null;
  }
}

/**
 * Check whether the `agent-deck` CLI is available on the system PATH.
 */
function isAgentDeckAvailable(): boolean {
  const result = spawnSync('command', ['-v', 'agent-deck'], {
    shell: true,
    encoding: 'utf-8',
    timeout: 5_000,
  });
  return result.status === 0;
}

/**
 * Sanitize a skill name so it is safe for use in file paths and shell arguments.
 * Strips anything that is not alphanumeric, underscore, or hyphen.
 */
function sanitizeSkillName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_');
}

/**
 * Extract a session ID from agent-deck `create` output.
 *
 * agent-deck prints the session identifier on the first line of stdout after
 * a successful `create` command. The exact format may vary, so we grab the
 * first non-empty line.
 */
function parseSessionId(stdout: string): string {
  const firstLine = stdout.split('\n').find((l) => l.trim().length > 0);
  if (!firstLine) {
    throw new Error('Failed to parse session ID from agent-deck output');
  }
  return firstLine.trim();
}

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

export class Optimizer {
  private store: MetricsStore;

  /** Track in-flight optimizations to prevent concurrent runs per skill. */
  private activeOptimizations = new Map<string, string>();

  constructor(store: MetricsStore) {
    this.store = store;
  }

  // -----------------------------------------------------------------------
  // Prompt generation
  // -----------------------------------------------------------------------

  /**
   * Generate the prompt that drives the autonomous optimization session.
   *
   * This prompt is passed to `claude --resume` or agent-deck as the task
   * definition. It encodes the full ralph-loop including:
   * - Eval command and score extraction
   * - Failure diagnosis taxonomy
   * - Targeted fix constraints
   * - Iteration summary format
   * - Final JSON output format
   */
  generateOptimizationPrompt(config: OptimizationConfig): string {
    return `
You are running an autonomous skill optimization loop for "${config.skillName}".

## Git Safety
Before making any changes, create and switch to a branch:
\`\`\`bash
git checkout -b optimize/${config.skillName}
\`\`\`
If the branch already exists, switch to it:
\`\`\`bash
git checkout optimize/${config.skillName}
\`\`\`

## Task
Improve the skill at ${config.skillPath} until its eval score reaches ${config.targetScore} or higher.

## Process (ralph-loop)
Repeat up to ${config.maxIterations} times:

1. **Evaluate**: Run \`tessl eval --scenarios ${config.scenariosPath}${config.evalMode === 'quick' ? ' --quick' : ''}\` and capture the score
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
  "changes": ["iteration 1: ...", "iteration 2: ..."],
  "duration_seconds": <total seconds from start to finish>
}
\`\`\`
`.trim();
  }

  // -----------------------------------------------------------------------
  // Background session management
  // -----------------------------------------------------------------------

  /**
   * Spawn a background optimization session.
   *
   * Prefers agent-deck for session management. Falls back to printing a
   * `claude --resume` command when agent-deck is not installed.
   *
   * @returns The session ID (from agent-deck) or `'manual'` for the fallback.
   * @throws If an optimization is already running for this skill.
   */
  async spawnBackground(config: OptimizationConfig): Promise<string> {
    // --- Prevent concurrent optimizations for the same skill ---------------
    const existing = this.activeOptimizations.get(config.skillName);
    if (existing) {
      throw new Error(
        `Optimization already running for "${config.skillName}" (session: ${existing}). ` +
          'Wait for it to complete or cancel it first.',
      );
    }

    // --- Sanitize skill name for path/shell safety -------------------------
    const safeName = sanitizeSkillName(config.skillName);

    // --- Generate the prompt and persist to a temp file --------------------
    const prompt = this.generateOptimizationPrompt(config);
    const sessionName = `pos-optimize-${safeName}-${Date.now()}`;

    mkdirSync(PROMPTS_DIR, { recursive: true });
    const promptFile = resolve(PROMPTS_DIR, `${sessionName}.md`);
    writeFileSync(promptFile, prompt, 'utf-8');

    // --- Spawn via agent-deck or fall back ---------------------------------
    let sessionId: string;

    try {
      if (isAgentDeckAvailable()) {
        sessionId = this.spawnWithAgentDeck(sessionName, promptFile);
      } else {
        sessionId = this.spawnFallback(config, promptFile);
      }
    } catch (err) {
      // Clean up prompt file and re-throw
      try { unlinkSync(promptFile); } catch { /* best-effort */ }
      throw err;
    }

    // --- Only track agent-deck sessions (manual sessions can't be polled) --
    if (sessionId !== 'manual') {
      this.activeOptimizations.set(config.skillName, sessionId);
    }

    // --- Record optimisation start event -----------------------------------
    // NOTE: trigger_score records the target we're aiming for, since the
    // actual starting score is not yet known (determined by the first eval
    // inside the session). The result event will carry the real start score.
    const event: OptimizationEvent = {
      skill_name: config.skillName,
      trigger_score: config.targetScore,
      optimization_type: 'auto',
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    };
    this.store.recordOptimization(event);

    return sessionId;
  }

  /**
   * Spawn using agent-deck as the session manager.
   */
  private spawnWithAgentDeck(sessionName: string, promptFile: string): string {
    const result = safeExec('agent-deck', [
      'create', '--name', sessionName, '--prompt-file', promptFile, '--background',
    ]);

    if (!result) {
      throw new Error(
        'agent-deck create failed. Check that agent-deck is installed and configured.',
      );
    }

    return parseSessionId(result);
  }

  /**
   * Fallback when agent-deck is unavailable: print a `claude --resume`
   * command for the user to execute manually in a separate terminal.
   */
  private spawnFallback(
    _config: OptimizationConfig,
    promptFile: string,
  ): string {
    const command = `claude --resume --prompt-file "${promptFile}"`;

    // eslint-disable-next-line no-console
    console.log(
      '\nagent-deck not found. Run this in a separate terminal:\n',
    );
    // eslint-disable-next-line no-console
    console.log(`  ${command}\n`);

    return 'manual';
  }

  // -----------------------------------------------------------------------
  // Status & result retrieval
  // -----------------------------------------------------------------------

  /**
   * Check the status of a running optimization session.
   *
   * Queries agent-deck for the session state. Returns a structured status
   * with the last line of output for progress indication.
   */
  async checkStatus(sessionId: string): Promise<StatusReport> {
    if (sessionId === 'manual') {
      return { status: 'running', lastOutput: 'Manual session — check your terminal' };
    }

    const result = safeExec('agent-deck', ['status', sessionId]);
    if (!result) {
      return { status: 'failed', lastOutput: 'Unable to query session status' };
    }

    const lower = result.toLowerCase();

    if (lower.includes('completed') || lower.includes('finished') || lower.includes('done')) {
      return { status: 'completed', lastOutput: result };
    }
    if (lower.includes('failed') || lower.includes('error') || lower.includes('crashed')) {
      return { status: 'failed', lastOutput: result };
    }

    return { status: 'running', lastOutput: result };
  }

  /**
   * Parse the optimization result from a completed session.
   *
   * Reads the session output, extracts the JSON summary block, records the
   * result in the MetricsStore, and (if converged) resolves the degradation.
   *
   * @returns The parsed result, or `null` if parsing fails.
   */
  async getResult(sessionId: string): Promise<OptimizationResult | null> {
    if (sessionId === 'manual') {
      return null; // Cannot read output from a manual session
    }

    const stdout = safeExec('agent-deck', ['output', sessionId]);
    if (!stdout) {
      this.clearActiveBySessionId(sessionId);
      return null;
    }

    // --- Parse the JSON summary block from session output -------------------
    const jsonMatch = stdout.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch?.[1]) {
      this.clearActiveBySessionId(sessionId);
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    } catch {
      this.clearActiveBySessionId(sessionId);
      return null;
    }

    // --- Type-safe extraction with runtime validation -----------------------
    const skillName = typeof parsed['skill'] === 'string' ? parsed['skill'] : '';
    const startScore = Number(parsed['start_score']);
    const endScore = Number(parsed['end_score']);
    const iterations = Number(parsed['iterations']);
    const durationSeconds = Number(parsed['duration_seconds']);

    if (isNaN(startScore) || isNaN(endScore) || isNaN(iterations)) {
      this.clearActiveBySessionId(sessionId);
      return null;
    }

    const converged = parsed['converged'] === true;
    const changes = Array.isArray(parsed['changes'])
      ? (parsed['changes'] as unknown[]).filter((c): c is string => typeof c === 'string')
      : [];

    const result: OptimizationResult = {
      skillName,
      startScore,
      endScore,
      iterations,
      converged,
      changes,
      duration: isNaN(durationSeconds) ? 0 : durationSeconds,
    };

    // --- Record completion in MetricsStore ---------------------------------
    const event: OptimizationEvent = {
      skill_name: result.skillName,
      trigger_score: result.startScore,
      result_score: result.endScore,
      optimization_type: 'auto',
      session_id: sessionId,
      duration_seconds: result.duration,
      timestamp: new Date().toISOString(),
    };
    this.store.recordOptimization(event);

    // --- If converged, resolve the degradation event -----------------------
    if (result.converged) {
      this.store.resolveDegradation(result.skillName);
    }

    // --- Clean up active tracking ------------------------------------------
    this.clearActiveBySessionId(sessionId);

    return result;
  }

  /**
   * Remove a session from activeOptimizations by its session ID.
   * Called on both successful result retrieval and on parse/lookup failures
   * to prevent stale entries from blocking future optimizations.
   */
  private clearActiveBySessionId(sessionId: string): void {
    for (const [skill, sid] of this.activeOptimizations.entries()) {
      if (sid === sessionId) {
        this.activeOptimizations.delete(skill);
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Remove stale prompt files and (optionally) agent-deck sessions older
   * than the specified number of days.
   *
   * @param maxAgeDays - Maximum age in days. Prompt files older than this are
   *   deleted. Defaults to 7.
   */
  cleanup(maxAgeDays: number = 7): number {
    let removed = 0;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    if (!existsSync(PROMPTS_DIR)) {
      return removed;
    }

    for (const file of readdirSync(PROMPTS_DIR)) {
      if (!file.startsWith('pos-optimize-')) continue;

      // Extract the timestamp from the filename:
      //   pos-optimize-<skill-name>-<timestamp>.md
      const tsMatch = file.match(/-(\d{13,})\.md$/);
      if (!tsMatch?.[1]) continue;

      const fileTs = Number(tsMatch[1]);
      if (fileTs < cutoff) {
        try {
          unlinkSync(resolve(PROMPTS_DIR, file));
          removed++;
        } catch {
          // best-effort cleanup
        }
      }
    }

    return removed;
  }

  // -----------------------------------------------------------------------
  // Introspection
  // -----------------------------------------------------------------------

  /**
   * Check whether an optimization is currently active for a skill.
   */
  isOptimizing(skillName: string): boolean {
    return this.activeOptimizations.has(skillName);
  }

  /**
   * Get the session ID for a currently active optimization.
   */
  getActiveSessionId(skillName: string): string | undefined {
    return this.activeOptimizations.get(skillName);
  }
}
