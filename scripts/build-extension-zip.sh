#!/usr/bin/env bash
# Build the installable extension zip
# (for manual install or Chrome Web Store upload). Output: dist/ (not committed).
# Run after changing notebooktools-extension/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/dist/notebooktools-extension.zip"
mkdir -p "$(dirname "$out")"
rm -f "$out"
cd "$root/notebooktools-extension"
zip -qr -X "$out" . -x 'node_modules/*' -x '*.DS_Store' -x '*.bak*' -x 'dev-stamp.txt'
version="$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')"
echo "Built $out (v$version, $(du -h "$out" | cut -f1))"
