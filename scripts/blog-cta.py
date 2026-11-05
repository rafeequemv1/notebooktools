#!/usr/bin/env python3
"""Put a topic-matched "Add to Chrome" box inside every blog post.

    python3 scripts/blog-cta.py

The box goes before the second heading of the article body, between
<!-- post-cta --> markers, so running this again updates it in place. A post
can place the markers itself (is-notebooklm-free puts them under the answer).
"""
from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from pathlib import Path

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
# Posts that place the markers themselves; the box stays where they put it
MANUAL = {"is-notebooklm-free"}


class TopHeadings(HTMLParser):
    """Offsets of the article body's top-level <h2> tags (never ones inside lists)."""

    def __init__(self, text: str):
        super().__init__(convert_charrefs=False)
        self.lines = [0]
        for line in text.splitlines(keepends=True):
            self.lines.append(self.lines[-1] + len(line))
        self.depth = 0
        self.all: list[tuple[int, int]] = []
        self.feed(text)
        top = min((d for d, _ in self.all), default=0)
        # Shallowest headings count as top level (some posts wrap sections in <section>)
        self.found = [o for d, o in self.all if d == top]

    def here(self) -> int:
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        if tag == "h2":
            self.all.append((self.depth, self.here()))
        self.depth += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag not in VOID:
            self.depth -= 1

BLOG = Path(__file__).resolve().parent.parent / "website" / "blog"
CHROME = "https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj"

GENERAL = (
    "Get more out of NotebookLM",
    "NotebookTools is a free Chrome extension for NotebookLM (Gemini Notebook). Import YouTube, webpages and AI chats in one click, keep every notebook in one table, and save answers as clean PDF or Word files.",
    ("See all features", "/features"),
)
LIMITS = (
    "Make the free plan go further",
    "NotebookTools shows a source meter on every notebook, finds duplicate sources, and imports links, open tabs and YouTube playlists in one run. Free Chrome extension.",
    ("Manage sources in bulk", "/features/manage-sources"),
)
PROMPTS = (
    "Use these prompts without copy-paste",
    "NotebookTools adds a prompt library to NotebookLM. Save any prompt from this page, then type / in the chat to insert it in any notebook.",
    ("See the prompt library", "/features/prompts"),
)

TOPICS = {
    "20-notebooklm-prompts": PROMPTS,
    "best-notebooklm-prompts": PROMPTS,
    "notebooklm-slide-prompts": (
        "Pick a slide style in one click",
        "NotebookTools puts these slide styles inside NotebookLM: type / in the chat and choose one. Then turn the finished deck into a blog post or a LinkedIn carousel.",
        ("Browse all slide styles", "/notebooklm-slide-styles"),
    ),
    "how-to-use-notebooklm-to-study": (
        "Study faster with NotebookTools",
        "Import a whole lecture playlist in one click, keep one notebook per subject, and save answers as clean PDF notes. Free Chrome extension for NotebookLM.",
        ("NotebookLM for students", "/students"),
    ),
    "summarize-youtube-videos-notebooklm": (
        "Add YouTube videos in one click",
        "NotebookTools puts a NotebookLM button on every YouTube video, playlist and channel. Pick a notebook and the videos are added as sources.",
        ("See YouTube import", "/features/add-youtube"),
    ),
    "best-ways-import-content-notebooklm": (
        "Import anything in one click",
        "NotebookTools adds one-click import for YouTube, webpages, X threads, highlights and AI chats, plus bulk import for lists of links and open tabs.",
        ("See bulk import", "/features/bulk-import"),
    ),
    "notebooklm-privacy": (
        "An extension that works inside your browser",
        "NotebookTools adds importing, organising and exporting to NotebookLM using your own Google sign-in, so your notebooks stay in your Google account.",
        ("Read our privacy policy", "/privacy"),
    ),
    "is-notebooklm-free": LIMITS,
    "notebooklm-pricing-plans": LIMITS,
    "notebooklm-source-limits": LIMITS,
    "notebooklm-review-2026": GENERAL,
    "notebooklm-vs-chatgpt": GENERAL,
    "notebooklm-vs-gemini": GENERAL,
    "best-notebooklm-alternatives": GENERAL,
    "what-is-notebooklm": GENERAL,
    "notebooklm-tutorial-beginners": GENERAL,
}

CHROME_ICON = (
    '<svg class="chrome-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">'
    '<circle cx="12" cy="12" r="11" fill="#fff"/>'
    '<path d="M12 1a11 11 0 0 1 9.53 5.5H12a5.5 5.5 0 0 0-4.76 2.75L3.47 4.5A11 11 0 0 1 12 1Z" fill="#EA4335"/>'
    '<path d="M21.53 6.5A11 11 0 0 1 12 23l4.76-8.25A5.5 5.5 0 0 0 16.76 9.25 5.5 5.5 0 0 0 12 6.5h9.53Z" fill="#FBBC04"/>'
    '<path d="M12 23A11 11 0 0 1 3.47 4.5l4.77 8.25A5.5 5.5 0 0 0 16.76 14.75L12 23Z" fill="#34A853"/>'
    '<circle cx="12" cy="12" r="4.4" fill="#4285F4" stroke="#fff" stroke-width="1.6"/></svg>'
)


def box(title: str, text: str, link: tuple[str, str]) -> str:
    e = lambda s: html.escape(s, quote=True)
    return (
        "<!-- post-cta -->\n"
        '          <aside class="post-cta" aria-label="NotebookTools">\n'
        '            <img class="post-cta-mark" src="/assets/logo-mark-32.png" alt="" width="32" height="32">\n'
        '            <div class="post-cta-text">\n'
        f"              <p class=\"post-cta-title\">{e(title)}</p>\n"
        f"              <p>{e(text)}</p>\n"
        "            </div>\n"
        '            <div class="post-cta-actions">\n'
        f'              <a class="button button-primary" href="{CHROME}" target="_blank" rel="noopener noreferrer">{CHROME_ICON}Add to Chrome, free</a>\n'
        f'              <a class="post-cta-link" href="{link[1]}">{e(link[0])} →</a>\n'
        "            </div>\n"
        "          </aside>\n"
        "          <!-- /post-cta -->"
    )


def main() -> None:
    done = 0
    for slug, (title, text, link) in TOPICS.items():
        path = BLOG / f"{slug}.html"
        if not path.exists():
            print("missing", slug)
            continue
        page = path.read_text(encoding="utf-8")
        block = box(title, text, link)
        if slug in MANUAL and "<!-- post-cta -->" in page:
            page = re.sub(r"<!-- post-cta -->.*?<!-- /post-cta -->", lambda _m: block, page, count=1, flags=re.S)
        else:
            # Take out any earlier box, then place it before the second top-level heading
            page = re.sub(r"<!-- post-cta -->.*?<!-- /post-cta -->\s*", "", page, flags=re.S)
            start = page.index('<div class="blog-article-body">')
            end = page.index('<footer class="blog-article-footer">', start)
            headings = TopHeadings(page[start:end]).found
            listicle = page.find('<ol class="blog-listicle">', start, end)
            if len(headings) >= 2 and (listicle < 0 or start + headings[1] < listicle or start + headings[0] > listicle):
                at = start + headings[1]
            elif listicle >= 0:
                at = listicle  # sections live inside a numbered list: go just before it
            else:
                print("skip (few headings)", slug)
                continue
            page = page[:at] + block + "\n\n          " + page[at:]
        path.write_text(page, encoding="utf-8")
        done += 1
    print(f"blog-cta: {done} posts")


if __name__ == "__main__":
    main()
