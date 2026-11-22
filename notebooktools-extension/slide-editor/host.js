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
  if (!notebookId || !window.NTSlideEditor) return;

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

  /** The way NotebookLM's own button works: its ⋮ menu → Download → PDF, picked up from Downloads. */
  async function fromNotebookDownload() {
    loader.text("Downloading through NotebookLM (⋮ → Download)…");
    const r = await chrome.runtime.sendMessage({ type: "notebooktools-deck-via-notebook-download", notebookId, title: params.get("title") || "" });
    if (!r?.ok || !r.data) throw Object.assign(new Error(r?.error || "Couldn't download the deck through NotebookLM."), { needPermission: !!r?.needPermission });
    loader.text("Opening the slides…");
    await editor.open([new File([base64Blob(r.data, "application/pdf")], `${title}.pdf`, { type: "application/pdf" })]);
    return true;
  }

  const hasDownloadsPermission = () => chrome.permissions.contains({ permissions: ["downloads"] }).catch(() => false);

  /** One button in the loader card: Chrome only asks for a permission after a click. */
  function offerNotebookDownload(reason) {
    loader.show(`Importing “${title}” from NotebookLM`);
    loader.text(reason);
    const card = document.querySelector(".se-loader-card");
    card.querySelector(".se-loader-actions")?.remove();
    document.querySelector("#seLoaderStrip")?.classList.remove("is-waiting"); // waiting on the person now, not loading
    const actions = document.createElement("div");
    actions.className = "se-loader-actions";
    actions.innerHTML = '<button type="button" class="se-btn is-primary" data-go>Download it through NotebookLM</button><button type="button" class="se-btn" data-pick>Choose a PDF instead</button><p class="se-loader-hint">Opens the deck\u2019s \u22ee menu \u2192 Download in your notebook tab, the way NotebookLM does it. Chrome asks once to let NotebookTools pick up that download.</p>';
    card.append(actions);
    actions.querySelector("[data-go]").addEventListener("click", async () => {
      const granted = (await hasDownloadsPermission()) || (await chrome.permissions.request({ permissions: ["downloads"] }).catch(() => false));
      if (!granted) {
        loader.text("Without that permission, download the PDF from the deck\u2019s \u22ee menu in NotebookLM, then choose it here.");
        return;
      }
      actions.remove();
      try {
        await fromNotebookDownload();
      } catch (error) {
        fail(error);
      }
    });
    actions.querySelector("[data-pick]").addEventListener("click", () => {
      actions.remove();
      loader.hide();
      document.querySelector('[data-act="new"]')?.click();
    });
  }

  function fail(error) {
    document.querySelector(".se-loader-actions")?.remove();
    loader.hide();
    editor.status(error?.message || "Couldn't open the slide deck.", "error");
  }

  loader.show(`Importing “${title}” from NotebookLM`);
  loader.text("Finding your slide deck…");
  let reason = "";
  try {
    if (artifactId) {
      let deck = await getDeck();
      // Still generating: wait for it (up to about 5 minutes)
      for (let tries = 0; deck.status === "generating" && tries < 30; tries += 1) {
        loader.text("Still generating in NotebookLM. Checking again in 10 seconds…");
        await sleep(10000);
        deck = await getDeck();
      }
      if (deck.status === "generating") throw new Error("This slide deck is still generating in NotebookLM. Try Edit slides again when it's finished.");
      if (await fromPdf(deck)) return;
      if (await fromImages(deck)) return;
      reason = pdfError ? "NotebookLM didn\u2019t let us download the deck directly." : "NotebookLM didn\u2019t give a direct link to this deck.";
    } else {
      reason = "Couldn\u2019t look this deck up directly.";
    }
  } catch (error) {
    if (/still generating/.test(error.message || "")) return fail(error);
    reason = /HTTP 40[13]/.test(error.message || "") ? "NotebookLM didn\u2019t let us download the deck directly." : (error.message || "Couldn\u2019t download the deck directly.");
  }

  // Direct download didn't work: NotebookLM's own Download, as its button does it
  if (await hasDownloadsPermission()) {
    try {
      await fromNotebookDownload();
      return;
    } catch (error) {
      if (!error.needPermission) return fail(error);
    }
  }
  offerNotebookDownload(reason);
})();
