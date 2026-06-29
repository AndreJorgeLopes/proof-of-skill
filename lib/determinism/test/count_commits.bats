#!/usr/bin/env bats
setup() {
  . "${BATS_TEST_DIRNAME}/../functions/count_commits.sh"
  REPO="$(mktemp -d)"
  git -C "$REPO" init -q
  git -C "$REPO" config user.email t@t.t; git -C "$REPO" config user.name t
  for i in 1 2 3; do echo "$i" > "$REPO/f$i"; git -C "$REPO" add -A; git -C "$REPO" commit -qm "c$i"; done
}
teardown() { rm -rf "$REPO"; }

@test "counts commits in range" { run count_commits "HEAD~2..HEAD" "$REPO"; [ "$status" -eq 0 ]; [ "$output" = "2" ]; }
@test "bad range errors" { run count_commits "nope..nope" "$REPO"; [ "$status" -eq 1 ]; }
@test "empty range errors" { run count_commits "" "$REPO"; [ "$status" -eq 1 ]; }
