#!/usr/bin/env python3
"""Build the free tools section: website/tools/*.html plus a Markdown twin of
each page (for AI crawlers and answer engines), from the definitions below.

    python3 scripts/build-tools-pages.py
    python3 scripts/sync-site-chrome.py     # adds the shared header and footer

The tools themselves are plain JS files in website/tools/ and run entirely in
the browser. The slide styles are copied from the extension so they never
drift apart.
"""
from __future__ import annotations

import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"
OUT = SITE / "tools"
BASE = "https://www.notebooktools.com"
UPDATED = "2026-11-21"
UPDATED_LABEL = "November 21, 2026"
CHROME_STORE = (
    "https://chromewebstore.google.com/detail/"
    "notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj"
)

ICONS = {
    "prompt": '<path d="M5 5h14v10H9l-4 4V5Z"/><path d="M9 9h6M9 12h4"/>',
    "links": '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    "split": '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M4 12h16" stroke-dasharray="2 2"/>',
    "clean": '<path d="M4 6h10M4 10h16M4 14h12M4 18h8"/><path d="m16 16 4 4M20 16l-4 4"/>',
}

LOCK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>'

E = html.escape


def icon(name: str, size: int = 22) -> str:
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "slug": "notebooklm-prompts",
        "icon": "prompt",
        "name": "NotebookLM Prompt Library",
        "card": "27 fill-in-the-blank prompts for chat, Audio and Video Overviews, slide decks, reports, flashcards, quizzes and infographics.",
        "title": "NotebookLM Prompt Library: 27 Fill-in Prompts (Free)",
        "description": "Free NotebookLM prompt library: 27 prompts for chat, Audio Overview, Video Overview, slide decks, reports, flashcards, quizzes and infographics. Fill the blanks, copy, paste.",
        "h1": "NotebookLM Prompt Library",
        "answer": "Pick where the prompt goes (chat, Audio Overview, Video Overview, slide deck, report, flashcards, quiz or infographic), choose a prompt, and type into the highlighted blanks right inside the text. Copy it and follow the \"Paste it here\" steps. Slide deck prompts can add one of 14 visual styles. All 27 prompts tell NotebookLM to stay within your sources.",
        "script": "prompt-library.js",
        "extra_scripts": ["slide-styles.js"],
        "raw_app": '<section class="pl-app" id="plApp" aria-label="NotebookLM prompt library"><p class="tool-empty">Loading prompts…</p></section>',
        "steps": [
            "Choose where the prompt goes with the tabs (Chat, Audio Overview, Slide deck…) and, if you like, a job such as Study or Research.",
            "Click a prompt card.",
            "Type into the highlighted blanks inside the prompt, or click \"Use examples\".",
            "For a slide deck, pick a visual style (optional).",
            "Copy the prompt and follow the \"Paste it here\" steps for that destination.",
        ],
        "faq": [
            ("What makes a good NotebookLM prompt?", "Name the output, the audience, the length and the focus, and tell NotebookLM to stay within your sources. Specific formats (a table, 10 questions, 8 slides) work better than open questions."),
            ("Where do I paste a prompt in NotebookLM?", "Chat prompts go in the chat box at the bottom of the notebook. Studio prompts go in the Customise box of that output: click the pencil on Audio Overview, Video Overview, Slide deck, Flashcards, Quiz or Infographic, or choose Reports, then Create your own."),
            ("Do these prompts work in Gemini Notebook?", "Yes. Gemini Notebook is the new name for NotebookLM; the chat and Studio work the same way."),
            ("Can I use these prompts inside NotebookLM without copying?", "Yes, with the free NotebookTools Chrome extension: type / in the NotebookLM chat for your prompts, and slide styles appear as cards in the slide deck dialog (Pro)."),
        ],
        "links": [("/blog/notebooklm-prompts-for-studying", "30 NotebookLM prompts for studying"), ("/blog/notebooklm-slide-prompts", "NotebookLM slide prompts"), ("/notebooklm-slide-styles", "Slide deck style gallery"), ("/blog/best-notebooklm-prompts", "Best NotebookLM prompts for research")],
        "cta": "<strong>Use them inside NotebookLM.</strong> With NotebookTools, prompts are one / away in the chat and slide styles appear as cards in the slide deck dialog.",
    },
    {
        "slug": "link-list-cleaner",
        "icon": "links",
        "name": "Link List Cleaner",
        "card": "Paste notes, a reading list or HTML. Get a clean list of unique links, ready to add to NotebookLM.",
        "title": "Link List Cleaner for NotebookLM: Extract & Dedupe URLs",
        "description": "Free link cleaner: paste any text or HTML and get a clean, de-duplicated list of URLs and YouTube links, with tracking removed and a count against NotebookLM's 50-source limit.",
        "h1": "Link List Cleaner for NotebookLM",
        "answer": "Paste anything that contains links (notes, a chat export, an email, HTML) and this tool pulls out every URL, removes duplicates and tracking parameters, normalises YouTube links, and counts them against NotebookLM's limit of 50 sources per notebook on the free plan. Copy the list or download it as a .txt file.",
        "script": "link-list-cleaner.js",
        "app": """
      <div class="tool-pane">
        <div class="tool-pane-head"><h2>Paste text or HTML</h2><button type="button" class="tool-btn" id="llcSample">Try a sample</button></div>
        <textarea id="llcInput" placeholder="Paste notes, a reading list, an email or HTML…" aria-label="Text with links"></textarea>
        <div class="tool-checks">
          <label><input type="checkbox" id="llcTracking" checked> Remove tracking (utm, fbclid…)</label>
          <label><input type="checkbox" id="llcAnchors" checked> Drop #anchors</label>
        </div>
        <div class="tool-field"><label for="llcOnly">Keep</label>
          <select id="llcOnly"><option value="all">All links</option><option value="youtube">YouTube only</option><option value="web">Web pages only</option></select></div>
      </div>
      <div class="tool-pane">
        <div class="tool-pane-head"><h2>Clean links</h2><span class="tool-stats" id="llcStats"></span></div>
        <textarea id="llcOutput" class="is-output" readonly aria-label="Clean link list"></textarea>
        <p class="tool-note" id="llcNote" hidden></p>
        <div class="tool-actions"><button type="button" class="tool-btn is-primary" id="llcCopy" disabled>Copy links</button><button type="button" class="tool-btn" id="llcDownload" disabled>Download .txt</button></div>
      </div>""",
        "steps": [
            "Paste text or HTML that contains links.",
            "Keep tracking removal on, and choose all links, YouTube only or web pages only.",
            "Check the count against NotebookLM's 50-sources-per-notebook limit.",
            "Copy the list or download it, then add the links to your notebook.",
        ],
        "faq": [
            ("How many links can I add to one NotebookLM notebook?", "Each link becomes one source. The free plan allows 50 sources per notebook; Google AI Plus allows 100, Google AI Pro 300 and Ultra 500+."),
            ("Does it remove duplicate links?", "Yes. Links that point to the same page are kept once, including YouTube short links (youtu.be) and full watch links for the same video."),
            ("What tracking does it remove?", "Common tracking parameters such as utm_source, utm_medium, fbclid, gclid and similar. The rest of the link is kept."),
            ("Is my text uploaded?", "No. Everything runs in your browser; nothing leaves your device."),
        ],
        "links": [("/features/bulk-import", "Bulk import to NotebookLM"), ("/blog/notebooklm-source-limits", "NotebookLM source limits"), ("/blog/youtube-to-notebooklm", "YouTube to NotebookLM"), ("/blog/best-ways-import-content-notebooklm", "Ways to import content into NotebookLM")],
        "cta": "<strong>Import the whole list in one click.</strong> NotebookTools takes pasted links, your open tabs or a YouTube playlist and adds every one to the notebook you pick. Free.",
    },
    {
        "slug": "text-splitter",
        "icon": "split",
        "name": "Text Splitter for NotebookLM",
        "card": "Too long for one source? Split a transcript or book into parts that fit NotebookLM's 500,000-word limit.",
        "title": "Split Long Text for NotebookLM (500,000-Word Limit)",
        "description": "Free text splitter for NotebookLM: cut long transcripts, books or notes into parts under 500,000 words (or a size you choose) at paragraph breaks, then copy or download each part.",
        "h1": "Text Splitter for NotebookLM",
        "answer": "NotebookLM accepts up to 500,000 words or 200 MB per source on every plan. If your text is longer, split it here: paste it or open a .txt or .md file, pick a part size, and the tool cuts it at paragraph breaks into numbered parts you can copy or download and add as separate sources.",
        "script": "text-splitter.js",
        "app": """
      <div class="tool-pane">
        <div class="tool-pane-head"><h2>Your text</h2><span class="tool-stats" id="tsStats"></span></div>
        <textarea id="tsInput" placeholder="Paste a long transcript, book or notes…" aria-label="Text to split"></textarea>
        <div class="tool-row">
          <div class="tool-field"><label for="tsTitle">Title</label><input type="text" id="tsTitle" placeholder="e.g. Lecture transcripts" maxlength="80"></div>
          <div class="tool-field"><label for="tsFile">Or open a file</label><input type="file" id="tsFile" accept=".txt,.md,.markdown,.csv,text/plain"></div>
        </div>
        <div class="tool-field"><label for="tsSize">Words per part</label>
          <select id="tsSize"><option value="500000">500,000 (NotebookLM maximum)</option><option value="200000">200,000</option><option value="100000">100,000</option><option value="50000">50,000 (sharper answers)</option><option value="custom">Custom…</option></select>
          <input type="number" id="tsCustom" min="1000" step="1000" value="25000" hidden aria-label="Custom words per part"></div>
      </div>
      <div class="tool-pane">
        <div class="tool-pane-head"><h2>Parts</h2></div>
        <div class="tool-parts" id="tsParts"></div>
      </div>""",
        "steps": [
            "Paste your text, or open a .txt or .md file.",
            "Give it a title so the parts are named, for example \"Lecture transcripts (part 1 of 3)\".",
            "Pick a part size: the 500,000-word maximum, or smaller parts for sharper answers.",
            "Copy or download each part and add it to NotebookLM as its own source.",
        ],
        "faq": [
            ("What is NotebookLM's limit per source?", "Up to 500,000 words or 200 MB per source, on every plan, including the free one."),
            ("Why split into smaller parts than the limit?", "Smaller, focused sources often give more precise citations, and each part can be added or removed on its own. The trade-off is that each part uses one of your notebook's source slots."),
            ("Does it cut sentences in half?", "No. It splits at paragraph breaks, then at sentence ends if a single paragraph is too long."),
            ("Is my file uploaded?", "No. The file is read and split in your browser."),
        ],
        "links": [("/blog/notebooklm-source-limits", "NotebookLM source limits"), ("/blog/notebooklm-pricing-plans", "NotebookLM plans and limits"), ("/features/manage-sources", "Manage NotebookLM sources"), ("/blog/notebooklm-not-working", "NotebookLM import errors and fixes")],
        "cta": "<strong>See every limit before you hit it.</strong> NotebookTools shows a source meter on each notebook and imports links, tabs and playlists in bulk. Free.",
    },
    {
        "slug": "notebooklm-answer-cleaner",
        "icon": "clean",
        "name": "NotebookLM Answer Cleaner",
        "card": "Copied an answer from NotebookLM? Strip the citation numbers and … markers. Get clean text or Markdown.",
        "title": "Clean NotebookLM Answers: Remove Citation Numbers",
        "description": "Free NotebookLM answer cleaner: paste a copied chat answer and remove citation numbers, [1]-style references and … markers, then copy clean text or Markdown.",
        "h1": "NotebookLM Answer Cleaner",
        "answer": "When you copy an answer out of NotebookLM, the citation numbers (like \"6\" or \"9 10\") and \"…\" markers come along. Paste the answer here to remove them, tidy the spacing and bullets, and copy the result as clean plain text or Markdown with the bold and headings kept.",
        "script": "answer-cleaner.js",
        "app": """
      <div class="tool-pane">
        <div class="tool-pane-head"><h2>Paste a NotebookLM answer</h2><button type="button" class="tool-btn" id="acSample">Try a sample</button></div>
        <textarea id="acInput" placeholder="Paste text copied from a NotebookLM chat answer…" aria-label="NotebookLM answer"></textarea>
        <div class="tool-checks">
          <label><input type="checkbox" id="acCitations" checked> Remove citation numbers</label>
          <label><input type="checkbox" id="acSpacing" checked> Tidy spacing</label>
        </div>
        <div class="tool-field"><label for="acFormat">Output</label>
          <select id="acFormat"><option value="markdown">Markdown (keeps bold and headings)</option><option value="plain">Plain text</option></select></div>
      </div>
      <div class="tool-pane">
        <div class="tool-pane-head"><h2>Clean answer</h2><span class="tool-stats" id="acStats"></span></div>
        <textarea id="acOutput" class="is-output" readonly aria-label="Clean answer"></textarea>
        <div class="tool-actions"><button type="button" class="tool-btn is-primary" id="acCopy" disabled>Copy</button><button type="button" class="tool-btn" id="acDownload" disabled>Download</button></div>
      </div>""",
        "steps": [
            "In NotebookLM, copy the answer (the copy button under the answer, or select and copy).",
            "Paste it here.",
            "Keep citation removal on and choose Markdown or plain text.",
            "Copy the clean answer or download it.",
        ],
        "faq": [
            ("Why does a copied NotebookLM answer have numbers in it?", "Those are the citation chips that link each claim to a source passage. When copied as text they turn into bare numbers and \"…\" markers."),
            ("Will it remove numbers that are part of my content?", "It only removes short numbers that sit right before punctuation or a line end, the way citation chips do, plus [1]-style references. Years and numbers inside sentences are kept."),
            ("Can I keep the citations instead?", "Turn off \"Remove citation numbers\". To export answers with formatting and sources intact, use NotebookTools chat export."),
            ("Is the answer uploaded?", "No. Everything runs in your browser."),
        ],
        "links": [("/blog/export-notebooklm-to-pdf", "Export NotebookLM to PDF, Word or Markdown"), ("/features/chat-export", "Chat export for NotebookLM"), ("/blog/what-is-notebooklm", "What is NotebookLM?"), ("/blog/notebooklm-privacy", "NotebookLM privacy")],
        "cta": "<strong>Export answers already clean.</strong> NotebookTools saves the last answer or the whole chat as PDF, Word or Markdown in one click (Pro).",
    },
]

HUB = {
    "title": "Free NotebookLM Tools: Prompts, Links, Splitter, Answers",
    "description": "Free browser tools for NotebookLM users: build prompts and slide styles, clean link lists, split long text under the 500,000-word limit, and clean copied answers. Nothing is uploaded.",
    "h1": "Free tools for NotebookLM",
    "answer": "Four free tools for people who work in NotebookLM (now Gemini Notebook), all running in your browser with nothing uploaded: a prompt builder with 14 slide deck styles, a link list cleaner that counts against the 50-source limit, a text splitter for the 500,000-word-per-source limit, and an answer cleaner that strips citation numbers.",
}


# ---------------------------------------------------------------------------
# Page parts
# ---------------------------------------------------------------------------
def head(title: str, description: str, path: str, schema: dict) -> str:
    url = f"{BASE}{path}"
    md = f"{path}.md" if path != "/tools" else "/tools/index.md"
    return f"""<!doctype html>
<html lang="en">
  <head>
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
    <title>{E(title)}</title>
    <meta name="description" content="{E(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="{url}">
    <link rel="alternate" hreflang="en" href="{url}">
    <link rel="alternate" hreflang="x-default" href="{url}">
    <link rel="alternate" type="text/markdown" href="{md}" title="Markdown version">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="NotebookTools">
    <meta property="og:locale" content="en_US">
    <meta property="og:title" content="{E(title)}">
    <meta property="og:description" content="{E(description)}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{BASE}/assets/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{E(title)}">
    <meta name="twitter:description" content="{E(description)}">
    <meta name="twitter:image" content="{BASE}/assets/og-image.png">
    <link rel="icon" href="/assets/favicon.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&amp;family=Google+Sans+Text:wght@400;500;700&amp;family=Roboto:wght@400;500&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/theme.css">
    <link rel="stylesheet" href="/tools/tools.css">
    <script type="application/ld+json">
{json.dumps(schema, indent=2, ensure_ascii=False)}
    </script>
  </head>"""


BADGES = f"""<div class="tools-badges">
          <span class="tools-badge">{CHECK}Free, no sign-up</span>
          <span class="tools-badge">{LOCK}Runs in your browser. Nothing is uploaded.</span>
          <span class="tools-badge">Updated <time datetime="{UPDATED}">{UPDATED_LABEL}</time></span>
        </div>"""


def cta(text: str) -> str:
    return f"""<aside class="tool-cta" aria-label="NotebookTools Chrome extension">
        <p>{text}</p>
        <a class="button" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">Add to Chrome, free</a>
      </aside>"""


def breadcrumb(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": name, "item": f"{BASE}{path}"} for i, (name, path) in enumerate(items)]}


def faq_schema(faq):
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}


def other_tools(slug: str) -> str:
    cards = []
    for t in TOOLS:
        if t["slug"] == slug:
            continue
        cards.append(f"""<a class="tool-card" href="/tools/{t['slug']}">
            <span class="tool-card-icon">{icon(t['icon'])}</span>
            <h2>{E(t['name'])}</h2>
            <p>{E(t['card'])}</p>
          </a>""")
    return "\n          ".join(cards)


def tool_page(t: dict) -> str:
    path = f"/tools/{t['slug']}"
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebApplication", "name": t["name"], "url": f"{BASE}{path}", "description": t["description"],
         "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (runs in the browser)",
         "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
         "dateModified": UPDATED, "publisher": {"@type": "Organization", "name": "NotebookTools", "url": BASE}},
        {"@type": "HowTo", "name": f"How to use the {t['name']}", "step": [
            {"@type": "HowToStep", "position": i + 1, "text": s} for i, s in enumerate(t["steps"])]},
        faq_schema(t["faq"]),
        breadcrumb([("Home", "/"), ("Free tools", "/tools"), (t["name"], path)]),
    ]}
    scripts = "".join(f'\n    <script src="/tools/{s}"></script>' for s in ["tools.js", *t.get("extra_scripts", []), t["script"]])
    if t.get("raw_app"):
        app_html = t["raw_app"]
    else:
        app_html = '<section class="tool-app" aria-label="' + E(t["name"]) + '">' + t["app"] + "\n      </section>"
    steps = "".join(f"<li>{E(s)}</li>" for s in t["steps"])
    faq = "".join(f"<h3>{E(q)}</h3><p>{E(a)}</p>" for q, a in t["faq"])
    links = "".join(f'<li><a href="{h}">{E(l)}</a></li>' for h, l in t["links"])
    return f"""{head(t['title'], t['description'], path, schema)}
  <body>
    <header class="site-header"></header>

    <main class="tools-main">
      <nav class="blog-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/tools">Free tools</a> <span aria-hidden="true">/</span> <span>{E(t['name'])}</span></nav>
      <section class="tools-hero">
        <p class="eyebrow">Free tool</p>
        <h1>{E(t['h1'])}</h1>
        <div class="post-answer"><p class="post-answer-label">Short answer</p><p>{E(t['answer'])}</p></div>
        {BADGES}
      </section>

      {app_html}

      {cta(t['cta'])}

      <article class="tools-copy">
        <h2 id="how-to">How to use it</h2>
        <ol>{steps}</ol>
        <h2 id="faq">FAQ</h2>
        {faq}
        <h2 id="related">Related guides</h2>
        <ul>{links}</ul>
        <p>Also available as <a href="{path}.md">Markdown</a>.</p>
      </article>

      <section class="tools-more" aria-label="More free tools">
        <h2>More free tools</h2>
        <div class="tools-grid">
          {other_tools(t['slug'])}
        </div>
      </section>
    </main>

    <footer class="site-footer"></footer>
{scripts}
  </body>
</html>
"""


def hub_page() -> str:
    path = "/tools"
    faq = [
        ("Are these NotebookLM tools free?", "Yes. All four are free with no sign-up, and they run in your browser, so nothing you paste or open is uploaded."),
        ("Are these tools made by Google?", "No. NotebookTools is independent and not affiliated with Google. The tools work with NotebookLM (now Gemini Notebook) as it is today."),
        ("What is the NotebookTools extension?", "A Chrome extension for NotebookLM: one-click imports from YouTube, web pages, X and AI chats are free; Pro ($49 once) adds a notebooks dashboard, source manager, slide style cards, chat export and more."),
    ]
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": HUB["h1"], "url": f"{BASE}{path}", "description": HUB["description"], "dateModified": UPDATED},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": f"{BASE}/tools/{t['slug']}", "name": t["name"]} for i, t in enumerate(TOOLS)]},
        faq_schema(faq),
        breadcrumb([("Home", "/"), ("Free tools", path)]),
    ]}
    cards = "\n        ".join(f"""<a class="tool-card" href="/tools/{t['slug']}">
          <span class="tool-card-icon">{icon(t['icon'])}</span>
          <h2>{E(t['name'])}</h2>
          <p>{E(t['card'])}</p>
          <span class="tool-card-tag">Open tool →</span>
        </a>""" for t in TOOLS)
    faq_html = "".join(f"<h3>{E(q)}</h3><p>{E(a)}</p>" for q, a in faq)
    return f"""{head(HUB['title'], HUB['description'], path, schema)}
  <body>
    <header class="site-header"></header>

    <main class="tools-main">
      <section class="tools-hero">
        <p class="eyebrow">Free tools</p>
        <h1>{E(HUB['h1'])}</h1>
        <div class="post-answer"><p class="post-answer-label">Short answer</p><p>{E(HUB['answer'])}</p></div>
        {BADGES}
      </section>

      <div class="tools-grid">
        {cards}
      </div>

      {cta("<strong>Do it inside NotebookLM.</strong> NotebookTools imports links, tabs, YouTube playlists and AI chats into any notebook in one click, and adds a source meter, slide style cards and chat export.")}

      <article class="tools-copy">
        <h2 id="faq">FAQ</h2>
        {faq_html}
        <p>Guides: <a href="/blog/what-is-notebooklm">What is NotebookLM?</a> · <a href="/blog/is-notebooklm-free">Is NotebookLM free?</a> · <a href="/blog/notebooklm-source-limits">Source limits</a> · <a href="/blog/notebooklm-prompts-for-studying">Prompts for studying</a>. Also available as <a href="/tools/index.md">Markdown</a>.</p>
      </article>
    </main>

    <footer class="site-footer"></footer>
  </body>
</html>
"""


def tool_md(t: dict) -> str:
    steps = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(t["steps"]))
    faq = "\n\n".join(f"### {q}\n\n{a}" for q, a in t["faq"])
    links = "\n".join(f"- [{l}]({BASE}{h})" for h, l in t["links"])
    cta_text = html.unescape(t["cta"].replace("<strong>", "**").replace("</strong>", "**"))
    return f"""# {t['h1']}

> {t['answer']}

- Tool: {BASE}/tools/{t['slug']}
- Price: free, no sign-up
- Privacy: runs in your browser; nothing is uploaded
- Updated: {UPDATED}

## How to use it

{steps}

## FAQ

{faq}

## Related guides

{links}

## Do it inside NotebookLM

{cta_text} Install NotebookTools: {CHROME_STORE}

NotebookTools is independent and not affiliated with Google.
"""


def hub_md() -> str:
    items = "\n".join(f"- [{t['name']}]({BASE}/tools/{t['slug']}): {t['card']}" for t in TOOLS)
    return f"""# {HUB['h1']}

> {HUB['answer']}

Updated: {UPDATED}

## Tools

{items}

## About

All tools are free, need no sign-up and run in your browser. NotebookTools is a Chrome extension for NotebookLM (now Gemini Notebook): {CHROME_STORE}. Independent; not affiliated with Google.
"""


# ---------------------------------------------------------------------------
# One page per prompt: /tools/notebooklm-prompts/<id> (+ Markdown twin)
# ---------------------------------------------------------------------------
PROMPT_DIR = OUT / "notebooklm-prompts"


def load_prompts() -> dict:
    return json.loads((OUT / "prompts.json").read_text(encoding="utf-8"))


def blank_html(p: dict) -> str:
    out = E(p["prompt"])
    for b in p["blanks"]:
        out = out.replace("{{" + b["key"] + "}}", f'<span class="pp-blank">[{E(b["label"])}]</span>')
    return out


def blank_text(p: dict, examples: bool = False) -> str:
    out = p["prompt"]
    for b in p["blanks"]:
        out = out.replace("{{" + b["key"] + "}}", b["example"] if examples else f"[{b['label']}]")
    return out


def prompt_faq(p: dict, dest: dict) -> list:
    where = " ".join(dest["where"])
    return [
        (f"Where do I paste a NotebookLM {dest['label'].lower()} prompt?", where),
        ("What do the [brackets] mean?", "They are blanks. Replace each one with your own words before you paste the prompt, or fill them in the prompt library, which shows them as fields inside the text."),
        ("Does this prompt work in Gemini Notebook?", "Yes. Gemini Notebook is the new name for NotebookLM, and the chat and Studio work the same way."),
    ]


def prompt_page(p: dict, data: dict) -> str:
    dest = data["destinations"][p["dest"]]
    path = f"/tools/notebooklm-prompts/{p['id']}"
    title = f"{p['title']}: NotebookLM {dest['label']} Prompt"
    description = f"{p['summary']} A free, fill-in-the-blank NotebookLM {dest['label'].lower()} prompt with where to paste it and a worked example."
    answer = f"{p['summary']} Copy the prompt below, replace the [blanks] with your own details, and paste it in NotebookLM: {' '.join(dest['where'])}"
    faq = prompt_faq(p, dest)
    steps = [*dest["where"][:-1], f"{dest['where'][-1]} Replace the [blanks] first."]
    related = [q for q in data["prompts"] if q["dest"] == p["dest"] and q["id"] != p["id"]][:3]
    related += [q for q in data["prompts"] if q["dest"] != p["dest"] and set(q["jobs"]) & set(p["jobs"])][: 4 - len(related) if len(related) < 4 else 0]
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "CreativeWork", "name": title, "headline": title, "description": description, "text": blank_text(p),
         "url": f"{BASE}{path}", "dateModified": UPDATED, "isAccessibleForFree": True,
         "publisher": {"@type": "Organization", "name": "NotebookTools", "url": BASE}},
        {"@type": "HowTo", "name": f"How to use the {p['title']} prompt in NotebookLM", "step": [
            {"@type": "HowToStep", "position": i + 1, "text": s} for i, s in enumerate(steps)]},
        faq_schema(faq),
        breadcrumb([("Home", "/"), ("Free tools", "/tools"), ("NotebookLM Prompt Library", "/tools/notebooklm-prompts"), (p["title"], path)]),
    ]}
    rel_html = "".join(f'<li><a href="/tools/notebooklm-prompts/{q["id"]}">{E(q["title"])}</a> ({E(data["destinations"][q["dest"]]["label"])})</li>' for q in related)
    faq_html = "".join(f"<h3>{E(q)}</h3><p>{E(a)}</p>" for q, a in faq)
    return f"""{head(title, description, path, schema)}
  <body>
    <header class="site-header"></header>

    <main class="tools-main">
      <nav class="blog-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/tools">Free tools</a> <span aria-hidden="true">/</span> <a href="/tools/notebooklm-prompts">Prompt library</a> <span aria-hidden="true">/</span> <span>{E(p['title'])}</span></nav>
      <section class="tools-hero">
        <p class="eyebrow">NotebookLM {E(dest['label'])} prompt</p>
        <h1>{E(p['title'])}</h1>
        <div class="post-answer"><p class="post-answer-label">Short answer</p><p>{E(answer)}</p></div>
        {BADGES}
      </section>

      <section aria-label="The prompt">
        <pre class="pp-prompt" id="ppPrompt">{blank_html(p)}</pre>
        <div class="tool-actions" style="margin-top:12px">
          <button type="button" class="tool-btn is-primary" data-copy-prompt>Copy prompt</button>
          <a class="tool-btn" href="/tools/notebooklm-prompts#{p['id']}">Fill the blanks in the library</a>
        </div>
      </section>

      {cta("<strong>Skip the copy-paste.</strong> With NotebookTools, your prompts are one / away in the NotebookLM chat. Free Chrome extension.")}

      <article class="tools-copy">
        <h2 id="how-to">Where to paste it</h2>
        <ol>{"".join(f"<li>{E(s)}</li>" for s in steps)}</ol>
        <h2 id="when">When to use it</h2>
        <p>{E(p['when'])}</p>
        {f"<p><strong>Tip.</strong> {E(p['tip'])}</p>" if p.get('tip') else ""}
        <h2 id="example">Example, filled in</h2>
        <pre class="pp-prompt">{E(blank_text(p, True))}</pre>
        <h2 id="faq">FAQ</h2>
        {faq_html}
        <h2 id="more">More prompts</h2>
        <ul>{rel_html}<li><a href="/tools/notebooklm-prompts">All {len(data['prompts'])} prompts in the library</a></li></ul>
        <p>Also available as <a href="{path}.md">Markdown</a>.</p>
      </article>
    </main>

    <footer class="site-footer"></footer>
    <script src="/tools/tools.js"></script>
    <script>
      document.querySelector("[data-copy-prompt]").addEventListener("click", (e) =>
        NTTools.copy(document.getElementById("ppPrompt").textContent, e.currentTarget));
    </script>
  </body>
</html>
"""


def prompt_md(p: dict, data: dict) -> str:
    dest = data["destinations"][p["dest"]]
    steps = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(dest["where"]))
    faq = "\n\n".join(f"### {q}\n\n{a}" for q, a in prompt_faq(p, dest))
    return f"""# {p['title']}: NotebookLM {dest['label']} prompt

> {p['summary']} Replace the [blanks], then paste it in NotebookLM ({dest['label']}).

- Page: {BASE}/tools/notebooklm-prompts/{p['id']}
- Fill the blanks interactively: {BASE}/tools/notebooklm-prompts#{p['id']}
- Jobs: {", ".join(p['jobs'])}
- Updated: {UPDATED}

## The prompt

```
{blank_text(p)}
```

## Where to paste it

{steps}

## When to use it

{p['when']}

{"**Tip.** " + p['tip'] if p.get('tip') else ""}

## Example, filled in

```
{blank_text(p, True)}
```

## FAQ

{faq}

NotebookTools is independent and not affiliated with Google. Chrome extension: {CHROME_STORE}
"""


def library_md_index(data: dict) -> str:
    lines = []
    for key, dest in data["destinations"].items():
        items = [p for p in data["prompts"] if p["dest"] == key]
        if items:
            lines.append(f"\n## {dest['label']}\n")
            lines += [f"- [{p['title']}]({BASE}/tools/notebooklm-prompts/{p['id']}): {p['summary']}" for p in items]
    return "\n".join(lines)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    shutil.copyfile(ROOT / "notebooktools-extension" / "prompt-library-data.js", OUT / "slide-styles.js")
    (OUT / "index.html").write_text(hub_page(), encoding="utf-8")
    (OUT / "index.md").write_text(hub_md(), encoding="utf-8")
    for t in TOOLS:
        (OUT / f"{t['slug']}.html").write_text(tool_page(t), encoding="utf-8")
        (OUT / f"{t['slug']}.md").write_text(tool_md(t), encoding="utf-8")
    data = load_prompts()
    PROMPT_DIR.mkdir(exist_ok=True)
    for p in data["prompts"]:
        (PROMPT_DIR / f"{p['id']}.html").write_text(prompt_page(p, data), encoding="utf-8")
        (PROMPT_DIR / f"{p['id']}.md").write_text(prompt_md(p, data), encoding="utf-8")
    lib_md = OUT / "notebooklm-prompts.md"
    lib_md.write_text(lib_md.read_text(encoding="utf-8") + "\n## All prompts\n" + library_md_index(data) + "\n", encoding="utf-8")
    print(f"Built /tools, {len(TOOLS)} tool pages and {len(data['prompts'])} prompt pages (HTML + Markdown)")


if __name__ == "__main__":
    main()
