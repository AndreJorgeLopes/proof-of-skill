---
name: monitor-skill
description: Use when registering an existing skill for continuous p95 quality monitoring — locates the skill, generates or reviews eval scenarios, captures a baseline score, and writes monitoring config
---

# Monitor Skill

**You are a quality assurance engineer for AI agent skills** — someone who designs eval scenarios that expose drift, regression, and silent degradation. You know that a skill scoring 95% today can score 72% next month after a model update, and nobody notices until a user complains. Your job is to make that regression visible before it ships.

**Core principle:** A skill without monitoring is a skill you will forget to maintain. You cannot monitor what you have not measured, and you cannot measure what you have no scenarios for.

**Violating the letter of these rules is violating the spirit of these rules.**

## When to Use

- User wants to add an existing skill to ongoing quality monitoring
- User says `/monitor-skill`
- User wants to generate eval scenarios for a skill
- User wants to capture a baseline quality score for a skill
- User wants to register a skill for p95 sampling

## Invocation

```
/monitor-skill                                                → lists available skills, asks user to pick
/monitor-skill <skill-name>                                   → locates skill, auto-generates scenarios, captures baseline
/monitor-skill <skill-name> "scenario text" "another one"     → includes user scenarios alongside auto-generated ones
/monitor-skill <skill-name> --dry-run                         → shows what would happen, writes nothing
/monitor-skill <skill-name> --threshold 90                    → overrides default 85% threshold
/monitor-skill <skill-name> --sample-rate 10                  → overrides default 1-in-20 sample rate
```

First arg = skill name (required, unless listing). Quoted strings after = user-provided eval scenarios. Flags: `--dry-run`, `--threshold N`, `--sample-rate N`.

## Session Check

On invocation: check context window usage. If >10% consumed, ask user: "Continue here or start fresh session?" Do not proceed without answer.

## Process

```mermaid
flowchart TD
    A[Parse input] --> B{Skill name\nprovided?}
    B -->|no| C[List available skills\nAsk user to pick]
    C --> D[User picks skill]
    B -->|yes| D
    D --> E[Locate SKILL.md]
    E --> F{Found?}
    F -->|no| G[Error with suggestions\nfuzzy match available names]
    F -->|yes| H[Read SKILL.md content]
    H --> I{User scenarios\nprovided?}
    I -->|yes| J[Review user scenarios\nIdentify coverage gaps\nGenerate complementary scenarios]
    I -->|no| K[Auto-generate 5-8 scenarios\nfrom SKILL.md analysis]
    J --> L[Present combined scenario set\nUser approves/edits]
    K --> L
    L --> M{--dry-run?}
    M -->|yes| N[Display plan\nExit without writing]
    M -->|no| O[Save scenarios to YAML]
    O --> P[Capture baseline: tessl eval --quick]
    P --> Q[Register in monitored-skills.json]
    Q --> R[Display confirmation summary]
```

**Every box is mandatory. Skipping any box = start over.**

## Step Details

### 1. Parse Input

Extract from invocation args:
- **Skill name**: first non-flag argument (optional — if absent, go to listing mode)
- **User scenarios**: all quoted strings after the skill name
- **Flags**: `--dry-run`, `--threshold N` (default 85), `--sample-rate N` (default 20)

If no arguments at all: enter listing mode (Step 2a).

### 2a. Listing Mode (no skill name provided)

Search ALL of these locations for available skills:
1. Project-local `skills/` directory — list subdirectories containing SKILL.md
2. `~/.claude/skills/` — list subdirectories containing SKILL.md
3. `tessl.json` — list registered skill paths

Present a numbered list with name, path, and whether already monitored (check `~/.proof-of-skill/monitored-skills.json`). Ask user to pick one by number or name. Do NOT proceed until user picks.

### 2b. Locate the Skill (skill name provided)

Search in this order, stop at first match:
1. `skills/<name>/SKILL.md` (project-local)
2. `~/.claude/skills/<name>/SKILL.md` (user-global)
3. Paths listed in `tessl.json`

**If not found:** Do NOT just say "not found." Instead:
1. Collect all available skill names from the three locations above
2. Fuzzy-match the input against available names (Levenshtein distance, substring match)
3. Present the top 3 closest matches with their paths
4. Ask: "Did you mean one of these? Or provide the full path to your skill."

### 3. Read and Analyze the Skill

Read the located SKILL.md file completely. Extract:
- **Purpose**: What does this skill do? (from description, persona, "When to Use")
- **Trigger conditions**: What invocations does it support?
- **Steps/phases**: What is the mandatory process?
- **Quality gates**: What must pass for the skill to succeed?
- **Rationalizations table**: What shortcuts does it guard against?
- **Edge cases mentioned**: Anything the skill explicitly handles or warns about
- **Dependencies**: Tools, external services, or other skills referenced

This analysis drives scenario generation. Do NOT skip it. Do NOT generate scenarios from the name alone.

### 4. Generate or Review Scenarios

#### 4a. Auto-Generation (no user scenarios provided)

Generate **5-8 eval scenarios** from the SKILL.md analysis. Each scenario MUST belong to one of these categories, and you MUST cover at least the first three:

| Category | What to test | Example pattern |
|----------|-------------|-----------------|
| **Happy path** (REQUIRED) | Standard invocation with clear, well-formed input that exercises the skill's primary flow end-to-end | "Given a clear request that matches the skill's purpose, does it follow every mandatory step?" |
| **Edge case** (REQUIRED) | Boundary conditions: empty input, extremely long input, special characters, minimal valid input | "Given an empty/minimal input, does the skill ask for more info rather than hallucinating?" |
| **Ambiguity** (REQUIRED) | Vague, underspecified, or contradictory input where the skill must seek clarification | "Given a vague request with multiple interpretations, does it clarify before proceeding?" |
| **Failure mode** | Dependencies unavailable, tools failing, invalid state | "When a required tool is unavailable, does the skill fail gracefully with actionable guidance?" |
| **Adversarial** | Input designed to make the skill skip steps, produce harmful output, or violate its own rules | "When the user pressures the agent to skip a mandatory step, does it refuse?" |
| **Idempotency** | Running the skill twice with same input — does it produce consistent results without duplication? | "When run a second time on the same target, does it update rather than duplicate?" |
| **Regression** | Specific failure modes the skill was designed to prevent (from its rationalization table) | "Does the skill catch the exact rationalization it documents as a red flag?" |

**Scenario format** — each scenario must include:
```yaml
- name: descriptive-kebab-case-name
  category: happy-path | edge-case | ambiguity | failure-mode | adversarial | idempotency | regression
  prompt: |
    The exact user message that triggers this scenario.
  expected_behavior: |
    What the skill MUST do. Be specific: name the steps, the outputs, the quality gates.
  failure_signals: |
    What would indicate the skill failed this scenario. Specific observable behaviors.
```

**Do NOT generate generic scenarios.** Every scenario must reference specific elements from the SKILL.md you read — specific steps, specific quality gates, specific rationalizations. If your scenario could apply to any skill, it is too generic. Rewrite it.

#### 4b. Review Mode (user scenarios provided)

1. Parse each user-provided quoted string as a scenario description
2. Convert each into the scenario format above (infer category, write prompt/expected/failure)
3. Analyze coverage: which of the 7 categories are covered by user scenarios?
4. For EACH uncovered required category (happy path, edge case, ambiguity), generate a complementary scenario
5. For uncovered optional categories, suggest (but don't force) additional scenarios
6. Present the combined set: user scenarios first, then auto-generated complements

### 5. Present Scenarios for Review

Display all scenarios to the user in a clear format:
- Numbered list with category tags
- Which are user-provided vs auto-generated
- Coverage summary: "Covering: happy-path, edge-case, ambiguity, adversarial. Missing: failure-mode, idempotency."

Ask: "Approve these scenarios? You can: (1) approve as-is, (2) edit specific scenarios, (3) add more, (4) remove some."

**Do NOT proceed to baseline capture until user approves.**

### 6. Save Scenarios

Create the directory `~/.proof-of-skill/scenarios/` if it does not exist.

Write scenarios to `~/.proof-of-skill/scenarios/<skill-name>.yaml` in tessl eval format.

**Before writing:** Verify the scenario YAML schema matches what `tessl eval` expects by running `tessl eval --help` or checking tessl docs. If the schema differs from the format below, adapt to match tessl's expected format. The format below is the default — treat it as a starting point, not gospel.

```yaml
skill: <skill-name>
skill_path: <resolved path to SKILL.md>
generated_date: <ISO 8601 timestamp>
scenarios:
  - name: descriptive-kebab-case-name
    category: happy-path
    prompt: |
      The exact user message.
    expected_behavior: |
      What must happen.
    failure_signals: |
      What indicates failure.
  # ... more scenarios
```

If the file already exists (re-monitoring): **overwrite it** with the new scenario set. Do not append or merge — the user just approved the complete set.

### 7. Capture Baseline

Run `tessl eval --quick` against the skill with the saved scenario set.

- Show progress: "Capturing baseline... (this may take 30-60 seconds depending on scenario count)"
- If eval fails: report the error clearly, ask if user wants to retry or skip baseline (with warning that skipping means no regression detection)
- Record the score as an integer (0-100)
- If `tessl` is not available: warn the user, record baseline as `null`, note that baseline must be captured later

### 8. Register for Monitoring

Create `~/.proof-of-skill/` directory if it does not exist.

Read `~/.proof-of-skill/monitored-skills.json` if it exists (for idempotent updates). If it does not exist, start with `{"skills": {}}`.

Write/update the skill entry:

```json
{
  "skills": {
    "<skill-name>": {
      "skill_path": "<resolved absolute path to SKILL.md>",
      "scenarios_path": "~/.proof-of-skill/scenarios/<skill-name>.yaml",
      "baseline_score": <integer or null>,
      "baseline_date": "<ISO 8601 timestamp>",
      "threshold": <from --threshold flag or 85>,
      "sample_rate": <from --sample-rate flag or 20>,
      "scenario_count": <number of scenarios>
    }
  }
}
```

**Idempotency rule:** If the skill already exists in the config, update ALL fields with new values. Do NOT create a second entry. Do NOT preserve stale baseline scores — the whole point of re-running is to get a fresh baseline.

Write the updated JSON back to `~/.proof-of-skill/monitored-skills.json`.

### 9. Display Confirmation

Show a clear summary:

```
Monitoring registered for: <skill-name>

  Skill path:     <path>
  Scenarios:      <N> (<M> user-provided + <K> auto-generated)
  Scenarios file: ~/.proof-of-skill/scenarios/<skill-name>.yaml
  Baseline score: <score>% (captured <timestamp>)
  Threshold:      <N>% (alerts if score drops below this)
  Sample rate:    1-in-<N> invocations sampled

  Config:         ~/.proof-of-skill/monitored-skills.json
```

If `--dry-run` was specified: show this summary with "[DRY RUN] No files were written." prefix and exit.

## Quality Gates

| Gate | Requirement |
|------|-------------|
| Skill located | SKILL.md found and fully read |
| Scenario analysis | SKILL.md content analyzed — purpose, steps, gates, rationalizations extracted |
| Category coverage | At minimum: happy-path + edge-case + ambiguity scenarios present |
| Scenario specificity | Every scenario references specific elements from the SKILL.md, not generic patterns |
| User approval | User explicitly approved the scenario set before proceeding |
| Scenarios saved | YAML file written to ~/.proof-of-skill/scenarios/<skill-name>.yaml |
| Baseline captured | tessl eval --quick run (or explicitly skipped with warning) |
| Config written | monitored-skills.json updated (not duplicated) |
| Confirmation shown | Summary displayed with all registration details |

## Rationalizations & Red Flags

Any of these thoughts mean **STOP — you are about to produce garbage monitoring**:

| If you think... | The reality is... |
|--------|---------|
| "I'll generate scenarios from the skill name alone" | The name tells you nothing about edge cases. Read the SKILL.md. |
| "Five happy-path variations is good coverage" | That is one category repeated five times. Cover the required three minimum. |
| "The user didn't provide scenarios, so I'll just use defaults" | There are no defaults. Every scenario must be derived from the specific SKILL.md content. |
| "I'll skip the user approval step to save time" | Unapproved scenarios = scenarios the user will ignore. Always confirm. |
| "Baseline capture is optional" | Without a baseline, regression detection is impossible. Capture it. |
| "I'll add to the existing scenarios file" | The user just approved a complete set. Overwrite, don't merge with stale scenarios. |
| "The config file already has this skill, I'll create a new entry" | Idempotent means update-in-place. One entry per skill, always. |
| "Generic scenarios work for any skill" | Generic scenarios catch generic failures. Specific scenarios catch real regressions. |
| "I can skip fuzzy matching on not-found — just say not found" | "Not found" without suggestions wastes user time. Always suggest alternatives. |
| "I don't need to show coverage gaps for user scenarios" | Users write happy-path scenarios. They need you to show what they missed. |

## Common Mistakes

- **Name-only scenarios**: Generating "test the happy path" without referencing the specific steps, gates, or outputs of the skill being monitored
- **Category theater**: Labeling five similar scenarios with different category names. If they all test the same thing, they are one category
- **Silent overwrite**: Updating scenarios or config without telling the user what changed from the previous registration
- **Stale baseline preservation**: Keeping the old baseline score when re-monitoring. The new scenarios may be different — always re-capture
- **Missing directories**: Failing to create `~/.proof-of-skill/` or `~/.proof-of-skill/scenarios/` before writing files
- **Relative paths in config**: Writing `skills/foo/SKILL.md` instead of the resolved absolute path. The config is consumed by external tools that may not share your working directory

## Example: Monitoring the `grill-me` Skill

**Input:** `/monitor-skill grill-me "When given a vague plan, does it push back?"`

**Step 1 — Parse:** skill name = `grill-me`, user scenarios = ["When given a vague plan, does it push back?"], flags = none

**Step 2 — Locate:** Found at `~/.claude/skills/grill-me/SKILL.md`

**Step 3 — Analyze:** Read SKILL.md. Extracted: purpose = "relentlessly interview about a plan or idea", steps = question generation, pushback, gap identification, stress testing. Quality gates: minimum 5 hard questions, must identify at least 2 gaps, must not accept "I'll figure it out later."

**Step 4 — Scenarios:**
- User scenario converted: "vague-plan-pushback" (ambiguity category)
- Auto-generated: "clear-plan-full-interview" (happy-path), "empty-input-handling" (edge-case), "user-tries-to-skip-questions" (adversarial), "plan-with-contradictions" (ambiguity), "re-grill-same-plan" (idempotency)
- Coverage: happy-path, edge-case, ambiguity (x2), adversarial, idempotency. Suggesting: failure-mode scenario.

**Step 5 — User approves** with 6 scenarios (declined failure-mode suggestion).

**Step 6-8 — Save, baseline, register.** Scenarios written, baseline = 88%, config updated.

**Step 9 — Confirmation:**
```
Monitoring registered for: grill-me

  Skill path:     /Users/alice/.claude/skills/grill-me/SKILL.md
  Scenarios:      6 (1 user-provided + 5 auto-generated)
  Scenarios file: ~/.proof-of-skill/scenarios/grill-me.yaml
  Baseline score: 88% (captured 2026-04-09T10:30:00Z)
  Threshold:      85% (alerts if score drops below this)
  Sample rate:    1-in-20 invocations sampled

  Config:         ~/.proof-of-skill/monitored-skills.json
```
