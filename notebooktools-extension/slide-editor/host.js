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

  /** Google's file servers pick the signed-in account from ?authuser=N (default: the first account). */
  function withAccount(url) {
    if (authUser === null || authUser === "") return url;
    try {
      const u = new URL(url);
      if (/(^|\.)(googleusercontent\.com|google\.com|ggpht\.com)$/i.test(u.hostname) && !u.searchParams.has("authuser")) {
        u.searchParams.set("authuser", authUser);
      }
      return u.toString();
    } catch (_error) {
      return url;
    }
  }

  function base64Blob(data, type) {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: type || "application/octet-stream" });
  }

  /** Direct with the account, direct as given, then through the notebook tab. */
  async function download(url) {
    let lastError = null;
    for (const attempt of [withAccount(url), url].filter((v, i, list) => list.indexOf(v) === i)) {
      try {
        const response = await fetch(attempt, { credentials: "include" });
        if (response.ok) return await response.blob();
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    const viaTab = await chrome.runtime.sendMessage({ type: "notebooktools-fetch-via-notebook-tab", url: withAccount(url), notebookId });
    if (viaTab?.ok && viaTab.data) return base64Blob(viaTab.data, viaTab.type);
    throw new Error(viaTab?.error || lastError?.message || "Download failed");
  }

  let pdfError = null;

  async function fromPdf(deck) {
    if (!deck.pdfUrl) return false;
    loader.text("Downloading the deck…");
    try {
      const blob = await download(deck.pdfUrl);
      if (blob.size < 1000 || !/pdf|octet-stream/i.test(blob.type || "application/pdf")) return false;
      loader.text("Opening the slides…");
      await editor.open([new File([blob], `${title}.pdf`, { type: "application/pdf" })]);
      return true;
    } catch (error) {
      pdfError = error;
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
    if (pdfError) throw pdfError;
    throw new Error(deck.status === "generating"
      ? "This slide deck is still generating in NotebookLM. Try Edit slides again when it's finished."
      : "Couldn't import this deck from NotebookLM. Download it as PDF in NotebookLM (⋮ → Download), then click Open and choose the file.");
  } catch (error) {
    loader.hide();
    editor.status(/HTTP 40[13]/.test(error.message)
      ? "NotebookLM didn't let us download the deck. Keep the notebook open in a tab (same Google account), then click Edit slides again. Or download the PDF in NotebookLM (⋮ → Download) and click Open."
      : error.message || "Couldn't open the slide deck.", "error");
  }
})();
