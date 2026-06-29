#!/usr/bin/env bats
load_fn() { . "${BATS_TEST_DIRNAME}/../functions/extract_ticket_id.sh"; }
setup() { load_fn; }

@test "JIRA-style confident" { run extract_ticket_id "feat/MES-4282-foo"; [ "$status" -eq 0 ]; [ "$output" = "MES-4282" ]; }
@test "issue # confident" { run extract_ticket_id "fix #123 bug"; [ "$status" -eq 0 ]; [ "$output" = "123" ]; }
@test "digits-first ABSTAINS (the edge case)" { run extract_ticket_id "123-abc-branch"; [ "$status" -eq 10 ]; }
@test "two distinct IDs ABSTAIN (ambiguous)" { run extract_ticket_id "MES-1-and-ABC-2"; [ "$status" -eq 10 ]; }
@test "no match ABSTAINS" { run extract_ticket_id "just-a-branch"; [ "$status" -eq 10 ]; }
@test "empty arg errors" { run extract_ticket_id ""; [ "$status" -eq 1 ]; }
@test "same ID twice is NOT ambiguous" { run extract_ticket_id "MES-9/MES-9"; [ "$status" -eq 0 ]; [ "$output" = "MES-9" ]; }
