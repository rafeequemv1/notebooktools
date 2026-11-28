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
# Pro checkout. Points to the pricing section until the Dodo product for
# NotebookTools Pro exists in the Scidart business; then set the checkout URL.
BUY = "/#pricing"

FONTS = (
    '<link href="https://fonts.googleapis.com/css2?'
    "family=Google+Sans:wght@400;500;600;700"
    "&amp;family=Google+Sans+Text:wght@400;500;700"
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

AUDIENCES = [
    ("/students", "Students", "students", "Study guides, flashcards and revision podcasts", '<path d="M3 9l9-5 9 5-9 5-9-5Z"/><path d="M7 11.5V16c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.5"/>'),
    ("/teachers", "Teachers", "teachers", "Lesson plans, quizzes and class materials", '<rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M8 20h8M12 15.5V20"/>'),
    ("/researchers", "Researchers", "researchers", "Literature reviews and well-managed sources", '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'),
    ("/creators", "Content creators", "creators", "Research, scripts, posts and carousels", '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
]

NAV = [
    ("/features", "Features", "features"),
    ("/tools/edit-notebooklm-slides", "Slide editor", "editor"),
    ("@audiences", "Who it's for", None),
    ("/#pricing", "Pricing", None),
    ("/blog", "Blog", "blog"),
    ("/tools", "Free tools", "tools"),
    ("/support", "Support", "support"),
]


def section_of(rel: str) -> str | None:
    if rel == "tools/edit-notebooklm-slides.html" or rel.startswith(("es/editar-", "pt/editar-", "zh-tw/edit-")):
        return "editor"
    if rel.startswith("features/"):
        return "features"
    if rel.startswith("blog/"):
        return "blog"
    if rel.startswith("tools/"):
        return "tools"
    if rel == "support.html":
        return "support"
    if rel in ("researchers.html", "creators.html", "teachers.html", "students.html"):
        return rel[:-5]
    return None


def header_html(rel: str) -> str:
    current = section_of(rel)
    links = []
    for href, label, key in NAV:
        if href == "@audiences":
            on = current in [k for _h, _l, k, _d, _i in AUDIENCES]
            items = "\n".join(
                f'              <a class="nav-menu-item" href="{h}"{" aria-current=\"page\"" if k == current else ""}>'
                f'<span class="nav-menu-ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{ico}</svg></span>'
                f'<span class="nav-menu-text"><strong>{l}</strong><small>{d}</small></span></a>'
                for h, l, k, d, ico in AUDIENCES)
            links.append(f"""          <div class="nav-menu">
            <button type="button" class="nav-menu-btn{" is-current" if on else ""}" aria-expanded="false" aria-haspopup="true">{label}<svg class="nav-menu-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
            <div class="nav-menu-panel">
{items}
            </div>
          </div>""")
            continue
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
            <a class="button button-primary" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}Add to Chrome — free</a>
            <a class="button button-ghost" href="{BUY}">Get Pro — $49</a>
          </div>
        </nav>
        <div class="header-actions">
          <a class="button button-primary button-sm header-cta" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}<span>Add to Chrome</span></a>
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
            <a href="/students">For students</a>
            <a href="/teachers">For teachers</a>
            <a href="/researchers">For researchers</a>
            <a href="/creators">For content creators</a>
            <a href="/#how-it-works">How it works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#install">Install</a>
          </nav>
          <nav class="footer-col" aria-label="Resources">
            <h2>Resources</h2>
            <a href="/blog">Blog</a>
            <a href="/blog/what-is-notebooklm">What is NotebookLM?</a>
            <a href="/blog/best-notebooklm-prompts">NotebookLM prompts</a>
            <a href="/notebooklm-slide-styles">Slide deck styles</a>
            <a href="/blog/notebooklm-tutorial-beginners">Beginner tutorial</a>
          </nav>
          <nav class="footer-col" aria-label="Free tools">
            <h2>Free tools</h2>
            <a href="/tools/edit-notebooklm-slides">Edit NotebookLM slides (PPTX)</a>
            <a href="/tools/split-pdf-for-notebooklm">Split PDF for NotebookLM</a>
            <a href="/tools/merge-pdf">Merge PDFs</a>
            <a href="/tools/pdf-to-text">PDF to text</a>
            <a href="/tools/image-to-text-ocr">Image to text (OCR)</a>
            <a href="/tools/notebooklm-prompts">NotebookLM prompt library</a>
            <a href="/tools">All 13 free tools →</a>
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
# Only the text fonts (Google Sans) are shared. Other font links, such as the
# Material Symbols icon font on the feature pages, are left alone.
FONT_RE = re.compile(r'<link href="https://fonts\.googleapis\.com/css2\?family=Google\+Sans[^"]*" rel="stylesheet">')
STYLESHEET_RE = re.compile(r'<link rel="stylesheet" href="[^"]*(styles|features)\.css">')


# Translated pages carry their own translated header and footer; never
# overwrite them with the English chrome.
LOCALIZED_DIRS = ("de/", "es/", "fr/", "it/", "nl/", "pt/")


def sync(path: Path) -> bool:
    rel = path.relative_to(SITE).as_posix()
    if rel.startswith(LOCALIZED_DIRS):
        return False
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
