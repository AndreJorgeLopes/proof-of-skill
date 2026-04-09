---
id: DOCS-readme
title: "Polished README with demos, architecture, and comparison"
priority: P1
category: docs
status: open
depends_on: []
estimated_effort: S
files_to_touch:
  - README.md
---

# Polished README

## Context

The current README is functional but minimal. It explains what proof-of-skill is and how to use `/create-skill`, but it lacks the visual appeal and comprehensive documentation needed for an open-source project to attract contributors and users. A great README is the difference between someone cloning the repo and someone scrolling past it.

## Problem Statement

1. **No visual demos**: Users cannot see what the tool looks like in action without installing it. Animated GIFs showing the TDD cycle would dramatically lower the barrier to trying it
2. **No architecture overview**: Contributors have no way to understand the system structure at a glance. A Mermaid diagram showing the relationship between skills, hooks, store, and monitoring would make the codebase approachable
3. **No installation guide**: The current "Quick Start" assumes the user knows what symlinks are and how Claude Code skills work. A proper installation section with prerequisites, step-by-step instructions, and troubleshooting would reduce friction
4. **No comparison**: Users don't know why they need proof-of-skill. A before/after comparison showing what happens with and without tested skills makes the value proposition concrete
5. **No contribution path**: There is no link to a contributing guide, no explanation of how to add new features, and no code of conduct reference

## Desired Outcome

- A README that serves as both documentation and marketing for the project
- Users can understand the value proposition in 30 seconds (comparison table)
- Users can see the tool in action without installing (GIF demos)
- Users can install and use it in under 2 minutes (installation guide)
- Contributors can understand the architecture at a glance (Mermaid diagram)
- The README links to all relevant resources (contributing guide, roadmap, license)

## Implementation Guide

### Step 1: Project header and badges

```markdown
# proof-of-skill

> *If your skills aren't tested, they're just suggestions.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: v1.0](https://img.shields.io/badge/Status-v1.0-blue.svg)]()

Create, validate, and continuously monitor AI agent skills using TDD principles.
```

### Step 2: Value proposition with comparison table

Create a clear before/after table:

```markdown
## Why proof-of-skill?

| Without proof-of-skill | With proof-of-skill |
|------------------------|---------------------|
| Skills are written once, never tested | Every skill has eval scenarios from day one |
| "It works on my machine" | Empirical scores across model versions |
| Silent degradation after model updates | p95 sampling detects regression in real-time |
| Manual quality checks (if any) | Automated background optimization |
| No visibility into skill health | Dashboard with trends, scores, and alerts |
| Skills are documentation | Skills are tested, measured infrastructure |
```

### Step 3: Animated GIF demos

Record and include GIF demos for:

1. **`/create-skill` TDD cycle**: Show the interview, RED phase (baseline failures), GREEN phase (skill creation), and REFACTOR phase (eval iteration)
2. **`/monitor-skill` registration**: Show adding a skill to monitoring and the baseline capture
3. **Dashboard view**: Show the local dashboard with score trends and invocation charts

Place GIFs in `docs/assets/` and reference them:

```markdown
## See It in Action

### Creating a skill with TDD
![create-skill demo](docs/assets/create-skill-demo.gif)

### Monitoring an existing skill
![monitor-skill demo](docs/assets/monitor-skill-demo.gif)
```

Note: GIF recording can be done with tools like `vhs` (Charm), `terminalizer`, or `asciinema` + `agg`.

### Step 4: Installation guide

```markdown
## Installation

### Prerequisites
- [Claude Code](https://claude.ai/claude-code) (v1.0+)
- [tessl](https://tessl.io) CLI installed and authenticated
- Node.js 18+ (for the metrics store and dashboard)

### Quick Install
\`\`\`bash
git clone https://github.com/AndreJorgeLopes/proof-of-skill.git
cd proof-of-skill
./install.sh
\`\`\`

### Manual Install
\`\`\`bash
git clone https://github.com/AndreJorgeLopes/proof-of-skill.git
cd proof-of-skill

# Symlink skills into Claude Code
ln -sf $(pwd)/skills/create-skill ~/.claude/skills/create-skill
ln -sf $(pwd)/skills/monitor-skill ~/.claude/skills/monitor-skill

# Install the p95 sampling hook
cp hooks/skill-complete.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/skill-complete.sh

# Verify installation
tessl status
\`\`\`
```

### Step 5: Command reference

Document all commands with usage examples, arguments, and options:

```markdown
## Commands

### `/create-skill`
### `/monitor-skill`
```

Each command section should include: description, syntax, examples, and options.

### Step 6: Architecture diagram

Create a Mermaid diagram showing the full system:

```markdown
## Architecture

\`\`\`mermaid
graph TD
    A["/create-skill"] -->|TDD cycle| B["SKILL.md"]
    B -->|register| C["/monitor-skill"]
    C -->|writes config| D["monitored-skills.json"]
    D -->|reads| E["p95 Hook"]
    E -->|samples 1-in-20| F["tessl eval --quick"]
    F -->|records| G["SQLite Store"]
    G -->|serves| H["Dashboard"]
    F -->|below threshold| I["Notifier"]
    I -->|spawns| J["Background Optimizer"]
    J -->|ralph-loop| F
\`\`\`
```

### Step 7: Roadmap and contributing links

```markdown
## Roadmap

See [`tasks/`](tasks/) for the full v1.0 roadmap as Nimbalist task files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add skills, write eval scenarios, and submit PRs.

## License

MIT
```

## Acceptance Criteria

- [ ] README includes a clear one-liner description and project badges
- [ ] README includes a before/after comparison table showing the value of proof-of-skill
- [ ] README includes placeholder references for animated GIF demos (with recording instructions in comments)
- [ ] README includes a complete installation guide with prerequisites, quick install, and manual install
- [ ] README includes a command reference section documenting `/create-skill` and `/monitor-skill`
- [ ] README includes a Mermaid architecture diagram showing the full system flow
- [ ] README includes links to the roadmap (`tasks/`), contributing guide, and license
- [ ] README is well-formatted with consistent heading levels, proper code blocks, and no broken links
- [ ] README works well on GitHub (Mermaid renders, badges display, relative links resolve)
- [ ] The tone is professional but approachable, matching the "If your skills aren't tested, they're just suggestions" voice

## Technical Notes

- **Mermaid diagrams**: GitHub natively renders Mermaid in markdown files. No external tool needed. Test rendering by pushing to a branch and viewing on GitHub
- **GIF demos**: Use `vhs` (https://github.com/charmbracelet/vhs) for reproducible terminal recordings. VHS uses a tape file format that can be version-controlled. Alternatively, `asciinema rec` + `agg` for GIF conversion
- **Badge images**: Use shields.io for consistent badge styling. The MIT license badge URL is standard. Add more badges as the project matures (CI status, npm version, etc.)
- **Relative links**: Use relative paths for all internal links (`[CONTRIBUTING](CONTRIBUTING.md)`, `[tasks](tasks/)`) so they work both on GitHub and locally
- **README length**: Aim for a README that is comprehensive but scannable. Use collapsible sections (`<details>`) for lengthy content like full configuration references
- **SEO**: Include relevant keywords naturally: "AI agent skills", "TDD", "Claude Code", "skill testing", "quality monitoring". This helps with GitHub search and Google indexing

## Verification

```bash
# 1. Verify README renders correctly on GitHub
# Push to a branch and view at:
# https://github.com/AndreJorgeLopes/proof-of-skill/blob/main/README.md

# 2. Verify Mermaid diagram renders
# GitHub should display the diagram as a visual graph, not raw code

# 3. Verify all internal links resolve
# Click each link in the rendered README: tasks/, CONTRIBUTING.md, LICENSE

# 4. Verify badges display
# The MIT badge should show as a colored shield, not broken image

# 5. Verify code blocks are properly formatted
# All code blocks should have syntax highlighting (bash, markdown, etc.)

# 6. Verify mobile rendering
# View the README on a mobile device or narrow browser window
# Tables and code blocks should not break the layout
```
