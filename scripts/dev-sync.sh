#!/usr/bin/env bash
# Keep a local NotebookTools clone in sync with GitHub so the unpacked
# extension reloads itself (macOS / Linux). See dev-sync.ps1 for the setup.
#   scripts/dev-sync.sh [branch] [seconds]
set -uo pipefail
branch="${1:-main}"; every="${2:-20}"
repo="$(cd "$(dirname "$0")/.." && pwd)"; stamp_file="$repo/notebooktools-extension/dev-stamp.txt"
cd "$repo"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$branch" ] || { git fetch -q origin "$branch" && git checkout -q "$branch"; }
echo "NotebookTools dev sync: following '$branch' every ${every}s (Ctrl+C to stop)."
while true; do
  if git fetch -q origin "$branch"; then
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch")" ]; then
      git merge --ff-only -q "origin/$branch" && echo "$(date +%T)  updated to $(git log -1 --format='%h  %s')"
    fi
    stamp="$(git rev-parse HEAD)"
    [ "$(cat "$stamp_file" 2>/dev/null)" = "$stamp" ] || printf '%s' "$stamp" > "$stamp_file"
  else
    echo "$(date +%T)  sync failed (offline?)"
  fi
  sleep "$every"
done
