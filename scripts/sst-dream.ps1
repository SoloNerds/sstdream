# sst-dream — drop-in local infrastructure scan. This folder is self-contained: copy it
# into your SST/Vercel project and run it. No clone, no install, no build. Runs entirely
# on your machine — zero credentials, zero network.
#
# Usage:  .\sst-dream.ps1 scan .       (writes ARCHITECTURE.md + sstdream-scan.json)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is required (https://nodejs.org) — every SST/Vercel project already uses it.'
  exit 1
}
node (Join-Path $dir 'sst-dream.mjs') @args
