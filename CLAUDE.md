# proof-of-skill — project instructions

A skill factory: `create-skill` (TDD authoring), `optimize-skill` (tessl-gated Ralph
loop), `determinize-skill` (determinism audit), `write-spike`, and a shared
`lib/determinism/` function library. Skills are markdown; tessl scores them.

## tessl 0.87 command surface (verified — do not regress)

- `tessl skill review` is **deprecated** → use **`tessl review run`** (alias `tessl review`).
  The old `tessl skill review --optimize` → **`tessl review fix`** (automated review-and-fix loop).
- `tessl review run --json` **requires `--workspace <name>`** (non-interactive) — list via
  `tessl workspace list`. Without it: `"workspace is required when --json is set"`.
- The overall score moved: read **`.review.reviewScore`** (0–100), NOT `.weightedScore`
  (now a per-judge ~2.3 value). jq fallback: `.review.reviewScore // .weightedScore // .score`.
- Needs **`tessl login`** (browser auth, cannot be automated). Precheck `tessl whoami`.
- `--threshold N` gates non-zero exit below N% (cleaner than manual jq comparison).

## A judge score is not correctness — run + separately review after any auto-optimizer

`tessl review fix` (LLM auto-optimizer) raises the *score* but can introduce
**correctness regressions the score never catches** — empirically it hallucinated an
invalid promptfoo provider syntax (`type: exec`, bare `assert: is-json`) and created
orphan/duplicate files while scoring 86→94. tessl scores *prose plausibility*, not
whether the artifact runs. **After any `tessl review fix`: (1) re-run a fresh
`tessl review run` (never trust its self-reported number), (2) run the artifact, (3)
do the optimize-skill spec-review pass** (broken refs, hallucinated syntax, orphans).

## Determinism: the abstain contract (lib/determinism/CONTRACT.md)

Deterministic-first, **AI fallback only on FAILURE, never on a confident answer**.
Every lib function: `exit 0`=confident value / `10`=abstain→AI / `1`=error→AI.
**Sound, not complete** — return a value only for provably-unambiguous input; abstain
on unknown OR ambiguous (digits-first ticket, 2+ candidates, self-hosted host). No
greedy catch-all → a `0` result can never be confidently wrong. Caller:
`v=$(fn "$x") || v=$(ai_fn "$x")`.

## Lib-first + the risk gate

- **Before writing new deterministic code for computable work, search
  `lib/determinism/index.json`** — reuse or `extend` an existing function. Both
  `create-skill` (step 9.5) and `determinize-skill` enforce this.
- **Do NOT determinize judgment.** Ranking, scoring, typo/status heuristics, and
  generation are HIGH-risk — a deterministic version is confidently *worse* and can be
  confidently wrong (review-skill D12/D18). For those, only **constrain the output
  format** (axis B: `is-json`/`regex`/no-fences). Offload only parse/classify/count.

## Headless skill runs

A nested `claude --print` inside a Claude Code session refuses to launch (inherits
`CLAUDECODE=1`, claude-agent-sdk#573). Always `env CLAUDECODE="" claude --print`.
Slash-skills activate headless this way — the basis of the promptfoo skill harness.
