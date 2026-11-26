/* Loads extension scripts into this page the first time they're needed
   (see LAZY_FILES in background.js). Each file loads once. */
(function () {
  "use strict";
  if (window.NotebookToolsLazy) return;
  const loading = new Map();
  function load(files) {
    const list = [].concat(files || []);
    return Promise.all(list.map((file) => {
      if (!loading.has(file)) {
        loading.set(file, new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: "notebooktools-load-scripts", files: [file] }, (reply) => {
            if (chrome.runtime.lastError || !reply?.ok) {
              loading.delete(file);
              reject(new Error(reply?.error || chrome.runtime.lastError?.message || `Couldn't load ${file}. Reload the page and try again.`));
            } else resolve();
          });
        }));
      }
      return loading.get(file);
    }));
  }
  /** window.PDFLib, loaded on first use */
  async function pdfLib() {
    if (!globalThis.PDFLib) await load("vendor/pdf-lib/pdf-lib.min.js");
    if (!globalThis.PDFLib?.PDFDocument) throw new Error("PDF tools couldn't load. Reload the page and try again.");
    return globalThis.PDFLib;
  }
  window.NotebookToolsLazy = { load, pdfLib };
})();
