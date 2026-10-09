#!/bin/bash
# Turns the failure records of an e2e suite into GitHub annotations and a run-summary table.
#
# Usage: report-e2e-flakes.sh <results dir> <label>
#   e.g. report-e2e-flakes.sh results "ELK 9.4.7 on docker"
#
# It reads failed-specs.tsv, which the suite writes in the results directory: one row per failed
# spec of each suite run, with the run start time and the spec.
#
# Each row gives one warning annotation, up to the limit of a step. GitHub shows annotations in the
# checks list of a PR, so a reader sees the failed specs without opening the log.
set -uo pipefail

RESULTS_DIR="${1:?Usage: report-e2e-flakes.sh <results dir> <label>}"
LABEL="${2:?Usage: report-e2e-flakes.sh <results dir> <label>}"
FAILED_SPECS="$RESULTS_DIR/failed-specs.tsv"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
# GitHub keeps 10 warning annotations per step and drops the others without a sign.
MAX_ANNOTATIONS=10

# A workflow-command property escapes "%", ":" and ","; the message escapes "%" and line breaks.
escape_property() {
  local s=${1//%/%25}
  s=${s//:/%3A}
  printf '%s' "${s//,/%2C}"
}
escape_message() {
  local s=${1//%/%25}
  s=${s//$'\r'/%0D}
  printf '%s' "${s//$'\n'/%0A}"
}

TITLE=$(escape_property "E2E: $LABEL")
warnings=()

if [ -s "$FAILED_SPECS" ]; then
  runs=$(cut -f1 "$FAILED_SPECS" | sort -u | wc -l)
  {
    echo
    echo "#### Failed specs: $LABEL"
    echo
    echo '| suite run started | spec |'
    echo '| --- | --- |'
  } >> "$SUMMARY"
  while IFS=$'\t' read -r started spec; do
    [ -n "$spec" ] || continue
    warnings+=("Cypress spec failed in the suite run that started $started: $spec")
    echo "| $started | \`$spec\` |" >> "$SUMMARY"
  done < "$FAILED_SPECS"
  echo "Failed specs: $(wc -l < "$FAILED_SPECS") rows in $runs suite runs."
fi

# Above the limit, the last annotation gives the number of failed specs that have none.
shown=${#warnings[@]}
if [ "$shown" -gt "$MAX_ANNOTATIONS" ]; then
  shown=$((MAX_ANNOTATIONS - 1))
fi
for warning in "${warnings[@]:0:$shown}"; do
  echo "::warning title=$TITLE::$(escape_message "$warning")"
done
if [ "$shown" -lt "${#warnings[@]}" ]; then
  echo "::warning title=$TITLE::$((${#warnings[@]} - shown)) more failed specs. The run summary lists them all."
fi

exit 0
