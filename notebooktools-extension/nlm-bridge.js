/* Import panels shown inside other sites (an iframe on youtube.com, …): their
   NotebookLM calls go through the background worker. Inside another site Chrome
   treats requests to NotebookLM as third-party and often holds back the Google
   sign-in cookies, so the panel would look signed out or fail to import. */
(function () {
  "use strict";
  if (window.top === window || !window.NotebookToolsNotebookLM) return;
  const methods = [
    "listNotebookLmNotebooks", "createNotebookLmNotebook", "listNotebookLmSources", "getNotebookLmSourceCount",
    "addYoutubeToNotebookLm", "addWebpageToNotebookLm", "addTextToNotebookLm",
    "waitForYoutubeSourceReady", "waitForWebSourceReady",
    "createNotebookLmArtifact", "waitForNotebookLmArtifactReady"
  ];
  for (const method of methods) {
    if (typeof window.NotebookToolsNotebookLM[method] !== "function") continue;
    window.NotebookToolsNotebookLM[method] = async (...args) => {
      const response = await chrome.runtime.sendMessage({ type: "notebooktools-nlm", method, args });
      if (!response?.ok) throw new Error(response?.error || "NotebookLM didn't answer. Try again.");
      return response.result;
    };
  }
})();
