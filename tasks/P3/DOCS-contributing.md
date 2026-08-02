---
id: DOCS-contributing
title: "Contributing guide with skill authoring, eval writing, and PR process"
priority: P3
category: docs
status: done
depends_on:
  - DOCS-readme
estimated_effort: S
files_to_touch:
  - CONTRIBUTING.md
---

# Contributing Guide

## Context

proof-of-skill is an open-source project that encourages community contributions -- new skills, eval scenarios, adapters, and core improvements. Without a clear contributing guide, potential contributors face friction: they don't know how to structure a skill, what makes a good eval scenario, how the PR process works, or how the project's TDD philosophy applies to their contributions. A well-written CONTRIBUTING.md removes this friction and ensures consistent quality.

## Problem Statement

1. **No entry point for contributors**: Developers who want to contribute have no documentation explaining the process, expectations, or standards
2. **No skill authoring guide**: The most common contribution type (new skills) has no template or guidelines beyond studying existing skills
3. **No eval writing guide**: Eval scenarios are the backbone of proof-of-skill's quality guarantees, but there is no documentation on how to write effective ones
4. **No code of conduct**: Open-source projects need explicit behavioral norms to maintain a healthy community
5. **No PR process**: Contributors don't know what to include in a PR, what checks will run, or how reviews work

## Desired Outcome

- A CONTRIBUTING.md that guides contributors from "I want to help" to "my PR is merged"
- Clear sections on: adding skills, writing eval scenarios, core development, code of conduct, PR process
- The TDD philosophy is woven throughout, not just mentioned
- Examples are concrete and copy-pasteable
- The document is friendly and encouraging without being patronizing

## Implementation Guide

### Step 1: Opening and overview

```markdown
# Contributing to proof-of-skill

Thanks for considering a contribution! proof-of-skill applies TDD principles to AI agent skills, and we apply the same discipline to contributions: every change should be testable, every skill should have eval scenarios, and every PR should demonstrate that it works.

## Ways to Contribute

- **Add a new skill** — Create a skill and its eval scenarios using `/create-skill`
- **Improve eval scenarios** — Add edge cases, failure modes, or adversarial inputs to existing skills
- **Build an adapter** — Connect proof-of-skill to your observability platform
- **Improve core** — Enhance the metrics store, dashboard, hooks, or optimizer
- **Fix bugs** — Found something broken? PRs welcome
- **Improve docs** — Typos, unclear sections, missing examples
```

### Step 2: Adding a new skill

```markdown
## Adding a New Skill

proof-of-skill uses TDD for skill creation. The process is:

1. **Write failing scenarios first** — Define what the skill should do by writing eval scenarios that fail without the skill
2. **Create the minimal SKILL.md** — Write just enough to make the scenarios pass
3. **Iterate until score >= 85%** — Use `tessl eval` to measure and improve

### Quick path (recommended)

Use `/create-skill` to go through the full TDD process interactively:

\`\`\`
/create-skill my-new-skill I want a skill that does X
\`\`\`

This will interview you, write scenarios, create the skill, and iterate until the eval score passes.

### Manual path

If you prefer to work manually:

1. Create the skill directory:
   \`\`\`bash
   mkdir -p skills/my-new-skill
   \`\`\`

2. Write eval scenarios first (in `docs/eval/my-new-skill-scenarios.md`):
   \`\`\`markdown
   ## Scenario 1: [Name]
   **Prompt**: "[What the user says]"
   **What this tests**: [What capability is being evaluated]
   **Expected behavior**: [What the skill should do]
   **Expected failure without skill**: [What happens without it]
   \`\`\`

3. Create `skills/my-new-skill/SKILL.md` following the template:
   \`\`\`markdown
   ---
   name: my-new-skill
   description: One-line description
   ---
   # /my-new-skill
   ## Trigger
   ## Step 1: ...
   ## Step 2: ...
   \`\`\`

4. Run `tessl eval` and iterate until score >= 85%

5. Register in `tessl.json`:
   \`\`\`json
   {
     "skills": ["skills/my-new-skill"]
   }
   \`\`\`
```

### Step 3: Writing eval scenarios

```markdown
## Writing Eval Scenarios

Good eval scenarios are the most valuable contribution you can make. A skill is only as good as its tests.

### Scenario categories

Every skill should have scenarios in at least these categories:

| Category | Purpose | Example |
|----------|---------|---------|
| Happy path | Standard use case | "Create a skill for code review" |
| Edge case | Boundary conditions | Empty input, very long input, special characters |
| Failure mode | Graceful degradation | Dependency unavailable, invalid config |
| Ambiguity | Unclear input | Vague request that needs clarification |
| Adversarial | Misuse resistance | Input designed to bypass constraints |

### What makes a good scenario

- **Specific**: "When given a skill name that matches an existing skill" not "handles duplicates"
- **Observable**: The expected behavior can be verified by reading the output
- **Independent**: Each scenario tests one thing. Don't combine concerns
- **Realistic**: Use inputs that real users would provide, not contrived test strings

### What makes a bad scenario

- **Vague**: "Works correctly" — what does "correctly" mean?
- **Redundant**: Testing the same thing as another scenario with trivially different input
- **Impossible**: Testing behavior that no skill could reasonably achieve
- **Implementation-coupled**: Testing specific wording rather than intent
```

### Step 4: Code of conduct

```markdown
## Code of Conduct

- Be kind and constructive in reviews and discussions
- Assume good intent from other contributors
- Focus on the work, not the person
- Disagreements about technical approach are welcome; personal attacks are not
- If you see problematic behavior, contact the maintainers directly
```

### Step 5: PR process

```markdown
## Pull Request Process

### Before opening a PR

1. **Run eval scenarios** for any skills you changed: `tessl eval`
2. **Check that scores are >= 85%** for all affected skills
3. **Ensure your skill has scenarios** — PRs adding skills without eval scenarios will be asked to add them
4. **Update tessl.json** if you added a new skill

### PR template

Your PR description should include:

- **What**: One sentence describing the change
- **Why**: What problem this solves or what value it adds
- **How**: Brief technical approach (for non-trivial changes)
- **Eval results**: Paste the tessl eval output showing scores

### Review process

1. A maintainer will review within 48 hours
2. For new skills: we run the eval scenarios independently to verify scores
3. For core changes: we review for backward compatibility and test coverage
4. Iteration is normal — most PRs need 1-2 rounds of feedback

### After merge

- Your skill becomes available to all proof-of-skill users
- If you used `/monitor-skill`, monitoring continues automatically
- You'll be credited in the changelog
```

### Step 6: Development setup

```markdown
## Development Setup

\`\`\`bash
# Clone the repo
git clone https://github.com/AndreJorgeLopes/proof-of-skill.git
cd proof-of-skill

# Install dependencies (for core TypeScript modules)
npm install

# Symlink skills for local testing
ln -sf $(pwd)/skills/create-skill ~/.claude/skills/create-skill

# Run eval scenarios
tessl eval

# Run the dashboard (requires metrics data)
node dashboard/server.js
\`\`\`

### Project structure

\`\`\`
proof-of-skill/
  skills/           # Skill definitions (SKILL.md files)
  core/             # TypeScript modules (metrics store, notifier, optimizer)
  hooks/            # Claude Code hooks (p95 sampling)
  adapters/         # Observability adapters (Langfuse, etc.)
  dashboard/        # Local dashboard (HTML + JS)
  config/           # Default configuration
  docs/             # Documentation and eval scenarios
  tasks/            # Nimbalist task files (roadmap)
  tessl.json        # Skill registry
\`\`\`
```

## Acceptance Criteria

- [ ] CONTRIBUTING.md exists at the project root
- [ ] The document covers: overview, adding skills, writing eval scenarios, code of conduct, PR process, development setup
- [ ] The TDD process for skill creation is explained with both quick (`/create-skill`) and manual paths
- [ ] Eval scenario categories are documented with examples: happy path, edge case, failure mode, ambiguity, adversarial
- [ ] Guidelines distinguish between good and bad scenarios with concrete examples
- [ ] The PR process explains: pre-PR checklist, PR template, review process, and post-merge expectations
- [ ] Code of conduct section sets clear behavioral expectations
- [ ] Development setup section includes: clone, install, symlink, eval, and project structure
- [ ] The tone is welcoming and encouraging without being patronizing
- [ ] All code examples are copy-pasteable and accurate
- [ ] The document links back to the README for installation and architecture context

## Technical Notes

- **CONTRIBUTING.md placement**: Must be at the project root. GitHub will automatically link to it from the "Contributing" tab on the repository page
- **PR template**: Consider also adding a `.github/PULL_REQUEST_TEMPLATE.md` that pre-fills the PR description with the expected sections. This is a stretch goal beyond this task
- **Issue templates**: Similarly, `.github/ISSUE_TEMPLATE/` with templates for bug reports and feature requests would complement the contributing guide. Also a stretch goal
- **License compliance**: The CONTRIBUTING.md should note that contributions are made under the project's MIT license. Contributors should be aware that their work will be MIT-licensed
- **Eval reproducibility**: Mention that eval scenarios should produce consistent results across runs. If a scenario is flaky (different results each time), it is a bad scenario. This is a common pitfall for LLM-based testing
- **Linking**: Link to the README's architecture section so contributors understand the system before diving in. Link to the `tasks/` directory for people looking for specific things to work on

## Verification

```bash
# 1. Verify file exists at project root
ls -la /Users/andrejorgelopes/dev/proof-of-skill/CONTRIBUTING.md
# Expect: File exists

# 2. Verify GitHub rendering
# Push to a branch and view at:
# https://github.com/AndreJorgeLopes/proof-of-skill/blob/main/CONTRIBUTING.md

# 3. Verify all code examples are valid
# Manually try each code block in the document
# Expect: All commands run without syntax errors

# 4. Verify internal links resolve
# Check that links to README.md, tasks/, tessl.json resolve correctly on GitHub

# 5. Verify PR template matches what the document describes
# Open a test PR and verify the description format matches the guide

# 6. Review tone
# Read through as a first-time contributor
# Expect: Feels welcoming, clear, and actionable
```
