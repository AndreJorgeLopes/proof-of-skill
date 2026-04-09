# proof-of-skill

> *If your skills aren't tested, they're just suggestions.*

Create, validate, and continuously monitor AI agent skills using TDD principles.

## What Is This?

**proof-of-skill** applies software engineering discipline to AI agent skills. Skills are documentation — but untested documentation drifts, rationalizes, and silently degrades. This project treats skills the way TDD treats code: write a failing test first, write the minimal skill to pass it, then refine until bulletproof.

## Status: MVP

Currently contains `/create-skill` — a TDD-based skill creation workflow combining:

- **superpowers:writing-skills** — RED-GREEN-REFACTOR cycle for documentation
- **tessl skill-optimizer** — empirical validation with automated eval scenarios
- **ralph-loop** — iterative self-improvement loops

## Quick Start

```bash
# Clone
git clone https://github.com/AndreJorgeLopes/proof-of-skill.git
cd proof-of-skill

# Symlink into Claude Code
ln -sf $(pwd)/skills/create-skill ~/.claude/skills/create-skill

# Create your first skill
/create-skill my-new-skill I want a skill that helps me write better commit messages
```

## Commands

### `/create-skill`

Creates a new skill through a structured TDD process:

1. **Interview** — understands what the skill should do (one question at a time)
2. **Discovery** — checks if a similar skill already exists
3. **RED** — writes pressure scenarios, runs them without the skill, documents baseline failures
4. **GREEN** — writes minimal SKILL.md addressing those specific failures
5. **REFACTOR** — runs tessl eval, iterates with ralph-loop until score >= 85%

```
/create-skill                              # starts interview
/create-skill code-review                  # names the skill upfront
/create-skill code-review I want it to...  # provides context inline
```

### `/monitor-skill` (v1.0 — coming soon)

Adds any existing skill to continuous p95 quality monitoring.

```
/monitor-skill grill-me
/monitor-skill grill-me When given a vague plan, does it push back hard enough?
```

## Principles

Inspired by the [Latent Space & Effective LLM Use](https://example.com) visual guide:

- **Precise coordinates** — every skill uses persona stacking + constraint chaining to navigate to rare, high-value regions of the model's capability space
- **Tested, not assumed** — a perfect review score doesn't mean your skill works. Empirical evals do.
- **Self-healing** — skills that degrade get automatically flagged and optimized in background sessions

## Roadmap

See `tasks/` for the v1.0 roadmap as Nimbalist task files.

| Milestone | Status | Description |
|-----------|--------|-------------|
| MVP | Current | `/create-skill` with TDD + tessl + ralph-loop |
| v1.0 | Planned | `/monitor-skill`, p95 hooks, SQLite metrics, dashboard |
| v1.1 | Future | Langfuse adapter, cross-model testing |

## License

MIT
