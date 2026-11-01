<#
  Keep your local NotebookTools clone in sync with GitHub, so the unpacked
  extension in Chrome updates itself. No reinstalling.

  One-time setup:
    1. git clone https://github.com/rafeequemv1/notebooktools.git
    2. chrome://extensions > Developer mode > Load unpacked >
       pick the notebooktools\notebooktools-extension folder
    3. Run this script and leave the window open:
         powershell -ExecutionPolicy Bypass -File scripts\dev-sync.ps1

  Every new commit on the branch is pulled within ~20 s; the extension then
  reloads itself and refreshes the NotebookLM / YouTube tabs it was running in.
  Follow another branch with:  -Branch claude/some-branch
#>
param(
  [string]$Branch = "main",
  [int]$Every = 20
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$stampFile = Join-Path $repo "notebooktools-extension\dev-stamp.txt"
Set-Location $repo

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "Git is not installed. Get it from https://git-scm.com/download/win" -ForegroundColor Red
  exit 1
}

$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne $Branch) {
  git fetch --quiet origin $Branch
  git checkout --quiet $Branch
}

Write-Host "NotebookTools dev sync: following '$Branch' every $Every s. Leave this window open (Ctrl+C to stop)." -ForegroundColor Cyan

while ($true) {
  try {
    git fetch --quiet origin $Branch
    $local = (git rev-parse HEAD).Trim()
    $remote = (git rev-parse "origin/$Branch").Trim()

    if ($local -ne $remote) {
      git merge --ff-only --quiet "origin/$Branch"
      $short = (git rev-parse --short HEAD).Trim()
      $subject = (git log -1 --format=%s).Trim()
      Write-Host "$(Get-Date -Format T)  updated to $short  $subject" -ForegroundColor Green
    }

    $stamp = (git rev-parse HEAD).Trim()
    $old = if (Test-Path $stampFile) { (Get-Content $stampFile -Raw).Trim() } else { "" }
    if ($old -ne $stamp) {
      Set-Content -Path $stampFile -Value $stamp -NoNewline
    }
  } catch {
    Write-Host "$(Get-Date -Format T)  sync failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Start-Sleep -Seconds $Every
}
