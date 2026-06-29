#!/usr/bin/env bash
# is_protected_branch <branch> -> exit 0 (protected) | exit 1 (not protected)
# Total predicate over the well-known protected names; no abstain needed.
# (A predicate, not a value-producer: 0=true, 1=false per the contract's predicate form.)
is_protected_branch() {
  case "${1:-}" in
    main|master|develop|production|staging|release/*|hotfix/*) return 0 ;;
    *) return 1 ;;
  esac
}
