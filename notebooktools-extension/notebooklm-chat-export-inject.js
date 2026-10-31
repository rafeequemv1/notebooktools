(function () {
  "use strict";

  const BAR_ID = "notebooktools-nlm-export-bar";
  const WRAP_ID = "notebooktools-nlm-export-wrap";
  let renderTimer = 0;
  let lastUrl = location.href;
  let exportBusy = false;

  function isNotebookPage() {
    return NotebookToolsNotebookLmChatExtract.isNotebookLmNotebookPage();
  }

  function findChatInputAnchor() {
    const input = document.querySelector(
      "textarea[placeholder*='Ask'], textarea[aria-label='Query box'], textarea[placeholder*='Start typing'], textarea[aria-label*='Query']"
    );

    if (!input) {
      return null;
    }

    return (
      input.closest(".query-box") ||
      input.closest("form") ||
      input.parentElement?.parentElement ||
      input.parentElement
    );
  }

  function showToast(message, isError = false) {
    document.querySelector(".notebooktools-nlm-export-toast")?.remove();

    const toast = document.createElement("div");
    toast.className = `notebooktools-nlm-export-toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    document.body.append(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2800);
  }

  function closeMenu() {
    document.getElementById(WRAP_ID)?.classList.remove("is-open");
  }

  async function runExport(formatId, button) {
    if (exportBusy) {
      return;
    }

    exportBusy = true;
    closeMenu();

    const exportButton = document.querySelector(".notebooktools-nlm-export-btn");

    if (exportButton) {
      exportButton.disabled = true;
      exportButton.textContent = "Exporting...";
    }

    document.querySelectorAll(".notebooktools-nlm-export-option").forEach((option) => {
      option.disabled = true;
    });

    try {
      const payload = NotebookToolsNotebookLmChatExtract.extractNotebookLmChat();
      const format = NotebookToolsChatExport.listFormats().find((entry) => entry.id === formatId);
      const result = await NotebookToolsChatExport.exportConversation(payload, formatId);

      if (result?.openedPrintDialog) {
        showToast("PDF view opened. Choose Save as PDF.");
        return;
      }

      showToast(`Exported ${result?.filename || format?.label || "file"}.`);
    } catch (error) {
      showToast(error.message || "Export failed.", true);
    } finally {
      exportBusy = false;

      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = "";
        const mark = document.createElement("span");
        mark.className = "notebooktools-nlm-export-mark";
        const img = document.createElement("img");
        img.src = chrome.runtime.getURL("icons/icon16.png");
        img.alt = "";
        img.width = 14;
        img.height = 14;
        mark.append(img);
        exportButton.append(mark, document.createTextNode("Export chat"));
      }

      document.querySelectorAll(".notebooktools-nlm-export-option").forEach((option) => {
        option.disabled = false;
      });
    }
  }

  function createExportBar() {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "notebooktools-nlm-export-bar";

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.className = "notebooktools-nlm-export-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "notebooktools-nlm-export-btn";
    button.title = "Export this NotebookLM chat";

    const mark = document.createElement("span");
    mark.className = "notebooktools-nlm-export-mark";
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("icons/icon16.png");
    img.alt = "";
    img.width = 14;
    img.height = 14;
    mark.append(img);
    button.append(mark, document.createTextNode("Export chat"));

    const menu = document.createElement("div");
    menu.className = "notebooktools-nlm-export-menu";

    for (const format of NotebookToolsChatExport.listFormats()) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "notebooktools-nlm-export-option";
      option.dataset.exportFormat = format.id;
      option.textContent = format.label;
      option.addEventListener("click", () => {
        void runExport(format.id, option);
      });
      menu.append(option);
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      wrap.classList.toggle("is-open");
    });

    wrap.append(button, menu);
    bar.append(wrap);
    return bar;
  }

  function removeExportBar() {
    document.getElementById(BAR_ID)?.remove();
    closeMenu();
  }

  function mountExportBar() {
    if (!isNotebookPage()) {
      removeExportBar();
      return;
    }

    if (document.getElementById(BAR_ID)) {
      return;
    }

    const anchor = findChatInputAnchor();

    if (!anchor?.parentElement) {
      return;
    }

    anchor.parentElement.insertBefore(createExportBar(), anchor);
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(mountExportBar, 200);
  }

  function onNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeExportBar();
    }

    scheduleRender();
  }

  document.addEventListener(
    "mousedown",
    (event) => {
      const wrap = document.getElementById(WRAP_ID);

      if (!wrap?.classList.contains("is-open")) {
        return;
      }

      if (event.target instanceof Node && wrap.contains(event.target)) {
        return;
      }

      closeMenu();
    },
    true
  );

  new MutationObserver(scheduleRender).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("popstate", onNavigation);
  window.setInterval(onNavigation, 500);
  scheduleRender();
})();
