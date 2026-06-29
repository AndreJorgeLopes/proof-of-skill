#!/usr/bin/env bash
# detect_vcs_platform <remote-url> -> stdout github|gitlab|bitbucket|azure (exit 0)
#                                    | abstain (exit 10) | error (exit 1)
# Sound: only well-known hosts return 0. Unknown/self-hosted -> abstain -> AI.
detect_vcs_platform() {
  local u="${1:-}"
  [ -n "$u" ] || return 1
  case "$u" in
    *github.com*)                       echo github;    return 0 ;;
    *gitlab.com*|*gitlab.*)             echo gitlab;    return 0 ;;
    *bitbucket.org*|*bitbucket.*)       echo bitbucket; return 0 ;;
    *dev.azure.com*|*visualstudio.com*) echo azure;     return 0 ;;
  esac
  return 10   # unknown / self-hosted host -> AI
}
