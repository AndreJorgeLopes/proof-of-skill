# optimize-skill — reference material

Bundle file loaded by `SKILL.md` when more context is needed. Contains: empirical evidence from the seed run, rationalization counters, and common mistakes.

## Empirical evidence (2026-05-11 seed run)

This skill's design is grounded in a real session that built and optimized `~/dev/devflow/skills/review/SKILL.md`. The iteration log:

| Iteration | Change | Score | Decision | Why |
|-----------|--------|-------|----------|-----|
| Baseline | initial 278-line write | 90% | — | starting point |
| A | `tessl skill review --optimize --yes` (consolidates SoT + removes filler phrases) | **86%** | **REVERTED** | hard gate G1: 86 < 90 |
| B | manual SoT consolidation | n/a | SKIPPED | iteration A already proved this regresses |
| C | extract `AGENTS.md` + `TEMPLATES.md` (agent defs + templates) | 90% | **KEPT** | plateau ≥ baseline; structural quality improved |
| D | move scoring + output template into `TEMPLATES.md` | 90% | **KEPT** | plateau; SKILL.md slimmed further (195 → 141 lines) |
| Spec-review | subagent flagged bash 3.2 unsafe array expansion in caller code | n/a | FIXED | G6: independent verification catches author bias |

Net result: SKILL.md went from 278 → 141 lines (-49%), bundle files filled out, score held at 90%, one defensive bug surfaced and applied. **Total iterations to plateau: 4. Hard reverts: 1. Final score: same as baseline. Structural improvement: significant.**

## Rationalization counters

Any of these thoughts mean: STOP, revert the current iteration, re-evaluate.

| If you think... | The reality is... |
|---|---|
| "The score went down by only 1 point, it's fine" | G1 says ≥. 1 point down is a regression. Revert. |
| "Tessl's optimizer wouldn't suggest this if it hurt" | It would, and it has (90→86 in the empirical record). Re-score every time. |
| "The score plateau means I should keep changing things" | Plateau confirms the change was at least neutral. Move to the next candidate; don't undo the plateau iteration. |
| "I can skip the subagent review, I've been over this" | The author has the worst judgment of their own work. Dispatch the subagent anyway. |
| "These suggestions are about a different skill, I'll just apply them all at once" | Tessl's suggestions vary per file. Apply iteratively, re-score between each. |
| "max-iters=4 is too few" | If 4 ROI-ranked candidates don't help, the skill is near its score ceiling. Stop. |
| "I'll just rewrite the whole thing from scratch" | You'll lose the prior empirical evidence baked into the existing skill. Iterate, don't replace. |

## Common mistakes

- **Skipping the snapshot step** — regression becomes unrecoverable; a single bad edit destroys work
- **Mixing `score` and `weightedScore` between iterations** — pick one (recommend `weightedScore`) and stick with it
- **Applying multiple candidates between re-scores** — you can't attribute regression to a specific change
- **Trusting the spec doc over the rubric** — Tessl's scoring rubric is the empirical truth for this run; spec docs describe intent
- **Touching the description if it's already at 100%** — the only direction is down
- **Forgetting bundle files exist when iterating** — Tessl reviews SKILL.md, but the agent at runtime reads SKILL.md + siblings. Optimize the agent experience, not just the score.
