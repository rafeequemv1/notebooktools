#!/usr/bin/env python3
"""Build /notebooklm-slide-styles from the extension's own prompt library.

    python3 scripts/build-slide-styles.py && python3 scripts/sync-site-chrome.py

Reads the styles from notebooktools-extension/prompt-library-data.js and the
preview art from prompt-library.css, so the page always shows exactly the
styles the extension offers.
"""
from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "notebooktools-extension"
OUT = ROOT / "website" / "notebooklm-slide-styles.html"
BASE = "https://www.notebooktools.com"
URL = f"{BASE}/notebooklm-slide-styles"
CHROME = "https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj"

PREVIEW_COPY = {
    "editorial": ("Cover", "Ideas", "Why this matters now"),
    "minimal": ("01. Intro", "Overview", "Clean structure"),
    "yellow-black": ("Feature", "Signal", "Editorial point of view"),
    "agency": ("Pitch", "Launch", "Creative direction"),
    "seminar": ("Talk", "Focus", "One clear message"),
    "manga": ("Scene 1", "Story", "Learn through panels"),
    "magazine": ("No.1", "Edit", "Trend notes"),
    "retro-dev": ("Build", "Agents", "System layers"),
    "street-pop": ("Pop", "Vibes", "Street energy"),
    "watercolor": ("Art", "Mood", "Painted narrative"),
    "neon-tech": ("Fig.1", "Model", "Structural map"),
    "mockup": ("Product", "Studio", "Device showcase"),
    "sports": ("Live", "Drive", "High intensity"),
    "calm-product": ("Flow", "Artifact", "Calm clarity"),
}
CATEGORIES = [("business", "Business"), ("pop", "Pop & bold"), ("artistic", "Artistic"), ("premium", "Premium")]

FAQ = [
    ("How do I change the style of a NotebookLM slide deck?", "Open Studio in your notebook, choose Slide deck, then the customise (pencil) option, and paste a style prompt from this page into the description box before you generate. With the NotebookTools extension you can also type / in the chat and pick a style."),
    ("Do these prompts change what the slides say?", "No. Each prompt describes the look (colours, type, layout) and tells Gemini Notebook to take every fact from your own sources, so the content still comes from your notebook."),
    ("Can I use these slide styles for free?", "Yes. Slide decks are part of NotebookLM's free plan, within its usage limits, and these prompts are free to copy."),
    ("Can I turn the finished deck into a blog post or carousel?", "Yes. NotebookTools can turn a finished deck into a blog post with every slide as an image, or into a LinkedIn or Instagram carousel."),
]


def e(s: str) -> str:
    return html.escape(s, quote=True)


def load_styles() -> list[dict]:
    js = (EXT / "prompt-library-data.js").read_text(encoding="utf-8")
    out = subprocess.run(
        ["node", "-e", js + "\nprocess.stdout.write(JSON.stringify(NotebookToolsPromptLibrary.slideDecks))"],
        check=True, capture_output=True, text=True,
    )
    return json.loads(out.stdout)


def preview_css() -> str:
    css = (EXT / "prompt-library.css").read_text(encoding="utf-8")
    rules = re.findall(r"(\.pl-preview[^{]*\{[^}]*\})", css)
    return "\n".join(rules)


def preview(style: str) -> str:
    kicker, title, sub = PREVIEW_COPY.get(style, PREVIEW_COPY["editorial"])
    return (
        f'<div class="pl-preview pl-preview--{e(style)} pl-preview-large"><div class="pl-preview-inner">'
        f'<span class="pl-preview-accent" aria-hidden="true"></span>'
        f'<span class="pl-preview-kicker">{e(kicker)}</span><span class="pl-preview-title">{e(title)}</span>'
        f'<span class="pl-preview-sub">{e(sub)}</span></div></div>'
    )


def build() -> str:
    styles = load_styles()
    by_cat = {c: [s for s in styles if s["category"] == c] for c, _ in CATEGORIES}
    nav = "".join(f'<a href="#{c}">{e(label)} <span>{len(by_cat[c])}</span></a>' for c, label in CATEGORIES if by_cat[c])
    sections = []
    for cat, label in CATEGORIES:
        if not by_cat[cat]:
            continue
        cards = "".join(
            f"""
            <article class="ss-card" id="{e(s['id'])}">
              {preview(s['preview'])}
              <div class="ss-card-body">
                <div class="ss-card-head"><h3>{e(s['title'])}</h3><span class="ss-badge">{e(s['badge'])}</span></div>
                <p>{e(s['description'])}</p>
                <div class="uc-prompt">
                  <div class="uc-prompt-head"><span>Style prompt</span><button type="button" class="uc-copy" data-copy>Copy</button></div>
                  <pre>{e(s['prompt'])}</pre>
                </div>
              </div>
            </article>"""
            for s in by_cat[cat]
        )
        sections.append(f"""
        <section class="ss-group" id="{cat}">
          <h2>{e(label)}</h2>
          <div class="ss-grid">{cards}
          </div>
        </section>""")

    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": URL, "url": URL, "name": "NotebookLM Slide Deck Styles: 14 Prompts with Previews",
             "isPartOf": {"@type": "WebSite", "name": "NotebookTools", "url": BASE}},
            {"@type": "ItemList", "name": "NotebookLM slide deck styles", "itemListElement": [
                {"@type": "ListItem", "position": i, "name": s["title"], "url": f"{URL}#{s['id']}"} for i, s in enumerate(styles, 1)]},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Slide deck styles", "item": URL}]},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]},
        ],
    }
    faq_html = "".join(f'<details class="uc-faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in FAQ)
    title = f"NotebookLM Slide Deck Styles: {len(styles)} Prompts with Previews | NotebookTools"
    desc = f"{len(styles)} ready-to-paste NotebookLM (Gemini Notebook) slide deck style prompts with previews: editorial, minimal, manga, watercolor, neon tech and more. Copy one into Studio or insert it with /."
    return f"""<!doctype html>
<html lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-K2BJP0Q9LL"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());

      gtag('config', 'G-K2BJP0Q9LL');
    </script>
    <script defer data-site="bqtzsbfj" data-domain="notebooktools.com" src="https://piqo.app/piqo.js"></script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{e(title)}</title>
    <meta name="description" content="{e(desc)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="{URL}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="NotebookTools">
    <meta property="og:title" content="{e(title)}">
    <meta property="og:description" content="{e(desc)}">
    <meta property="og:url" content="{URL}">
    <meta property="og:image" content="{BASE}/assets/blog/og/notebooklm-slide-prompts.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="/assets/favicon.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <style>
{preview_css()}
    </style>
    <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
  </head>
  <body>
    <header class="site-header"></header>

    <main class="uc-page ss-page">
      <section class="uc-hero">
        <p class="eyebrow">Slide deck styles</p>
        <h1>NotebookLM slide deck styles, <span class="grad">ready to paste</span></h1>
        <p class="uc-lead">{len(styles)} style prompts for Gemini Notebook (formerly NotebookLM) slide decks, each with a preview. Copy one into Studio, or insert it with / using the free NotebookTools extension. Your slides still take every fact from your own sources.</p>
        <div class="uc-actions">
          <a class="button button-primary button-lg" href="{CHROME}" target="_blank" rel="noopener noreferrer">Add to Chrome — free</a>
          <a class="button button-ghost button-lg" href="/blog/notebooklm-slide-prompts">How to use slide prompts</a>
        </div>
      </section>

      <section class="uc-section ss-how">
        <ol class="uc-flow">
          <li><span class="uc-flow-n">1</span><b>Open Studio</b><span>In your notebook, choose Slide deck and open the customise option.</span></li>
          <li><span class="uc-flow-n">2</span><b>Paste a style</b><span>Copy a prompt below into the description box. With NotebookTools, type / instead.</span></li>
          <li><span class="uc-flow-n">3</span><b>Generate</b><span>The deck uses that look, with content from your sources.</span></li>
          <li><span class="uc-flow-n">4</span><b>Reuse it</b><span>Turn the deck into a blog post or a LinkedIn carousel.</span></li>
        </ol>
      </section>

      <nav class="ss-cats" aria-label="Style categories">{nav}</nav>
      {''.join(sections)}

      <section class="uc-section uc-faq">
        <div class="section-head center"><h2>Questions</h2></div>
        {faq_html}
      </section>

      <section class="uc-section">
        <div class="uc-cta">
          <div>
            <h2>Every style, one keystroke away</h2>
            <p>NotebookTools puts these styles inside Gemini Notebook: type / and pick one. Free Chrome extension.</p>
          </div>
          <a class="button button-primary button-lg" href="{CHROME}" target="_blank" rel="noopener noreferrer">Add to Chrome — free</a>
        </div>
      </section>
    </main>
    <script>
      document.addEventListener("click", async (event) => {{
        const button = event.target.closest("[data-copy]");
        if (!button) return;
        const text = button.closest(".uc-prompt").querySelector("pre").textContent;
        try {{ await navigator.clipboard.writeText(text); button.textContent = "Copied"; }}
        catch (_) {{ button.textContent = "Select and copy"; }}
        setTimeout(() => {{ button.textContent = "Copy"; }}, 1600);
      }});
    </script>
  </body>
</html>
"""


def main() -> None:
    OUT.write_text(build(), encoding="utf-8")
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
