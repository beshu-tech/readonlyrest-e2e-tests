#!/usr/bin/env bash
# Tests for .github/scripts/login-ghcr.sh.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SCRIPT="$SCRIPT_DIR/../login-ghcr.sh"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

make_stubs() {
  local dir="$TEST_ROOT/$RANDOM"
  mkdir -p "$dir/bin"
  cat > "$dir/bin/docker" <<'EOF'
#!/usr/bin/env bash
stdin_val=$(cat)
echo "docker $* stdin=$stdin_val" >> "$TEST_LOG"
count=$(wc -l < "$TEST_LOG")
if [ "$count" -le "${FAIL_TIMES:-0}" ]; then
  echo "${FAIL_MESSAGE:-503 Service Unavailable}" >&2
  exit 1
fi
echo "Login Succeeded"
EOF
  cat > "$dir/bin/sleep" <<'EOF'
#!/usr/bin/env bash
echo "sleep $*" >> "$TEST_LOG"
EOF
  chmod +x "$dir/bin/docker" "$dir/bin/sleep"
  : > "$dir/log"
  echo "$dir"
}

test_missing_token_fails() {
  local dir status=0
  dir=$(make_stubs)
  PATH="$dir/bin:$PATH" TEST_LOG="$dir/log" env -u ROR_GH_TOKEN bash "$SCRIPT" >"$dir/out" 2>&1 || status=$?
  [ "$status" -eq 1 ] || fail "expected exit 1 without token, got $status"
  [ ! -s "$dir/log" ] || fail "docker should not run without token"
}

test_logs_in_with_token_on_stdin() {
  local dir
  dir=$(make_stubs)
  PATH="$dir/bin:$PATH" TEST_LOG="$dir/log" ROR_GH_TOKEN=secret-pat bash "$SCRIPT" >"$dir/out" 2>&1 \
    || fail "login failed: $(cat "$dir/out")"
  grep -qx 'docker login ghcr.io -u x-access-token --password-stdin stdin=secret-pat' "$dir/log" \
    || fail "unexpected log: $(cat "$dir/log")"
}

test_retries_transient_failure() {
  local dir
  dir=$(make_stubs)
  PATH="$dir/bin:$PATH" TEST_LOG="$dir/log" FAIL_TIMES=1 GHCR_LOGIN_RETRY_DELAY_SECONDS=1 \
    ROR_GH_TOKEN=secret-pat bash "$SCRIPT" >"$dir/out" 2>&1 \
    || fail "retry should have succeeded: $(cat "$dir/out")"
  [ "$(grep -c '^docker login ' "$dir/log")" -eq 2 ] || fail "expected 2 login calls: $(cat "$dir/log")"
  grep -qx 'sleep 1' "$dir/log" || fail "expected sleep 1: $(cat "$dir/log")"
}

test_auth_failures_do_not_retry() {
  local msg dir status
  for msg in "Error response from daemon: Get \"https://ghcr.io/v2/\": unauthorized" \
             "Error response from daemon: Get \"https://ghcr.io/v2/\": denied: installation not allowed"; do
    status=0
    dir=$(make_stubs)
    PATH="$dir/bin:$PATH" TEST_LOG="$dir/log" FAIL_TIMES=3 FAIL_MESSAGE="$msg" \
      GHCR_LOGIN_RETRY_DELAY_SECONDS=1 ROR_GH_TOKEN=bad-pat bash "$SCRIPT" >"$dir/out" 2>&1 || status=$?
    [ "$status" -eq 1 ] || fail "expected exit 1 for '$msg', got $status"
    [ "$(grep -c '^docker login ' "$dir/log")" -eq 1 ] || fail "should not retry '$msg': $(cat "$dir/log")"
    ! grep -q '^sleep ' "$dir/log" || fail "should not sleep on '$msg': $(cat "$dir/log")"
  done
}

for t in $(declare -F | awk '{print $3}' | grep '^test_'); do
  "$t"
  echo "ok - $t"
done
