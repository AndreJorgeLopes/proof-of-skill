# Determinism-fix library — the contract

Shared, composable, deterministic replacements for skill steps that otherwise lean
on LLM judgment. Every function here obeys ONE contract so a skill can wrap it with
an AI fallback that fires **only on failure, never on a confident answer**.

## The status contract (exit codes)

| Exit | Meaning | Caller does |
|------|---------|-------------|
| `0`  | **CONFIDENT** — value on stdout, provably correct for this input shape | use it; **do NOT call AI** |
| `10` | **ABSTAIN** — input is outside the function's validated shapes (unknown / ambiguous) | fall back to AI |
| `1`  | **ERROR** — precondition broke (empty arg, tool missing, git failed) | fall back to AI + log |

Caller pattern (AI runs ONLY on non-zero):
```bash
val=$(extract_ticket_id "$branch") || val=$(ai_extract_ticket_id "$branch")
```

## The two rules that make the fallback safe

1. **Sound, not complete.** A function returns `0` ONLY for inputs whose answer is
   provably unambiguous. Everything else `return 10`. There is **no greedy
   catch-all** — that is what guarantees a `0` result is never confidently wrong, so
   the caller can trust it without an AI second-opinion.

2. **Abstain on ambiguity, not just on no-match.** "Looks like it could be X but I'm
   not sure" → `return 10`. Example: a branch containing two candidate ticket IDs is
   ambiguous → abstain → let AI decide. Detect the edge case and hand it off; never
   force a guess.

So: "AI only if the command FAILED, not if its output looks wrong" is mechanical —
the command **cannot** emit a wrong-but-confident output, because anything it isn't
sure about exits `10`.

## What belongs here / what does NOT

- ✅ **Parse / classify / count / extract** — sound, abstainable (ticket-ID, VCS
  platform, repo group, commit counts, size thresholds, score→label bucketing).
- ❌ **Rank / judge / generate** — keep these AI-driven. A deterministic ranker or
  typo-matcher or status-classifier is *confidently worse* than the model and can be
  confidently wrong (see review-skill D12/D18). For those, only **constrain the
  output format** (axis B) — never replace the judgment.

## Composition

Functions may extend/compose others. Declare it in `index.json` (`extends` field); a
derived function sources the base and wraps it (e.g. add company-specific patterns,
then delegate to the generic base, then abstain).

## Installation / sourcing

Canonical source lives here (`proof-of-skill/lib/determinism/`). `install.sh` copies
`functions/` to `~/.claude/lib/determinism/functions/`. Consuming skills source it:
```bash
for f in ~/.claude/lib/determinism/functions/*.sh; do . "$f"; done
```
`create-skill` and `determinize-skill` consult `index.json` BEFORE writing new code
for computable work — reuse or extend over reinventing.
