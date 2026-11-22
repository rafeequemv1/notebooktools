/* Extension host for the slide editor: opens a NotebookLM slide deck straight
   from the notebook (no download / upload), using the deck's PDF link and the
   signed-in Google account. URL: slide-editor.html?notebook=…&artifact=…&title=…&authuser=… */
(async () => {
  const params = new URLSearchParams(location.search);
  const notebookId = params.get("notebook");
  const artifactId = params.get("artifact");
  const title = (params.get("title") || "Slide deck").replace(/[<>:"/\\|?*]+/g, "-").slice(0, 90);
  const authUser = params.get("authuser");
  if (title) document.title = `${title} · Slide editor · NotebookTools`;
  if (!notebookId || !artifactId || !window.NTSlideEditor) return;
  const editor = window.NTSlideEditor;
  editor.status("Loading the slide deck from NotebookLM…");
  try {
    const options = authUser ? { authUser } : {};
    const deck = await window.NotebookToolsNotebookLM.getNotebookLmSlideDeck(notebookId, artifactId, options);
    const url = deck?.pdfUrl;
    if (!url) throw new Error("This slide deck has no PDF yet. If it's still generating, try again in a minute; or download it in NotebookLM and drop the PDF here.");
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`Couldn't download the deck from NotebookLM (${response.status}). Open NotebookLM in this browser, then try again.`);
    const blob = await response.blob();
    await editor.open([new File([blob], `${title}.pdf`, { type: "application/pdf" })]);
  } catch (error) {
    editor.status(error.message || "Couldn't open the slide deck.", "error");
  }
})();
