#!/usr/bin/env bash
# Copy the slide editor (one source: website/tools) into the extension.
# Run after changing website/tools/{slide-editor,slide-engine,pdf-kit,deck-store,tools}.js or tools.css.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/website/tools"
ext="$root/notebooktools-extension"
mkdir -p "$ext/slide-editor" "$ext/vendor/tesseract" "$ext/vendor/pptxgenjs"
for f in tools.js pdf-kit.js slide-engine.js slide-editor.js deck-store.js tools.css; do
  cp "$src/$f" "$ext/slide-editor/$f"
done
cp -R "$src/vendor/tesseract/." "$ext/vendor/tesseract/"
cp -R "$src/vendor/pptxgenjs/." "$ext/vendor/pptxgenjs/"
echo "Synced slide editor into the extension"
