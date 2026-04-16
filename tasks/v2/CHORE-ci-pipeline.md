---
id: CHORE-ci-pipeline
title: "GitHub Actions CI pipeline for PR validation"
priority: P1
category: chore
status: done
pr: https://github.com/AndreJorgeLopes/proof-of-skill/pull/12
depends_on: []
estimated_effort: S
files_to_touch:
  - .github/workflows/ci.yml
---

# GitHub Actions CI Pipeline

## Context

proof-of-skill has 11 open PRs from the v1.0 autonomous coordination run (April 15, 2026) but no automated CI to validate them. There is no way to know if PRs introduce syntax errors, broken skills, or invalid configurations without manual review.

## Problem Statement

1. **No automated validation**: PRs are merged based on manual review alone
2. **No tessl eval on CI**: The project uses `tessl` for skill evaluation but it never runs automatically
3. **No syntax/lint checks**: Shell scripts (install.sh, hooks) and YAML configs have no validation
4. **No PR status checks**: GitHub shows no green/red checks on PRs

## Desired Outcome

- GitHub Actions workflow that runs on PR and push to main
- Validates: shell script syntax (shellcheck), YAML validity, skill file structure
- Runs `tessl eval` if tessl is available (graceful skip if not)
- Lightweight: no heavy dependencies, fast execution

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` exists and passes on main
- [ ] Workflow triggers on PR to main and push to main
- [ ] Shell scripts validated with shellcheck
- [ ] tessl.json validated as valid JSON
- [ ] Skill SKILL.md files validated for required frontmatter (name, description)
- [ ] Workflow completes in under 2 minutes

## Implementation Notes

- Keep it simple: bash-based checks, no complex tooling
- tessl may not be available in CI; make eval step optional
- Consider caching for any installed tools
