# NotebookLM Not Working? 9 Common Errors and Fixes (2026)

> NotebookLM not working? Check the Google Workspace Status Dashboard for outages, then fix source imports, source limits, usage limits and account access.
> Source: https://www.notebooktools.com/blog/notebooklm-not-working

![NotebookLM not working? 9 common errors and how to fix them](https://www.notebooktools.com/assets/blog/notebooklm-not-working.webp)

Short answer

**First check whether NotebookLM is down on the Google Workspace Status Dashboard.** If it is up, most problems come from sources that cannot be imported (over **200 MB or 500,000 words**, private or caption-less YouTube videos, paywalled pages), a full notebook (**50 sources** on the free plan), a usage limit that refreshes after a few hours, or a work or school account where the admin has not turned NotebookLM on.

post-cta

Fewer failed imports, fewer full notebooks

Imports are free. Pro ($49 one-time, lifetime) unlocks the notebooks dashboard, source manager (duplicate scan, Drive refresh), Studio files, blog and carousel makers, snapshots, a prompt library with / commands, and chat export to PDF/Word.

[Add to Chrome, free](https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj) [Find duplicate sources and track the source limit →](https://www.notebooktools.com/features/manage-sources)

/post-cta

NotebookLM (now Gemini Notebook) is usually reliable, but when it fails the error messages are short and vague. Use the table to match your symptom, then read the section for the full fix.

## NotebookLM troubleshooting table

| Symptom | Likely cause | Fix |
|---|---|---|
| Site will not load, or every action errors | Google outage | Check the Google Workspace Status Dashboard; wait and retry |
| “The system was unable to answer” | Temporary server error, sources still processing, or a usage limit | Retry, refresh, start a new chat, check limits |
| A source will not import or stays loading | File too large, unsupported or blocked content | Stay under 200 MB and 500,000 words; split or paste text |
| YouTube link fails | Private, unlisted-restricted or caption-less video | Use a public video with captions, or paste a transcript |
| Web page imports empty or partial | Paywall, login wall or heavy scripts | Copy the text you have access to and paste it |
| “This notebook has reached its source limit” | Notebook is full (50 on Free) | Delete or merge sources, split the notebook, or upgrade |
| Usage limit message for chat or Studio | Rolling usage limit reached | Wait a few hours; the weekly cap resets later |
| “Not available” or no access | Admin has not enabled it, or age requirements | Ask your admin, or use a personal account |
| Buttons do nothing, blank panels | Browser extensions, cache or cookies | Try a private window, clear site data, update the browser |

## 1. Is NotebookLM down? How to check

Google lists NotebookLM incidents on the [Google Workspace Status Dashboard](https://www.google.com/appsstatus/dashboard/). Past incidents there include outages where users could not chat or upload sources, and problems limited to Audio and Video Overviews. Check it before you change anything on your side.

1. Open the Google Workspace Status Dashboard and look for NotebookLM (it may also appear under the Gemini Notebook name).
2. If there is an open incident, wait. Your notebooks and sources are stored by Google and are not lost during an outage.
3. If the dashboard is clear, open notebooklm.google.com in a private window. If it works there, the problem is your browser (see section 9).
4. If it still fails, try a different network. Some company networks and VPNs block Google services.

Partial outages are common: chat can work while Audio Overviews fail, or the reverse. If only one feature is broken, the dashboard is the place to confirm it.

## 2. “The system was unable to answer”

This message is generic. It means NotebookLM could not produce a reply to that question at that moment. Work through these in order:

- **Retry once.** Many cases are temporary server errors.
- **Wait for sources to finish processing.** A new long PDF or a 90-minute video can take a while before NotebookLM can use it.
- **Check which sources are selected.** If no sources are ticked in the Sources panel, there is nothing to answer from.
- **Make the question narrower.** Very broad requests across dozens of sources fail more often. Ask about one topic or one source at a time.
- **Refresh and start a new chat.** A long chat history can cause trouble. Save useful answers as notes first.
- **Check your usage limit** (section 7) and the status dashboard.

## 3. Source not loading or failing to import

Each source can be up to **500,000 words or 200 MB**, on every plan. Common reasons an import fails:

- **Too large.** Split a big PDF into parts, or compress scanned images. Very large scans may also be slow to process.
- **Scanned PDF with no text layer.** If you cannot select the text in the PDF, run it through OCR first or paste the text.
- **Unsupported format.** Supported sources include PDFs, Google Docs, Slides and Sheets, web URLs, YouTube videos, audio files and pasted text. Convert other formats to PDF or text.
- **Drive permissions.** A Google Drive file you cannot open in Drive will not import. Ask the owner for access or make a copy.

## 4. YouTube video will not import

NotebookLM reads a YouTube video through its transcript. Imports usually fail when the video is **private**, restricted, removed, or has **no captions** (auto-generated or uploaded). Pick a public video with captions, or copy the transcript from YouTube and add it as pasted text. If you import many videos, [NotebookTools adds YouTube videos and playlists](https://www.notebooktools.com/features/add-youtube) in one run and shows which ones failed.

## 5. Web page imports empty, partial or wrong

NotebookLM can only read what is publicly reachable at the URL. **Paywalled** articles, pages behind a login, and sites that block automated readers often come in empty or show only a teaser. Open the page in your browser, copy the text you have legal access to, and paste it as a text source. Pages that load content with heavy scripts can also import partially; a print view or reader view often has cleaner text.

## 6. “This notebook has reached its source limit”

The notebook holds the maximum number of sources for your plan: **50 on Free**, 100 on Google AI Plus, 300 on Google AI Pro and 500+ on Ultra. Delete duplicates and stale sources, merge short notes into one Google Doc, split the project into a second notebook, or upgrade. Full details are in our [NotebookLM source limits guide](https://www.notebooktools.com/blog/notebooklm-source-limits).

## 7. Usage limit reached

Since September 2026, chat and Studio use (Audio Overviews, Video Overviews, slide decks and other outputs) is measured with limits that **refresh every few hours, up to a weekly cap**. Paid Google AI plans get more. If you hit the limit:

- Wait a few hours for the rolling limit to refresh.
- If you have reached the weekly cap, it resets later in the week.
- Save tokens: ask focused questions and avoid regenerating the same Studio output many times.
- If you hit limits every week, compare plans in our [NotebookLM pricing guide](https://www.notebooktools.com/blog/notebooklm-pricing-plans).

## 8. Account access: work, school and age

**Work or school accounts** only get NotebookLM if the organization’s admin has turned it on in the Google Admin console. If you see a message that the service is not available, ask your IT team, or sign in with a personal Google account for personal projects.

**Age.** Google applies age requirements that vary by account type and country, and may ask you to verify your age. If NotebookLM says it is not available for your account, check your account’s age settings or ask your school admin.

Also confirm you are signed in to the right account. If you use several Google accounts in one browser, NotebookLM may open with a different account than the one that owns the notebook.

## 9. Browser problems

1. **Try a private window.** If NotebookLM works there, an extension or stored site data is the cause.
2. **Disable extensions one at a time.** Ad blockers and privacy tools sometimes block Google scripts.
3. **Clear site data** for notebooklm.google.com and sign in again.
4. **Update your browser.** Use a current version of Chrome, Edge, Firefox or Safari.
5. **Turn off VPN or proxy** to rule out network blocks.

If you use the NotebookTools extension and something stops working after a NotebookLM update, visit our [support page](https://www.notebooktools.com/support). We track NotebookLM changes and ship fixes.

## FAQ

### Is NotebookLM down right now?

Check the Google Workspace Status Dashboard, which lists NotebookLM incidents. If it shows no incident, try a private browser window and another network before assuming an outage.

### What does “The system was unable to answer” mean?

NotebookLM could not produce a reply at that moment. Retry, wait for new sources to finish processing, make sure sources are selected, ask a narrower question, or start a new chat. It can also follow a usage limit or an outage.

### Why is my NotebookLM source not loading?

The file may be over 200 MB or 500,000 words, a scanned PDF with no text, an unsupported format, or a Drive file you cannot open. YouTube videos need to be public with captions, and paywalled pages often import empty.

### How do I fix “This notebook has reached its source limit”?

Delete or merge sources, move some into a new notebook, or upgrade. The limit is 50 sources per notebook on Free, 100 on Google AI Plus, 300 on Pro and 500+ on Ultra.

### How long until the NotebookLM usage limit resets?

Since September 2026, chat and Studio limits refresh every few hours, up to a weekly cap. If you hit the weekly cap, you wait until it resets later in the week. Paid plans get more use.

### Why can't I use NotebookLM with my school account?

The school's Google Workspace admin has to turn NotebookLM on, and age requirements may apply. Ask your IT team or teacher to check.

![NotebookTools](https://www.notebooktools.com/assets/logo-wordmark-sm.png)

## Import to NotebookLM in one click

Free Chrome extension. Import YouTube, webpages, X posts, and highlights into your notebooks.

- YouTube watch-page button
- Right-click any highlight
- Works with your Google sign-in

[![Available in the Chrome Web Store](https://www.notebooktools.com/assets/chrome-web-store-badge.png)](https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj)

Free · No extra account
