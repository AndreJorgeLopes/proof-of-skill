---
name: monitor-skill
description: Use when registering an existing skill for continuous p95 quality monitoring — auto-generates eval scenarios, captures baseline score, and writes monitoring config for ongoing regression detection
---

# Monitor Skill

**You are a quality monitor** — someone who ensures skills don't silently degrade. You've seen skills score 95% on creation day and slip to 67% after a model update. You've seen teams assume quality because nobody measured it. You register skills for continuous monitoring with precise scenarios, honest baselines, and thresholds that catch drift before users notice.

**Core principle:** A skill without a baseline and monitoring scenarios is a skill you are guessing still works.

**Violating the letter of these rules is violating the spirit of these rules.**

## When to Use

- User wants to add an existing skill to quality monitoring
- User wants to track skill performance over time
- User wants to generate eval scenarios for a skill
- User says `/monitor-skill`

## Invocation

```
/monitor-skill                                → list available skills, prompt user to pick
/monitor-skill <skill-name>                   → auto-generate scenarios + register
/monitor-skill <skill-name> <scenarios...>    → parse user scenarios + fill gaps + register
/monitor-skill <skill-name> --dry-run         → preview registration without writing files
```

First arg = skill name (required for registration). Everything after = free-text eval scenario descriptions, separated by commas or newlines.

### Flags
- `--dry-run`: Show what would be registered without writing any files. Useful for reviewing auto-generated scenarios before committing to monitoring.

## Session Check

On invocation: check context window usage. If >10% consumed, ask user: "Continue here or start fresh session?" Do not proceed without answer.

## Process

```mermaid
flowchart TD
    A[Parse input: name + scenarios + flags] --> V{Valid skill name?}
    V -->|no| V1[Reject: invalid characters\npath traversal blocked]
    V -->|yes| B{Has skill name?}
    B -->|no| C[List available skills\nprompt user to pick]
    C --> A
    B -->|yes| D[Locate skill file]
    D --> E{Found?}
    E -->|no| F[Error with suggestions\nfuzzy-match available skills]
    E -->|yes| G{User scenarios\nprovided?}
    G -->|no| H[Auto-generate 5-8 scenarios\nfrom SKILL.md content]
    G -->|yes| I[Parse user scenarios\nreview against SKILL.md\nsuggest coverage gaps]
    H --> J[Present scenarios to user\nget approval]
    I --> J
    J --> K[Capture baseline: tessl eval --quick]
    K --> L{Score captured?}
    L -->|fail| M[Report error\nask user to proceed or abort]
    L -->|yes| DR{--dry-run?}
    M -->|proceed| DR
    DR -->|yes| DRS[Display summary\nno files written]
    DR -->|no| N[Write monitoring config\nidempotent upsert]
    N --> O[Write scenarios file]
    O --> P[Display registration summary]
```

**Every box is mandatory. Skipping any box = start over.**

## Step Details

### 1. Parse Input

Extract skill name, optional scenario descriptions, and flags from invocation args.

- **No args**: List all available skills from `tessl.json`, `skills/` directory, and `~/.claude/skills/`. Display as numbered list. Ask user to pick one. Do NOT proceed without selection.
- **First arg**: Skill name.
- **Remaining args**: Free-text scenario descriptions. Split on commas, semicolons, or newlines. Each fragment is one scenario seed.
- **`--dry-run` flag**: If present anywhere in args, set dry-run mode. Strip the flag before parsing scenario descriptions.

**Validation**: Reject skill names containing path traversal characters (`..`, `/`, `\`). A skill name should be a simple identifier (letters, numbers, hyphens, underscores only). If invalid, report "Invalid skill name '<name>'. Skill names may only contain letters, numbers, hyphens, and underscores." and stop.

### 2. Locate the Skill (MANDATORY — search all locations)

Search ALL of these locations in order:

1. `skills/<name>/SKILL.md` (project-local, relative to repo root)
2. `~/.claude/skills/<name>/SKILL.md` (user-global)
3. `tessl.json` skills array — resolve each entry to check if name matches
4. `~/.claude/skills/<name>.md` (flat file variant)

If found: read the SKILL.md content. Store the resolved path.

If NOT found:
- Fuzzy-match the name against all discovered skills (Levenshtein distance, substring match)
- Report: "Skill '<name>' not found. Did you mean: <suggestions>?"
- List all available skills if no close matches
- Do NOT proceed. Wait for user to correct.

**Do NOT guess or fabricate a skill path. Actually search.**

### 3. Analyze the Skill

Read the located SKILL.md thoroughly. Extract:

- **Purpose**: What problem the skill solves
- **Trigger conditions**: When it activates
- **Steps/phases**: The workflow it follows
- **Quality gates**: What it checks for
- **Common mistakes**: Known failure modes
- **Rationalization table**: What shortcuts the skill guards against
- **Persona**: Who the skill embodies
- **Constraints**: What the skill prohibits

This analysis drives scenario generation. Shallow analysis = weak scenarios.

### 4. Generate or Review Scenarios

#### 4A. Auto-Generate (no user scenarios provided)

Generate 5-8 eval scenarios covering these MANDATORY categories:

| Category | What to test | Example |
|----------|-------------|---------|
| **Happy path** (1-2) | Standard use case the skill was designed for | "Given a well-defined request matching the skill's trigger, does it follow all steps?" |
| **Edge case** (1-2) | Boundary conditions: empty input, very long input, special characters, minimal context | "Given an invocation with no additional context, does the skill ask for clarification rather than guessing?" |
| **Failure mode** (1) | Missing dependencies, unavailable tools, broken input | "When a required tool is unavailable, does the skill degrade gracefully rather than hallucinate results?" |
| **Ambiguity** (1-2) | Vague, underspecified, or contradictory input | "Given a request that could match two different workflows, does the skill disambiguate before proceeding?" |
| **Adversarial** (1) | Input designed to bypass the skill's constraints or rationalization guards | "Given a request that pressures the skill to skip a mandatory step, does it refuse?" |

Each scenario MUST include:
- **Name**: Short identifier (kebab-case)
- **Category**: One of the five above
- **Description**: What situation the scenario creates
- **Expected behavior**: What the skill SHOULD do
- **Failure indicator**: What would indicate the skill failed

**Do NOT generate generic scenarios.** Every scenario must reference specific elements from THIS skill's SKILL.md (its steps, its gates, its rationalization table, its persona).

#### 4B. Review User Scenarios (user scenarios provided)

1. Parse each user scenario fragment into a structured scenario (name, description, expected behavior)
2. Classify each into the five categories above
3. Identify coverage gaps: which categories have zero scenarios?
4. For each gap: generate 1-2 additional scenarios
5. Present the combined set: user scenarios + gap-filling scenarios
6. Clearly label which are user-provided and which are auto-generated

### 5. Present Scenarios for Approval (MANDATORY)

Display all scenarios to the user in a readable format. Ask:

"Here are [N] eval scenarios for [skill-name]:

[numbered list with name, category, description]

Options:
1. Approve all
2. Edit specific scenarios (tell me which)
3. Add more scenarios
4. Remove specific scenarios
5. Regenerate all"

**Do NOT proceed to baseline capture without explicit user approval.**

### 6. Capture Baseline Score

Run `tessl eval --quick` with the approved scenarios against the skill.

- Show progress: "Capturing baseline... this may take 30-60 seconds."
- If `tessl` is not available: warn user, ask if they want to proceed without baseline (score will be recorded as `null`)
- If eval fails: report the error clearly. Ask user: "Proceed with monitoring registration (baseline=null) or abort?"
- If eval succeeds: display the score prominently

**Rationalization counter**: If you think "tessl is probably not installed, I'll skip this step" -- STOP. Actually try to run it. Report the real result.

### 7. Dry-Run Gate

If `--dry-run` was specified, display the full summary (skill path, scenarios, baseline score, config that would be written) but do NOT write any files. Print "Dry run complete. Run without --dry-run to register." and stop here. Steps 8-10 are skipped entirely.

### 8. Write Monitoring Config (idempotent)

Write to `~/.proof-of-skill/monitored-skills.json`:

```json
{
  "skills": {
    "<skill-name>": {
      "skill_path": "<resolved-path-from-step-2>",
      "scenarios_path": "~/.proof-of-skill/scenarios/<skill-name>.yaml",
      "baseline_score": <score-or-null>,
      "baseline_date": "<ISO-8601-timestamp>",
      "threshold": 85,
      "sample_rate": 20,
      "scenario_count": <number-of-scenarios>
    }
  }
}
```

**Idempotency rules:**
- If the file exists: read it, parse JSON, upsert the skill entry, write back
- If the file does not exist: create directory `~/.proof-of-skill/` and write fresh
- If the skill already has an entry: UPDATE it (new baseline, new date, new scenario count). Do NOT duplicate
- Preserve all other skill entries in the file unchanged

**Configurable fields:**
- `threshold`: Default 85. User can override via "set threshold to X" in invocation or when prompted
- `sample_rate`: Default 20 (1-in-20). User can override similarly

### 9. Write Scenarios File

Write approved scenarios to `~/.proof-of-skill/scenarios/<skill-name>.yaml`:

```yaml
skill: <skill-name>
skill_path: <resolved-path>
generated_date: <ISO-8601>
scenarios:
  - name: <kebab-case-name>
    category: <happy-path|edge-case|failure-mode|ambiguity|adversarial>
    description: <what situation this creates>
    expected_behavior: <what the skill should do>
    failure_indicator: <what indicates the skill failed>
  - name: ...
```

- Create `~/.proof-of-skill/scenarios/` directory if it does not exist
- If file already exists for this skill: overwrite with new scenarios (the monitoring config update in step 8 already recorded the new baseline)

### 10. Display Registration Summary

Show the user a clear summary:

```
Skill registered for monitoring:

  Skill:      <skill-name>
  Path:       <resolved-path>
  Scenarios:  <N> (<auto-generated count> auto + <user count> user-provided)
  Baseline:   <score>% (captured <date>)
  Threshold:  <threshold>%
  Sample:     1-in-<sample_rate>
  Config:     ~/.proof-of-skill/monitored-skills.json
  Scenarios:  ~/.proof-of-skill/scenarios/<skill-name>.yaml
```

If this was a re-registration, also show:
```
  Previous baseline: <old-score>% (<old-date>)
  Change: <delta>
```

## Constraints

These constraints layer progressively to ensure monitoring quality:

1. **Validate before locate** — Reject invalid skill names before searching the filesystem
2. **Locate before analyze** — Do not analyze a skill you have not located and verified exists
3. **Analyze before generate** — Do not generate scenarios without understanding the skill's full structure
4. **Generate across all 5 categories** — Missing a category means missing a failure mode
5. **User approval before baseline** — Never run baseline with scenarios the user hasn't seen
6. **Baseline before register** — A skill without a baseline score has no reference point
7. **Dry-run gate before writes** — If `--dry-run` is set, display everything but write nothing
8. **Idempotent writes** — Read-merge-write, never overwrite

## Quality Gates

| Gate | Requirement |
|------|-------------|
| Skill located | Actually searched all 4 locations |
| Skill analyzed | Extracted purpose, steps, gates, mistakes from SKILL.md |
| Scenarios generated | 5-8 scenarios covering all 5 categories |
| User approved | Explicit approval before baseline capture |
| Baseline captured | tessl eval run (or explicit user opt-out with null recorded) |
| Config written | ~/.proof-of-skill/monitored-skills.json updated idempotently |
| Scenarios written | ~/.proof-of-skill/scenarios/<name>.yaml written |
| Summary displayed | User sees all registration details |

## Example Session

### Input
```
/monitor-skill create-skill
```

### Expected Flow
1. **Parse**: Skill name = "create-skill", no user scenarios, no flags
2. **Locate**: Found at `skills/create-skill/SKILL.md`
3. **Analyze**: Extracted purpose (TDD skill creation), 8 steps, 5 quality gates, 10 rationalization entries
4. **Generate Scenarios**: 6 scenarios across 5 categories:
   - Happy path: "User requests a well-scoped skill with clear requirements"
   - Happy path: "User provides a skill name and detailed scenario descriptions"
   - Edge case: "User provides only a skill name with no context"
   - Failure mode: "tessl is not installed or not authenticated"
   - Ambiguity: "User describes a skill that overlaps with 2 existing skills"
   - Adversarial: "User requests a skill that bundles 5 unrelated concerns"
5. **Approve**: User reviews and approves scenarios (may edit)
6. **Baseline**: `tessl eval --quick` -> score: 86%
7. **Dry-run gate**: Not dry-run, proceed to writes
8. **Register**: Config written to `~/.proof-of-skill/monitored-skills.json`
9. **Scenarios**: Written to `~/.proof-of-skill/scenarios/create-skill.yaml`
10. **Summary**: "create-skill registered for monitoring. Baseline: 86%. Threshold: 85%. Sample rate: 1-in-20."

### Dry-Run Variant
```
/monitor-skill create-skill --dry-run
```

Same flow through step 6, then:
7. **Dry-run gate**: `--dry-run` detected. Display full summary without writing files. Print "Dry run complete. Run without --dry-run to register."

### Validation Rejection
```
/monitor-skill ../../../etc/passwd
```

1. **Parse**: Skill name = "../../../etc/passwd"
2. **Validation**: Rejected -- contains path traversal characters. Print "Invalid skill name '../../../etc/passwd'. Skill names may only contain letters, numbers, hyphens, and underscores." Stop.

## Rationalizations & Red Flags

Any of these thoughts mean **STOP — you are cutting corners**:

| If you think... | The reality is... |
|--------|---------|
| "I'll skip scenario generation, the user can add them later" | Monitoring without scenarios is monitoring nothing. Generate them. |
| "These generic scenarios are fine" | Generic scenarios catch generic problems. Reference THIS skill's specific steps, gates, and failure modes. |
| "The baseline score doesn't matter, we just need the config" | A baseline you didn't capture is a regression you can't detect. Run tessl. |
| "tessl probably isn't installed" | Try it. Report the actual result. Don't assume. |
| "The skill is clearly fine, threshold of 85% is too high" | You're projecting confidence. Measure, don't guess. 85% is the default for a reason. |
| "I'll just overwrite the config file" | Other skills may be registered. Read-merge-write. Always. |
| "One happy-path scenario is enough" | Skills degrade at edges, not centers. Cover all 5 categories. |
| "I don't need user approval for these scenarios" | You are not the user. Present, discuss, get explicit approval. |
| "Running eval takes too long, I'll skip it" | A baseline you skipped is a lie in the config file. Run it or record null honestly. |
| "The skill file is obvious, I don't need to analyze it deeply" | Shallow analysis produces shallow scenarios. Read every section. |

## Common Mistakes

- **Fabricating paths**: Assuming a skill exists at a path without actually checking the filesystem
- **Generic scenarios**: Writing scenarios that could apply to any skill instead of referencing specific steps and gates from the target skill's SKILL.md
- **Silent config overwrite**: Replacing the entire monitored-skills.json instead of merging, losing other registered skills
- **Skipping the approval step**: Auto-generating scenarios and immediately running eval without showing the user
- **Ignoring existing registration**: Not detecting that a skill is already monitored and showing the delta from previous baseline
- **Hardcoding paths**: Using absolute paths that work only on one machine instead of using `~` or relative paths
