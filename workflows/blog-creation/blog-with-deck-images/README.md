# Blog with deck images

Turn a **NotebookLM slide deck** plus a **chat-generated blog draft** into a Word document with slide images embedded inline.

## Folder layout

```
workflows/
  blog-creation/
    blog-with-deck-images/
      README.md
notebooktools-extension/workflows/blog-creation/blog-with-deck-images/
  blog-prompt.js       # Chat prompt template
  blog-assembler.js    # Merge chat + slide images
  blog-doc-export.js   # Download .doc with inline images
  workflow.js          # Orchestration
  workflow-ui.js       # NotebookLM page UI
  workflow.css
```

## Workflow (in NotebookLM)

1. Create a **Slide deck** in Studio from your sources.
2. Open the notebook chat and click **Blog workflow** (next to Export chat).
3. Pick the slide deck from the dropdown.
4. Click **1. Copy blog prompt** and paste it into NotebookLM chat.
5. Wait for NotebookLM to write the full blog article.
6. Click **2. Download blog .doc**.

The downloaded `.doc` includes:

- Blog title and body from the latest NotebookLM chat reply
- **One image per slide**, rendered from the deck **PDF** (not fragile preview URLs)
- Images inserted after each `##` section (one image per section, in order)
- Any extra slide images appended at the end
- Captions from slide text when available

## Notes

- You must be signed in to NotebookLM in the same browser.
- The workflow downloads the slide deck PDF, renders each page to JPEG, and embeds those images in the Word file.
- Open the `.doc` in Microsoft Word or Google Docs.
- If chat has no long assistant reply yet, step 2 will ask you to generate the blog first.

## Future ideas

- Auto-send the blog prompt to chat (requires chat RPC)
- Match images to sections using slide text similarity
- Export `.docx` with the `docx` library instead of Word-compatible HTML
