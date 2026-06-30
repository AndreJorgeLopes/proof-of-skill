Now I have full context. Let me produce the audit report:

---

## Determinism Audit: optimize-skill

### Findings

| ID | Location | Axis | Severity | Effort | Nondeterminism | Deterministic fix |
|----|----------|------|----------|--------|----------------|-------------------|
| D1 | Step 1, parse invocation args | offload | high | S | `max-iters=N` and `target=N` extracted from `$ARGUMENTS` by model reading prose | `[[ "$ARGUMENTS" =~ max-iters=([0-9]+) ]] && MAX_ITERS="${BASH_REMATCH[1]}"` |
| D2 | Step 2, Hindsight recall tags | offload | low | S | "the skill's name" extracted by model judgment | `SKILL_NAME=$(basename "$skill_dir")` |
| D3 | Step 4, Tessl suggestions ranking | offload | medium | S | "ranked by their attached impact" — model re-orders the JSON array by reading | `jq '.suggestions | sort_by(-.impact // 0)' /tmp/score-baseline.json` |
| D4 | Step 6, cross-file reference check | offload | high | M | "bundle file references pointing nowhere" — model mentally checks link targets | `grep -oE '\[.*\]\([^)]+\.md\)' SKILL.md | grep -oE '\([^)]+\)' | tr -d '()' | while read f; do [ -f "$skill_dir/$f" ] \|\| echo "BROKEN: $f"; done` |
| D5 | Step 6, frontmatter validity check | offload | high | S | "frontmatter validity on every file" — model eyeballs YAML headers | `for f in "$skill_dir"/*.md; do python3 -c "import yaml; yaml.safe_load(open('$f').read())" \|\| echo "INVALID_YAML: $f"; done` |
| D6 | Step 7, final report format | constrain | medium | M | Report schema unconstrained: "initial → final score, iterations kept / reverted / total..." — model narrates differently each run | Pin format: `SCORE_0=N SCORE_F=N kept=N reverted=N total=N`; add "output only the block, no prose, no fences" |

### Findings (machine-readable)

```yaml
skill: optimize-skill
findings:
  - id: D1
    location: "step 1, parse invocation args"
    axis: offload
    severity: high
    effort: S
    nondeterminism: "max-iters=N and target=N extracted from $ARGUMENTS by model reading"
    fix: "bash regex: [[ $ARGUMENTS =~ max-iters=([0-9]+) ]] && MAX_ITERS=${BASH_REMATCH[1]}"
  - id: D2
    location: "step 2, hindsight recall tags"
    axis: offload
    severity: low
    effort: S
    nondeterminism: "skill name for Hindsight tag derived by model judgment"
    fix: "SKILL_NAME=$(basename \"$skill_dir\")"
  - id: D3
    location: "step 4, tessl suggestions ranking"
    axis: offload
    severity: medium
    effort: S
    nondeterminism: "ranked by attached impact — model re-orders JSON array"
    fix: "jq '.suggestions | sort_by(-.impact // 0)' /tmp/score-baseline.json"
  - id: D4
    location: "step 6, cross-file reference check"
    axis: offload
    severity: high
    effort: M
    nondeterminism: "bundle file references checked by model mentally inspecting links"
    fix: "grep+test loop: grep -oE link targets, test -f each against skill_dir"
  - id: D5
    location: "step 6, frontmatter validity check"
    axis: offload
    severity: high
    effort: S
    nondeterminism: "YAML frontmatter validity eyeballed by model"
    fix: "python3 yaml.safe_load per *.md file in skill_dir"
  - id: D6
    location: "step 7, final report"
    axis: constrain
    severity: medium
    effort: M
    nondeterminism: "report format unconstrained — prose order varies per run"
    fix: "pin schema: SCORE_0=N SCORE_F=N kept=N reverted=N total=N; forbid fences"
```

### Assertions → `/Users/andrejorgelopes/dev/proof-of-skill/skills/optimize-skill/determinism.promptfooconfig.yaml`

Existing config (2 tests for D5/D6 abort path) confirmed **green** (2/2 passed). No changes needed; config already written and verified.

The existing assertions cover:
- **D5-abort path**: validation failure outputs `ABORT: <reason>` with no fences (regex matches `not found|does not exist|tessl|jq|write access|TESSL_WORKSPACE`)
- **D6-abort+validate paths**: output matches `score|SCORE|tessl|Baseline|baseline|validation|Validate|abort|Abort` with no fences

D1–D4 are Axis A (offload) findings; their assertions are bats tests, emitted below as "apply after refactor":

```bash
# apply after D1 refactor lands in run-skill.sh / step 1 parse block
@test "parse max-iters arg" {
  run bash -c 'ARGUMENTS="max-iters=7" && [[ "$ARGUMENTS" =~ max-iters=([0-9]+) ]] && echo "${BASH_REMATCH[1]}"'
  [ "$output" = "7" ]
}
@test "parse target arg" {
  run bash -c 'ARGUMENTS="target=92" && [[ "$ARGUMENTS" =~ target=([0-9]+) ]] && echo "${BASH_REMATCH[1]}"'
  [ "$output" = "92" ]
}

# apply after D5 refactor
@test "frontmatter valid SKILL.md" {
  run python3 -c "import yaml; yaml.safe_load(open('SKILL.md').read().split('---',2)[1])"
  [ "$status" -eq 0 ]
}
@test "frontmatter invalid file caught" {
  echo -e "---\nkey: [unclosed" > /tmp/bad.md
  run python3 -c "import yaml,sys; yaml.safe_load(open('/tmp/bad.md').read())"
  [ "$status" -ne 0 ]
}
```

### ROI

Top fix: **D1** (severity=high, effort=S) — arg parsing for `max-iters`/`target` in step 1; a misread produces wrong iteration cap and wrong score target silently.

Order: D1 > D5 > D4 > D3 > D6 > D2
