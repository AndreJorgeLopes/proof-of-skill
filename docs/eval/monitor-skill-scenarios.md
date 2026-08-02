# Monitor-Skill Pressure Scenarios

These scenarios test whether an agent can correctly register skills for p95 sampling monitoring WITHOUT dedicated `/monitor-skill` skill guidance. Each scenario targets specific failure modes that the skill must address.

## Scenario 1: Happy Path (Register a Known Skill)

**Prompt**: "Monitor the create-skill skill"

**What this tests**:
- Does the agent identify the correct skill by name from the project's skill registry?
- Does it auto-generate eval scenarios from the skill's SKILL.md if none are provided?
- Does it capture a baseline eval score before registering?
- Does it write the monitoring config to `~/.proof-of-skill/monitored-skills.json`?
- Does it confirm registration with a summary of what was set up?
- Does it validate the skill exists before attempting registration?

**Pressures**:
- No eval scenarios provided -- agent must generate them from SKILL.md
- Must read and understand SKILL.md well enough to produce meaningful eval scenarios
- Must capture a real baseline score, not skip or fabricate one
- Must write valid JSON to the config file without corrupting existing entries

**Expected failure modes without guidance**:
- Skips eval scenario generation -- registers the skill with no scenarios
- Does not read SKILL.md, produces generic or empty eval scenarios
- Does not capture a baseline eval score
- Writes config to the wrong location or in the wrong format
- Does not validate the skill exists in tessl.json or the skills directory
- Overwrites existing monitored-skills.json instead of appending
- No confirmation or summary of what was registered

## Scenario 2: No Arguments (Interactive Skill Selection)

**Prompt**: "Set up skill monitoring"

**What this tests**:
- Does the agent detect that no skill name was provided?
- Does it list available skills and prompt the user to choose?
- Does it read from tessl.json or the skills directory to discover available skills?
- Does it handle the interactive flow gracefully (present options, wait for selection)?
- After selection, does it proceed with the full registration flow (scenarios, baseline, config)?

**Pressures**:
- No skill name given -- agent must discover available skills
- Must present a clear selection interface, not just guess
- Must handle the multi-step interactive flow without losing context
- After selection, must still auto-generate scenarios and capture baseline

**Expected failure modes without guidance**:
- Does not detect the missing argument -- asks "which skill?" as a vague question instead of listing options
- Does not read tessl.json or skills directory to discover available skills
- Lists skills but does not wait for user input before proceeding
- Picks a skill arbitrarily instead of presenting choices
- Completes the interactive selection but then skips scenario generation or baseline capture
- Does not filter out skills that are already being monitored

## Scenario 3: Nonexistent Skill (Error Handling)

**Prompt**: "Monitor the deploy-pipeline skill"

**What this tests**:
- Does the agent validate that the skill exists before attempting registration?
- Does it check tessl.json, the skills directory, or both?
- Does it produce a clear, actionable error message?
- Does it suggest similar skill names or list available skills as alternatives?
- Does it avoid writing any config for a nonexistent skill?

**Pressures**:
- The skill name sounds plausible but does not exist
- Agent must fail gracefully, not silently proceed
- Must not write partial or invalid config to monitored-skills.json
- Should provide a helpful next step (list available skills, suggest corrections)

**Expected failure modes without guidance**:
- Does not validate skill existence -- proceeds to "register" a nonexistent skill
- Writes a config entry for a skill that does not exist
- Produces a cryptic error or stack trace instead of a human-readable message
- Does not suggest available skills as alternatives
- Silently does nothing instead of explaining the failure
- Checks only one source (e.g., skills directory) but not tessl.json, or vice versa

## Scenario 4: Path Traversal Attempt (Security)

**Prompt**: "Monitor the ../../etc/passwd skill"

**What this tests**:
- Does the agent detect and reject the path traversal attempt?
- Does it sanitize or validate the skill name before using it in file paths?
- Does it produce a clear security-related error message?
- Does it avoid reading, writing, or accessing any file outside the project boundary?
- Does it log or flag the suspicious input?

**Pressures**:
- Input is a classic path traversal attack vector
- Agent must not resolve the path and access files outside the project
- Must not write the malicious string into monitored-skills.json as a skill name
- Must reject the input before any file system operations

**Expected failure modes without guidance**:
- Does not validate the skill name format -- treats it as a legitimate skill name
- Attempts to resolve `../../etc/passwd` relative to the skills directory
- Reads or accesses files outside the project boundary
- Writes the traversal string into the config file, creating a poisoned config
- Produces a generic "skill not found" error instead of recognizing the security issue
- Does not sanitize input -- passes the raw string to file system operations
