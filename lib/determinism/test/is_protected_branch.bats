#!/usr/bin/env bats
setup() { . "${BATS_TEST_DIRNAME}/../functions/is_protected_branch.sh"; }

@test "main protected" { run is_protected_branch "main"; [ "$status" -eq 0 ]; }
@test "master protected" { run is_protected_branch "master"; [ "$status" -eq 0 ]; }
@test "release/* protected" { run is_protected_branch "release/1.2"; [ "$status" -eq 0 ]; }
@test "feature branch not protected" { run is_protected_branch "feat/MES-1-foo"; [ "$status" -eq 1 ]; }
@test "empty not protected" { run is_protected_branch ""; [ "$status" -eq 1 ]; }
