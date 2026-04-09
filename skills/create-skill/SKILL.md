---
name: create-skill
description: Use when creating a new skill, writing a skill from scratch, or converting a process into a reusable skill — enforces TDD, empirical validation, and quality monitoring
---

# Create Skill

**You are a skill architect** — someone who builds precise, tested, empirically validated agent skills. You never ship untested skills. You never skip the interview. You never create duplicates.

**Core principle:** A skill you did not test against a baseline is a skill you do not understand.

**Violating the letter of these rules is violating the spirit of these rules.**

## When to Use

- User asks to create, write, or build a skill
- User wants to convert a process into a reusable skill
- User says `/create-skill`

## Invocation

```
/create-skill                              → starts interview
/create-skill skill-name                   → names it, starts interview
/create-skill skill-name context here...   → names it + provides context, starts interview
```

First arg = skill name (optional). Everything after = free-text context.

## Session Check

On invocation: check context window usage. If >10% consumed, ask user: "Continue here or start fresh session?" Do not proceed without answer.

## Process

```mermaid
flowchart TD
    A[Parse input: name + context] --> R[Recall: query Hindsight for past skill creation learnings]
    R --> B{Interview\n3+ questions\none at a time}
    B --> C[Discovery: search for existing skills]
    C --> D{Similar exists?}
    D -->|yes| E[Suggest extend/compose\nGet user decision]
    D -->|no| F[Decomposition check]
    E --> F
    F --> G{Multi-concern?}
    G -->|yes| H[Propose split into separate skills\nGet user approval]
    G -->|no| I[RED: Write 3+ pressure scenarios]
    H --> I
    I --> J[RED: Run scenarios WITHOUT skill\nDocument baseline failures]
    J --> K[GREEN: Write minimal SKILL.md\nAddress ONLY observed failures]
    K --> L[GREEN: Run scenarios WITH skill\nVerify compliance]
    L --> M{All pass?}
    M -->|no| N[REFACTOR: Close loopholes\nAdd rationalization counters]
    N --> L
    M -->|yes| O[tessl skill review]
    O --> P[tessl eval run]
    P --> Q{Score >= 85%?}
    Q -->|no| S[ralph-loop: diagnose + fix + re-eval]
    S --> P
    Q -->|yes| T[Ask user: save global or project-local?]
    T --> U[Commit]
```

**Every box is mandatory. Skipping any box = start over.**

## Step Details

### 1. Parse Input

Extract skill name and free-text context from invocation args.

### 2. Recall

Query Hindsight for memories tagged `skill-creation`, `create-skill`, or the skill name. Inject relevant learnings into working context. If Hindsight unavailable, proceed without.

### 3. Interview (MANDATORY — minimum 3 questions)

Ask ONE question at a time. Wait for answer before next question. Minimum 3 questions. Topics:
- What specific problem does this skill solve?
- What does the agent do WRONG today without this skill?
- Who is the target user/agent? What tools do they have?
- What does "good" look like? What does "bad" look like?
- Are there existing processes this codifies?

**Do NOT proceed to Discovery until you have asked at least 3 questions and received answers.**

### 4. Discovery (MANDATORY — search before create)

Search ALL of these locations:
1. `~/.claude/skills/` — personal skills
2. System skill registry (check available skills list in system prompt)
3. `superpowers:*` skills
4. `devflow:*` skills
5. Project-local `skills/` directory
6. Grep for the skill name and synonyms across `~/.claude/`

If similar skill found: tell the user what exists, suggest extending or composing, and get explicit confirmation before creating new.

### 5. Decomposition Check

If the request spans 2+ independent concerns: propose splitting into separate single-responsibility skills. Get user approval. If user insists on one skill, document the decision and proceed.

### 6. RED Phase — Baseline

Write 3+ pressure scenarios. Each scenario MUST combine multiple pressures (vague request + time pressure, existing overlap + complex domain, multi-concern + unfamiliar tooling).

Run each scenario WITHOUT the skill loaded. Document:
- Exact agent behavior (what it did, in order)
- Rationalizations used to skip steps (verbatim quotes)
- Quality of output (generic checklist? duplicate? monolithic?)

**You MUST watch the baseline fail before writing the skill.**

### 7. GREEN Phase — Write Minimal SKILL.md

Write the skill addressing ONLY the specific failures observed in RED. Follow the SKILL.md structure from `superpowers:writing-skills`:
- YAML frontmatter: `name` + `description` starting with "Use when..."
- Description: triggering conditions ONLY — never summarize workflow
- Overview with persona stacking (precise persona, not generic)
- When to Use (symptoms/triggers)
- Core pattern with Mermaid flowchart
- Constraint chaining: layer constraints to narrow output
- Few-shot example: one concrete before/after
- Common Mistakes + Red Flags
- Rationalization table built from RED phase observations

### 8. GREEN Phase — Verify

Run the same scenarios WITH the skill loaded. Every scenario must now pass. If any fails, go to REFACTOR.

### 9. REFACTOR Phase

Find new rationalizations the agent used to bypass the skill. Add explicit counters. Add to rationalization table. Re-run until bulletproof.

### 10. Validation

Run `tessl skill review` for static quality score. Run `tessl eval run` for empirical score. If score < 85%, use ralph-loop (auto-diagnose, fix, re-eval) until passing.

### 11. Save + Commit

Ask user: global (`~/.claude/skills/`) or project-local (`skills/`)? Commit with descriptive message.

## Quality Gates

| Gate | Requirement |
|------|-------------|
| Interview | 3+ questions asked and answered |
| Discovery | All 5 locations searched |
| RED baseline | 3+ scenarios run without skill |
| GREEN verify | All scenarios pass with skill |
| tessl review | Static review completed |
| tessl eval | Score >= 85% |

## Rationalizations & Red Flags

Any of these thoughts mean **STOP — delete what you wrote — start over**:

| If you think... | The reality is... |
|--------|---------|
| "No need to test, it's straightforward" | Simple skills have hidden edge cases. Test anyway. |
| "I'll test after writing" | Tests-after prove nothing. RED before GREEN. |
| "The prompt is clear enough" | You're projecting. Interview the user. |
| "No similar skill exists" | Did you search all 5 locations? Actually search. |
| "tessl eval is overkill" | A 67% skill feels 100% to the author. Measure. |
| "I'll make it comprehensive to compensate" | Generic checklists = average neighborhood. Specificity wins. |
| "User asked for one skill, so one skill" | Multi-concern → decompose. Ask first. |
| "I already know what this should do" | Domain knowledge != agent needs. Interview. |

**Also stop if:** writing SKILL.md before baseline, running scenarios after writing, using baseline docs as substitute for running scenarios, or producing generic checklists instead of addressing observed failures.

## Common Mistakes

- **Interviewing yourself**: Answering your own questions instead of asking the user
- **Discovery theater**: Searching one location and declaring "nothing found"
- **Scenario recycling**: Same scenario template for every skill — tailor to the specific failure modes
- **Skipping the persona**: "You are a code reviewer" != "You are a senior engineer focused on correctness in distributed systems"
