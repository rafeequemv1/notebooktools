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
NLM = FEATURES / "nlm"
SCRIPTS_BEFORE_DEMO = [
    '<script src="/features/nlm/nlm-config.js"></script>',
    '<script src="/features/nlm/nlm-shell.js"></script>',
    '<script src="/features/surfaces/surfaces.js"></script>',
]
SCRIPTS_AFTER_DEMO = [
    '<script src="/features/demo-scenes.js"></script>',
]


def icon_names() -> str:
    """Every Material Symbol the demos use: "ms:<name>" or ms("<name>") in
    the shell/surface scripts, and nlm-ms glyphs written into the markup."""
    names = set()
    for f in [NLM / "nlm-config.js", NLM / "nlm-shell.js", FEATURES / "surfaces" / "surfaces.js", FEATURES / "demo-scenes.js"]:
        text = f.read_text(encoding="utf-8")
        names |= set(re.findall(r'"ms:([a-z0-9_]+)"', text))
        names |= set(re.findall(r'\bms\("([a-z0-9_]+)"', text))
    html = (FEATURES / "index.html").read_text(encoding="utf-8")
    names |= set(re.findall(r'class="nlm-ms[^"]*"[^>]*>([a-z0-9_]+)<', html))
    return ",".join(sorted(names))


def head_links() -> list:
    return [
        '<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&amp;family=Google+Sans+Text:wght@400;500;700&amp;display=swap" rel="stylesheet">',
        '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0,0&amp;icon_names='
        + icon_names() + '&amp;display=block" rel="stylesheet">',
        '<link rel="stylesheet" href="/features/nlm/nlm-ui.css">',
        '<link rel="stylesheet" href="/features/surfaces/surfaces.css">',
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
        # Drop older copies of the NotebookLM links, then add the current ones.
        new = re.sub(r'\n\s*<link href="https://fonts\.googleapis\.com/css2\?family=(Google\+Sans|Material\+Symbols)[^"]*" rel="stylesheet">', "", new)
        new = re.sub(r'\n\s*<link rel="stylesheet" href="/features/((nlm/)?nlm-ui|surfaces/surfaces)\.css">', "", new)
        anchor = '<link rel="stylesheet" href="/features/features.css">'
        new = new.replace(anchor, anchor + "".join("\n    " + l for l in head_links()), 1)
        demo = '<script src="/features/demo.js"></script>'
        for tag in SCRIPTS_BEFORE_DEMO:
            if tag not in new:
                new = new.replace(demo, tag + "\n    " + demo, 1)
        for tag in reversed(SCRIPTS_AFTER_DEMO):
            if tag not in new:
                new = new.replace(demo, demo + "\n    " + tag, 1)
        if new != text:
            page.write_text(new, encoding="utf-8")
            changed += 1
    print(f"Synced feature pages: {changed} changed")


if __name__ == "__main__":
    main()
