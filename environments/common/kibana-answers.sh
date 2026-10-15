# shellcheck shell=bash
# Sourced, not executed.
#
# TEMPORARY (RORDEV-2283). Remove this file, the two restart-unanswering-kibana.sh scripts and their
# call in runner.sh when the tested ReadonlyREST KBN release has the RORDEV-2283 fix
# (readonlyrest_kbn#1105).

# has_rordev_2283 <node> <command> [args...]
# The command prints the package.json of the ReadonlyREST KBN plugin of one Kibana node. Returns 0
# when the plugin is a release with the defect: 1.71.0 or 1.72.0. A later release gets no restart,
# so a regression fails the run.
has_rordev_2283() {
  local node=$1 version
  shift
  version=$("$@" 2>/dev/null | grep -m1 '"version"' | sed -E 's/.*"version": *"([^"]+)".*/\1/')
  case "$version" in
    1.71.0 | 1.72.0) return 0 ;;
    "") echo "::warning title=RORDEV-2283::Cannot read the ReadonlyREST KBN version of $node. It gets no restart." ;;
  esac
  return 1
}

ROR_KBN_PACKAGE_JSON=/usr/share/kibana/plugins/readonlyrestkbn/package.json

# kibana_answers <command> [args...]
# The command does one user request to one Kibana node and prints the HTTP status. Returns 0 when
# the node answers 4 requests in a row with a 2xx status within 45 s, and 1 when it does not. A node
# with the defect gives no answer: each request waits until the client timeout.
kibana_answers() {
  local deadline=$((SECONDS + 45)) answers=0 status
  while [ "$answers" -lt 4 ]; do
    [ "$SECONDS" -lt "$deadline" ] || return 1
    status=$("$@" 2>/dev/null) || status=000
    if [[ "$status" == 2?? ]]; then
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
