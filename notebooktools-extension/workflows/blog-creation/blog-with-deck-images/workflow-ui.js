(function () {
  "use strict";

  const BAR_ID = "notebooktools-blog-workflow-bar";
  const WRAP_ID = "notebooktools-blog-workflow-wrap";
  const MENU_ID = "notebooktools-blog-workflow-menu";
  let renderTimer = 0;
  let lastUrl = location.href;
  let busy = false;
  let slideDecks = [];
  let menuListenersBound = false;
  let resetProgressTimer = 0;
  let pendingArticle = null;
  let lastCompletedArticle = null;
  let isCompleteState = false;
  let progressSteps = [];

  const DOWNLOAD_FORMATS = NotebookToolsBlogDocExport.EXPORT_FORMATS;

  function isNotebookPage() {
    return NotebookToolsNotebookLmChatExtract.isNotebookLmNotebookPage();
  }

  function getNotebookId() {
    return NotebookToolsBlogWorkflow.getNotebookIdFromUrl();
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
    document.querySelector(".notebooktools-blog-workflow-toast")?.remove();

    const toast = document.createElement("div");
    toast.className = `notebooktools-blog-workflow-toast${isError ? " is-error" : ""}`;
    toast.textContent = message;
    document.body.append(toast);

    window.setTimeout(() => toast.remove(), 3200);
  }

  function getWrap() {
    return document.getElementById(WRAP_ID);
  }

  function getMenu() {
    return document.getElementById(MENU_ID);
  }

  function getFormPanel() {
    return getMenu()?.querySelector(".notebooktools-blog-workflow-form");
  }

  function getProgressPanel() {
    return getMenu()?.querySelector(".notebooktools-blog-workflow-progress");
  }

  function isMenuOpen() {
    return getMenu()?.classList.contains("is-open") === true;
  }

  function closeMenu() {
    getWrap()?.classList.remove("is-open");
    getMenu()?.classList.remove("is-open");
  }

  function openMenu() {
    getWrap()?.classList.add("is-open");
    getMenu()?.classList.add("is-open");
    positionMenu();
    requestAnimationFrame(positionMenu);
  }

  function positionMenu() {
    const wrap = getWrap();
    const menu = getMenu();
    const button = wrap?.querySelector(".notebooktools-blog-workflow-btn");

    if (!wrap || !menu || !button || !menu.classList.contains("is-open")) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 300;
    const menuHeight = menu.offsetHeight || 260;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - menuWidth),
      window.innerWidth - menuWidth - margin
    );
    const aboveTop = rect.top - menuHeight - 6;
    const belowTop = rect.bottom + 6;
    const top =
      aboveTop >= margin || belowTop + menuHeight > window.innerHeight - margin
        ? Math.max(margin, aboveTop)
        : belowTop;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function bindMenuListeners() {
    if (menuListenersBound) {
      return;
    }

    menuListenersBound = true;
    window.addEventListener("scroll", positionMenu, true);
    window.addEventListener("resize", positionMenu);
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    const button = document.querySelector(".notebooktools-blog-workflow-btn");
    const options = document.querySelectorAll(".notebooktools-blog-workflow-option");
    const select = document.querySelector("#notebooktoolsBlogDeckSelect");

    if (button) {
      button.disabled = nextBusy;
      button.textContent = nextBusy ? "Building blog..." : "Blog workflow";
    }

    options.forEach((option) => {
      option.disabled = nextBusy;
    });

    if (select) {
      select.disabled = nextBusy;
    }
  }

  function getHistoryPanel() {
    return getMenu()?.querySelector(".notebooktools-blog-workflow-history");
  }

  function buildFormatButtons(className, onFormatClick) {
    const row = document.createElement("div");
    row.className = className;

    for (const format of DOWNLOAD_FORMATS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `${className}-btn`;
      button.dataset.format = format;
      button.textContent = format.toUpperCase();
      button.addEventListener("click", () => {
        onFormatClick(format, button);
      });
      row.append(button);
    }

    return row;
  }

  function ensureProgressControls() {
    const progress = getProgressPanel();

    if (!progress) {
      return;
    }

    if (!progress.querySelector(".notebooktools-blog-workflow-downloads")) {
      const downloads = document.createElement("div");
      downloads.className = "notebooktools-blog-workflow-downloads";
      downloads.hidden = true;

      const label = document.createElement("p");
      label.className = "notebooktools-blog-workflow-downloads-label";
      label.textContent = "Download as";

      const buttons = buildFormatButtons(
        "notebooktools-blog-workflow-download-buttons",
        (format, button) => {
          void triggerFormatDownload(format, button);
        }
      );

      downloads.append(label, buttons);
      progress.append(downloads);
    }

    if (!progress.querySelector(".notebooktools-blog-workflow-complete-note")) {
      const completeNote = document.createElement("p");
      completeNote.className = "notebooktools-blog-workflow-complete-note";
      completeNote.hidden = true;
      progress.append(completeNote);
    }

    if (!progress.querySelector(".notebooktools-blog-workflow-steps")) {
      const steps = document.createElement("ol");
      steps.className = "notebooktools-blog-workflow-steps";
      steps.setAttribute("aria-live", "polite");
      progress.insertBefore(steps, progress.querySelector(".notebooktools-blog-workflow-thumbs"));
    }
  }

  function ensureHistoryPanel(menu) {
    if (!menu || menu.querySelector(".notebooktools-blog-workflow-history")) {
      return;
    }

    const history = document.createElement("div");
    history.className = "notebooktools-blog-workflow-history";
    history.innerHTML = `
      <p class="notebooktools-blog-workflow-history-title">Recent blogs</p>
      <div class="notebooktools-blog-workflow-history-list" aria-live="polite"></div>
    `;
    menu.append(history);
  }

  function formatHistoryDate(value) {
    try {
      return new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch (_error) {
      return "";
    }
  }

  async function renderBlogHistory() {
    const listEl = getHistoryPanel()?.querySelector(".notebooktools-blog-workflow-history-list");
    const notebookId = getNotebookId();

    if (!listEl || !notebookId) {
      return;
    }

    try {
      const items = await NotebookToolsBlogHistory.list(notebookId);
      const titleEl = getHistoryPanel()?.querySelector(".notebooktools-blog-workflow-history-title");

      if (titleEl) {
        titleEl.textContent = items.length
          ? `Recent blogs (${items.length})`
          : "Recent blogs";
      }

      if (!items.length) {
        listEl.innerHTML = `<p class="notebooktools-blog-workflow-history-empty">No saved blogs for this notebook yet.</p>`;
        return;
      }

      listEl.innerHTML = items
        .map((item, index) => {
          const title = String(item.title || item.filename || "Blog article").replace(/"/g, "&quot;");
          const meta = `${formatHistoryDate(item.createdAt)} · ${item.imageCount || 0} images`;
          const latestClass = index === 0 ? " is-latest" : "";
          const formats = [];
          const hasHydratedImages = item.blocks?.some(
            (block) => block.type === "image" && block.dataUrl
          );

          if (item.content || item.blocks?.length) {
            formats.push("html");
          }

          if (hasHydratedImages) {
            ["csv", "doc", "pdf"].forEach((format) => {
              if (!formats.includes(format)) {
                formats.push(format);
              }
            });
          } else if (item.blocks?.length) {
            formats.push("csv");
          }

          return `
            <div class="notebooktools-blog-workflow-history-item${latestClass}" data-history-id="${item.id}">
              <div class="notebooktools-blog-workflow-history-copy">
                <strong>${title}</strong>
                <span>${meta}</span>
              </div>
              ${
                formats.length
                  ? `<div class="notebooktools-blog-workflow-history-formats" data-history-id="${item.id}">
                ${formats
                  .map(
                    (format) =>
                      `<button type="button" class="notebooktools-blog-workflow-history-format" data-history-id="${item.id}" data-format="${format}">${format.toUpperCase()}</button>`
                  )
                  .join("")}
              </div>`
                  : `<p class="notebooktools-blog-workflow-history-empty">File unavailable</p>`
              }
            </div>
          `;
        })
        .join("");

      listEl.querySelectorAll(".notebooktools-blog-workflow-history-format").forEach((button) => {
        button.addEventListener("click", () => {
          void downloadHistoryItem(button.dataset.historyId, button.dataset.format, button);
        });
      });
    } catch (error) {
      listEl.innerHTML = `<p class="notebooktools-blog-workflow-history-empty">Could not load blog history.</p>`;
      console.warn("NotebookTools blog history:", error);
    }

    positionMenu();
  }

  async function downloadHistoryItem(historyId, format = "html", button = null) {
    const notebookId = getNotebookId();
    const items = await NotebookToolsBlogHistory.list(notebookId);
    const item = items.find((entry) => entry.id === historyId);
    const normalizedFormat = String(format || "html").toLowerCase();

    if (!item) {
      showToast("Saved blog is no longer available.", true);
      return;
    }

    if (button) {
      button.disabled = true;
    }

    try {
      if (normalizedFormat === "html" && item.content) {
        NotebookToolsBlogDocExport.downloadDoc(
          item.filename || NotebookToolsBlogDocExport.safeFilename(item.title, "html"),
          item.content
        );
        showToast(`Downloaded ${item.filename || "blog article"}`);
        return;
      }

      if (!item.blocks?.length) {
        showToast("This saved blog only has HTML available. Try the HTML button.", true);
        return;
      }

      const hasImages = item.blocks.some((block) => block.type === "image" && block.dataUrl);

      if (!hasImages && normalizedFormat !== "csv") {
        showToast("Saved images are not available. Re-run the workflow or download HTML.", true);
        return;
      }

      const built = await NotebookToolsBlogDocExport.downloadFormat(
        { title: item.title, blocks: item.blocks },
        normalizedFormat
      );
      showToast(`Downloaded ${built.filename}`);
    } catch (error) {
      showToast(error.message || "Could not download blog.", true);
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  function clearPendingArticle() {
    pendingArticle = null;

    const downloads = getProgressPanel()?.querySelector(".notebooktools-blog-workflow-downloads");
    const completeNote = getProgressPanel()?.querySelector(".notebooktools-blog-workflow-complete-note");

    if (downloads) {
      downloads.hidden = true;
      downloads.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
        button.textContent = String(button.dataset.format || "").toUpperCase();
      });
    }

    if (completeNote) {
      completeNote.hidden = true;
      completeNote.textContent = "";
    }
  }

  function setCompletedArticle(result) {
    if (!result?.blocks?.length) {
      return;
    }

    const article = {
      title: result.title || "Blog article",
      blocks: result.blocks,
      clipboardCopied: Boolean(result.clipboardCopied),
      imageCount: result.imageCount || 0,
      filename: result.filename || ""
    };

    pendingArticle = article;
    lastCompletedArticle = article;
    isCompleteState = true;
    showDownloadReady(article);
  }

  async function resolveDownloadArticle() {
    if (pendingArticle?.blocks?.length) {
      return pendingArticle;
    }

    if (lastCompletedArticle?.blocks?.length) {
      pendingArticle = lastCompletedArticle;
      return lastCompletedArticle;
    }

    const notebookId = getNotebookId();
    const items = await NotebookToolsBlogHistory.list(notebookId);

    if (items[0]?.blocks?.length) {
      const article = { title: items[0].title, blocks: items[0].blocks };
      pendingArticle = article;
      return article;
    }

    return null;
  }

  function showDownloadReady(result) {
    ensureProgressControls();
    const progress = getProgressPanel();
    const menu = getMenu();
    const downloads = progress?.querySelector(".notebooktools-blog-workflow-downloads");
    const completeNote = progress?.querySelector(".notebooktools-blog-workflow-complete-note");

    if (!result?.blocks?.length) {
      return;
    }

    menu?.classList.add("is-complete", "is-images");
    formHidden(progress);

    if (downloads) {
      downloads.hidden = false;
      downloads.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
        button.textContent = String(button.dataset.format || "").toUpperCase();
      });
    } else {
      showToast("Blog ready. Reopen Blog workflow to download.", true);
    }

    if (completeNote) {
      completeNote.hidden = false;
      completeNote.textContent = result.clipboardCopied
        ? "Blog copied to clipboard. Download as HTML, CSV, DOC, or PDF."
        : "Download as HTML, CSV, DOC, or PDF.";
    }

    positionMenu();
    requestAnimationFrame(positionMenu);
    void renderBlogHistory();
  }

  function formHidden(progress) {
    const form = getFormPanel();

    if (form) {
      form.hidden = true;
    }

    if (progress) {
      progress.hidden = false;
    }
  }

  function restoreCompleteUi() {
    if (!isCompleteState || !lastCompletedArticle) {
      return;
    }

    ensureProgressControls();
    const menu = getMenu();
    const progress = getProgressPanel();

    menu?.classList.add("is-complete", "is-images");
    menu?.classList.remove("is-busy");
    formHidden(progress);

    const fillEl = progress?.querySelector(".notebooktools-blog-workflow-progress-fill");
    const statusEl = progress?.querySelector(".notebooktools-blog-workflow-status");
    const countEl = progress?.querySelector(".notebooktools-blog-workflow-progress-count");

    if (fillEl) {
      fillEl.style.width = "100%";
    }

    if (statusEl) {
      statusEl.textContent = `Ready to download — ${lastCompletedArticle.imageCount || 0} images embedded`;
    }

    if (countEl) {
      countEl.textContent = `${lastCompletedArticle.imageCount || 0} images embedded in blog file`;
    }

    pendingArticle = lastCompletedArticle;
    showDownloadReady(lastCompletedArticle);
    renderProgressSteps();
  }

  async function triggerFormatDownload(format, button = null) {
    const article = await resolveDownloadArticle();

    if (!article) {
      showToast("No blog document is ready yet. Run the workflow or pick a recent blog below.", true);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "...";
    }

    try {
      const built = await NotebookToolsBlogDocExport.downloadFormat(article, format);
      showToast(`Downloaded ${built.filename}`);
    } catch (error) {
      showToast(error.message || "Could not export blog.", true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = String(format || "").toUpperCase();
      }
    }
  }

  function resetProgressUi({ hard = false } = {}) {
    const menu = getMenu();
    const form = getFormPanel();
    const progress = getProgressPanel();

    window.clearTimeout(resetProgressTimer);

    if (!hard && isCompleteState && lastCompletedArticle) {
      restoreCompleteUi();
      return;
    }

    isCompleteState = false;
    lastCompletedArticle = null;
    progressSteps = [];
    clearPendingArticle();
    menu?.classList.remove("is-busy", "is-complete", "is-images", "is-error");

    if (form) {
      form.hidden = false;
    }

    if (progress) {
      progress.hidden = true;
      progress.querySelector(".notebooktools-blog-workflow-status").textContent = "";
      progress.querySelector(".notebooktools-blog-workflow-progress-fill").style.width = "0%";
      progress.querySelector(".notebooktools-blog-workflow-progress-count").textContent = "";
      progress.querySelector(".notebooktools-blog-workflow-thumbs").replaceChildren();
      progress.querySelector(".notebooktools-blog-workflow-progress-note").hidden = false;
      const stepsEl = progress.querySelector(".notebooktools-blog-workflow-steps");
      if (stepsEl) {
        stepsEl.replaceChildren();
      }
    }

    positionMenu();
  }

  function appendProgressStep(event) {
    if (!event?.message) {
      return;
    }

    const last = progressSteps[progressSteps.length - 1];

    if (last && last.phase === event.phase && last.message === event.message) {
      return;
    }

    if (last) {
      last.status = event.phase === "error" ? "error" : "done";
    }

    progressSteps.push({
      phase: event.phase || "working",
      message: event.message,
      status: event.phase === "error" ? "error" : event.phase === "complete" ? "done" : "active"
    });

    if (event.phase === "complete" || event.phase === "error") {
      progressSteps = progressSteps.map((step, index) =>
        index === progressSteps.length - 1
          ? { ...step, status: event.phase === "error" ? "error" : "done" }
          : step.status === "active"
            ? { ...step, status: "done" }
            : step
      );
    }

    renderProgressSteps();
  }

  function renderProgressSteps() {
    const stepsEl = getProgressPanel()?.querySelector(".notebooktools-blog-workflow-steps");

    if (!stepsEl) {
      return;
    }

    stepsEl.innerHTML = progressSteps
      .map((step) => {
        const statusClass =
          step.status === "error" ? " is-error" : step.status === "done" ? " is-done" : " is-active";
        return `<li class="notebooktools-blog-workflow-step${statusClass}"><span>${step.message}</span></li>`;
      })
      .join("");

    stepsEl.scrollTop = stepsEl.scrollHeight;
    requestAnimationFrame(positionMenu);
  }

  function showProgressFailure(error) {
    const progress = getProgressPanel();
    const menu = getMenu();
    const message = error?.message || "Workflow failed.";

    menu?.classList.add("is-error");
    menu?.classList.remove("is-busy");

    appendProgressStep({ phase: "error", message: `Failed: ${message}` });

    if (progress) {
      progress.hidden = false;
      const statusEl = progress.querySelector(".notebooktools-blog-workflow-status");
      const fillEl = progress.querySelector(".notebooktools-blog-workflow-progress-fill");
      const noteEl = progress.querySelector(".notebooktools-blog-workflow-progress-note");

      if (statusEl) {
        statusEl.textContent = `Failed: ${message}`;
      }

      if (fillEl) {
        fillEl.style.width = "100%";
      }

      if (noteEl) {
        noteEl.hidden = false;
        noteEl.textContent = "Fix the issue above, then try again or use a recent blog from history.";
      }
    }

    positionMenu();
    requestAnimationFrame(positionMenu);
  }

  function showProgressUi() {
    ensureProgressControls();
    const menu = getMenu();
    const form = getFormPanel();
    const progress = getProgressPanel();

    isCompleteState = false;
    lastCompletedArticle = null;
    pendingArticle = null;
    progressSteps = [];

    menu?.classList.add("is-busy");
    menu?.classList.remove("is-complete", "is-images", "is-error");

    if (form) {
      form.hidden = true;
    }

    if (progress) {
      progress.hidden = false;
      progress.querySelector(".notebooktools-blog-workflow-thumbs").replaceChildren();
      progress.querySelector(".notebooktools-blog-workflow-progress-fill").style.width = "0%";
      const stepsEl = progress.querySelector(".notebooktools-blog-workflow-steps");
      if (stepsEl) {
        stepsEl.replaceChildren();
      }
    }

    positionMenu();
    requestAnimationFrame(positionMenu);
  }

  function updateProgressUi(event) {
    const progress = getProgressPanel();
    const menu = getMenu();

    if (!progress || !event) {
      return;
    }

    const statusEl = progress.querySelector(".notebooktools-blog-workflow-status");
    const fillEl = progress.querySelector(".notebooktools-blog-workflow-progress-fill");
    const countEl = progress.querySelector(".notebooktools-blog-workflow-progress-count");
    const thumbsEl = progress.querySelector(".notebooktools-blog-workflow-thumbs");
    const noteEl = progress.querySelector(".notebooktools-blog-workflow-progress-note");
    const total = Number(event.total) || 0;
    const current = Number(event.current) || 0;
    let percent = 0;

    if (event.phase === "importing") {
      percent = event.message?.includes("Compressing") ? 10 : 14;
      menu?.classList.remove("is-images");
    } else if (event.phase === "writing") {
      percent = 28;
      menu?.classList.remove("is-images");
    } else if (event.phase === "blog-complete") {
      percent = 42;
      menu?.classList.add("is-images");
    } else if (event.phase === "preparing") {
      percent = 44;
      menu?.classList.add("is-images");
    } else if (event.phase === "downloading") {
      percent = 48;
      menu?.classList.add("is-images");
    } else if (event.phase === "parsing") {
      percent = 52;
      menu?.classList.add("is-images");
    } else if (event.phase === "rendering" && total > 0) {
      percent = 54 + Math.round((current / total) * 34);
      menu?.classList.add("is-images");
    } else if (event.phase === "rendering") {
      percent = 58;
      menu?.classList.add("is-images");
    } else if (event.phase === "assembling") {
      percent = 92;
      menu?.classList.add("is-images");
    } else if (event.phase === "exporting") {
      percent = 94;
      menu?.classList.add("is-images");
    } else if (event.phase === "ready") {
      percent = 96;
      menu?.classList.add("is-images");
    } else if (event.phase === "complete") {
      percent = 100;
      menu?.classList.add("is-complete", "is-images");
      menu?.classList.remove("is-error");
    } else if (event.phase === "error") {
      percent = 100;
      menu?.classList.add("is-error");
      menu?.classList.remove("is-busy");
    }

    appendProgressStep(event);

    if (statusEl) {
      statusEl.textContent = event.message || "Working...";
    }

    if (fillEl) {
      fillEl.style.width = `${percent}%`;
    }

    if (countEl) {
      if (event.phase === "rendering" || event.phase === "assembling" || event.phase === "ready" || event.phase === "exporting") {
        countEl.textContent = total > 0 ? `Slide images: ${Math.min(current, total)} / ${total}` : event.message || "";
      } else if (event.phase === "complete") {
        countEl.textContent =
          total > 0 ? `${event.imageCount || current} images embedded in blog file` : "Blog file ready";
      } else if (event.phase === "error") {
        countEl.textContent = "Workflow stopped";
      } else if (event.phase === "writing") {
        countEl.textContent = event.detail || "Writing blog article...";
      } else if (event.phase === "importing") {
        countEl.textContent = event.detail || "Importing PDF source...";
      } else if (event.phase === "blog-complete") {
        countEl.textContent = "Starting slide image extraction...";
      } else if (event.phase === "downloading") {
        countEl.textContent = "Fetching deck PDF...";
      } else if (event.phase === "parsing") {
        countEl.textContent = total > 0 ? `PDF has ${total} slides` : "Reading PDF structure...";
      } else if (event.phase === "preparing") {
        countEl.textContent = "Loading chat and deck metadata...";
      } else {
        countEl.textContent = event.detail || "";
      }
    }

    if (noteEl) {
      noteEl.hidden = event.phase === "complete";

      if (event.phase === "error") {
        noteEl.hidden = false;
        noteEl.textContent = "See the step list below for where it failed.";
      } else {
        noteEl.textContent =
          event.phase === "rendering" || event.phase === "assembling" || event.phase === "ready"
            ? "Slide previews appear below as each image is rendered from the PDF."
            : "Each step is logged below as the workflow runs.";
      }
    }

    if (event.image?.dataUrl && thumbsEl) {
      const existing = thumbsEl.querySelector(`[data-slide-index="${event.image.index}"]`);

      if (!existing) {
        const card = document.createElement("div");
        card.className = "notebooktools-blog-workflow-thumb is-new";
        card.dataset.slideIndex = String(event.image.index);

        const img = document.createElement("img");
        img.src = event.image.dataUrl;
        img.alt = event.image.alt || `Slide ${event.image.index}`;
        img.loading = "lazy";

        const label = document.createElement("span");
        label.className = "notebooktools-blog-workflow-thumb-label";
        label.textContent = `Slide ${event.image.index}`;

        card.append(img, label);
        thumbsEl.append(card);
        thumbsEl.scrollTop = thumbsEl.scrollHeight;
        window.setTimeout(() => card.classList.remove("is-new"), 240);
        requestAnimationFrame(positionMenu);
      }
    }

    if (event.phase === "complete" && event.blocks?.length) {
      setCompletedArticle(event);
    }
  }

  async function refreshSlideDeckOptions(selectEl) {
    const notebookId = getNotebookId();

    if (!notebookId || !selectEl) {
      return;
    }

    try {
      slideDecks = await NotebookToolsBlogWorkflow.listReadySlideDecks(notebookId);
      selectEl.innerHTML = slideDecks.length
        ? slideDecks
            .map(
              (deck) =>
                `<option value="${deck.id}">${deck.title.replace(/"/g, "&quot;")}</option>`
            )
            .join("")
        : `<option value="">No ready slide decks</option>`;
    } catch (error) {
      selectEl.innerHTML = `<option value="">Could not load slide decks</option>`;
      console.warn("NotebookTools blog workflow:", error);
    }
  }

  async function runCopyPrompt() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      const notebookId = getNotebookId();
      const select = document.querySelector("#notebooktoolsBlogDeckSelect");
      const artifactId = select?.value || "";
      const slideDeck = await NotebookToolsBlogWorkflow.resolveSlideDeck(notebookId, artifactId);
      await NotebookToolsBlogWorkflow.copyPrompt(slideDeck);
      showToast("Blog prompt copied. Paste it into NotebookLM chat.");
    } catch (error) {
      showToast(error.message || "Could not copy prompt.", true);
    } finally {
      setBusy(false);
    }
  }

  async function runFullAutoBlog() {
    if (busy) {
      return;
    }

    setBusy(true);
    resetProgressUi({ hard: true });
    showProgressUi();
    openMenu();

    try {
      const notebookId = getNotebookId();
      const select = document.querySelector("#notebooktoolsBlogDeckSelect");
      const artifactId = select?.value || "";
      const result = await NotebookToolsBlogWorkflow.runFullAutoBlog({
        notebookId,
        artifactId,
        onProgress: updateProgressUi
      });
      setCompletedArticle({ ...result, clipboardCopied: true });
    } catch (error) {
      showProgressFailure(error);
      showToast(error.message || "Auto blog workflow failed.", true);
    } finally {
      setBusy(false);
    }
  }

  async function runDownloadDoc() {
    if (busy) {
      return;
    }

    setBusy(true);
    resetProgressUi({ hard: true });
    showProgressUi();
    openMenu();

    try {
      const notebookId = getNotebookId();
      const select = document.querySelector("#notebooktoolsBlogDeckSelect");
      const artifactId = select?.value || "";
      const result = await NotebookToolsBlogWorkflow.createBlogDoc({
        notebookId,
        artifactId,
        onProgress: updateProgressUi
      });
      setCompletedArticle(result);
    } catch (error) {
      showProgressFailure(error);
      showToast(error.message || "Blog export failed.", true);
    } finally {
      setBusy(false);
    }
  }

  function createMenuPortal() {
    let menu = getMenu();

    if (menu) {
      ensureHistoryPanel(menu);
      ensureProgressControls();
      return menu;
    }

    menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.className = "notebooktools-blog-workflow-menu";

    const form = document.createElement("div");
    form.className = "notebooktools-blog-workflow-form";

    const intro = document.createElement("p");
    intro.className = "notebooktools-blog-workflow-intro";
    intro.textContent =
      "Import deck PDF, auto-write the blog, then download as HTML, CSV, DOC, or PDF.";

    const label = document.createElement("label");
    label.className = "notebooktools-blog-workflow-label";
    label.textContent = "Slide deck";
    label.setAttribute("for", "notebooktoolsBlogDeckSelect");

    const select = document.createElement("select");
    select.id = "notebooktoolsBlogDeckSelect";
    select.className = "notebooktools-blog-workflow-select";
    select.innerHTML = `<option value="">Loading slide decks...</option>`;

    const autoButton = document.createElement("button");
    autoButton.type = "button";
    autoButton.className = "notebooktools-blog-workflow-option is-primary";
    autoButton.textContent = "Auto blog: import PDF → write → download";
    autoButton.addEventListener("click", () => {
      void runFullAutoBlog();
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "notebooktools-blog-workflow-option";
    copyButton.textContent = "Manual: copy blog prompt";
    copyButton.addEventListener("click", () => {
      void runCopyPrompt();
    });

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "notebooktools-blog-workflow-option";
    downloadButton.textContent = "Manual: build blog file from current chat";
    downloadButton.addEventListener("click", () => {
      void runDownloadDoc();
    });

    form.append(intro, label, select, autoButton, copyButton, downloadButton);

    const progress = document.createElement("div");
    progress.className = "notebooktools-blog-workflow-progress";
    progress.hidden = true;
    progress.innerHTML = `
      <p class="notebooktools-blog-workflow-status">Preparing...</p>
      <div class="notebooktools-blog-workflow-progress-bar" aria-hidden="true">
        <span class="notebooktools-blog-workflow-progress-fill"></span>
      </div>
      <p class="notebooktools-blog-workflow-progress-count"></p>
      <ol class="notebooktools-blog-workflow-steps" aria-live="polite"></ol>
      <div class="notebooktools-blog-workflow-thumbs" aria-live="polite"></div>
      <p class="notebooktools-blog-workflow-progress-note">PDF parsing runs in a background worker.</p>
      <div class="notebooktools-blog-workflow-downloads" hidden>
        <p class="notebooktools-blog-workflow-downloads-label">Download as</p>
        <div class="notebooktools-blog-workflow-download-buttons">
          <button type="button" class="notebooktools-blog-workflow-download-buttons-btn" data-format="html">HTML</button>
          <button type="button" class="notebooktools-blog-workflow-download-buttons-btn" data-format="csv">CSV</button>
          <button type="button" class="notebooktools-blog-workflow-download-buttons-btn" data-format="doc">DOC</button>
          <button type="button" class="notebooktools-blog-workflow-download-buttons-btn" data-format="pdf">PDF</button>
        </div>
      </div>
      <p class="notebooktools-blog-workflow-complete-note" hidden></p>
    `;

    progress.querySelectorAll(".notebooktools-blog-workflow-download-buttons-btn").forEach((button) => {
      button.addEventListener("click", () => {
        void triggerFormatDownload(button.dataset.format, button);
      });
    });

    menu.append(form, progress);
    ensureHistoryPanel(menu);
    (document.body || document.documentElement).append(menu);
    bindMenuListeners();
    void renderBlogHistory();
    return menu;
  }

  function createWorkflowBar() {
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "notebooktools-blog-workflow-bar";

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.className = "notebooktools-blog-workflow-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "notebooktools-blog-workflow-btn";
    button.title = "Blog from chat + slide deck images";
    button.textContent = "Blog workflow";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const menu = createMenuPortal();
      const select = menu.querySelector("#notebooktoolsBlogDeckSelect");

      if (busy) {
        openMenu();
        return;
      }

      if (isMenuOpen()) {
        closeMenu();
        return;
      }

      if (isCompleteState && lastCompletedArticle) {
        openMenu();
        restoreCompleteUi();
        void refreshSlideDeckOptions(select);
        void renderBlogHistory();
        return;
      }

      resetProgressUi({ hard: false });
      openMenu();
      void refreshSlideDeckOptions(select);
      void renderBlogHistory();
    });

    wrap.append(button);
    bar.append(wrap);
    createMenuPortal();
    return bar;
  }

  function removeWorkflowBar() {
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(MENU_ID)?.remove();
    closeMenu();
  }

  function mountWorkflowBar() {
    if (!isNotebookPage()) {
      removeWorkflowBar();
      return;
    }

    if (document.getElementById(BAR_ID)) {
      return;
    }

    const anchor = findChatInputAnchor();

    if (!anchor?.parentElement) {
      return;
    }

    const exportBar = document.getElementById("notebooktools-nlm-export-bar");
    const bar = createWorkflowBar();

    if (exportBar?.nextSibling) {
      anchor.parentElement.insertBefore(bar, exportBar.nextSibling);
    } else if (exportBar) {
      exportBar.after(bar);
    } else {
      anchor.parentElement.insertBefore(bar, anchor);
    }
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(mountWorkflowBar, 200);
  }

  function onNavigation() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeWorkflowBar();
    }

    scheduleRender();
  }

  document.addEventListener(
    "mousedown",
    (event) => {
      if (!isMenuOpen()) {
        return;
      }

      if (busy) {
        return;
      }

      const wrap = getWrap();
      const menu = getMenu();
      const target = event.target;

      if (
        (wrap && target instanceof Node && wrap.contains(target)) ||
        (menu && target instanceof Node && menu.contains(target))
      ) {
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
