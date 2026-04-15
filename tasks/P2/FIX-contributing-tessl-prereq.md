---
id: FIX-contributing-tessl-prereq
title: "Add tessl to CONTRIBUTING.md prerequisites"
priority: P2
category: docs
status: done
depends_on:
  - DOCS-contributing
estimated_effort: XS
files_to_touch:
  - CONTRIBUTING.md
---

# Add tessl to CONTRIBUTING.md Prerequisites

## Context

Code review of PR #3 (DOCS-contributing) identified that the Development Setup section lists prerequisites as "git, Claude Code, and devflow" but does not mention tessl, even though eval commands appear throughout the document.

## Problem Statement

A contributor following only CONTRIBUTING.md would hit `tessl: command not found` when trying to run evals. This is the most common action a contributor would take.

## Desired Outcome

- tessl is listed as a prerequisite with installation instructions
- The `tessl eval run` commands in the document are contextualized

## Acceptance Criteria

- [ ] tessl is mentioned in the prerequisites section
- [ ] Installation instructions or link to tessl docs provided
- [ ] No other broken prerequisite assumptions
