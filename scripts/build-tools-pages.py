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
import re
import shutil
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from editor_locales import EDITOR_LOCALES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"
OUT = SITE / "tools"
BASE = "https://www.notebooktools.com"
UPDATED = "2026-11-22"
UPDATED_LABEL = "November 22, 2026"
CHROME_STORE = (
    "https://chromewebstore.google.com/detail/"
    "notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj"
)

ICONS = {
    "prompt": '<path d="M5 5h14v10H9l-4 4V5Z"/><path d="M9 9h6M9 12h4"/>',
    "links": '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    "split": '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M4 12h16" stroke-dasharray="2 2"/>',
    "clean": '<path d="M4 6h10M4 10h16M4 14h12M4 18h8"/><path d="m16 16 4 4M20 16l-4 4"/>',
    "pdfsplit": '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M3 13h18" stroke-dasharray="2.5 2"/>',
    "pdfmerge": '<path d="M4 4h7v9H4zM13 11h7v9h-7z"/><path d="M8 13v3a2 2 0 0 0 2 2h3M16 11V8a2 2 0 0 0-2-2h-3"/>',
    "pdftext": '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4M9 12h6M9 15h6M9 18h4"/>',
    "count": '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M9 17v-3M12 17v-6M15 17v-4"/>',
    "compress": '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="m9.5 11 2.5 2.5 2.5-2.5M9.5 17.5 12 15l2.5 2.5"/>',
    "pages": '<rect x="3.5" y="5" width="7" height="9" rx="1"/><rect x="13.5" y="5" width="7" height="9" rx="1"/><path d="M7 17.5h10M7 20h6"/>',
    "ocr": '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 10h8M8 13h8M8 16h5"/>',
    "slides": '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/><path d="M7 9h6M7 12h4"/><path d="m15.5 9.5 2 2-3 3h-2v-2z"/>',
    "images": '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8"/>',
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
        "group": "notebooklm",
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
        "group": "notebooklm",
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
        "group": "notebooklm",
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
        <div class="tool-pane-head"><h2>Your text</h2><span class="tool-stats" id="tsStats"></span><button type="button" class="tool-btn" id="tsSample">Try a sample</button></div>
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
        "group": "notebooklm",
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
    # ---------------- Slide editor ----------------
    {
        "slug": "edit-notebooklm-slides",
        "group": "pdf",
        "icon": "slides",
        "name": "NotebookLM Slide Editor (PDF to PPTX)",
        "card": "Make a NotebookLM slide deck editable: OCR turns the text into real text boxes. Edit, present, download PowerPoint.",
        "title": "Edit NotebookLM Slides: Slide Deck PDF to Editable PowerPoint (Free)",
        "description": "Free NotebookLM slide editor: open a slide deck PDF, OCR turns the text on each slide into editable text boxes, edit text, colours and shapes, then download an editable PowerPoint (PPTX), PDF or PNG. Runs in your browser; nothing is uploaded.",
        "h1": "Edit NotebookLM Slides (PDF to PowerPoint)",
        "answer": "NotebookLM slide decks download as pictures of slides, so you can't change a word. Open the deck PDF here: each slide is read with OCR, the original text is painted out, and real text boxes are put back in the same places, in matching fonts and colours. Pictures, icons and divider lines become separate objects you can move, resize or delete. Click to select, double-click to type, drag to move, change fonts and colours, add text, shapes and images, and present. Then download an editable PowerPoint (.pptx) that opens in PowerPoint, Keynote and Google Slides, a PDF with real text, or PNG images. Everything runs in your browser.",
        "script": "slide-editor.js",
        "extra_scripts": ["pdf-kit.js", "slide-engine.js"],
        "raw_app": '<section class="se-app" id="seApp" aria-label="NotebookLM slide editor"><p class="tool-empty">Loading the editor…</p></section>',
        "steps": [
            "In NotebookLM, open your slide deck in Studio and download it as a PDF.",
            "Drop the PDF here (or click Try with a sample set). Keep \"Editable text (OCR)\" on.",
            "Wait a few seconds per slide while the text is read. Slides that are ready can be edited straight away.",
            "Double-click any text to change it. Drag to move, use the handles to resize, and use the panel on the right for font, size, colour and alignment.",
            "Add text, shapes or images from the toolbar, compare with the original, or press Present.",
            "Click Download PowerPoint for an editable .pptx (or choose PDF or PNG from the arrow menu).",
        ],
        "faq": [
            ("Can you edit NotebookLM slide decks?", "Not inside NotebookLM: its slide decks are generated as images, so the text can't be changed. This editor reads the text with OCR and turns it into real text boxes you can edit."),
            ("How do I convert NotebookLM slides to PowerPoint?", "Download the slide deck as a PDF from NotebookLM's Studio panel, open it here and click Download PowerPoint. Each slide keeps its design as the background, and the text comes back as editable text boxes."),
            ("Will it look exactly like the original?", "Close, not identical. Fonts are matched to the nearest common font, and the area behind the old text is filled from the surrounding colours: clean on flat or gradient backgrounds, but busy photos can show faint marks. Use Original to compare, and fix anything in the editor."),
            ("What about charts and diagrams?", "Labels on diagrams (in pills, boxes and beside drawings) are read as editable text, and the drawings become separate pictures you can move. Text inside number-heavy charts usually stays part of the image so the chart stays intact; you can add your own text boxes on top."),
            ("Can I move or delete the pictures on a slide?", "Yes, on slides with a plain background (most NotebookLM decks). Illustrations, photos and icons become separate pictures with a transparent background, and solid lines and bars become shapes, so you can drag, resize or delete them; they export to PowerPoint as separate objects. Slides with a full-bleed photo or strong gradient behind everything keep a single background picture."),
            ("Does it work in Google Slides?", "Yes. In Google Slides choose File → Import slides (or open the .pptx from Drive); the text boxes stay editable."),
            ("Is my deck uploaded?", "No. pdf.js, Tesseract OCR, pdf-lib and PptxGenJS all run in your browser. The deck never leaves your device."),
        ],
        "links": [("/tools/pdf-to-images", "PDF slides to images"), ("/notebooklm-slide-styles", "NotebookLM slide deck styles"), ("/blog/notebooklm-slide-prompts", "NotebookLM slide prompts"), ("/tools/notebooklm-prompts", "NotebookLM prompt library")],
        "cta": "<strong>Get better slides from NotebookLM in the first place.</strong> NotebookTools adds 14 slide style cards to NotebookLM's slide deck dialog and turns any deck into a LinkedIn or Instagram carousel (Pro).",
    },
    # ---------------- PDF & image tools (pdf-kit.js) ----------------
    {
        "slug": "split-pdf-for-notebooklm",
        "group": "pdf",
        "icon": "pdfsplit",
        "name": "Split PDF for NotebookLM",
        "card": "Book or PDF too big for one source? Split it into equal parts, every N pages, by ranges or under a size limit.",
        "title": "Split PDF for NotebookLM: Fit the 200 MB / 500,000-Word Limit",
        "description": "Free PDF splitter for NotebookLM: split a large PDF into equal parts, every N pages, custom ranges or parts under a size limit, then download each part or a ZIP. Runs in your browser; nothing is uploaded.",
        "h1": "Split PDF for NotebookLM",
        "answer": "NotebookLM accepts up to 200 MB or 500,000 words per source, so large textbooks and scanned books often fail to upload. Drop the PDF here and split it into equal parts, every N pages, by page ranges (one part per line) or into parts under a size you choose. Each part downloads as its own PDF, or all at once as a ZIP, ready to add as separate sources. The file never leaves your browser.",
        "script": "pdf-split.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="splitDrop"></div>
        <div class="pdf-file" id="splitFile" hidden></div>
        <div id="splitOptions" hidden>
          <div class="tool-field"><span class="tool-label">Split</span>
            <div class="pdf-seg" role="radiogroup" aria-label="How to split">
              <label><input type="radio" name="splitMode" value="parts" checked>Into equal parts</label>
              <label><input type="radio" name="splitMode" value="every">Every N pages</label>
              <label><input type="radio" name="splitMode" value="ranges">By page ranges</label>
              <label><input type="radio" name="splitMode" value="size">Under a size</label>
            </div></div>
          <div class="pdf-options">
            <div class="tool-field" data-split-mode="parts"><label for="splitParts">Number of parts</label><input type="number" id="splitParts" min="2" max="200" value="2"></div>
            <div class="tool-field" data-split-mode="every" hidden><label for="splitEvery">Pages per part</label><input type="number" id="splitEvery" min="1" value="50"></div>
            <div class="tool-field" data-split-mode="ranges" hidden><label for="splitRanges">One part per line</label><textarea id="splitRanges" rows="3" placeholder="1-120&#10;121-250&#10;251-"></textarea></div>
            <div class="tool-field" data-split-mode="size" hidden><label for="splitSize">Max size per part (MB)</label><input type="number" id="splitSize" min="1" value="190"></div>
          </div>
          <div class="pdf-run"><button type="button" class="tool-btn is-primary" id="splitRun">Split PDF</button></div>
        </div>
        <div class="pdf-bar" id="splitBar" hidden><span></span></div>
        <p class="pdf-status" id="splitStatus" hidden></p>
        <div class="pdf-results" id="splitResults"></div>""",
        "steps": [
            "Drop your PDF in the box, or click Choose a file.",
            "Pick how to split: into equal parts, every N pages, by page ranges, or under a size limit (190 MB keeps each part under NotebookLM's 200 MB cap).",
            "Click Split PDF.",
            "Download each part, or all of them as a ZIP, and add each part to your notebook as its own source.",
        ],
        "faq": [
            ("What is the maximum PDF size for NotebookLM?", "Each source can be up to 200 MB or 500,000 words, on every plan. Split anything larger into parts."),
            ("How many parts should I split a book into?", "Split by chapters if you can (By page ranges), so each source stays on one topic and citations are easier to follow. Otherwise, equal parts under 200 MB work."),
            ("Does splitting lose quality?", "No. Pages are copied as they are, with their text, images and fonts; nothing is re-compressed."),
            ("Is my PDF uploaded?", "No. The PDF is read and split in your browser with pdf-lib. Nothing is sent to a server."),
        ],
        "links": [("/tools/pdf-page-word-counter", "Will my PDF fit? Page & word counter"), ("/tools/compress-pdf", "Compress PDF"), ("/blog/notebooklm-source-limits", "NotebookLM source limits"), ("/tools/text-splitter", "Text splitter for long text")],
        "cta": "<strong>Add all parts to one notebook in one go.</strong> With NotebookTools, bulk import adds every part, link or tab to the notebook you pick, and shows the source meter as you go.",
    },
    {
        "slug": "merge-pdf",
        "group": "pdf",
        "icon": "pdfmerge",
        "name": "Merge PDFs",
        "card": "Combine lecture handouts, papers or scans (and images) into one PDF. One source instead of ten.",
        "title": "Merge PDF Files Free (In Your Browser) for NotebookLM",
        "description": "Free PDF merger: combine several PDFs and images into one file, in the order you choose. Save NotebookLM source slots. Runs in your browser; nothing is uploaded.",
        "h1": "Merge PDFs",
        "answer": "Drop two or more PDFs (or JPG and PNG images), put them in order with the arrows, and click Merge to download one combined PDF. In NotebookLM every file is one source and the free plan allows 50 per notebook, so merging related handouts or chapters saves slots. Everything happens in your browser.",
        "script": "pdf-merge.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="mergeDrop"></div>
        <div class="pdf-list" id="mergeList"></div>
        <div class="pdf-run" id="mergeRunRow" hidden><button type="button" class="tool-btn is-primary" id="mergeRun">Merge and download</button></div>
        <div class="pdf-bar" id="mergeBar" hidden><span></span></div>
        <p class="pdf-status" id="mergeStatus" hidden></p>""",
        "steps": [
            "Drop the PDFs (and any JPG or PNG images) you want to combine.",
            "Use the arrows to put them in order; remove any with ×.",
            "Click Merge and download.",
            "Add the merged PDF to NotebookLM as one source.",
        ],
        "faq": [
            ("Should I merge PDFs before adding them to NotebookLM?", "Merge files that belong together (one course's handouts, one report's appendices) to save source slots. Keep unrelated papers separate: citations then point to the right document."),
            ("Is there a size limit?", "Your browser's memory is the only limit here. NotebookLM accepts up to 200 MB or 500,000 words per source, so check the merged file with the page & word counter."),
            ("Can I merge images too?", "Yes. JPG and PNG images become full-size pages in the merged PDF."),
            ("Are my files uploaded?", "No. Merging happens in your browser with pdf-lib."),
        ],
        "links": [("/tools/split-pdf-for-notebooklm", "Split PDF for NotebookLM"), ("/tools/pdf-page-word-counter", "PDF page & word counter"), ("/features/notebooks-hub", "Organise notebooks with folders and tags"), ("/blog/notebooklm-source-limits", "NotebookLM source limits")],
        "cta": "<strong>Or keep them separate and organised.</strong> NotebookTools adds folders, tags and a notebooks table to NotebookLM, plus bulk import and a source meter.",
    },
    {
        "slug": "pdf-to-text",
        "group": "pdf",
        "icon": "pdftext",
        "name": "PDF to Text / Markdown",
        "card": "Get clean text or Markdown from any PDF, with OCR for scanned pages. Fixes broken line wraps.",
        "title": "PDF to Text or Markdown Converter (Free, with OCR)",
        "description": "Free PDF to text and Markdown converter: extract clean text from any PDF, join broken line wraps, add page markers, and read scanned pages with OCR. Runs in your browser; nothing is uploaded.",
        "h1": "PDF to Text / Markdown",
        "answer": "Drop a PDF to pull out its text, with lines that were wrapped mid-sentence joined back up. Choose plain text or Markdown (headings and bullet lists detected), optionally mark where each page starts, and turn on OCR to read scanned pages that have no text layer. Copy the result or download a .txt or .md file to add to NotebookLM as a clean text source.",
        "script": "pdf-to-text.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="ptDrop"></div>
        <div class="pdf-file" id="ptFile" hidden></div>
        <div id="ptOptions" hidden>
          <div class="pdf-options">
            <div class="tool-field"><label for="ptFormat">Output</label><select id="ptFormat"><option value="md">Markdown (.md)</option><option value="txt">Plain text (.txt)</option></select></div>
          </div>
          <div class="tool-checks">
            <label><input type="checkbox" id="ptJoin" checked> Join broken line wraps</label>
            <label><input type="checkbox" id="ptMarkers"> Mark each page</label>
            <label><input type="checkbox" id="ptOcr"> OCR scanned pages (slower)</label>
          </div>
          <span id="ptRun" hidden></span>
        </div>
        <div class="pdf-bar" id="ptBar" hidden><span></span></div>
        <p class="pdf-status" id="ptStatus" hidden></p>
        <textarea id="ptOutput" class="is-output pdf-output" readonly aria-label="Extracted text" placeholder="The text appears here."></textarea>
        <div class="tool-actions"><button type="button" class="tool-btn is-primary" id="ptCopy" disabled>Copy</button><button type="button" class="tool-btn" id="ptDownload" disabled>Download</button></div>""",
        "steps": [
            "Drop a PDF in the box.",
            "Choose Markdown or plain text. Keep \"Join broken line wraps\" on for readable paragraphs.",
            "If some pages are scanned, turn on OCR scanned pages.",
            "Copy the text or download it, then add it to NotebookLM (Copied text, or upload the .md/.txt file).",
        ],
        "faq": [
            ("Why convert a PDF to text before adding it to NotebookLM?", "NotebookLM reads PDFs directly, but multi-column layouts, headers and footers and scans can confuse it. A clean text or Markdown version often gives more accurate answers and citations."),
            ("Can it read scanned PDFs?", "Yes. Turn on OCR scanned pages: pages without a text layer are read with Tesseract OCR in your browser (English). Check names and numbers afterwards."),
            ("Does it keep tables and formatting?", "It keeps paragraphs, and detects headings and bullet lists for Markdown. Complex tables come out as text in reading order."),
            ("Is my PDF uploaded?", "No. pdf.js and Tesseract run in your browser; nothing is sent anywhere."),
        ],
        "links": [("/tools/image-to-text-ocr", "Image to text (OCR)"), ("/tools/text-splitter", "Text splitter for NotebookLM"), ("/tools/notebooklm-answer-cleaner", "NotebookLM answer cleaner"), ("/blog/best-ways-import-content-notebooklm", "Ways to import content into NotebookLM")],
        "cta": "<strong>Send text straight to a notebook.</strong> NotebookTools adds any page, highlighted text, YouTube video or AI chat to NotebookLM in one click. Free.",
    },
    {
        "slug": "pdf-page-word-counter",
        "group": "pdf",
        "icon": "count",
        "name": "PDF Page & Word Counter",
        "card": "Will it fit in NotebookLM? Count pages, words and size for one PDF or a whole folder, against the limits.",
        "title": "PDF Word & Page Counter: Will It Fit in NotebookLM?",
        "description": "Free PDF word counter and page counter: check one or many PDFs against NotebookLM's limits (500,000 words and 200 MB per source, 50 sources per notebook). Runs in your browser.",
        "h1": "PDF Page & Word Counter",
        "answer": "Drop one PDF or a whole batch. The counter reads every page in your browser and shows pages, words and size per file, then checks them against NotebookLM's limits: 500,000 words or 200 MB per source, and 50 sources per notebook on the free plan. It also flags files that look scanned.",
        "script": "pdf-counter.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="pcDrop"></div>
        <p class="pdf-status" id="pcStatus" hidden></p>
        <div id="pcResult" hidden>
          <div class="pdf-meter" id="pcMeters"></div>
          <div id="pcVerdict"></div>
          <div class="pdf-list" id="pcList"></div>
          <div class="pdf-run"><button type="button" class="tool-btn" id="pcClear">Clear</button></div>
        </div>""",
        "steps": [
            "Drop one or more PDFs.",
            "Wait while each file's pages are read and counted.",
            "Check the meters: words and size of the largest file, and the number of files against 50 sources.",
            "Follow the suggestion: split files that are too big, or merge or spread files across notebooks.",
        ],
        "faq": [
            ("How many words can a NotebookLM source have?", "Up to 500,000 words, and up to 200 MB, per source on every plan."),
            ("How many PDFs can I add to one notebook?", "50 sources on the free plan, 100 on Google AI Plus, 300 on Google AI Pro, and more on Ultra. Each PDF is one source."),
            ("Why does a PDF show 0 words?", "It's probably scanned: the pages are images with no text layer. NotebookLM can still read many scans, but converting with OCR first gives more reliable answers."),
            ("Are my files uploaded?", "No. Counting happens in your browser with pdf.js."),
        ],
        "links": [("/tools/split-pdf-for-notebooklm", "Split PDF for NotebookLM"), ("/tools/merge-pdf", "Merge PDFs"), ("/blog/notebooklm-source-limits", "NotebookLM source limits"), ("/blog/notebooklm-pricing-plans", "NotebookLM plans and limits")],
        "cta": "<strong>See limits as you import.</strong> NotebookTools shows a source meter on every notebook and warns before you hit 50. Free.",
    },
    {
        "slug": "compress-pdf",
        "group": "pdf",
        "icon": "compress",
        "name": "Compress PDF",
        "card": "Shrink large or scanned PDFs so they upload. Keep text, or compress scans hard with a quality slider.",
        "title": "Compress PDF Free in Your Browser (for NotebookLM Uploads)",
        "description": "Free PDF compressor: re-save PDFs compactly without losing text, or compress scanned and image-heavy PDFs as JPEG pages at the quality you pick. Runs in your browser; nothing is uploaded.",
        "h1": "Compress PDF",
        "answer": "Drop a PDF and pick a mode. Keep text re-saves the file more compactly without changing anything you can see (small savings, text stays selectable). Scanned redraws each page as a JPEG at the quality you choose, which shrinks scans and photo-heavy PDFs a lot, but turns text into an image. Use it to get files under NotebookLM's 200 MB per source.",
        "script": "pdf-compress.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="cpDrop"></div>
        <div class="pdf-file" id="cpFile" hidden></div>
        <div id="cpOptions" hidden>
          <div class="tool-field"><span class="tool-label">Mode</span>
            <div class="pdf-seg" role="radiogroup" aria-label="Compression mode">
              <label><input type="radio" name="cpMode" value="lossless" checked>Keep text (lossless)</label>
              <label><input type="radio" name="cpMode" value="scan">Scanned / image-heavy</label>
            </div></div>
          <div class="pdf-options" id="cpQualityWrap" hidden>
            <div class="tool-field"><label for="cpQuality">Quality</label><select id="cpQuality"><option value="0.75:150">Balanced (150 dpi)</option><option value="0.85:200">High (200 dpi)</option><option value="0.6:110">Smallest (110 dpi)</option></select></div>
          </div>
          <div class="pdf-run"><button type="button" class="tool-btn is-primary" id="cpRun">Compress</button></div>
        </div>
        <div class="pdf-bar" id="cpBar" hidden><span></span></div>
        <p class="pdf-status" id="cpStatus" hidden></p>
        <div class="pdf-results" id="cpResults"></div>""",
        "steps": [
            "Drop the PDF.",
            "Choose Keep text for normal documents, or Scanned / image-heavy for scans and photo PDFs (pick a quality).",
            "Click Compress and compare the before and after size.",
            "Download the smaller PDF and add it to NotebookLM.",
        ],
        "faq": [
            ("Why won't my PDF upload to NotebookLM?", "The most common reasons are size (over 200 MB per source), a password, or a damaged file. Compress or split large files; remove the password before uploading."),
            ("Will compressing hurt NotebookLM's answers?", "Keep text mode changes nothing NotebookLM reads. Scanned mode turns pages into images, so NotebookLM has to read them like a scan; use it for files that are scans already."),
            ("How much smaller will it get?", "Scanned PDFs often shrink by half or more at Balanced quality. Text-only PDFs are usually compact already, so Keep text saves less."),
            ("Is my PDF uploaded?", "No. Compression runs in your browser with pdf.js and pdf-lib."),
        ],
        "links": [("/tools/split-pdf-for-notebooklm", "Split PDF for NotebookLM"), ("/tools/pdf-page-word-counter", "PDF page & word counter"), ("/blog/notebooklm-not-working", "NotebookLM upload errors and fixes"), ("/tools/pdf-to-text", "PDF to text with OCR")],
        "cta": "<strong>Then import it in one click.</strong> NotebookTools adds files, pages, videos and AI chats to any notebook, and imports links and tabs in bulk. Free.",
    },
    {
        "slug": "extract-pdf-pages",
        "group": "pdf",
        "icon": "pages",
        "name": "Extract or Remove PDF Pages",
        "card": "Keep only the chapters you need, or delete pages. Click thumbnails or type ranges like 12-40, 55.",
        "title": "Extract or Delete PDF Pages Free (Click Thumbnails)",
        "description": "Free tool to extract or remove pages from a PDF: click page thumbnails or type ranges, then save a new PDF with only those pages or without them. Runs in your browser; nothing is uploaded.",
        "h1": "Extract or Remove PDF Pages",
        "answer": "Drop a PDF to see every page as a thumbnail. Click pages (or type ranges like 12-40, 55) and choose Extract to save only those pages, or Remove to save the PDF without them. Giving NotebookLM only the chapters you need keeps its answers on topic and the source small.",
        "script": "pdf-pages.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="pagesDrop"></div>
        <div class="pdf-file" id="pagesFile" hidden></div>
        <div id="pagesOptions" hidden>
          <div class="pdf-options">
            <div class="tool-field"><span class="tool-label">Do</span>
              <div class="pdf-seg" role="radiogroup" aria-label="Extract or remove">
                <label><input type="radio" name="pagesMode" value="keep" checked>Extract picked pages</label>
                <label><input type="radio" name="pagesMode" value="remove">Remove picked pages</label>
              </div></div>
            <div class="tool-field"><label for="pagesRanges">Pages</label><input type="text" id="pagesRanges" placeholder="e.g. 1-12, 20, 31-"></div>
          </div>
          <div class="pdf-run"><button type="button" class="tool-btn is-primary" id="pagesRun" disabled>Extract pages</button><button type="button" class="tool-btn" id="pagesAll">Select all</button><button type="button" class="tool-btn" id="pagesNone">Clear</button><span class="tool-stats" id="pagesCount"></span></div>
        </div>
        <p class="pdf-status" id="pagesStatus" hidden></p>
        <div class="pdf-thumbs" id="pagesThumbs"></div>""",
        "steps": [
            "Drop the PDF; page thumbnails appear.",
            "Click the pages you want, or type ranges such as 1-12, 20, 31-.",
            "Choose Extract picked pages or Remove picked pages.",
            "Save the new PDF and add it to NotebookLM.",
        ],
        "faq": [
            ("Why give NotebookLM only some pages?", "Answers and summaries stay focused on what you're studying, citations are easier to check, and smaller sources leave room under the size limits."),
            ("Can I type page numbers instead of clicking?", "Yes. Use commas and ranges: 1-12, 20, 31- (31 to the end)."),
            ("Does it keep the text selectable?", "Yes. Pages are copied as they are."),
            ("Is my PDF uploaded?", "No. Everything happens in your browser."),
        ],
        "links": [("/tools/split-pdf-for-notebooklm", "Split PDF for NotebookLM"), ("/tools/merge-pdf", "Merge PDFs"), ("/blog/how-to-use-notebooklm-to-study", "How to study with NotebookLM"), ("/features/manage-sources", "Manage NotebookLM sources")],
        "cta": "<strong>See which chapters you already added.</strong> NotebookTools compares two notebooks side by side, finds duplicate sources and copies sources between notebooks (Pro).",
    },
    {
        "slug": "image-to-text-ocr",
        "group": "pdf",
        "icon": "ocr",
        "name": "Image to Text (OCR)",
        "card": "Photos of whiteboards, slides, handwritten notes or screenshots to editable text. Paste or drop.",
        "title": "Image to Text (OCR) Free in Your Browser: Photos, Screenshots",
        "description": "Free OCR image to text converter: turn photos of whiteboards, slides, book pages and screenshots into editable text. Paste or drop several images. Runs in your browser with Tesseract; nothing is uploaded.",
        "h1": "Image to Text (OCR)",
        "answer": "Drop or paste photos of whiteboards, lecture slides, book pages, receipts or screenshots, and the text is read out with OCR (Tesseract, English) right in your browser. Several images become one document with a heading per image. Copy it or download a Markdown file to add to NotebookLM as a text source.",
        "script": "image-ocr.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="ocrDrop"></div>
        <p class="pdf-status" id="ocrStatus" hidden></p>
        <div id="ocrResult" hidden>
          <textarea id="ocrOutput" class="is-output pdf-output" aria-label="Recognised text"></textarea>
          <div class="tool-actions"><button type="button" class="tool-btn is-primary" id="ocrCopy" disabled>Copy</button><button type="button" class="tool-btn" id="ocrDownload" disabled>Download .md</button><button type="button" class="tool-btn" id="ocrClear">Clear</button></div>
        </div>""",
        "steps": [
            "Drop one or more images, or paste a screenshot with Ctrl+V (Cmd+V on Mac).",
            "Wait while each image is read. The first run loads the text reader (about 8 MB, then cached).",
            "Fix anything misread directly in the text box.",
            "Copy the text or download it, then add it to NotebookLM as a source.",
        ],
        "faq": [
            ("Does it read handwriting?", "Neat print works best. Joined-up handwriting is often misread; check the text before you rely on it."),
            ("Which languages does it support?", "English. Other Latin-script text is often readable but less accurate."),
            ("NotebookLM accepts images; why convert them?", "Text sources are searchable, quotable and easy to correct. For notes and whiteboards, clean text usually gives NotebookLM more reliable answers."),
            ("Are my images uploaded?", "No. OCR runs in your browser with Tesseract.js; images never leave your device."),
        ],
        "links": [("/tools/pdf-to-text", "PDF to text with OCR"), ("/features/snapshots", "Snapshots to NotebookLM"), ("/blog/how-to-use-notebooklm-to-study", "How to study with NotebookLM"), ("/tools/text-splitter", "Text splitter")],
        "cta": "<strong>Capture screens straight into a notebook.</strong> NotebookTools Snapshots grabs any part of a page and sends it to NotebookLM, or writes a step-by-step guide from your screenshots (Pro).",
    },
    {
        "slug": "pdf-to-images",
        "group": "pdf",
        "icon": "images",
        "name": "PDF Slides to Images",
        "card": "Turn a NotebookLM slide deck (or any PDF) into PNG or JPG images sized for LinkedIn and Instagram.",
        "title": "PDF to PNG/JPG: NotebookLM Slide Deck to Images (Free)",
        "description": "Free PDF to image converter: turn every page of a NotebookLM slide deck or any PDF into PNG or JPG images at full resolution or sized for LinkedIn and Instagram. Download one or all as a ZIP. Runs in your browser.",
        "h1": "PDF Slides to Images",
        "answer": "Download your slide deck from NotebookLM as a PDF, drop it here, and every page becomes a PNG or JPG image: full resolution, or 1080 or 1200 px wide for LinkedIn and Instagram posts. Pick pages if you only need some, then download one image or all of them as a ZIP. Nothing is uploaded.",
        "script": "pdf-to-images.js",
        "extra_scripts": ["pdf-kit.js"],
        "stack": True,
        "app": """
        <div id="piDrop"></div>
        <div class="pdf-file" id="piFile" hidden></div>
        <div id="piOptions" hidden>
          <div class="pdf-options">
            <div class="tool-field"><label for="piFormat">Format</label><select id="piFormat"><option value="png">PNG (sharp text)</option><option value="jpg">JPG (smaller)</option></select></div>
            <div class="tool-field"><label for="piWidth">Size</label><select id="piWidth"><option value="1080">1080 px wide (Instagram)</option><option value="1200">1200 px wide (LinkedIn)</option><option value="1920">1920 px wide (Full HD)</option><option value="0">2× original</option></select></div>
            <div class="tool-field"><label for="piPages">Pages (optional)</label><input type="text" id="piPages" placeholder="All, or e.g. 1-5, 8"></div>
          </div>
          <div class="pdf-run"><button type="button" class="tool-btn is-primary" id="piRun">Convert to images</button></div>
        </div>
        <div class="pdf-bar" id="piBar" hidden><span></span></div>
        <p class="pdf-status" id="piStatus" hidden></p>
        <div class="pdf-run" id="piZipRow" hidden><button type="button" class="tool-btn is-primary" id="piZip">Download all (.zip)</button></div>
        <div class="pdf-thumbs" id="piThumbs"></div>""",
        "steps": [
            "In NotebookLM, open your slide deck in Studio and download it as a PDF.",
            "Drop the PDF here.",
            "Choose PNG or JPG, a size (1080 px for Instagram, 1200 px for LinkedIn) and, optionally, which pages.",
            "Click Convert, then download single images or all of them as a ZIP.",
        ],
        "faq": [
            ("How do I download a NotebookLM slide deck?", "Open the slide deck in the Studio panel and use its download option to save it as a PDF (or PowerPoint)."),
            ("Which size is best for LinkedIn and Instagram?", "1080 px wide suits Instagram; 1200 px suits LinkedIn. For a swipeable LinkedIn carousel, post the PDF itself as a document."),
            ("PNG or JPG?", "PNG keeps text and lines crisp; JPG files are smaller, good for photo-heavy slides."),
            ("Is my deck uploaded?", "No. Pages are rendered in your browser with pdf.js."),
        ],
        "links": [("/notebooklm-slide-styles", "NotebookLM slide deck styles"), ("/blog/notebooklm-slide-prompts", "NotebookLM slide prompts"), ("/tools/notebooklm-prompts", "NotebookLM prompt library"), ("/tools/merge-pdf", "Merge PDFs")],
        "cta": "<strong>Make a LinkedIn or Instagram carousel from a deck.</strong> NotebookTools turns any NotebookLM slide deck into a carousel with your handle, page numbers and a swipe hint, right inside NotebookLM (Pro).",
    },
]


HUB = {
    "title": "Free NotebookLM & PDF Tools: Slide Editor, Split, Merge, OCR",
    "description": "13 free browser tools for NotebookLM users: edit NotebookLM slides and export PowerPoint, split, merge, compress and count PDFs, PDF to text, OCR, slides to images, a prompt library, link cleaner, text splitter and answer cleaner. Nothing is uploaded.",
    "h1": "Free tools for NotebookLM",
    "answer": "Thirteen free tools for people who work in NotebookLM (now Gemini Notebook), all running in your browser with nothing uploaded. A slide editor turns NotebookLM slide decks into editable PowerPoint files. PDF and image tools get files ready for NotebookLM: split, merge, compress, extract pages, count words against the limits, convert PDF to text, read images with OCR, and turn slide decks into images. NotebookLM tools help inside it: a prompt library, a link cleaner, a text splitter and an answer cleaner.",
}

GROUPS = [
    ("pdf", "PDF & image tools", "Get files ready for NotebookLM: under 200 MB and 500,000 words per source, 50 sources per notebook."),
    ("notebooklm", "NotebookLM tools", "Prompts, links and answers for working inside NotebookLM."),
]


# ---------------------------------------------------------------------------
# Page parts
# ---------------------------------------------------------------------------
def head(title: str, description: str, path: str, schema: dict, lang: str = "en", og: str = "en_US", alternates=None, md: str | None = "") -> str:
    url = f"{BASE}{path}"
    if md == "":
        md = f"{path}.md" if path != "/tools" else "/tools/index.md"
    alts = alternates or [("en", url), ("x-default", url)]
    alt_links = "\n    ".join(f'<link rel="alternate" hreflang="{h}" href="{u}">' for h, u in alts)
    md_link = f'\n    <link rel="alternate" type="text/markdown" href="{md}" title="Markdown version">' if md else ""
    return f"""<!doctype html>
<html lang="{lang}">
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
    {alt_links}{md_link}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="NotebookTools">
    <meta property="og:locale" content="{og}">
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
    group = next((t.get("group") for t in TOOLS if t["slug"] == slug), None)
    ordered = [t for t in TOOLS if t.get("group") == group] + [t for t in TOOLS if t.get("group") != group]
    for t in ordered[:7]:
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
    alternates = editor_alternates() if t["slug"] == "edit-notebooklm-slides" else None
    if t.get("raw_app"):
        app_html = t["raw_app"]
    else:
        app_html = '<section class="tool-app' + (" is-stack" if t.get("stack") else "") + '" aria-label="' + E(t["name"]) + '">' + t["app"] + "\n      </section>"
    steps = "".join(f"<li>{E(s)}</li>" for s in t["steps"])
    faq = "".join(f"<h3>{E(q)}</h3><p>{E(a)}</p>" for q, a in t["faq"])
    links = "".join(f'<li><a href="{h}">{E(l)}</a></li>' for h, l in t["links"])
    wide = t["slug"] == "edit-notebooklm-slides"
    main_open, main_close = wide_main(app_html) if wide else ('<main class="tools-main">', "</main>")
    return f"""{head(t['title'], t['description'], path, schema, alternates=alternates)}
  <body>
    <header class="site-header"></header>

    {main_open}
      <nav class="blog-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/tools">Free tools</a> <span aria-hidden="true">/</span> <span>{E(t['name'])}</span></nav>
      <section class="tools-hero">
        <p class="eyebrow">Free tool</p>
        <h1>{E(t['h1'])}</h1>
        <div class="post-answer"><p class="post-answer-label">Short answer</p><p>{E(t['answer'])}</p></div>
        {BADGES}{editor_languages("en") if wide else ""}
      </section>

      {"" if wide else app_html}

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
    {main_close}

    <footer class="site-footer"></footer>
{scripts}
  </body>
</html>
"""


def wide_main(app_html: str):
    """The slide editor fills the screen under the header; the page text follows below it."""
    app = app_html.replace('class="se-app"', 'class="se-app is-wide"', 1)
    return f'<main class="editor-page">\n      {app}\n      <div class="tools-main">', "</div>\n    </main>"


def editor_languages(current: str) -> str:
    """'English · Español · Português · 繁體中文' under the editor's title; the current one isn't a link."""
    items = [("en", "English", "/tools/edit-notebooklm-slides")] + [(l["lang"], l["native"], l["path"]) for l in EDITOR_LOCALES]
    parts = [f'<span aria-current="true">{E(n)}</span>' if c == current else f'<a href="{h}" hreflang="{c}" lang="{c}">{E(n)}</a>' for c, n, h in items]
    return '<p class="tools-langs">' + ' <span aria-hidden="true">·</span> '.join(parts) + '</p>'


def editor_alternates():
    en = f"{BASE}/tools/edit-notebooklm-slides"
    return [("en", en)] + [(loc["lang"], f"{BASE}{loc['path']}") for loc in EDITOR_LOCALES] + [("x-default", en)]


def editor_locale_page(t: dict, loc: dict) -> str:
    """The slide editor page in another language (EDITOR_LOCALES)."""
    L = loc["labels"]
    path = loc["path"]
    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebApplication", "name": loc["name"], "url": f"{BASE}{path}", "description": loc["description"], "inLanguage": loc["lang"],
         "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (runs in the browser)",
         "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
         "dateModified": UPDATED, "publisher": {"@type": "Organization", "name": "NotebookTools", "url": BASE}},
        {"@type": "HowTo", "name": L["howto_name"], "step": [
            {"@type": "HowToStep", "position": i + 1, "text": st} for i, st in enumerate(loc["steps"])]},
        faq_schema(loc["faq"]),
        breadcrumb([(L["home"], "/"), (L["tools"], "/tools"), (loc["name"], path)]),
    ]}
    # editor-i18n.js translates the editor's interface; it loads before the editor builds it
    scripts = "".join(f'\n    <script src="/tools/{x}"></script>' for x in ["tools.js", *t.get("extra_scripts", []), "editor-i18n.js", t["script"]])
    steps = "".join(f"<li>{E(x)}</li>" for x in loc["steps"])
    faq = "".join(f"<h3>{E(q)}</h3><p>{E(a)}</p>" for q, a in loc["faq"])
    links = "".join(f'<li><a href="{h}">{E(l)}</a></li>' for h, l in loc["links"])
    badges = f"""<div class="tools-badges">
          <span class="tools-badge">{CHECK}{E(L['free'])}</span>
          <span class="tools-badge">{LOCK}{E(L['private'])}</span>
          <span class="tools-badge">{E(L['updated'])} <time datetime="{UPDATED}">{E(L['updated_label'])}</time></span>
        </div>"""
    app_html = t["raw_app"].replace("Loading the editor…", E(L["loading"])).replace('aria-label="NotebookLM slide editor"', f'aria-label="{E(loc["name"])}"')
    main_open, main_close = wide_main(app_html)
    return f"""{head(loc['title'], loc['description'], path, schema, lang=loc['lang'], og=loc['og'], alternates=editor_alternates(), md=None)}
  <body>
    <header class="site-header"></header>

    {main_open}
      <nav class="blog-breadcrumb" aria-label="Breadcrumb"><a href="/">{E(L['home'])}</a> <span aria-hidden="true">/</span> <a href="/tools">{E(L['tools'])}</a> <span aria-hidden="true">/</span> <span>{E(loc['name'])}</span></nav>
      <section class="tools-hero">
        <p class="eyebrow">{E(L['eyebrow'])}</p>
        <h1>{E(loc['h1'])}</h1>
        <div class="post-answer"><p class="post-answer-label">{E(L['answer'])}</p><p>{E(loc['answer'])}</p></div>
        {badges}{editor_languages(loc["lang"])}
      </section>

      <aside class="tool-cta" aria-label="NotebookTools Chrome extension">
        <p>{loc['cta']}</p>
        <a class="button" href="{CHROME_STORE}" target="_blank" rel="noopener noreferrer">{E(L['add'])}</a>
      </aside>

      <article class="tools-copy">
        <h2 id="how-to">{E(L['howto'])}</h2>
        <ol>{steps}</ol>
        <h2 id="faq">{E(L['faq'])}</h2>
        {faq}
        <h2 id="related">{E(L['related'])}</h2>
        <ul>{links}</ul>
      </article>

      <section class="tools-more" aria-label="{E(L['more'])}">
        <h2>{E(L['more'])}</h2>
        <div class="tools-grid">
          {other_tools(t['slug'])}
        </div>
      </section>
    {main_close}

    <footer class="site-footer"></footer>
{scripts}
  </body>
</html>
"""


def hub_page() -> str:
    path = "/tools"
    faq = [
        ("Are these NotebookLM tools free?", "Yes. All thirteen are free with no sign-up, and they run in your browser, so nothing you paste or open is uploaded."),
        ("Are my PDFs uploaded to a server?", "No. The PDF tools use pdf-lib, pdf.js and Tesseract.js running in your browser tab. Files never leave your device, which also makes them fast for large files."),
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
    def card(t):
        return f"""<a class="tool-card" href="/tools/{t['slug']}">
          <span class="tool-card-icon">{icon(t['icon'])}</span>
          <h3>{E(t['name'])}</h3>
          <p>{E(t['card'])}</p>
          <span class="tool-card-tag">Open tool →</span>
        </a>"""
    cards = "\n".join(
        f"""<section class="tools-group" aria-labelledby="g-{key}">
        <div class="tools-group-head"><h2 id="g-{key}">{E(label)}</h2><p>{E(note)}</p></div>
        <div class="tools-grid">
        {"".join(card(t) for t in TOOLS if t.get("group") == key)}
        </div>
      </section>"""
        for key, label, note in GROUPS)
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

      {cards}

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
    editor = next(t for t in TOOLS if t["slug"] == "edit-notebooklm-slides")
    for loc in EDITOR_LOCALES:
        dest = SITE / (loc["path"].lstrip("/") + ".html")
        dest.parent.mkdir(parents=True, exist_ok=True)
        page = editor_locale_page(editor, loc)
        if loc.get("chrome_from"):
            # the language's own translated header and footer (sync-site-chrome.py leaves these folders alone)
            ref = (SITE / loc["chrome_from"]).read_text(encoding="utf-8")
            for pat in (r'<header class="site-header">.*?</header>', r'<footer class="site-footer">.*?</footer>'):
                m = re.search(pat, ref, re.S)
                if m:
                    page = re.sub(pat, lambda _: m.group(0), page, count=1, flags=re.S)
            # this page's own link in the translated header is the current page
            page = page.replace(f'<a href="{loc["path"]}">', f'<a href="{loc["path"]}" aria-current="page">', 1)
            for tag in ('<link rel="stylesheet" href="/theme.css">',):
                if tag not in page:
                    page = page.replace('<link rel="stylesheet" href="/tools/tools.css">', '<link rel="stylesheet" href="/tools/tools.css">\n    ' + tag, 1)
            if '<script src="/site.js" defer></script>' not in page:
                page = page.replace("</body>", '  <script src="/site.js" defer></script>\n  </body>', 1)
        dest.write_text(page, encoding="utf-8")
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
