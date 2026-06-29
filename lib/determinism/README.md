# Determinism-fix library

Reusable, composable, **sound** deterministic replacements for skill steps that would
otherwise use LLM judgment for computable work. Read [`CONTRACT.md`](CONTRACT.md) for
the exit-code contract and the soundness rules. Machine index: [`index.json`](index.json).

## Why
Auditing devflow skills (resolve-repo, finish-feature, review) surfaced the *same*
deterministic sub-steps over and over — VCS detection, ticket-ID extraction, repo-group
parsing, commit counts, score→severity bucketing. Rather than each skill reinventing
(and drifting on) them, they live here once, tested, with an AI fallback contract.

## Functions

| Function | Purpose | Axis | Risk | Abstains on |
|----------|---------|------|------|-------------|
| `extract_ticket_id` | ticket ID from branch/text | offload | med | unknown scheme, 2+ candidates |
| `detect_vcs_platform` | remote URL → platform | offload | low | unknown/self-hosted host |
| `extract_repo_group` | remote URL → group path | offload | med | no group segment |
| `is_protected_branch` | predicate: protected branch? | offload | low | — (total) |
| `count_commits` | git rev-list --count wrapper | offload | low | bad range → error |
| `score_to_severity` | int 0-100 → severity label | offload | low | non-int → error |

**Not here (kept AI-driven):** ranking/scoring judgment, typo heuristics, NEW/RAISED
status classification, commit-msg/PR-body generation. A deterministic version is
confidently *worse* — only the OUTPUT FORMAT of those is constrained (axis B), in the
skills themselves.

## Use it
```bash
bash install.sh                        # → ~/.claude/lib/determinism
for f in ~/.claude/lib/determinism/functions/*.sh; do . "$f"; done

# deterministic-first, AI fallback ONLY on non-zero (abstain/error):
id=$(extract_ticket_id "$branch") || id=$(ai_extract_ticket_id "$branch")
```

## Extend / compose
Build a derived function on a base: source the base, add your patterns, delegate, then
abstain. Declare `extends` in `index.json`. Example: a company-specific
`extract_ticket_id_acme` that recognizes one extra scheme then falls through to the
generic `extract_ticket_id`.

## Test
```bash
bats test/    # requires bats-core
```
