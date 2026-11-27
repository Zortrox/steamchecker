#!/usr/bin/env bash
# Builds the Firefox add-on from this source, for AMO review.
# Requirements and steps: see "Building from source" in README.md.
# Output: dist-firefox/ and extension-firefox.zip (the Chrome build lands in dist/).
set -euo pipefail
cd "$(dirname "$0")"

for tool in bun node zip; do
  if ! command -v "$tool" >/dev/null; then
    echo "Missing '$tool'. See \"Building from source\" in README.md." >&2
    exit 1
  fi
done

echo "bun $(bun --version), node $(node --version)"

bun install --frozen-lockfile
bun run build

echo
echo "Firefox build: dist-firefox/ (zipped as extension-firefox.zip)"
