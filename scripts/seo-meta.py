#!/usr/bin/env python3
"""Set search titles and descriptions for pages that are hand-written HTML.

    python3 scripts/seo-meta.py

Rewrites <title>, meta description and the og:/twitter: title and description
tags in place, so the text Google shows matches what people search for.
Safe to run again.
"""
from __future__ import annotations

import html
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "website"

META = {
    "index.html": (
        "NotebookTools: Free Chrome Extension for NotebookLM & Gemini Notebook",
        "NotebookTools (Notebook Tools) is the free Chrome extension for NotebookLM, now Gemini Notebook: bulk import YouTube, webpages and AI chats, organise notebooks in a table, export answers and more.",
    ),
    "features/index.html": (
        "NotebookTools Features: Import, Organise & Export for NotebookLM",
        "Every NotebookTools feature with live demos: one-click YouTube and webpage import, bulk import, notebooks table, Drive refresh, Studio files, prompt library, chat export, slides to blog and snapshots.",
    ),
    "features/add-webpage.html": (
        "Add Any Webpage to NotebookLM in One Click | NotebookTools",
        "Send the page you're reading to NotebookLM (Gemini Notebook) as a clean source in one click, or add just the text you highlight. Free Chrome extension.",
    ),
    "features/add-youtube.html": (
        "Add YouTube Videos & Playlists to NotebookLM | NotebookTools",
        "Import a YouTube video, a whole playlist or a channel into NotebookLM (Gemini Notebook) with one click from the watch page. Free Chrome extension.",
    ),
    "features/bulk-import.html": (
        "Bulk Import Links, Tabs & Playlists into NotebookLM | NotebookTools",
        "Paste a list of links, add all your open tabs or a YouTube playlist, and import them into NotebookLM (Gemini Notebook) in one run, with the 50-source limit tracked for you.",
    ),
    "features/chat-export.html": (
        "Export NotebookLM Answers to PDF, Word or Markdown | NotebookTools",
        "Save the last NotebookLM (Gemini Notebook) answer as a clean, print-ready PDF or Word file, or export the whole chat as Markdown, HTML, CSV or PDF.",
    ),
    "features/drive-refresh.html": (
        "Refresh Google Drive Sources in NotebookLM | NotebookTools",
        "See which Google Docs, Sheets and Slides sources in NotebookLM (Gemini Notebook) are out of date and refresh them in bulk, so answers use the latest version.",
    ),
    "features/highlights.html": (
        "Send Highlighted Text to NotebookLM from Any Page | NotebookTools",
        "Highlight a passage on any webpage and send it to a NotebookLM (Gemini Notebook) notebook from the right-click menu, with the page title and link kept as the source.",
    ),
    "features/manage-sources.html": (
        "Manage NotebookLM Sources in Bulk | NotebookTools",
        "Search, sort, select and delete NotebookLM (Gemini Notebook) sources in bulk, find duplicate sources and organise them into folders. Free Chrome extension.",
    ),
    "features/notebooks-hub.html": (
        "Notebooks Table for NotebookLM: Folders, Tags & Search | NotebookTools",
        "See every NotebookLM (Gemini Notebook) notebook in one sortable table or card view, with folders, tags, favourites, source counts and search.",
    ),
    "features/prompts.html": (
        "NotebookLM Prompt Library & Slide Deck Styles | NotebookTools",
        "Ready-made NotebookLM (Gemini Notebook) prompts and slide deck styles you can insert with / in the chat, plus your own saved prompts. Free Chrome extension.",
    ),
    "features/slides-to-blog.html": (
        "NotebookLM Slide Deck to Blog Post with Images | NotebookTools",
        "Turn a NotebookLM (Gemini Notebook) slide deck into a full blog post or handout with every slide embedded as an image. Download as HTML, Word, PDF or Markdown.",
    ),
    "features/snapshots.html": (
        "Screenshot to How-To Guide for NotebookLM | NotebookTools Snapshots",
        "Capture each step of a task with Alt+Shift+S, then turn the screenshots into a written how-to guide with every image in place, using NotebookLM (Gemini Notebook).",
    ),
    "features/studio-podcasts.html": (
        "NotebookLM Studio Files & Podcasts in One Place | NotebookTools",
        "Browse, play, rename and download every NotebookLM (Gemini Notebook) Audio Overview, slide deck and Studio file across all your notebooks.",
    ),
    "features/x-twitter.html": (
        "Import X (Twitter) Posts and Threads into NotebookLM | NotebookTools",
        "Add an X (Twitter) post or a whole thread to NotebookLM (Gemini Notebook) as a clean source in one click. Free Chrome extension.",
    ),
    "blog/is-notebooklm-free.html": (
        "Is NotebookLM Free? Yes: Free vs Paid Limits Compared (2026)",
        "Yes, NotebookLM (now Gemini Notebook) is free with a Google account: 100 notebooks and 50 sources each. See what the free plan includes and what Google AI Plus, Pro and Ultra add.",
    ),
    "blog/what-is-notebooklm.html": (
        "What Is NotebookLM (“Notebook LLM”)? Google's AI Notebook Explained",
        "NotebookLM, often searched as “Notebook LLM” and now called Gemini Notebook, is Google's free AI notebook: add PDFs, links and videos, then get cited answers, study guides and Audio Overviews.",
    ),
}


def set_tag(text: str, pattern: str, replacement: str) -> str:
    new, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=re.S)
    return new if count else text


def apply(path: Path, title: str, desc: str) -> bool:
    text = path.read_text(encoding="utf-8")
    before = text
    t, d = html.escape(title, quote=False).replace('"', '&quot;'), html.escape(desc, quote=False).replace('"', '&quot;')
    text = set_tag(text, r"<title>.*?</title>", f"<title>{t}</title>")
    text = set_tag(text, r'<meta\s+name="description"\s+content="[^"]*"\s*>', f'<meta name="description" content="{d}">')
    text = set_tag(text, r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{t}">')
    text = set_tag(text, r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{d}">')
    text = set_tag(text, r'<meta name="twitter:title" content="[^"]*">', f'<meta name="twitter:title" content="{t}">')
    text = set_tag(text, r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{d}">')
    if text != before:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for rel, (title, desc) in META.items():
        path = SITE / rel
        if not path.exists():
            print("missing", rel)
            continue
        if len(title) > 70 or len(desc) > 200:
            print(f"note: long meta on {rel} ({len(title)}/{len(desc)})")
        changed += apply(path, title, desc)
    print(f"seo-meta: {changed} of {len(META)} pages updated")


if __name__ == "__main__":
    main()
