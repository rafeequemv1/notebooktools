#!/usr/bin/env python3
"""Copy the demo markup from website/features/index.html to every feature page.

All feature pages share the same <main> (sidebar + every demo); each page only
marks its own feature as active. Edit index.html, then run:

    python3 scripts/sync-feature-pages.py
"""
import re
from pathlib import Path

FEATURES = Path(__file__).resolve().parent.parent / "website" / "features"
MAIN_RE = re.compile(r"<main\b.*?</main>", re.S)
HEAD_LINKS = [
    '<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&amp;family=Google+Sans+Text:wght@400;500;700&amp;display=swap" rel="stylesheet">',
    '<link rel="stylesheet" href="/features/nlm-ui.css">',
]


def activate(main: str, feature: str) -> str:
    # Reset every active marker, then set the page's own feature.
    main = main.replace(' selected>', ">")
    main = re.sub(r' is-active(?=")', "", main)
    main = main.replace(' aria-current="page"', "")
    main = re.sub(r'(<article class="md-panel" data-panel="[^"]+" id="panel-[^"]+")(?! hidden)>', r"\1 hidden>", main)

    main = main.replace(f'<option value="{feature}">', f'<option value="{feature}" selected>', 1)
    href = "/features" if feature == "overview" else f"/features/{feature}"
    main = re.sub(
        rf'<a class="md-nav-item( md-nav-overview)?" href="{re.escape(href)}" data-feature="{feature}">',
        lambda m: f'<a class="md-nav-item{m.group(1) or ""} is-active" aria-current="page" href="{href}" data-feature="{feature}">',
        main, count=1)
    main = main.replace(
        f'<article class="md-panel" data-panel="{feature}" id="panel-{feature}" hidden>',
        f'<article class="md-panel is-active" data-panel="{feature}" id="panel-{feature}">', 1)
    return main


def main() -> None:
    source = (FEATURES / "index.html").read_text(encoding="utf-8")
    master = MAIN_RE.search(source).group(0)
    changed = 0
    for page in sorted(FEATURES.glob("*.html")):
        text = page.read_text(encoding="utf-8")
        feature = re.search(r'data-initial-feature="([^"]+)"', text).group(1)
        new = MAIN_RE.sub(lambda _: activate(master, feature), text, count=1)
        anchor = '<link rel="stylesheet" href="/features/features.css">'
        for link in HEAD_LINKS:
            if link not in new:
                new = new.replace(anchor, anchor + "\n    " + link, 1)
                anchor = link
            else:
                anchor = link
        if new != text:
            page.write_text(new, encoding="utf-8")
            changed += 1
    print(f"Synced feature pages: {changed} changed")


if __name__ == "__main__":
    main()
