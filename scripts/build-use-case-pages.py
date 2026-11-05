#!/usr/bin/env python3
"""Build the use-case pages (/researchers, /creators) from the data below.

    python3 scripts/build-use-case-pages.py && python3 scripts/sync-site-chrome.py

Every use case is a real job done with real NotebookTools features, and each
feature chip links to its demo on /features.
"""
from __future__ import annotations

import html
import json
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "website"
BASE = "https://www.notebooktools.com"
CHROME_STORE = "https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj"

F = {  # feature chips → demo pages
    "bulk": ("Bulk import", "/features/bulk-import"),
    "youtube": ("YouTube import", "/features/add-youtube"),
    "web": ("Webpage import", "/features/add-webpage"),
    "x": ("X & social import", "/features/x-twitter"),
    "highlights": ("Highlights", "/features/highlights"),
    "hub": ("Notebooks table", "/features/notebooks-hub"),
    "sources": ("Manage sources", "/features/manage-sources"),
    "drive": ("Drive refresh", "/features/drive-refresh"),
    "studio": ("Studio & podcasts", "/features/studio-podcasts"),
    "prompts": ("Prompt library", "/features/prompts"),
    "export": ("Chat export", "/features/chat-export"),
    "blog": ("Slides to blog", "/features/slides-to-blog"),
    "snapshots": ("Snapshots", "/features/snapshots"),
    "chats": ("AI chat import", "/#works-with"),
}

LOGOS = [("chatgpt", "ChatGPT"), ("claude", "Claude"), ("gemini", "Gemini"), ("perplexity", "Perplexity"), ("grok", "Grok"), ("kimi", "Kimi")]

PAGES = {
    "researchers": {
        "slug": "researchers",
        "eyebrow": "For researchers",
        "title": "Gemini Notebook (NotebookLM) for Researchers: 10 Practical Uses | NotebookTools",
        "description": "Practical ways researchers use Gemini Notebook (NotebookLM) with NotebookTools: literature reviews, lecture playlists, quotes, AI chats, source hygiene and exports.",
        "h1": "Do a week of reading <span class=\"grad\">in an afternoon</span>",
        "lead": "Practical ways PhD students, academics and analysts use Gemini Notebook (formerly NotebookLM) with NotebookTools: get every source in fast, keep projects organised, and get answers you can cite.",
        "uses": [
            ("Run a literature review in one sitting",
             "You have 30 papers open in tabs and a deadline.",
             ["Open the Bulk tab and add your open tabs, or paste a list of paper links.", "Import them all into one notebook in a single run.", "Ask cross-paper questions; every answer cites the paper it came from."],
             ["bulk", "prompts"]),
            ("Keep one living notebook per project",
             "Projects sprawl across dozens of notebooks with no structure.",
             ["Put each notebook in a project folder (Thesis, Grant, Lab meeting).", "Tag notebooks by theme, then filter the table to just those.", "Watch the source meter so a notebook never silently hits the 50-source limit."],
             ["hub"]),
            ("Turn lecture and conference playlists into notes",
             "The best explanation of a method is a 90-minute talk on YouTube.",
             ["Open the playlist or channel and import every video in one click.", "Ask for a summary of each talk with the claims it makes.", "Compare what different speakers say about the same method."],
             ["youtube", "bulk"]),
            ("Save quotes with their source while you read",
             "You find the perfect sentence and lose where it came from.",
             ["Highlight text on any page and send it to your notebook from the right-click menu.", "The quote keeps its page title and link as a source.", "Ask Gemini Notebook to group your saved quotes by argument."],
             ["highlights"]),
            ("Bring your AI chats into the evidence",
             "Your best brainstorming happened in ChatGPT or Claude, outside your notebook.",
             ["Open the conversation and click Import.", "The whole chat lands in your notebook as one clean source.", "Check its claims against your papers, with citations."],
             ["chats"]),
            ("Follow the debate, not just the papers",
             "Preprints get discussed on X and Reddit long before journals catch up.",
             ["Import a thread or discussion from X or Reddit as a source.", "Keep it next to the paper it discusses.", "Ask where the community agrees or disagrees with the authors."],
             ["x", "web"]),
            ("Keep sources current and duplicate-free",
             "Shared Google Docs change, and the same PDF sneaks in twice.",
             ["Check Drive sources for updates and refresh the stale ones.", "Scan the notebook for duplicate sources and remove them in bulk.", "Search, sort and export the source list for your bibliography."],
             ["drive", "sources"]),
            ("Reuse prompts that work for your field",
             "You retype the same careful prompt in every notebook.",
             ["Save prompts like \"list every statistic with its source\" to your library.", "Type / in the chat box to insert one.", "Share the same prompts with your lab so everyone asks the same way."],
             ["prompts"]),
            ("Export answers into your notes and drafts",
             "Copying a long, cited answer out of the chat breaks the formatting.",
             ["Use Export in the notebook ribbon.", "Save the chat as Markdown, Word, HTML or PDF with citations intact.", "Drop it into Obsidian, Zotero notes or your draft."],
             ["export"]),
            ("Turn findings into a talk and a write-up",
             "The lab meeting is tomorrow and the slides don't exist yet.",
             ["Generate a slide deck in Studio with a style from the slide prompts.", "Turn the deck into a written report with every slide as a figure.", "Make an Audio Overview to review the material on your commute."],
             ["studio", "blog"]),
        ],
        "workflow": [
            ("Collect", "Import papers, talks, threads and your AI chats in bulk."),
            ("Organise", "One notebook per project, foldered and tagged."),
            ("Ask", "Cross-source questions with citations, using saved prompts."),
            ("Share", "Export cited answers, slides and reports."),
        ],
        "faq": [
            ("Is Gemini Notebook good for literature reviews?", "Yes. It answers only from the sources you add and cites the passage behind each claim. NotebookTools makes it practical at scale: import dozens of papers at once and keep each project in its own organised notebook."),
            ("How many papers can one notebook hold?", "Up to 50 sources per notebook on the standard plan. NotebookTools shows a source meter on every notebook so you can split a project before it fills up."),
            ("Does it work with my PDFs and Google Drive?", "Yes. Add PDFs and Drive files as sources as usual; NotebookTools adds bulk import, Drive refresh checks and duplicate scans on top."),
            ("Is NotebookTools free for students?", "Yes. Every feature works on the free plan. Pro is a one-time lifetime upgrade."),
        ],
    },
    "creators": {
        "slug": "creators",
        "eyebrow": "For content creators",
        "title": "Gemini Notebook (NotebookLM) for Content Creators: 10 Practical Uses | NotebookTools",
        "description": "Practical ways creators use Gemini Notebook (NotebookLM) with NotebookTools: video research, slides to blog posts, how-to guides from screenshots, podcasts, swipe files and newsletters.",
        "h1": "Research once, <span class=\"grad\">publish everywhere</span>",
        "lead": "Practical ways YouTubers, writers, marketers and educators use Gemini Notebook (formerly NotebookLM) with NotebookTools: research faster, turn one source into many formats, and ship tutorials and posts with real visuals.",
        "uses": [
            ("Research a video topic in an hour",
             "You need to know what every other video on the topic already says.",
             ["Import the top videos or a whole playlist in one click.", "Ask what they all cover and what nobody explains well.", "Turn the gaps into your outline."],
             ["youtube", "bulk"]),
            ("Turn a slide deck into a blog post",
             "The talk is done; the article version never gets written.",
             ["Open the notebook with your deck in Studio and click Blog in the ribbon.", "NotebookTools imports the deck, writes the post and embeds every slide as an image.", "Download it as HTML, Word, PDF or Markdown."],
             ["blog"]),
            ("Write how-to guides from screenshots",
             "Tutorials take hours because every step needs a screenshot.",
             ["Do the task once and capture each step with Alt+Shift+S.", "Click Create how-to guide.", "Get a written, step-by-step guide with every screenshot in place."],
             ["snapshots"]),
            ("Repurpose one source into many formats",
             "One great interview should become a podcast, a deck and a carousel.",
             ["Add the source once.", "Generate an Audio Overview, slide deck, infographic and flashcards in Studio.", "Find every audio overview later in the Podcasts hub."],
             ["studio"]),
            ("Build a swipe file of posts that work",
             "Great hooks scroll past and are gone.",
             ["Import standout posts from X, Reddit and LinkedIn as you see them.", "Tag them by format and topic in the notebooks table.", "Ask what the best-performing ones have in common."],
             ["x", "hub"]),
            ("Turn your AI brainstorms into a script",
             "Your ideas are scattered across ChatGPT, Claude and Gemini chats.",
             ["Import each conversation into one notebook.", "Ask for a single outline that merges the best ideas.", "Keep the original chats as sources to check against."],
             ["chats"]),
            ("Write the weekly newsletter from your reading",
             "Friday comes and you can't remember what was worth sharing.",
             ["Save highlights and pages to a newsletter notebook all week.", "Ask for the five strongest ideas, each with its source.", "Export the answer as Markdown for your newsletter tool."],
             ["highlights", "export"]),
            ("Run a content calendar in notebooks",
             "Every series and client needs its own research, kept apart.",
             ["Make one notebook per series or client.", "Use folders for clients and tags for status (idea, drafting, published).", "Filter the table to see what's in progress."],
             ["hub"]),
            ("Keep a consistent visual style",
             "Every deck from AI looks different.",
             ["Pick a slide style from the prompt library (editorial, minimal, bold).", "Insert it with / in the chat or copy it into Studio.", "Get decks that look like one brand."],
             ["prompts", "studio"]),
            ("Fact-check before you publish",
             "One wrong number can sink a post.",
             ["Add your sources to the notebook behind the piece.", "Ask Gemini Notebook to verify each claim and show where it's from.", "Export the cited answer as your fact-check record."],
             ["web", "export"]),
        ],
        "workflow": [
            ("Research", "Import videos, posts, pages and AI chats in bulk."),
            ("Organise", "A notebook per series or client, tagged by status."),
            ("Create", "Studio decks, podcasts, guides and posts."),
            ("Publish", "Export as Markdown, Word, HTML or PDF."),
        ],
        "faq": [
            ("Can Gemini Notebook write a blog post from my slides?", "With NotebookTools, yes: the Blog workflow imports your slide deck, writes the post and embeds every slide as an image, ready to download."),
            ("Can I make a step-by-step tutorial from screenshots?", "Yes. Capture each step with Snapshots (Alt+Shift+S), then click Create how-to guide to get a written guide with the screenshots in place."),
            ("Which AI chats can I import?", "ChatGPT, Claude, Gemini, Perplexity, Grok and Kimi conversations, plus YouTube, X, Reddit, LinkedIn, Google Docs and any webpage."),
            ("Is it free?", "Yes. Every feature works on the free plan. Pro is a one-time lifetime upgrade."),
        ],
    },
}

OTHER = {"researchers": ("creators", "For content creators", "Research once, publish everywhere."),
         "creators": ("researchers", "For researchers", "Do a week of reading in an afternoon.")}

CHROME_ICON = (
    '<svg class="chrome-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">'
    '<circle cx="12" cy="12" r="11" fill="#fff"/>'
    '<path d="M12 1a11 11 0 0 1 9.53 5.5H12a5.5 5.5 0 0 0-4.76 2.75L3.47 4.5A11 11 0 0 1 12 1Z" fill="#EA4335"/>'
    '<path d="M21.53 6.5A11 11 0 0 1 12 23l4.76-8.25A5.5 5.5 0 0 0 16.76 9.25 5.5 5.5 0 0 0 12 6.5h9.53Z" fill="#FBBC04"/>'
    '<path d="M12 23A11 11 0 0 1 3.47 4.5l4.77 8.25A5.5 5.5 0 0 0 16.76 14.75L12 23Z" fill="#34A853"/>'
    '<circle cx="12" cy="12" r="4.4" fill="#4285F4" stroke="#fff" stroke-width="1.6"/></svg>'
)


def e(s: str) -> str:
    return html.escape(s, quote=True)


def logos_html() -> str:
    return "".join(
        f'<li><img src="/assets/logos/{k}.svg" alt="" width="20" height="20" loading="lazy">{n}</li>' for k, n in LOGOS
    )


def page(p: dict) -> str:
    url = f"{BASE}/{p['slug']}"
    cards = []
    for i, (title, job, steps, feats) in enumerate(p["uses"], 1):
        chips = "".join(f'<a class="uc-chip" href="{F[f][1]}">{e(F[f][0])}</a>' for f in feats)
        lis = "".join(f"<li>{e(s)}</li>" for s in steps)
        cards.append(f"""
          <article class="uc-card">
            <span class="uc-num">{i:02d}</span>
            <h3>{e(title)}</h3>
            <p class="uc-job"><b>The job:</b> {e(job)}</p>
            <ol class="uc-steps">{lis}</ol>
            <div class="uc-chips">{chips}</div>
          </article>""")
    flow = "".join(
        f'<li><span class="uc-flow-n">{i}</span><b>{e(t)}</b><span>{e(d)}</span></li>' for i, (t, d) in enumerate(p["workflow"], 1)
    )
    faq = "".join(f"<details class=\"uc-faq-item\"><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in p["faq"])
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": url, "url": url, "name": p["title"], "description": p["description"],
             "isPartOf": {"@type": "WebSite", "name": "NotebookTools", "url": BASE}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": p["eyebrow"], "item": url}]},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in p["faq"]]},
        ],
    }
    other_slug, other_label, other_line = OTHER[p["slug"]]
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
    <title>{e(p['title'])}</title>
    <meta name="description" content="{e(p['description'])}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="NotebookTools">
    <meta property="og:title" content="{e(p['title'])}">
    <meta property="og:description" content="{e(p['description'])}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{BASE}/assets/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" href="/assets/favicon.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
  </head>
  <body>
    <header class="site-header"></header>

    <main class="uc-page">
      <section class="uc-hero">
        <p class="eyebrow">{e(p['eyebrow'])}</p>
        <h1>{p['h1']}</h1>
        <p class="uc-lead">{e(p['lead'])}</p>
        <div class="uc-actions">
          <a class="button button-primary button-lg" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}Add to Chrome — free</a>
          <a class="button button-ghost button-lg" href="/features">See the features</a>
        </div>
        <div class="uc-works"><span>Works with your AI chats</span><ul>{logos_html()}</ul></div>
      </section>

      <section class="uc-section">
        <div class="section-head center">
          <p class="eyebrow">Practical uses</p>
          <h2>{len(p['uses'])} ways to use it this week</h2>
        </div>
        <div class="uc-grid">{''.join(cards)}
        </div>
      </section>

      <section class="uc-section">
        <div class="section-head center">
          <p class="eyebrow">The workflow</p>
          <h2>From scattered sources to finished work</h2>
        </div>
        <ol class="uc-flow">{flow}</ol>
      </section>

      <section class="uc-section uc-faq">
        <div class="section-head center"><h2>Questions</h2></div>
        {faq}
      </section>

      <section class="uc-section">
        <div class="uc-cta">
          <div>
            <h2>Try it on your next project</h2>
            <p>Free Chrome extension for Gemini Notebook. Every feature on the free plan.</p>
          </div>
          <a class="button button-primary button-lg" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}Add to Chrome — free</a>
        </div>
        <a class="uc-other" href="/{other_slug}"><span>{e(other_label)}</span>{e(other_line)} →</a>
      </section>
    </main>
  </body>
</html>
"""


def main() -> None:
    for p in PAGES.values():
        out = SITE / f"{p['slug']}.html"
        out.write_text(page(p), encoding="utf-8")
        print("wrote", out.relative_to(SITE.parent))


if __name__ == "__main__":
    main()
