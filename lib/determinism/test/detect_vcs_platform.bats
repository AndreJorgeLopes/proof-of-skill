#!/usr/bin/env bats
setup() { . "${BATS_TEST_DIRNAME}/../functions/detect_vcs_platform.sh"; }

@test "github ssh" { run detect_vcs_platform "git@github.com:o/r.git"; [ "$status" -eq 0 ]; [ "$output" = github ]; }
@test "gitlab https" { run detect_vcs_platform "https://gitlab.com/a/b.git"; [ "$status" -eq 0 ]; [ "$output" = gitlab ]; }
@test "self-hosted gitlab" { run detect_vcs_platform "https://gitlab.acme.io/g/r.git"; [ "$status" -eq 0 ]; [ "$output" = gitlab ]; }
@test "azure" { run detect_vcs_platform "https://dev.azure.com/org/proj/_git/r"; [ "$status" -eq 0 ]; [ "$output" = azure ]; }
@test "unknown host ABSTAINS" { run detect_vcs_platform "https://git.sr.ht/~u/r"; [ "$status" -eq 10 ]; }
@test "empty errors" { run detect_vcs_platform ""; [ "$status" -eq 1 ]; }
