# Sourced, not executed.
#
# retry <attempts> <command> [args...]
# Runs the command until it succeeds, at most <attempts> times, and returns the status of the last
# attempt. Use it for each step that goes to the network: the e2e suite has no retry of its own, so
# one dropped connection would fail the whole leg. The wait between attempts grows by 10 s, because
# a registry that rate-limits needs time to recover.
retry() {
  local attempts=$1 attempt=1 status
  shift
  while true; do
    "$@" && return 0
    status=$?
    if [ "$attempt" -ge "$attempts" ]; then
      echo "Failed after $attempt attempts (status $status): $*" >&2
      return "$status"
    fi
    echo "Attempt $attempt of $attempts failed (status $status): $*. Next attempt in $((attempt * 10)) s." >&2
    sleep $((attempt * 10))
    attempt=$((attempt + 1))
  done
}
