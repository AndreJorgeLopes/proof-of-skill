# Determinism pattern catalog + assertion recipes

Reference for `determinize-skill`. Walk the target skill step by step; for each step,
check every pattern below.

## Pattern catalog

| # | Smell in the SKILL.md | Axis | Deterministic fix | Assertion |
|---|------------------------|------|-------------------|-----------|
| 1 | English classification: "`x.com` → foo, `y.com` → bar" | offload | `case`/assoc-array lookup | bats: input→label |
| 2 | Fuzzy quantifier: "most specific", "significant words", "clear winner", "if confident" | offload | fixed numeric threshold / explicit rule | bats: boundary cases |
| 3 | Judgment scoring/ranking: HIGH/MED/LOW "by relevance" | offload | weighted integer rules + fixed cutoffs | bats: known input→score |
| 4 | Parse structured data by reading (URL, JSON, path) | offload | `sed`/`jq`/`grep -oE` | bats: parse cases |
| 5 | Result/return block with no schema | constrain | pin exact format; "output only the block, no prose, no fences" | promptfoo: `regex`/`is-json`/`not-icontains "\`\`\`"` |
| 6 | Ordering / dedup "as appropriate" | offload | `sort`/`sort -u`/explicit sort key | bats: order stable |
| 7 | ID/token extraction: "the ticket id", "the branch name" | offload | `grep -oE '[A-Z]+-[0-9]+'`, `git rev-parse --abbrev-ref HEAD` | bats: extraction |
| 8 | Counting/stats narrated in prose ("summarize how many…") | offload | `git rev-list --count`, `wc -l`, `git diff --stat` | bats: count |
| 9 | Branch/state guards in English ("if on protected branch") | offload | `case "$BRANCH" in main\|master)` | bats: guard fires |

**Do NOT flag** (these stay model-driven): brainstorming, prose/spec review,
naming/wording choices, design trade-offs, anything genuinely requiring judgment.
Determinism is for *computable* work only.

## Severity / effort rubric (fixed, not by feel)

- **Severity high**: wrong result cascades (e.g. platform misdetect → wrong CLI). 
  **medium**: degrades quality but recoverable. **low**: cosmetic/format only.
- **Effort S**: ≤10 lines, one function. **M**: a helper + wiring. **L**: restructures the skill.
- **ROI order** = severity desc, then effort asc (high+S first).

## promptfoo assertion template (Axis B — write to target skill dir)

`<skill-dir>/determinism.promptfooconfig.yaml`:

```yaml
description: <skill-name> determinism assertions
prompts: ['{{input}}']
providers:
  - id: 'exec: bash run-skill.sh'   # wrapper: env CLAUDECODE="" claude --print "$1"
    label: <skill-name>@head
tests:
  - description: result block is pure JSON (no markdown fences)
    vars: { input: '/devflow:<skill-name> <fixture-input>' }
    assert:
      - type: not-icontains
        value: '```'
      - type: is-json            # only if the block is declared JSON
  - description: required keys present in pinned format
    vars: { input: '/devflow:<skill-name> <fixture-input>' }
    assert:
      - type: regex
        value: 'Repo:\s|VCS Platform:\s'   # the pinned schema keys
```

Wrapper (`run-skill.sh`): `exec env CLAUDECODE="" timeout 300 claude --model "${SKILL_EVAL_MODEL:-claude-haiku-4-5-20251001}" --print "$1"`.
(devflow ships this at `eval/lib/run-skill.sh`.)

## bats template (Axis A — only after the fix extracts a function)

```bash
@test "detect_vcs: github SSH" { run detect_vcs "git@github.com:o/r.git"; [ "$output" = github ]; }
@test "detect_vcs: self-hosted gitlab" { run detect_vcs "https://gitlab.acme.io/g/r.git"; [ "$output" = gitlab ]; }
```

Mark the bats block "apply after refactor" — the functions don't exist until the
Axis-A fix lands.

## Why the fixed output schema matters

The whole point is version comparison: run the audit on skill vN and vN+1 and diff.
A free-form report differs every run for reasons unrelated to the skill. The fixed
table + machine-readable YAML block (stable `D1..Dn` IDs in document order) makes the
diff meaningful and lets you assert on the audit's own output (`is-json` on the YAML).
