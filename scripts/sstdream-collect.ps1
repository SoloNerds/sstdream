# SSTDREAM import collector (PowerShell wrapper). Run this in your SST project; it
# bundles your infra files (sst.config.ts + packages/infra/*.ts, wherever they live)
# into one sanitized blob -> sstdream-import.txt that you paste into the builder's
# "From code" import. It runs entirely on your machine and redacts secrets first.
#
#   .\sstdream-collect.ps1            # collect the current project
#   .\sstdream-collect.ps1 ..\other  # collect another project dir
$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is required (your SST project already uses it). Install Node, then re-run."
  exit 1
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $dir "sstdream-collect.mjs") @args
