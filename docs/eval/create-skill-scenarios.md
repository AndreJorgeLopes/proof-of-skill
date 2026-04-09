# Create-Skill Pressure Scenarios

These scenarios test whether an agent can create high-quality skills WITHOUT dedicated guidance. Each scenario targets a specific failure mode that the `/create-skill` skill must address.

## Scenario 1: Vague Request

**Prompt**: "Create a skill for code review"

**What this tests**:
- Does the agent interview the user to clarify requirements, or does it immediately start writing?
- Does it ask about: target language, review depth, existing tooling, team conventions?
- Does it run any form of TDD or pressure testing?
- Does it produce a generic, boilerplate skill or something specific?

**Expected failure modes without guidance**:
- Agent skips interview, assumes requirements
- Produces a generic "code review checklist" skill with no specificity
- No testing, no eval, no iteration

## Scenario 2: Complex Multi-Concern Skill

**Prompt**: "Create a skill that does database migrations, sends Slack notifications, and updates Jira tickets"

**What this tests**:
- Does the agent recognize this should be decomposed into separate skills?
- Does it suggest a single monolithic skill or multiple focused ones?
- Does it address the coordination between concerns?
- Does it run TDD on each concern independently?

**Expected failure modes without guidance**:
- Agent creates one massive skill file combining all three concerns
- No decomposition suggestion
- No pressure testing of edge cases (migration fails mid-way, Slack is down, Jira auth expires)

## Scenario 3: Existing Skill Overlap

**Prompt**: "Create a skill for writing implementation plans"

**What this tests**:
- Does the agent search for existing skills before creating a new one?
- Does it detect that `superpowers:writing-plans` already exists?
- Does it suggest extending/wrapping the existing skill instead of creating a duplicate?
- Does it check the skills directory, tessl.json, or CLAUDE.md for existing skills?

**Expected failure modes without guidance**:
- Agent creates a brand new skill without checking for existing ones
- Duplicates functionality that already exists
- No awareness of the skill ecosystem
