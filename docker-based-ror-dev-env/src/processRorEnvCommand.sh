#!/bin/bash -e

cd "$(dirname "$0")"

cd /app

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# The tests run `yarn --frozen-lockfile`. Yarn 2 gave that flag a new name. Thus we must use yarn 1.
# Corepack reads "packageManager" in e2e-tests/package.json. It installs that version of yarn and
# makes sure that the hash agrees. Node 24 contains corepack. Node 25 and subsequent versions do
# not contain it. Then this function installs yarn.
# It also makes sure that the hash agrees. `npm i -g yarn@<version>` is not equal: it compares the
# tarball only with the hash that the registry sends with it.
install_pinned_yarn() {
  local pinned yarn_version yarn_sha512 yarn_tmp
  pinned=$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"yarn@\([^"]*\)".*/\1/p' /app/e2e-tests/package.json)
  yarn_version=${pinned%%+*}
  yarn_sha512=${pinned#*+sha512.}
  if [ -z "$yarn_version" ] || [ "$yarn_sha512" = "$pinned" ]; then
    echo "ERROR: e2e-tests/package.json has no 'yarn@<version>+sha512.<digest>' pin"
    return 1
  fi
  yarn_tmp=$(mktemp -d)
  trap 'rm -rf "$yarn_tmp"' RETURN
  curl -fsSL "https://registry.npmjs.org/yarn/-/yarn-$yarn_version.tgz" -o "$yarn_tmp/yarn.tgz"
  echo "$yarn_sha512  $yarn_tmp/yarn.tgz" | sha512sum -c -
  npm i -g "$yarn_tmp/yarn.tgz"
}

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Do not write `corepack enable || install_pinned_yarn`. In a `||` list, bash stops errexit in the
# function. Then a bad download or a wrong hash does not stop this script.
if ! corepack enable; then
  install_pinned_yarn
fi

case "$1" in
    e2e-tests-7x )
      /app/runner.sh --run e2e --elk "7.17.24" --env "docker"
      ;;
    e2e-tests-8x )
      /app/runner.sh --run e2e --elk "8.15.2" --env "docker"
      ;;
    bash )
      bash
      ;;
    *)
      echo "Unknown command: $1"
      exit 1
      ;;
esac
