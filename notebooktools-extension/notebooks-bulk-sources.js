const NotebookToolsSourcesBulk = (() => {
  let modal = null;
  let pasteEl = null;
  let statusEl = null;
  let importEl = null;
  let activeNotebook = null;
  let authOptions = {};
  let onComplete = null;
  let running = false;

  function setStatus(message, type = "") {
    if (!statusEl) {
      return;
    }

    statusEl.textContent = message || "";
    statusEl.hidden = !message;
    statusEl.classList.toggle("is-error", type === "error");
    statusEl.classList.toggle("is-loading", type === "loading");
  }

  function setRunning(isRunning) {
    running = isRunning;

    if (importEl) {
      importEl.disabled = isRunning;
    }

    if (pasteEl) {
      pasteEl.disabled = isRunning;
    }
  }

  async function addFromOpenTabs() {
    if (!chrome?.tabs?.query) {
      setStatus("Open tabs import is not available here.", "error");
      return;
    }

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const lines = new Set(
      String(pasteEl?.value || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
    let added = 0;

    for (const tab of tabs) {
      const parsed = NotebookToolsStore.classifyImportUrl(tab.url || "");

      if (!parsed) {
        continue;
      }

      const line = parsed.url;

      if (lines.has(line)) {
        continue;
      }

      lines.add(line);
      added += 1;
    }

    if (pasteEl) {
      pasteEl.value = [...lines].join("\n");
    }

    setStatus(added ? `Added ${added} tab link${added === 1 ? "" : "s"}.` : "No importable tabs in this window.");
  }

  async function runImport() {
    if (running || !activeNotebook) {
      return;
    }

    const parsed = NotebookToolsStore.parseLinkList(pasteEl?.value || "");

    if (!parsed.length) {
      setStatus("Paste one URL per line.", "error");
      return;
    }

    setRunning(true);
    setStatus(`Importing ${parsed.length} source${parsed.length === 1 ? "" : "s"}...`, "loading");

    const items = parsed.map((entry, index) => ({
      id: `src-bulk-${index}-${entry.url}`,
      url: entry.url,
      title: entry.url,
      type: entry.type,
      status: "pending",
      error: "",
      selected: true,
      addedAt: Date.now()
    }));

    let success = 0;
    let failed = 0;

    try {
      const summary = await NotebookToolsBulkRunner.run({
        items,
        notebookId: activeNotebook.id,
        onProgress: ({ item, summary: liveSummary }) => {
          if (liveSummary?.stoppedByLimit) {
            setStatus("Notebook source limit reached.", "error");
          } else if (item.status === "failed") {
            setStatus(item.error || "Import failed.", "error");
          }
        }
      });

      success = summary.success;
      failed = summary.failed;

      if (summary.success) {
        pasteEl.value = "";
        setStatus(`Imported ${summary.success} source${summary.success === 1 ? "" : "s"}.`);
        close();

        if (typeof onComplete === "function") {
          await onComplete(success);
        }
      } else if (summary.stoppedByLimit) {
        setStatus("Notebook source limit reached.", "error");
      } else {
        setStatus("No sources were imported.", "error");
      }
    } catch (error) {
      setStatus(error.message || "Bulk import failed.", "error");
    } finally {
      setRunning(false);
    }
  }

  function open(notebook, options = {}) {
    activeNotebook = notebook;
    authOptions = options.authOptions || {};
    onComplete = options.onComplete || null;

    if (pasteEl) {
      pasteEl.value = "";
    }

    setStatus("");
    modal.hidden = false;
    pasteEl?.focus();
  }

  function close() {
    activeNotebook = null;
    onComplete = null;
    setRunning(false);
    setStatus("");

    if (modal) {
      modal.hidden = true;
    }
  }

  function init() {
    modal = document.querySelector("#srcBulkModal");
    pasteEl = document.querySelector("#srcBulkPaste");
    statusEl = document.querySelector("#srcBulkStatus");
    importEl = document.querySelector("#srcBulkImport");

    document.querySelector("#srcBulkCancel")?.addEventListener("click", close);
    document.querySelector("#srcBulkBackdrop")?.addEventListener("click", close);
    document.querySelector("#srcBulkAddTabs")?.addEventListener("click", () => {
      void addFromOpenTabs();
    });
    importEl?.addEventListener("click", () => {
      void runImport();
    });
  }

  return { init, open, close };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsSourcesBulk = NotebookToolsSourcesBulk;
}
