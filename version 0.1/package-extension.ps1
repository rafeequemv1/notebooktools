$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$extDir = Join-Path $here "extension"
$zipPath = Join-Path $here "notebooktools-v0.1.1.zip"

if (-not (Test-Path $extDir)) {
  throw "Extension folder not found: $extDir"
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Push-Location $extDir
try {
  Compress-Archive -Path * -DestinationPath $zipPath -Force
  Write-Host "Created $zipPath"
} finally {
  Pop-Location
}
