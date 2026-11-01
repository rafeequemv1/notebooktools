#!/usr/bin/env bash
# Build the installable extension zip served from the website
# (https://www.notebooktools.com/downloads/notebooktools-extension.zip).
# Run after changing notebooktools-extension/, then commit the zip.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/website/downloads/notebooktools-extension.zip"
mkdir -p "$(dirname "$out")"
rm -f "$out"
cd "$root/notebooktools-extension"
zip -qr -X "$out" . -x 'node_modules/*' -x '*.DS_Store' -x '*.bak*'
version="$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')"
echo "Built $out (v$version, $(du -h "$out" | cut -f1))"
