#!/usr/bin/env bash
# sst-dream — drop-in local infrastructure scan. This folder is self-contained: copy it
# into your SST/Vercel project and run it. No clone, no install, no build. Runs entirely
# on your machine — zero credentials, zero network.
#
# Usage:  ./sst-dream.sh scan .        (writes ARCHITECTURE.md + sstdream-scan.json)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (https://nodejs.org) — every SST/Vercel project already uses it." >&2
  exit 1
fi
exec node "$DIR/sst-dream.mjs" "$@"
