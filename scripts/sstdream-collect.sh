#!/usr/bin/env bash
# SSTDREAM import collector (bash wrapper). Run this in your SST project; it bundles
# your infra files (sst.config.ts + packages/infra/*.ts, wherever they live) into one
# sanitized blob -> sstdream-import.txt that you paste into the builder's "From code"
# import. It runs entirely on your machine and redacts secrets before writing.
#
#   ./sstdream-collect.sh            # collect the current project
#   ./sstdream-collect.sh ../other   # collect another project dir
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (your SST project already uses it). Install Node, then re-run." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
exec node "$DIR/sstdream-collect.mjs" "$@"
