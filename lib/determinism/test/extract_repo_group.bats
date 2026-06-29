#!/usr/bin/env bats
setup() { . "${BATS_TEST_DIRNAME}/../functions/extract_repo_group.sh"; }

@test "ssh nested group" { run extract_repo_group "git@gitlab.com:aircall/core/messaging.git"; [ "$status" -eq 0 ]; [ "$output" = "aircall/core" ]; }
@test "https single group" { run extract_repo_group "https://github.com/aircall-org/hydra.git"; [ "$status" -eq 0 ]; [ "$output" = "aircall-org" ]; }
@test "empty errors" { run extract_repo_group ""; [ "$status" -eq 1 ]; }
