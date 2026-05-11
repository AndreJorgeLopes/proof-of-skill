/**
 * Non-disruptive degradation notification system for proof-of-skill.
 *
 * Displays inline terminal notifications when a skill's eval score drops
 * below its configured threshold. Designed to inform without interrupting:
 *
 * - Box-drawing characters for visual distinction from regular output
 * - ANSI colors (respects NO_COLOR env var)
 * - Auto-dismisses after 10 seconds (non-blocking)
 * - Per-skill cooldown to prevent notification spam
 * - TTY detection: plain text fallback when piped
 * - Three actionable options: agent-deck optimization, claude --resume, skip
 *
 * Cooldown state is persisted to ~/.proof-of-skill/notification-cooldowns.json
 * (simple JSON, not SQLite) for loose coupling and tiny footprint.
 */

import { MetricsStore } from './metrics-store.js';
import { resolve, dirname } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createInterface, Interface as ReadlineInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Default paths
// ---------------------------------------------------------------------------

const PROOF_DIR =
  process.env['PROOF_OF_SKILL_DIR'] || resolve(homedir(), '.proof-of-skill');

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface DegradationAlert {
  skillName: string;
  currentScore: number;
  threshold: number;
  baselineScore: number;
  delta: number; // currentScore - baselineScore (negative when degraded)
  timestamp: string; // ISO 8601
}

export interface NotificationOptions {
  /** Per-skill cooldown in seconds. Default: 3600 (1 hour). */
  cooldownSeconds: number;
  /** Minimum drop from baseline to trigger notification. Default: 10. */
  minScoreDrop: number;
  /** Auto-dismiss timeout in milliseconds. Default: 10000 (10 seconds). */
  timeoutMs: number;
}

export interface CooldownEntry {
  until: string; // ISO 8601
  lastScore: number;
}

/** Result of a notification interaction. */
export type NotifyResult =
  | { action: 'spawn'; sessionName: string }
  | { action: 'resume'; command: string }
  | { action: 'skip'; cooldownUntil: string }
  | { action: 'suppressed'; reason: string };

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

function useColor(): boolean {
  return !process.env['NO_COLOR'];
}

function getAnsi() {
  if (useColor()) {
    return {
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
      dim: '\x1b[2m',
      bold: '\x1b[1m',
      reset: '\x1b[0m',
    };
  }
  return { yellow: '', red: '', green: '', cyan: '', gray: '', dim: '', bold: '', reset: '' };
}

// ---------------------------------------------------------------------------
// Notifier
// ---------------------------------------------------------------------------

export class Notifier {
  private store: MetricsStore;
  private cooldownFile: string;
  private defaults: NotificationOptions;

  constructor(store: MetricsStore, overrides?: Partial<NotificationOptions>) {
    this.store = store;
    this.cooldownFile = resolve(PROOF_DIR, 'notification-cooldowns.json');
    this.defaults = {
      cooldownSeconds: overrides?.cooldownSeconds ?? 3600,
      minScoreDrop: overrides?.minScoreDrop ?? 10,
      timeoutMs: overrides?.timeoutMs ?? 10_000,
    };
  }

  // -----------------------------------------------------------------------
  // Main entry point
  // -----------------------------------------------------------------------

  /**
   * Display a degradation notification, collect user response, and record
   * the event in the metrics store.
   *
   * Returns immediately with `{ action: 'suppressed' }` when:
   * - The skill is in cooldown
   * - The score drop is below `minScoreDrop`
   *
   * Otherwise renders the notification box, waits up to `timeoutMs` for
   * user input, and executes the chosen action.
   */
  async notify(
    alert: DegradationAlert,
    options?: Partial<NotificationOptions>,
  ): Promise<NotifyResult> {
    const opts: NotificationOptions = { ...this.defaults, ...options };

    // --- Gate: cooldown ---------------------------------------------------
    if (this.isInCooldown(alert.skillName)) {
      const suppressed: NotifyResult = { action: 'suppressed', reason: 'cooldown' };
      this.recordNotificationEvent(alert, suppressed);
      return suppressed;
    }

    // --- Gate: minimum score drop ----------------------------------------
    const drop = Math.abs(alert.delta);
    if (drop < opts.minScoreDrop) {
      const suppressed: NotifyResult = { action: 'suppressed', reason: 'below_min_drop' };
      this.recordNotificationEvent(alert, suppressed);
      return suppressed;
    }

    // --- Render -----------------------------------------------------------
    const isTTY = Boolean(process.stderr.isTTY && process.stdin.isTTY);
    const agentDeckAvailable = this.isAgentDeckAvailable();

    if (isTTY) {
      this.renderBox(alert, agentDeckAvailable, opts);
    } else {
      this.renderPlain(alert, opts);
    }

    // --- Collect user choice (non-blocking with timeout) ------------------
    const choice = isTTY
      ? await this.promptWithTimeout(agentDeckAvailable, opts.timeoutMs)
      : '3'; // Non-TTY always auto-skips

    // --- Execute chosen action -------------------------------------------
    const result = this.executeChoice(
      choice,
      alert,
      agentDeckAvailable,
      opts,
    );

    // --- Record notification in metrics store ----------------------------
    this.recordNotificationEvent(alert, result);

    return result;
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  /** Render the notification as a box-drawing bordered block to stderr. */
  private renderBox(
    alert: DegradationAlert,
    agentDeckAvailable: boolean,
    opts: NotificationOptions,
  ): void {
    const ANSI = getAnsi();
    const W = 57; // inner width (chars between vertical bars)
    const pad = (s: string, rawLen?: number): string => {
      const len = rawLen ?? stripAnsi(s).length;
      return s + ' '.repeat(Math.max(0, W - len));
    };

    const top = `\u250C${'─'.repeat(W)}\u2510`;
    const bot = `\u2514${'─'.repeat(W)}\u2518`;
    const sep = `\u2502${' '.repeat(W)}\u2502`;
    const line = (s: string, rawLen?: number): string =>
      `\u2502 ${pad(s, rawLen ? rawLen + 1 : undefined)}\u2502`;

    const header = `${ANSI.yellow}${ANSI.bold}proof-of-skill: skill degradation detected${ANSI.reset}`;
    const headerRaw = 'proof-of-skill: skill degradation detected';

    const scoreColor = alert.currentScore < alert.threshold ? ANSI.red : '';
    const scoreStr = `${scoreColor}${alert.currentScore}${ANSI.reset}`;
    const scoreLineText = `Score:     ${alert.currentScore} (threshold: ${alert.threshold}, baseline: ${alert.baselineScore})`;
    const scoreLineFormatted = `Score:     ${scoreStr} (threshold: ${alert.threshold}, baseline: ${alert.baselineScore})`;

    const deltaStr = `${ANSI.red}${alert.delta}${ANSI.reset}`;
    const dropLineText = `Drop:      ${alert.delta} points from baseline`;
    const dropLineFormatted = `Drop:      ${deltaStr} points from baseline`;

    const opt1Label = agentDeckAvailable
      ? '[1] Spawn background optimization (agent-deck)'
      : `${ANSI.gray}[1] Spawn background optimization (install agent-deck)${ANSI.reset}`;
    const opt1Raw = agentDeckAvailable
      ? '[1] Spawn background optimization (agent-deck)'
      : '[1] Spawn background optimization (install agent-deck)';

    const opt2 = `${ANSI.green}[2] Get claude --resume command for manual fix${ANSI.reset}`;
    const opt2Raw = '[2] Get claude --resume command for manual fix';

    const cooldownLabel =
      opts.cooldownSeconds >= 3600
        ? `${Math.round(opts.cooldownSeconds / 3600)} hour`
        : `${Math.round(opts.cooldownSeconds / 60)} min`;
    const opt3 = `[3] Skip (remind me in ${cooldownLabel})`;

    const lines = [
      '',
      top,
      line(` ${header}`, headerRaw.length + 1),
      sep,
      line(` Skill:     ${alert.skillName}`),
      line(` ${scoreLineFormatted}`, scoreLineText.length + 1),
      line(` ${dropLineFormatted}`, dropLineText.length + 1),
      sep,
      line(' Options:'),
      line(` ${opt1Label}`, opt1Raw.length + 1),
      line(` ${opt2}`, opt2Raw.length + 1),
      line(` ${opt3}`),
      bot,
      '',
    ];

    process.stderr.write(lines.join('\n') + '\n');
  }

  /** Render plain text notification for non-TTY environments. */
  private renderPlain(
    alert: DegradationAlert,
    opts: NotificationOptions,
  ): void {
    const lines = [
      '',
      '--- proof-of-skill: skill degradation detected ---',
      `Skill:     ${alert.skillName}`,
      `Score:     ${alert.currentScore} (threshold: ${alert.threshold}, baseline: ${alert.baselineScore})`,
      `Drop:      ${alert.delta} points from baseline`,
      `Auto-skipped (non-interactive). Cooldown: ${opts.cooldownSeconds}s`,
      '---',
      '',
    ];
    process.stderr.write(lines.join('\n') + '\n');
  }

  // -----------------------------------------------------------------------
  // User input
  // -----------------------------------------------------------------------

  /**
   * Prompt the user for a choice (1, 2, or 3) with a timeout.
   *
   * Returns '3' (skip) if no input within `timeoutMs`.
   */
  private promptWithTimeout(
    agentDeckAvailable: boolean,
    timeoutMs: number,
  ): Promise<string> {
    const ANSI = getAnsi();
    return new Promise<string>((resolve) => {
      let didResolve = false;
      const settle = (value: string): void => {
        if (didResolve) return;
        didResolve = true;
        resolve(value);
      };

      const rl: ReadlineInterface = createInterface({
        input: process.stdin,
        output: process.stderr,
        terminal: false,
      });

      const timer = setTimeout(() => {
        process.stderr.write(
          `${ANSI.dim}(auto-dismissed after ${timeoutMs / 1000}s -- skipping)${ANSI.reset}\n`,
        );
        rl.close();
        settle('3');
      }, timeoutMs);

      const prompt = `${ANSI.cyan}Choose [1/2/3]:${ANSI.reset} `;
      process.stderr.write(prompt);

      rl.once('line', (input: string) => {
        clearTimeout(timer);
        rl.close();

        const trimmed = input.trim();

        // Validate: only '1' (if agent-deck available), '2', or '3'
        if (trimmed === '1' && !agentDeckAvailable) {
          process.stderr.write(
            `${ANSI.gray}agent-deck not installed -- treating as skip${ANSI.reset}\n`,
          );
          settle('3');
          return;
        }

        if (trimmed === '1' || trimmed === '2' || trimmed === '3') {
          settle(trimmed);
        } else {
          // Invalid input -- default to skip
          settle('3');
        }
      });

      // Handle stream closing (e.g. piped input ends)
      rl.once('close', () => {
        clearTimeout(timer);
        settle('3');
      });
    });
  }

  // -----------------------------------------------------------------------
  // Action handlers
  // -----------------------------------------------------------------------

  /**
   * Execute the chosen action and return a typed result.
   */
  private executeChoice(
    choice: string,
    alert: DegradationAlert,
    agentDeckAvailable: boolean,
    opts: NotificationOptions,
  ): NotifyResult {
    switch (choice) {
      case '1':
        return this.spawnBackgroundOptimization(alert, agentDeckAvailable, opts);
      case '2':
        return this.getResumeCommand(alert);
      case '3':
      default:
        return this.skip(alert.skillName, alert.currentScore, opts.cooldownSeconds);
    }
  }

  /**
   * Option 1: Spawn an agent-deck background session for auto-optimization.
   */
  private spawnBackgroundOptimization(
    alert: DegradationAlert,
    agentDeckAvailable: boolean,
    opts: NotificationOptions,
  ): NotifyResult {
    const ANSI = getAnsi();
    if (!agentDeckAvailable) {
      process.stderr.write(
        `${ANSI.gray}agent-deck not found. Install it for background optimization.${ANSI.reset}\n`,
      );
      return this.skip(alert.skillName, alert.currentScore, opts.cooldownSeconds);
    }

    const sessionName = `pos-optimize-${alert.skillName}`;
    const prompt = [
      `Run ralph-loop optimization for skill "${alert.skillName}":`,
      `tessl eval -> diagnose -> fix -> re-eval.`,
      `Target score: ${alert.threshold}.`,
      `Current score: ${alert.currentScore}, baseline: ${alert.baselineScore}.`,
      `Do not ask for user input.`,
    ].join(' ');

    try {
      execFileSync('agent-deck', ['create', '--name', sessionName, '--prompt', prompt, '--background'], {
        stdio: 'inherit',
        timeout: 15_000,
      });
      process.stderr.write(
        `\n${ANSI.green}Background optimization started: session ${sessionName}${ANSI.reset}\n`,
      );
      return { action: 'spawn', sessionName };
    } catch {
      process.stderr.write(
        `${ANSI.red}Failed to spawn agent-deck session. Use option 2 for manual fix.${ANSI.reset}\n`,
      );
      return this.skip(alert.skillName, alert.currentScore, opts.cooldownSeconds);
    }
  }

  /**
   * Option 2: Print a claude --resume command for manual investigation.
   */
  private getResumeCommand(alert: DegradationAlert): NotifyResult {
    const ANSI = getAnsi();
    const escapedName = alert.skillName.replace(/'/g, "'\\''");
    const command = `claude --resume 'Skill ${escapedName} scored ${alert.currentScore}/${alert.threshold}. Investigate the eval failures and fix the skill.'`;

    process.stderr.write(
      `\n${ANSI.green}Run this command to investigate:${ANSI.reset}\n`,
    );
    process.stderr.write(`  ${command}\n\n`);

    return { action: 'resume', command };
  }

  /**
   * Option 3: Skip and set a per-skill cooldown.
   */
  private skip(
    skillName: string,
    currentScore: number,
    cooldownSeconds: number,
  ): NotifyResult {
    const until = new Date(Date.now() + cooldownSeconds * 1000).toISOString();
    const cooldowns = this.loadCooldowns();
    cooldowns[skillName] = { until, lastScore: currentScore };
    this.saveCooldowns(cooldowns);
    return { action: 'skip', cooldownUntil: until };
  }

  // -----------------------------------------------------------------------
  // Cooldown management
  // -----------------------------------------------------------------------

  /** Check whether a skill is currently within its notification cooldown. */
  private isInCooldown(skillName: string): boolean {
    const cooldowns = this.loadCooldowns();
    const entry = cooldowns[skillName];
    if (!entry) return false;
    return new Date(entry.until) > new Date();
  }

  /** Load cooldowns from the JSON file. Returns empty object on missing/corrupt file. */
  private loadCooldowns(): Record<string, CooldownEntry> {
    try {
      if (!existsSync(this.cooldownFile)) return {};
      const raw = readFileSync(this.cooldownFile, 'utf-8');
      return JSON.parse(raw) as Record<string, CooldownEntry>;
    } catch {
      return {};
    }
  }

  /** Persist cooldowns to the JSON file, creating the directory if needed. */
  private saveCooldowns(cooldowns: Record<string, CooldownEntry>): void {
    const dir = dirname(this.cooldownFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.cooldownFile, JSON.stringify(cooldowns, null, 2) + '\n');
  }

  // -----------------------------------------------------------------------
  // Metrics recording
  // -----------------------------------------------------------------------

  /** Record the notification event in the SQLite metrics store. */
  private recordNotificationEvent(
    alert: DegradationAlert,
    result: NotifyResult,
  ): void {
    const ANSI = getAnsi();
    try {
      this.store.recordDegradation({
        skill_name: alert.skillName,
        score: alert.currentScore,
        threshold: alert.threshold,
        notified: result.action !== 'suppressed',
        timestamp: alert.timestamp,
      });
    } catch (err) {
      process.stderr.write(`${ANSI.dim}(notification recording failed: ${err})${ANSI.reset}\n`);
    }
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /** Check whether agent-deck CLI is available on the PATH. */
  private isAgentDeckAvailable(): boolean {
    try {
      execFileSync('which', ['agent-deck'], { stdio: 'ignore', timeout: 3_000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip ANSI escape sequences for length calculation. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

