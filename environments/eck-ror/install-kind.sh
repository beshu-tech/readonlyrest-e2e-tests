#!/usr/bin/env bash
# install-kind.sh <directory>
# Downloads the pinned kind release into <directory>, and checks it against the pinned checksum.
# Linux only: CI runs on Linux, and a developer on another system installs kind by hand.
set -euo pipefail

DIR=${1:?Usage: install-kind.sh <directory>}
mkdir -p "$DIR"
DIR=$(cd "$DIR" && pwd)

cd "$(dirname "$0")"
source ./kind-pins.sh
source ../common/retry.sh

case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) ARCH=amd64 SHA256=$KIND_SHA256_LINUX_AMD64 ;;
  Linux/aarch64) ARCH=arm64 SHA256=$KIND_SHA256_LINUX_ARM64 ;;
  *) echo "No pinned kind for $(uname -s)/$(uname -m). Install kind $KIND_VERSION by hand." >&2; exit 1 ;;
esac

retry 3 curl -fsSL --connect-timeout 30 --max-time 300 -o "$DIR/kind.download" \
  "https://github.com/kubernetes-sigs/kind/releases/download/$KIND_VERSION/kind-linux-$ARCH"
echo "$SHA256  $DIR/kind.download" | sha256sum -c -
chmod +x "$DIR/kind.download"
mv "$DIR/kind.download" "$DIR/kind"
"$DIR/kind" version
