/* Extension host for the slide editor: opens a NotebookLM slide deck straight
   from the notebook (no download / upload) with the signed-in Google account.
   URL: slide-editor.html?notebook=…&artifact=…&title=…&authuser=…

   Order of attempts: the deck's PDF; if there's none or it won't download,
   the deck's slide pictures one by one. A deck that's still generating is
   checked again every 10 seconds. */
(async () => {
  const params = new URLSearchParams(location.search);
  const notebookId = params.get("notebook");
  const artifactId = params.get("artifact");
  const title = (params.get("title") || "Slide deck").replace(/[<>:"/\\|?*]+/g, "-").slice(0, 90);
  const authUser = params.get("authuser");
  if (title) document.title = `${title} · Slide editor · NotebookTools`;
  if (!notebookId || !artifactId || !window.NTSlideEditor) return;

  const editor = window.NTSlideEditor;
  const loader = editor.loader;
  const options = authUser ? { authUser } : {};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function getDeck() {
    return window.NotebookToolsNotebookLM.getNotebookLmSlideDeck(notebookId, artifactId, options);
  }

  async function download(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  }

  async function fromPdf(deck) {
    if (!deck.pdfUrl) return false;
    loader.text("Downloading the deck…");
    try {
      const blob = await download(deck.pdfUrl);
      if (blob.size < 1000 || !/pdf|octet-stream/i.test(blob.type || "application/pdf")) return false;
      loader.text("Opening the slides…");
      await editor.open([new File([blob], `${title}.pdf`, { type: "application/pdf" })]);
      return true;
    } catch (_error) {
      return false; // fall back to the slide pictures
    }
  }

  async function fromImages(deck) {
    const urls = (deck.slides || []).map((s) => s.imageUrl).filter(Boolean);
    if (!urls.length) return false;
    const files = [];
    for (let i = 0; i < urls.length; i += 1) {
      const blob = await download(urls[i]);
      const bitmap = await createImageBitmap(blob);
      loader.frame(i, urls.length, bitmap);
      bitmap.close?.();
      const ext = /png/i.test(blob.type) ? "png" : /webp/i.test(blob.type) ? "webp" : "jpg";
      files.push(new File([blob], `${title}-${String(i + 1).padStart(2, "0")}.${ext}`, { type: blob.type || "image/png" }));
    }
    loader.text("Opening the slides…");
    await editor.open(files);
    return true;
  }

  loader.show(`Importing “${title}” from NotebookLM`);
  loader.text("Finding your slide deck…");
  try {
    let deck = await getDeck();
    // Still generating: wait for it (up to about 5 minutes)
    for (let tries = 0; deck.status === "generating" && tries < 30; tries += 1) {
      loader.text("Still generating in NotebookLM. Checking again in 10 seconds…");
      await sleep(10000);
      deck = await getDeck();
    }
    if (await fromPdf(deck)) return;
    if (await fromImages(deck)) return;
    throw new Error(deck.status === "generating"
      ? "This slide deck is still generating in NotebookLM. Try Edit slides again when it's finished."
      : "Couldn't import this deck from NotebookLM. Download it as PDF in NotebookLM (⋮ → Download), then click Open and choose the file.");
  } catch (error) {
    loader.hide();
    editor.status(/HTTP 40[13]/.test(error.message)
      ? "NotebookLM didn't let us download the deck. Open NotebookLM in this browser with the same account, then try again."
      : error.message || "Couldn't open the slide deck.", "error");
  }
})();
