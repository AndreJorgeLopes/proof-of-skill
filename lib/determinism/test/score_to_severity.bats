#!/usr/bin/env bats
setup() { . "${BATS_TEST_DIRNAME}/../functions/score_to_severity.sh"; }

@test "90 critical" { run score_to_severity 90; [ "$status" -eq 0 ]; [ "$output" = critical ]; }
@test "75 important" { run score_to_severity 75; [ "$status" -eq 0 ]; [ "$output" = important ]; }
@test "50 suggestion" { run score_to_severity 50; [ "$status" -eq 0 ]; [ "$output" = suggestion ]; }
@test "49 drop" { run score_to_severity 49; [ "$status" -eq 0 ]; [ "$output" = drop ]; }
@test "non-integer errors" { run score_to_severity "high"; [ "$status" -eq 1 ]; }
@test "out of range errors" { run score_to_severity 200; [ "$status" -eq 1 ]; }
