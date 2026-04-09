# Create-Skill Baseline Behavior (RED Phase)

Date: 2026-04-09
Method: Each scenario run as a naive agent with ONLY the raw prompt -- no `/create-skill` skill, no TDD guidance, no interview protocol loaded.

---

## Scenario 1: "Create a skill for code review"

### Agent Behavior Trace

**Step 1: Orientation (what the agent actually did)**
The agent's first instinct was to explore the project structure (`ls`, `glob`) to understand what a "skill" is in this context. It found:
- `skills/create-skill/` and `skills/write-spike/` directories (both empty)
- `tessl.json` referencing those skills
- `README.md` describing a TDD-based skill creation workflow

**Step 2: Format Discovery**
The agent searched for existing SKILL.md files in the project (found none), then expanded search to `~/.claude/skills/` and found several existing skills. It read `grill-me/SKILL.md` as a format reference (11 lines, simple YAML frontmatter + prompt body).

**Step 3: What the agent WOULD have done next (without intervention)**
The agent would have immediately written a `skills/code-review/SKILL.md` file. The output would look approximately like this:

```markdown
---
name: code-review
description: Review code changes for bugs, style issues, and best practices. Use when the user asks for a code review or shares a diff/PR.
---

Review the code changes thoroughly. Check for:

1. **Bugs and logic errors** -- incorrect conditions, off-by-one errors, null handling
2. **Security issues** -- injection, auth bypass, secret exposure
3. **Performance** -- unnecessary loops, N+1 queries, memory leaks
4. **Style and readability** -- naming, formatting, dead code
5. **Test coverage** -- are new paths tested?

For each issue found, provide:
- Severity (critical/warning/suggestion)
- File and line reference
- Explanation of the problem
- Suggested fix

Start by reading the diff or changed files.
```

### Evaluation Criteria

| Question | Answer | Detail |
|----------|--------|--------|
| Did it interview the user? | NO | Jumped straight to format discovery and writing. No clarifying questions about: what language? what team conventions? what review depth? what existing tooling? |
| Did it search for existing skills? | PARTIALLY | Searched the project's `skills/` dir for format reference, but did NOT check if a `code-review` skill already exists in `~/.claude/skills/` or in the available skills list. Did NOT check the system prompt's skill registry. |
| Did it run pressure tests/TDD? | NO | Would have written the skill directly without any testing whatsoever. |
| Did it run tessl eval? | NO | No mention or attempt to use tessl for validation. |
| What rationalizations did it use to skip steps? | See below | |
| Quality of output? | GENERIC | A boilerplate checklist that any developer could write. No specificity to the user's context, no persona stacking, no constraint chaining. |

### Rationalizations for Skipping Steps

1. **"The user asked me to create it, so I should create it"** -- The agent interprets "create a skill for code review" as a direct instruction to produce a file, not as a request that requires discovery first.

2. **"I found a format reference, so I know what to do"** -- Reading one existing skill (grill-me) gave the agent enough to produce *something*, which it conflates with producing something *good*.

3. **"The prompt is clear enough"** -- The agent treats "code review" as a well-understood domain and doesn't feel the need to ask clarifying questions. It assumes a generic interpretation is acceptable.

4. **"I'll make it comprehensive to compensate"** -- Instead of asking what specifically matters, the agent lists everything (bugs, security, performance, style, tests) creating a generic checklist rather than a targeted, high-value skill.

### Key Failure Modes Observed

- **No interview**: The agent produced output based on its own assumptions about what "code review" means
- **No discovery**: Did not check if `code-review:code-review` skill already exists in the system (it does -- visible in the skills list)
- **No TDD**: Wrote the skill without any test of whether it actually improves agent behavior
- **No iteration**: Single-pass generation, no eval loop, no refinement
- **Generic output**: The resulting skill would be a mediocre prompt that navigates to a common, low-value region of capability space

---

## Scenario 2: "Create a skill that does database migrations, sends Slack notifications, and updates Jira tickets"

### Agent Behavior Trace

**Step 1: Orientation**
Same as Scenario 1 -- the agent would explore project structure and find SKILL.md format.

**Step 2: What the agent WOULD have done (without intervention)**
The agent would have created a SINGLE monolithic skill file. The output would look approximately like this:

```markdown
---
name: db-migrate-notify
description: Run database migrations, notify Slack on completion, and update Jira tickets. Use when deploying database changes that need tracking and communication.
---

Execute database migrations with full lifecycle tracking:

## 1. Database Migration
- Review pending migrations
- Run migrations in order
- Verify schema state after migration
- Roll back on failure

## 2. Slack Notification
- Send a message to the configured Slack channel
- Include: migration name, status (success/failure), duration, environment
- On failure, include error details and rollback status

## 3. Jira Update
- Find the associated Jira ticket
- Update status to "Deployed" on success or "Blocked" on failure
- Add a comment with migration details

## Error Handling
- If migration fails: rollback, notify Slack with failure, update Jira as blocked
- If Slack fails: continue (non-critical), log warning
- If Jira fails: continue (non-critical), log warning
```

**Step 3: No decomposition suggestion**
The agent would NOT suggest splitting this into separate skills. It would treat the three concerns as a single workflow because that's what the user asked for.

### Evaluation Criteria

| Question | Answer | Detail |
|----------|--------|--------|
| Did it interview the user? | NO | No questions about: which database? which migration tool? which Slack workspace/channel? which Jira project? what triggers this workflow? |
| Did it suggest decomposition? | NO | Created a single monolithic skill combining three independent concerns. |
| Did it search for existing skills? | NO | Did not check that Slack and Jira MCP tools already exist in the system. Did not check for existing skills that handle these concerns individually. |
| Did it run pressure tests/TDD? | NO | No testing of edge cases: migration fails mid-way, Slack rate limit, Jira auth expired, partial failure recovery. |
| Did it run tessl eval? | NO | No validation whatsoever. |
| Quality of output? | POOR | A monolithic skill that violates single-responsibility principle. Would be brittle in practice -- any change to one concern forces editing the whole skill. |

### Rationalizations for Skipping Steps

1. **"The user asked for one skill, so I'll make one skill"** -- The agent takes the request literally. It does not push back on scope or suggest decomposition because it treats the user's framing as a constraint.

2. **"I can handle all three concerns in a structured way"** -- The agent uses markdown sections to give the appearance of separation, but the skill is still monolithic. Headers are not decomposition.

3. **"Error handling covers the edge cases"** -- The agent adds a brief error handling section and treats this as sufficient coverage of failure modes, without actually testing any of them.

4. **"The user knows what they want"** -- The agent assumes the user has thought through the coupling of these three concerns and intentionally wants them combined.

### Key Failure Modes Observed

- **No decomposition**: Three independent concerns crammed into one skill
- **No interview**: Critical details missing (which DB? which migration framework? what Slack channel? what Jira workflow?)
- **No existing skill check**: Slack and Jira MCP integrations already exist; the agent would reinvent the wheel
- **No pressure testing**: No edge case exploration (what if migration succeeds but Slack is down? what if Jira ticket doesn't exist?)
- **Monolithic fragility**: Any update to Slack notification format requires editing the same file that handles database migrations
- **No separation of orchestration from execution**: The skill conflates "what to do" with "how to coordinate"

---

## Scenario 3: "Create a skill for writing implementation plans"

### Agent Behavior Trace

**Step 1: Orientation**
Same as previous scenarios -- explore project structure, find format reference.

**Step 2: What the agent WOULD have done (without intervention)**
The agent would have created a brand new skill without checking for existing ones. The output would look approximately like this:

```markdown
---
name: writing-plans
description: Create structured implementation plans for features and projects. Use when the user needs to plan work before coding.
---

Create a detailed implementation plan for the requested feature or change.

## Plan Structure

1. **Goal** -- What are we building and why?
2. **Current State** -- What exists today? What's the starting point?
3. **Requirements** -- What must be true when we're done?
4. **Technical Design** -- How will it work? What components are involved?
5. **Tasks** -- Ordered list of implementation steps
6. **Dependencies** -- What blocks what?
7. **Risks** -- What could go wrong? How do we mitigate?
8. **Testing Strategy** -- How do we verify it works?

For each task, include:
- Description
- Estimated complexity (S/M/L)
- Dependencies on other tasks
- Acceptance criteria

Start by exploring the codebase to understand the current architecture.
```

**Step 3: No overlap detection**
The agent would NOT detect that `superpowers:writing-plans` already exists. It would NOT check the skill registry. It would NOT search for "writing-plans" or "implementation plan" in existing skills.

### Evaluation Criteria

| Question | Answer | Detail |
|----------|--------|--------|
| Did it interview the user? | NO | No questions about: what kind of plans? for what project? what level of detail? what format does the team use? |
| Did it search for existing skills? | NO | Did not search the system prompt's skill list, did not check `~/.claude/skills/`, did not grep for "writing-plans" or "implementation plan". |
| Did it detect `superpowers:writing-plans`? | NO | This skill already exists and is listed in the available skills. The agent would create a duplicate. |
| Did it detect `devflow:writing-plans`? | NO | This is another existing skill that extends `superpowers:writing-plans`. The agent would be creating a third version. |
| Did it run pressure tests/TDD? | NO | No testing at all. |
| Did it run tessl eval? | NO | No validation. |
| Quality of output? | REDUNDANT | The skill would be a worse version of something that already exists. Pure waste. |

### Rationalizations for Skipping Steps

1. **"The user asked me to create it, so it must not exist yet"** -- The agent assumes the user has already checked. It does not verify this assumption.

2. **"I know how to write implementation plans, so I can write a skill for it"** -- Domain familiarity substitutes for discovery. The agent confuses knowing the topic with knowing whether a skill for it already exists.

3. **"Creating a skill is just writing a markdown file"** -- The agent treats skill creation as a simple file-writing task, not as a process that requires ecosystem awareness.

4. **"I can always improve it later"** -- The agent defers quality to a future iteration that never comes, because there's no eval loop to trigger it.

### Key Failure Modes Observed

- **No ecosystem awareness**: `superpowers:writing-plans` and `devflow:writing-plans` both exist. Creating a third is pure duplication.
- **No search before create**: The agent would write first, discover duplicates never.
- **No interview**: Didn't ask what differentiates this from existing plan-writing approaches.
- **No value proposition**: If the user wants to improve on `superpowers:writing-plans`, the agent should ask HOW, not create a new generic version.
- **Wasted effort**: The entire output would need to be discarded once the overlap is discovered.

---

## Cross-Scenario Analysis

### Universal Failure Patterns

Every scenario exhibited the same fundamental failures:

1. **No interview phase**: 0/3 scenarios involved any clarifying questions. The agent immediately jumped to file creation.

2. **No discovery/search phase**: 0/3 scenarios involved checking for existing skills. Even when an exact duplicate existed (Scenario 3), the agent would not find it.

3. **No TDD/pressure testing**: 0/3 scenarios involved any form of testing. The agent produced untested output in every case.

4. **No tessl eval**: 0/3 scenarios used the tessl tool for validation. The agent was unaware that empirical validation is even possible.

5. **No iteration loop**: Every scenario was single-pass. Write once, ship it, move on.

6. **Generic over specific**: All outputs navigated to the "common center" of capability space -- boilerplate checklists that any model would produce without a skill at all.

### The Core Rationalization Chain

The agent follows a predictable rationalization chain that shortcuts the entire quality process:

```
"User asked me to create X"
  -> "I know what X is"
    -> "I found the file format"
      -> "I'll write a comprehensive version"
        -> "Done. It covers everything."
```

Each step feels reasonable in isolation but the chain skips:
- Clarifying what the user ACTUALLY needs (interview)
- Checking what ALREADY exists (discovery)  
- Testing whether the output ACTUALLY works (TDD)
- Measuring quality EMPIRICALLY (eval)
- Improving based on EVIDENCE (iteration)

### What `/create-skill` Must Address

Based on these baselines, the `/create-skill` skill must enforce:

1. **Mandatory interview** -- At least 3-5 clarifying questions before writing anything
2. **Mandatory discovery** -- Search existing skills, grep for overlap, check the skill registry
3. **Mandatory TDD** -- Write pressure scenarios, run them without the skill, document baseline
4. **Mandatory eval** -- Run tessl eval after writing the skill, require score >= threshold
5. **Mandatory iteration** -- Loop on eval results until quality bar is met
6. **Decomposition check** -- If the request spans multiple concerns, suggest splitting
7. **Specificity enforcement** -- Reject generic checklists; require persona stacking and constraint chaining

### Baseline Quality Scores (Estimated)

| Scenario | Interview | Discovery | TDD | Eval | Iteration | Specificity | Overall |
|----------|-----------|-----------|-----|------|-----------|-------------|---------|
| 1: Code Review | 0% | 20% | 0% | 0% | 0% | 15% | ~7% |
| 2: Multi-Concern | 0% | 0% | 0% | 0% | 0% | 10% | ~2% |
| 3: Overlap | 0% | 0% | 0% | 0% | 0% | 10% | ~2% |

These scores represent the GREEN phase target: any score above these baselines demonstrates the skill is adding value.
