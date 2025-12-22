Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
node (Join-Path $PSScriptRoot "dev.mjs")

