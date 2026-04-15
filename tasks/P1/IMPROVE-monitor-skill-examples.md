---
id: IMPROVE-monitor-skill-examples
title: "Add few-shot example and dry-run to monitor-skill"
priority: P1
category: improvement
status: open
depends_on:
  - FEAT-monitor-skill
estimated_effort: S
files_to_touch:
  - skills/monitor-skill/SKILL.md
---

# Improve monitor-skill with Examples and Dry-Run

## Context

Code review of PR #2 (FEAT-monitor-skill) identified that the skill is missing two elements that the project's own skill-writing methodology considers important.

## Problem Statement

1. **No few-shot example**: The `create-skill` SKILL.md includes few-shot examples as a required element for constraining agent behavior. The `monitor-skill` SKILL.md has no concrete example of what a full monitoring session looks like.

2. **No `--dry-run` support**: The task spec's Technical Notes suggested supporting a `--dry-run` flag. For a tool that writes to the user's home directory, dry-run is valuable for transparency.

3. **No explicit constraints section**: While constraints exist throughout the SKILL.md, they are not collected into a canonical "Constraints" section that chains them in layered manner.

## Desired Outcome

- A brief before/after few-shot example showing what a complete `/monitor-skill` session looks like
- `--dry-run` flag support that shows what would be registered without writing files
- An explicit "Constraints" section listing all constraints in chained order

## Acceptance Criteria

- [ ] SKILL.md includes a concrete few-shot example (input → expected output flow)
- [ ] `--dry-run` flag is documented and handled in the argument parsing step
- [ ] Constraints section exists with layered constraint chain
- [ ] Skill name validation note added (guard against path traversal characters)
