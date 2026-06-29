# Nondeterminism pattern catalog

For each step of the target skill, check every pattern below — do not stop at the
first finding per step.

| # | Smell in the SKILL.md | Axis | Deterministic fix | Assertion |
|---|------------------------|------|-------------------|-----------|
| 1 | English classification: "`x.com` → foo, `y.com` → bar" | offload | `case`/assoc-array lookup | bats: input→label |
| 2 | Fuzzy quantifier: "most specific", "significant", "clear winner", "if confident" | offload | fixed numeric threshold / explicit rule | bats: boundary cases |
| 3 | Judgment scoring/ranking: HIGH/MED/LOW "by relevance" | offload | weighted integer rules + fixed cutoffs | bats: known input→score |
| 4 | Parse structured data by reading (URL, JSON, path) | offload | `sed`/`jq`/`grep -oE` | bats: parse cases |
| 5 | Result/return block with no schema | constrain | pin format; "output only the block, no prose, no fences" | promptfoo: `regex`/`is-json`/`not-icontains "\`\`\`"` |
| 6 | Ordering / dedup "as appropriate" | offload | `sort`/`sort -u`/explicit sort key | bats: order stable |
| 7 | ID/token extraction: "the ticket id", "the branch name" | offload | `grep -oE '[A-Z]+-[0-9]+'`, `git rev-parse --abbrev-ref HEAD` | bats: extraction |
| 8 | Counting/stats narrated in prose | offload | `git rev-list --count`, `wc -l`, `git diff --stat` | bats: count |
| 9 | Branch/state guards in English ("if on protected branch") | offload | `case "$BRANCH" in main\|master)` | bats: guard fires |

Axis A → offload to code (`bash`/`regex`/`lookup`/`jq`). Axis B → constrain the
model's output format (pin schema, forbid prose/fences).

**Do NOT flag** (these stay model-driven): brainstorming, prose/spec review,
naming/wording, design trade-offs — anything genuinely requiring judgment.
Determinism is for *computable* work only.

## Severity / effort rubric (fixed, not by feel)

- **Severity high**: wrong result cascades (e.g. platform misdetect → wrong CLI).
  **medium**: degrades quality but recoverable. **low**: cosmetic/format only.
- **Effort S**: ≤10 lines, one function. **M**: helper + wiring. **L**: restructures the skill.
- **ROI order** = severity desc, then effort asc (high+S first).

## bats template (Axis A — only after the fix extracts a function)

```bash
@test "detect_vcs: github SSH" { run detect_vcs "git@github.com:o/r.git"; [ "$output" = github ]; }
@test "detect_vcs: self-hosted gitlab" { run detect_vcs "https://gitlab.acme.io/g/r.git"; [ "$output" = gitlab ]; }
```

Mark the bats block "apply after refactor" — the functions don't exist until the
Axis-A fix lands. The promptfoo template (`promptfoo-template.yaml`) is the primary
artifact; it asserts on the skill's actual stdout.
