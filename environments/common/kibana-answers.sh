# shellcheck shell=bash
# Sourced, not executed.
#
# TEMPORARY (RORDEV-2283). Remove this file, the two restart-unanswering-kibana.sh scripts and their
# call in runner.sh when the tested ReadonlyREST KBN release has the RORDEV-2283 fix
# (readonlyrest_kbn#1105).
#
# kibana_answers <command> [args...]
# The command does one user request to one Kibana node and prints the HTTP status. Returns 0 when
# the node answers 4 requests in a row within 45 s (a status below 500, as the suite's gate counts
# it), and 1 when it does not.
kibana_answers() {
  local deadline=$((SECONDS + 45)) answers=0 status
  while [ "$answers" -lt 4 ]; do
    [ "$SECONDS" -lt "$deadline" ] || return 1
    status=$("$@" 2>/dev/null) || status=000
    if [ "$status" != 000 ] && [ "$status" -lt 500 ]; then
      answers=$((answers + 1))
    else
      answers=0
      sleep 1
    fi
  done
}

# The request every probe sends: a user request that ReadonlyREST authenticates. /api/status
# answers also on a node that never answers a user request.
KIBANA_PROBE_CURL=(curl -sk -m 10 -o /dev/null -w '%{http_code}' -u admin:dev -H 'kbn-xsrf: true')
