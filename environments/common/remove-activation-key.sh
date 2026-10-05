#!/bin/bash
# Copies stdin to stdout without the ROR activation key from ROR_ACTIVATION_KEY. The CI logs of this
# repo are public. The key is a JWT, so this also removes each of its three parts, in case a log
# prints only one part.
#
# Prints nothing and exits 1 when the key is empty, when the removal fails, or when the key is still
# in the result.
set -o pipefail

key=${ROR_ACTIVATION_KEY:-}
# A secret pasted with a newline at the end must still match the key in a log line.
key=${key#"${key%%[![:space:]]*}"}
key=${key%"${key##*[![:space:]]}"}
if [ -z "$key" ]; then
  echo "remove-activation-key.sh: ROR_ACTIVATION_KEY is empty, so the input is not printed." >&2
  exit 1
fi

# A string shorter than 16 characters matches too much unrelated text. A real key is much longer.
parts=()
IFS=. read -r -a split <<< "$key"
for part in "$key" "${split[@]}"; do
  (( ${#part} >= 16 )) && parts+=("$part")
done

out=$(KEY="$key" perl -pe '
  BEGIN { @s = grep { length($_) >= 16 } ($ENV{KEY}, split(/\./, $ENV{KEY})) }
  for my $p (@s) { s/\Q$p\E/[ACTIVATION KEY REMOVED]/g }') || {
  echo "remove-activation-key.sh: perl failed, so the input is not printed." >&2
  exit 1
}

# The result decides, not the exit code: perl can skip a substitution and still exit 0.
for part in "${parts[@]}"; do
  if [[ $out == *"$part"* ]]; then
    echo "remove-activation-key.sh: the key is still in the result, so it is not printed." >&2
    exit 1
  fi
done

[ -z "$out" ] || printf '%s\n' "$out"
