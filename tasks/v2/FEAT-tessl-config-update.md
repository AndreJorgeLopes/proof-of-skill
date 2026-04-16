---
id: FEAT-tessl-config-update
title: "Update tessl.json to include monitor-skill"
priority: P1
category: features
status: done
pr: https://github.com/AndreJorgeLopes/proof-of-skill/pull/13
depends_on:
  - FEAT-monitor-skill
estimated_effort: XS
files_to_touch:
  - tessl.json
---

# Update tessl.json for monitor-skill

## Context

`tessl.json` currently only lists `create-skill` and `write-spike`. After PR #2 adds `/monitor-skill`, it should be registered in `tessl.json` so tessl can evaluate it.

## Desired Outcome

```json
{
  "name": "proof-of-skill",
  "version": "0.1.0",
  "skills": ["skills/create-skill", "skills/write-spike", "skills/monitor-skill"]
}
```

## Acceptance Criteria

- [ ] tessl.json includes `skills/monitor-skill` in the skills array
- [ ] JSON is valid
