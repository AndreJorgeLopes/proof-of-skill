# Contributing to proof-of-skill

Thanks for considering a contribution. proof-of-skill applies TDD to AI agent skills, and we hold contributions to the same standard: every skill must be tested, every change must be validated empirically, and every PR must demonstrate that it works. No exceptions.

If you've read the [README](README.md) and understand the baseline-first philosophy, you're ready to contribute.

## Ways to Contribute

- **Add a new skill** -- Create a skill and its eval scenarios using `/create-skill`
- **Improve eval scenarios** -- Add edge cases, failure modes, or adversarial inputs to existing skills
- **Build an adapter** -- Connect proof-of-skill to your observability platform
- **Improve core** -- Enhance the metrics store, dashboard, hooks, or optimizer
- **Fix bugs** -- Found something broken? PRs welcome
- **Improve docs** -- Typos, unclear sections, missing examples

Check the [`tasks/`](tasks/) directory for the full v1.0 roadmap. Each task file contains detailed implementation guides, acceptance criteria, and verification steps. If something interests you, open an issue to claim it.

---

## Adding a New Skill

This is the most common contribution. proof-of-skill uses TDD for skill creation -- you write failing scenarios *before* you write the skill.

### Quick path (recommended)

Use `/create-skill` to go through the full TDD process interactively:

```
/create-skill my-new-skill I want a skill that does X
```

This walks you through **interview, discovery, baseline testing, skill writing, and empirical evaluation.** Each step is mandatory. The workflow handles file placement, scenario creation, and tessl registration automatically.

### Manual path

If you prefer to work step by step:

**1. Create the skill directory**

```bash
mkdir -p skills/my-new-skill
```

**2. Write eval scenarios first** (this is not optional)

Create `docs/eval/my-new-skill-scenarios.md`:

```markdown
# My-New-Skill Pressure Scenarios

## Scenario 1: [Descriptive Name]

**Prompt**: "[Exact text a user would type]"

**What this tests**:
- [Specific capability being evaluated]
- [Another capability]

**Pressures**:
- [What makes this scenario hard]
- [What shortcuts an agent might take]

**Expected failure modes without guidance**:
- [What happens without the skill]
- [Another expected failure]
```

Write at least 3 scenarios covering different failure modes. See [`docs/eval/create-skill-scenarios.md`](docs/eval/create-skill-scenarios.md) for a concrete example.

**3. Run the baseline (RED phase)**

Run your scenarios *without* the skill loaded. Document what the agent actually does in `docs/eval/my-new-skill-baseline.md`. This is the most important step -- you cannot fix what you have not observed.

See [`docs/eval/create-skill-baseline.md`](docs/eval/create-skill-baseline.md) for the level of detail expected: actual agent behavior traces, not hypothetical failures.

**4. Write the minimal SKILL.md (GREEN phase)**

Create `skills/my-new-skill/SKILL.md`:

```markdown
---
name: my-new-skill
description: One-line description of when to use this skill
---

# My New Skill

## When to Use

- [Trigger condition 1]
- [Trigger condition 2]

## Process

### Step 1: [Name]
[Instructions that address observed baseline failures]

### Step 2: [Name]
[More instructions -- only what is needed to fix observed failures]
```

Address **only** the failures you observed in the baseline. Do not add features that the baseline did not reveal as needed.

**5. Register in tessl.json**

Add your skill to the `skills` array:

```json
{
  "name": "proof-of-skill",
  "version": "0.1.0",
  "skills": ["skills/create-skill", "skills/write-spike", "skills/my-new-skill"]
}
```

**6. Evaluate (REFACTOR phase)**

```bash
tessl eval run --skill my-new-skill
```

Iterate until your score is **>= 85%.** If you're stuck, use `ralph-loop` to auto-diagnose and fix.

### Skill checklist

Before opening a PR for a new skill, verify:

- [ ] `skills/<name>/SKILL.md` exists with YAML frontmatter (`name`, `description`)
- [ ] `docs/eval/<name>-scenarios.md` has 3+ pressure scenarios
- [ ] `docs/eval/<name>-baseline.md` documents actual baseline behavior
- [ ] `tessl.json` includes the skill in the `skills` array
- [ ] `tessl eval` score >= 85%

---

## Writing Eval Scenarios

Eval scenarios are the most valuable contribution you can make. A skill is only as good as its tests.

### Scenario categories

Every skill should have scenarios in at least these categories:

| Category | Purpose | Example |
|----------|---------|---------|
| **Happy path** | Standard use case works correctly | "Create a skill for code review" |
| **Edge case** | Boundary conditions are handled | Empty input, very long input, special characters |
| **Failure mode** | Graceful degradation under problems | Dependency unavailable, invalid config |
| **Ambiguity** | Unclear input is clarified, not assumed | Vague request that needs clarification |
| **Adversarial** | Misuse is resisted | Input designed to bypass constraints |

### What makes a good scenario

- **Specific.** "When given a skill name that matches an existing skill" not "handles duplicates."
- **Observable.** The expected behavior can be verified by reading the output.
- **Independent.** Each scenario tests one thing. Don't combine concerns.
- **Realistic.** Use inputs that real users would provide, not contrived test strings.
- **Multi-pressure.** The best scenarios combine multiple pressures: vague input *plus* a familiar domain, existing overlap *plus* complex scope. Single-pressure scenarios are too easy to pass by accident.
- **Reproducible.** Scenarios should produce consistent results across runs. If a scenario gives different results each time, it is too loosely defined.

### What makes a bad scenario

- **Vague.** "Works correctly" -- what does "correctly" mean?
- **Redundant.** Testing the same thing as another scenario with trivially different input.
- **Impossible.** Testing behavior that no skill could reasonably achieve.
- **Implementation-coupled.** Testing specific wording rather than intent. Skills should be judged on *what* they do, not *how* they phrase it.

### Example: real scenario from create-skill

From [`docs/eval/create-skill-scenarios.md`](docs/eval/create-skill-scenarios.md):

```markdown
## Scenario 3: Existing Skill Overlap

**Prompt**: "Create a skill for writing implementation plans"

**What this tests**:
- Does the agent search for existing skills before creating a new one?
- Does it detect that `superpowers:writing-plans` already exists?
- Does it suggest extending/wrapping the existing skill instead of creating a duplicate?

**Expected failure modes without guidance**:
- Agent creates a brand new skill without checking for existing ones
- Duplicates functionality that already exists
- No awareness of the skill ecosystem
```

Notice: the scenario uses a *real* prompt a user would type, targets a *specific* failure mode (duplication), and the expected failures describe *observable* behaviors.

---

## Core Development

For changes to proof-of-skill itself (not adding skills), here is what you need to know.

### Project structure

```
proof-of-skill/
├── README.md
├── CONTRIBUTING.md              # You are here
├── LICENSE                      # MIT
├── install.sh                   # One-liner installer with auto-update
├── tessl.json                   # Skill registry for eval
│
├── skills/
│   ├── create-skill/
│   │   └── SKILL.md             # TDD skill creation (86% eval score)
│   └── write-spike/
│       └── SKILL.md             # Technical investigation framework
│
├── docs/
│   ├── eval/
│   │   ├── create-skill-scenarios.md
│   │   ├── create-skill-baseline.md
│   │   ├── write-spike-scenarios.md
│   │   └── write-spike-baseline.md
│   └── images/                  # Diagrams (PNG + Excalidraw sources)
│
└── tasks/                       # v1.0 roadmap (Nimbalist task files)
    ├── P1/                      # MVP completion
    ├── P2/                      # Core features
    └── P3/                      # Advanced features
```

### v1.0 roadmap

The v1.0 chain adds continuous monitoring to proof-of-skill: skills that detect their own degradation and trigger automatic optimization. The full roadmap lives in [`tasks/`](tasks/), organized by priority:

| Priority | Key Features |
|:--------:|-------------|
| **P1** | `/monitor-skill` command, p95 hooks, SQLite metrics store |
| **P2** | Degradation alerts, Langfuse adapter, background optimization |
| **P3** | Cross-model eval, dashboard, this contributing guide |

Each task file contains the problem statement, implementation guide, acceptance criteria, and verification steps. Read the task file before starting work.

### Architecture

proof-of-skill builds on four external tools. Understanding their roles is important for core contributions:

| Tool | Role |
|------|------|
| [tessl](https://github.com/AndreJorgeLopes/tessl) | Empirical skill evaluation -- runs pressure scenarios, measures quality |
| [ralph-loop](https://github.com/anthropics/claude-plugins-public/tree/main/plugins/ralph-loop) | Iterative self-improvement -- auto-diagnose + fix + re-eval loop |
| [devflow](https://github.com/AndreJorgeLopes/devflow) | AI dev environment -- persistent memory (Hindsight), session management |
| [Hindsight](https://github.com/vectorize-io/hindsight) | 3-tier memory system for recalling learnings across sessions |

See the [README architecture section](README.md#architecture) for detailed diagrams showing how these pieces connect.

---

## Development Setup

```bash
# Clone the repo
git clone https://github.com/AndreJorgeLopes/proof-of-skill.git
cd proof-of-skill

# Symlink skills for local testing
./install.sh

# Run eval scenarios
tessl eval run --all

# Review a specific skill
tessl skill review skills/create-skill/SKILL.md
```

**Prerequisites:** [git](https://git-scm.com/), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and [devflow](https://github.com/AndreJorgeLopes/devflow).

---

## Pull Request Process

### Before opening a PR

1. **Run eval scenarios** for any skills you changed or added: `tessl eval run --skill <name>`
2. **Check that scores are >= 85%** for all affected skills
3. **Ensure new skills have scenarios** -- PRs adding skills without eval scenarios will be asked to add them
4. **Update `tessl.json`** if you added a new skill
5. **Verify the installer** still works if you changed `install.sh`

### Fork, branch, implement, test, PR

```bash
# Fork on GitHub, then:
git clone https://github.com/<your-username>/proof-of-skill.git
cd proof-of-skill
git checkout -b feat/my-new-skill

# ... implement using /create-skill or manually ...

# Run evals
tessl eval run --skill my-new-skill

# Push and open PR
git push -u origin feat/my-new-skill
```

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| New skill | `feat/<skill-name>` | `feat/code-review` |
| Eval improvements | `eval/<skill-name>` | `eval/create-skill-edge-cases` |
| Bug fix | `fix/<description>` | `fix/install-symlink-path` |
| Documentation | `docs/<description>` | `docs/contributing-guide` |
| Core feature | `feat/<feature-name>` | `feat/metrics-store` |

### PR description

Your PR description should include:

- **What**: One sentence describing the change
- **Why**: What problem this solves or what value it adds
- **How**: Brief technical approach (for non-trivial changes)
- **Eval results**: Paste the `tessl eval` output showing scores (for skill PRs)

### What reviewers look for

- **Skills have eval scenarios.** No scenarios, no merge. This is non-negotiable.
- **Baselines are documented.** If you're adding a skill, the PR should include baseline behavior showing what happens *without* the skill.
- **Eval score >= 85%.** We run the eval scenarios independently to verify.
- **Minimal scope.** Skills should address observed failures, not imagined ones. If a feature wasn't revealed by the baseline, it probably doesn't belong.
- **Accurate file references.** Skills that reference nonexistent files or incorrect paths will be caught.

### Review timeline

1. A maintainer will review within 48 hours
2. For new skills: we run the eval scenarios independently to verify scores
3. For core changes: we review for backward compatibility
4. Iteration is normal -- most PRs need 1-2 rounds of feedback

### After merge

- Your skill becomes available to all proof-of-skill users via `install.sh`
- You'll be credited in the changelog
- If monitoring is set up (v1.0), your skill will be continuously validated

---

## Code of Conduct

- Be kind and constructive in reviews and discussions
- Assume good intent from other contributors
- Focus on the work, not the person
- Disagreements about technical approach are welcome; personal attacks are not
- If you see problematic behavior, contact the maintainers directly

---

## License

By contributing to proof-of-skill, you agree that your contributions will be licensed under the [MIT License](LICENSE).
