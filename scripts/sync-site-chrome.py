#!/usr/bin/env python3
"""Apply the shared site chrome (header, footer, fonts, theme) to every page.

The website is plain static HTML with no build step, so the header and footer
are copied into each page. Run this after adding or editing a page so every
page keeps the same navigation:

    python3 scripts/sync-site-chrome.py

It is idempotent: running it twice gives the same result.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "website"

CHROME_STORE = (
    "https://chromewebstore.google.com/detail/"
    "notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj"
)
BUY = "https://dodo.pe/notebooktools-pro"

FONTS = (
    '<link href="https://fonts.googleapis.com/css2?'
    "family=Inter:wght@400;500;600;700"
    "&amp;family=Instrument+Serif:ital@0;1"
    "&amp;family=Roboto:wght@400;500"
    '&amp;display=swap" rel="stylesheet">'
)
THEME = '<link rel="stylesheet" href="/theme.css">'
SITE_JS = '<script src="/site.js" defer></script>'

CHROME_ICON = (
    '<svg class="chrome-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">'
    '<circle cx="12" cy="12" r="11" fill="#fff"/>'
    '<path d="M12 1a11 11 0 0 1 9.53 5.5H12a5.5 5.5 0 0 0-4.76 2.75L3.47 4.5A11 11 0 0 1 12 1Z" fill="#EA4335"/>'
    '<path d="M21.53 6.5A11 11 0 0 1 12 23l4.76-8.25A5.5 5.5 0 0 0 16.76 9.25 5.5 5.5 0 0 0 12 6.5h9.53Z" fill="#FBBC04"/>'
    '<path d="M12 23A11 11 0 0 1 3.47 4.5l4.77 8.25A5.5 5.5 0 0 0 16.76 14.75L12 23Z" fill="#34A853"/>'
    '<circle cx="12" cy="12" r="4.4" fill="#4285F4" stroke="#fff" stroke-width="1.6"/>'
    "</svg>"
)

NAV = [
    ("/features", "Features", "features"),
    ("/#how-it-works", "How it works", None),
    ("/#pricing", "Pricing", None),
    ("/blog", "Blog", "blog"),
    ("/support", "Support", "support"),
]


def section_of(rel: str) -> str | None:
    if rel.startswith("features/"):
        return "features"
    if rel.startswith("blog/"):
        return "blog"
    if rel == "support.html":
        return "support"
    return None


def header_html(rel: str) -> str:
    current = section_of(rel)
    links = []
    for href, label, key in NAV:
        attr = ' aria-current="page"' if key and key == current else ""
        links.append(f'          <a href="{href}"{attr}>{label}</a>')
    nav = "\n".join(links)
    return f"""<header class="site-header">
      <div class="site-header-inner">
        <a class="logo" href="/" aria-label="NotebookTools home">
          <img class="logo-img logo-mark-header" src="/assets/logo-mark-32.png" alt="" width="32" height="32">
          <span class="logo-text">NotebookTools</span>
        </a>
        <nav class="site-nav" id="site-nav" aria-label="Main">
{nav}
          <div class="site-nav-actions">
            <a class="button button-ghost" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}Add to Chrome</a>
            <a class="button button-primary" href="{BUY}" target="_blank" rel="noopener noreferrer">Get Pro — $49</a>
          </div>
        </nav>
        <div class="header-actions">
          <a class="header-chrome" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}<span>Add to Chrome</span></a>
          <a class="button button-primary button-sm header-buy" href="{BUY}" target="_blank" rel="noopener noreferrer">Get Pro</a>
          <button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">
            <span></span><span></span>
          </button>
        </div>
      </div>
    </header>"""


FOOTER = f"""<footer class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="logo" href="/" aria-label="NotebookTools home">
              <img class="logo-img logo-mark-header" src="/assets/logo-mark-32.png" alt="" width="32" height="32">
              <span class="logo-text">NotebookTools</span>
            </a>
            <p>The Chrome extension for NotebookLM. Import faster, organize every notebook, and get more from your research. Free to start, Pro for life.</p>
            <a class="header-chrome footer-chrome" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}<span>Add to Chrome</span></a>
          </div>
          <nav class="footer-col" aria-label="Product">
            <h2>Product</h2>
            <a href="/features">Features</a>
            <a href="/#notebooks-app">Notebooks app</a>
            <a href="/#how-it-works">How it works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#install">Install</a>
          </nav>
          <nav class="footer-col" aria-label="Resources">
            <h2>Resources</h2>
            <a href="/blog">Blog</a>
            <a href="/blog/what-is-notebooklm">What is NotebookLM?</a>
            <a href="/blog/best-notebooklm-prompts">NotebookLM prompts</a>
            <a href="/blog/notebooklm-tutorial-beginners">Beginner tutorial</a>
          </nav>
          <nav class="footer-col" aria-label="Company">
            <h2>Company</h2>
            <a href="/support">Support</a>
            <a href="/privacy">Privacy policy</a>
            <a href="https://github.com/rafeequemv1/notebooktools" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">NotebookLM ↗</a>
          </nav>
        </div>
        <div class="footer-bottom">
          <p>© 2026 NotebookTools</p>
          <p>An independent tool for NotebookLM. Not affiliated with Google.</p>
        </div>
      </div>
    </footer>"""

HEADER_RE = re.compile(r'<header class="site-header">.*?</header>', re.S)
FOOTER_RE = re.compile(r'<footer class="site-footer">.*?</footer>', re.S)
FONT_RE = re.compile(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">')
STYLESHEET_RE = re.compile(r'<link rel="stylesheet" href="[^"]*(styles|features)\.css">')


def sync(path: Path) -> bool:
    rel = path.relative_to(SITE).as_posix()
    src = path.read_text(encoding="utf-8")
    out = src

    if not HEADER_RE.search(out):
        print(f"  skip (no site header): {rel}")
        return False
    out = HEADER_RE.sub(lambda _: header_html(rel), out, count=1)

    if FOOTER_RE.search(out):
        out = FOOTER_RE.sub(lambda _: FOOTER, out, count=1)
    else:
        # Put the footer after </main> (or before the closing body tag).
        anchor = "</main>" if "</main>" in out else "</body>"
        i = out.rfind(anchor)
        if anchor == "</main>":
            i += len(anchor)
        out = out[:i] + "\n\n    " + FOOTER + "\n" + out[i:]

    # Normalise stylesheet paths to absolute so every page shares one cache entry.
    out = re.sub(r'href="(?:\.\./)*styles\.css"', 'href="/styles.css"', out)

    first_font = FONT_RE.search(out)
    if first_font:
        # Replace every Google Fonts link with the single shared one.
        start = first_font.start()
        out = FONT_RE.sub("", out)
        out = out[:start] + FONTS + out[start:]
    if THEME not in out:
        last = None
        for m in STYLESHEET_RE.finditer(out):
            last = m
        if last is None:
            print(f"  warn (no stylesheet link): {rel}")
        else:
            out = out[: last.end()] + "\n    " + THEME + out[last.end():]

    if SITE_JS not in out:
        i = out.rfind("</body>")
        out = out[:i] + "  " + SITE_JS + "\n  " + out[i:]

    if out != src:
        path.write_text(out, encoding="utf-8")
        return True
    return False


def main() -> int:
    pages = sorted(SITE.rglob("*.html"))
    changed = sum(sync(p) for p in pages)
    print(f"Synced site chrome: {changed} of {len(pages)} pages changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
