## Determinism Audit: write-spike

### Findings

| ID | Location | Axis | Severity | Effort | Nondeterminism | Deterministic fix |
|----|----------|------|----------|--------|----------------|-------------------|
| D1 | Phase 1 · Codebase Discovery, "Detect workspace type" | offload | high | S | English classification of four workspace shapes ("single repo \| parent folder with sub-repos \| multi-repo worktree \| external folder") — no rule pins which shape wins when signals overlap | `case` on `git worktree list` count + presence of sibling `.git` dirs |
| D2 | Phase 1 · Codebase Discovery, "Top 20% of repos … full walkthrough" | offload | high | S | "Most critical" repo selection and 20% cutoff applied by judgment; no key or tie-break defined | compute `N_full=$(( (N_repos + 4) / 5 ))` from `find`/`ls` count; sort repos by last-commit recency as ranking key |
| D3 | Phase 1 · Scope Check, "two moderate signals compounding" | offload | high | S | Compound signal detection ("2+ moderate signals or 1 extreme") uses prose judgment; thresholds in text (30 goals, 10 deps) are readable but the aggregation rule (AND vs OR, how to count) is left to the model | extract counts: `GOALS=$(grep -c …)`, `DEPS=$(grep -c …)`, then `if (( GOALS >= 30 \|\| DEPS >= 10 || (GOALS >= 15 && DEPS >= 6) ))` |
| D4 | Phase 2.2 · Classify Knowledge Per Goal | offload | medium | S | Category assignment (A / B1 / B2 / C) described in prose — no scoring rule or primary decision key; model may freely invent sub-categories or merge them | enumerate the four categories as an enum; require the model to output only `A`, `B1`, `B2`, or `C` per goal; add: "if the classification is ambiguous, default to B2" |
| D5 | Phase 3.4 · Quality Gates table | constrain | medium | S | Gate check results presented as a free-form table or prose; no schema pinned for the output (pass/fail column values, row order) | mandate exact output: `| Gate | Status | Notes |` with `Status` ∈ `{PASS, FAIL, TBD}`; "output only this table, no prose, no fences" |
| D6 | Phase 4.1 · Self-Review, "Placeholder scan … ambiguity check" | offload | medium | M | "Ambiguity check" and "scope check" applied in prose with no crisp rule for what triggers a fix vs. a note | define three concrete checks: (1) every spike goal has a verb; (2) every TBD has a tracking reference; (3) every team mention has a named contact; flag rows failing each check |
| D7 | Phase 3.1 / 4.5 · slug generation for filenames | offload | low | S | `<date>-<slug>.md` slug derived by model from spike title — drifts (spaces, casing, special chars) | `slug=$(echo "$TITLE" \| tr '[:upper:]' '[:lower:]' \| sed 's/[^a-z0-9]/-/g' \| tr -s '-')` |

---

### Findings (machine-readable)

```yaml
skill: write-spike
findings:
  - id: D1
    location: "Phase 1, Codebase Discovery — workspace type detection"
    axis: offload
    severity: high
    effort: S
    nondeterminism: "English classification of four workspace shapes with no decision rule for overlapping signals"
    fix: "case statement on git worktree list count + presence of sibling .git dirs"

  - id: D2
    location: "Phase 1, Codebase Discovery — top-20% repo selection"
    axis: offload
    severity: high
    effort: S
    nondeterminism: "Model-chosen 'most critical' repos; 20% cutoff has no tie-break key"
    fix: "N_full=$(( (N_repos+4)/5 )); sort repos by last-commit recency; take top N_full"

  - id: D3
    location: "Phase 1, Scope Check — compound signal aggregation"
    axis: offload
    severity: high
    effort: S
    nondeterminism: "Prose threshold rule ('2+ moderate signals or 1 extreme') left to model to evaluate; aggregation logic ambiguous"
    fix: "extract integer counts via grep/wc; apply explicit if-else: GOALS>=30||DEPS>=10 = extreme; GOALS>=15&&DEPS>=6 = compound moderate"

  - id: D4
    location: "Phase 2.2, Classify Knowledge Per Goal — category assignment"
    axis: offload
    severity: medium
    effort: S
    nondeterminism: "No scoring key or tie-break for A/B1/B2/C; model may invent sub-categories"
    fix: "enum constraint: output only A|B1|B2|C; default to B2 on ambiguity"

  - id: D5
    location: "Phase 3.4, Quality Gates table — output format"
    axis: constrain
    severity: medium
    effort: S
    nondeterminism: "Gate check results emitted as free-form table or prose; Status column values undefined"
    fix: "pin schema: '| Gate | Status | Notes |' with Status in {PASS,FAIL,TBD}; forbid fences and trailing prose"

  - id: D6
    location: "Phase 4.1, Self-Review — ambiguity and placeholder checks"
    axis: offload
    severity: medium
    effort: M
    nondeterminism: "Ambiguity and scope checks are prose-described with no crisp rule for when a finding triggers a fix"
    fix: "define 3 concrete checks: (1) every goal has a verb; (2) every TBD has a tracking ref; (3) every team mention has a contact"

  - id: D7
    location: "Phase 3.1 / 4.5 — filename slug generation"
    axis: offload
    severity: low
    effort: S
    nondeterminism: "Slug derived from spike title by model; drifts on casing and special characters"
    fix: "slug=$(echo \"$TITLE\" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | tr -s '-')"
```

---

### Assertions → write-spike/determinism.promptfooconfig.yaml

Written to disk at `/Users/andrejorgelopes/dev/proof-of-skill/skills/write-spike/determinism.promptfooconfig.yaml`. 5 Axis B tests covering D4 (category enum), D5 (quality-gate table structure, no fences), D6 (scope-check binary flag), D2 (workspace-type enum), and D3 (integer repo count).

> **Note:** The `exec:` provider requires `promptfoo` with `exec` support and a working `claude --print` binary. Run `promptfoo eval -c determinism.promptfooconfig.yaml` from `skills/write-spike/` to validate.

Bats tests for D1–D3 and D7 (Axis A) are marked **apply after refactor** — the helper functions (`detect_workspace_type`, `select_top_repos`, `check_scope_signals`, `make_slug`) do not exist until the corresponding fixes land in the skill's companion bash helpers.

---

### ROI

**Top fix: D3** (severity=high, effort=S) — scope-check aggregation is the most failure-prone: a model that misreads "2+ moderate signals" may silently skip decomposition on a spike that should be split, causing wasted investigation. One `if`-block with two integer thresholds eliminates the ambiguity.

**Full order: D3 > D1 > D2 > D4 > D5 > D6 > D7**

Rationale: D1/D2/D3 all severity=high+effort=S; D3 ranks first because wrong scope-check → wrong phase-gate → wasted multi-hour work. D1 ranks above D2 because workspace misclassification corrupts all codebase discovery. D4 and D5 are medium-severity S-effort (format-level fixes). D6 is medium+M (multi-check extraction). D7 is cosmetic.
