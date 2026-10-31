(function () {
  "use strict";

  const BAR_ID = "notebooktools-snapshot-workflow-bar";
  const WRAP_ID = "notebooktools-snapshot-workflow-wrap";
  const MENU_ID = "notebooktools-snapshot-workflow-menu";
  let renderTimer = 0;
  let lastUrl = location.href;
  let busy = false;
  let menuListenersBound = false;
  let pendingArticle = null;
  let lastCompletedArticle = null;
  let isCompleteState = false;
  let session = null;
  let pendingRunStarted = false;
  let chatWatcherTimer = 0;
  let chatWatcherObserver = null;
  let progressSteps = [];

  const DOWNLOAD_FORMATS = ["doc", "html", "pdf"];
  const PROGRESS_LABELS = [
    "Upload snapshot images",
    "Send writing prompt",
    "Wait for NotebookLM reply",
    "Embed snapshot images",
    "DOC ready to download"
  ];

  function isNotebookPage() {
    return NotebookToolsNotebookLmChatExtract.isNotebookLmNotebookPage();
  }

  function getNotebookId() {
    return NotebookToolsSnapshotWorkflow.getNotebookIdFromUrl();
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
    document.querySelector(".notebooktools-snapshot-workflow-toast")?.remove();

    const toast = document.createElement("div");
    toast.className = `notebooktools-snapshot-workflow-toast${isError ? " is-error" : ""}`;
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
    const button = wrap?.querySelector(".notebooktools-snapshot-workflow-btn");

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

  function setBusy(nextBusy, label = "") {
    busy = nextBusy;
    const button = document.querySelector(".notebooktools-snapshot-workflow-btn");

    if (button) {
      button.disabled = nextBusy;
      button.classList.toggle("is-working", nextBusy);

      if (nextBusy) {
        button.textContent = "Writing...";
      } else if (isCompleteState) {
        button.textContent = "DOC ready";
        button.classList.add("is-doc-ready");
      } else if (session?.awaitingDoc) {
        button.textContent = "Waiting...";
        button.classList.add("is-watching");
      } else {
        button.textContent = label || "Snapshots";
        button.classList.remove("is-doc-ready", "is-watching");
      }
    }

    getMenu()?.classList.toggle("is-busy", nextBusy);

    getMenu()?.querySelectorAll("button").forEach((option) => {
      if (!option.classList.contains("notebooktools-snapshot-workflow-btn")) {
        option.disabled = nextBusy;
      }
    });
  }

  function resetProgressUi() {
    progressSteps = [];
    isCompleteState = false;
    renderProgressSteps();
    getMenu()?.classList.remove("is-complete", "is-doc-ready", "is-error");

    const banner = getMenu()?.querySelector(".notebooktools-snapshot-workflow-ready-banner");
    const completeNote = getMenu()?.querySelector(".notebooktools-snapshot-workflow-complete-note");

    if (banner) {
      banner.hidden = true;
    }

    if (completeNote) {
      completeNote.hidden = true;
      completeNote.textContent = "";
    }
  }

  function pushProgressStep(label, status = "active") {
    const last = progressSteps[progressSteps.length - 1];

    if (last && last.status === "active") {
      progressSteps[progressSteps.length - 1] = { ...last, status: "done" };
    }

    progressSteps.push({ label, status });
    renderProgressSteps();
  }

  function completeProgressStep(label) {
    progressSteps = progressSteps.map((step) =>
      step.label === label ? { ...step, status: "done" } : step
    );
    renderProgressSteps();
  }

  function renderProgressSteps() {
    const stepsEl = getMenu()?.querySelector(".notebooktools-snapshot-workflow-steps");

    if (!stepsEl) {
      return;
    }

    if (!progressSteps.length) {
      stepsEl.hidden = true;
      stepsEl.innerHTML = "";
      return;
    }

    stepsEl.hidden = false;
    stepsEl.innerHTML = progressSteps
      .map((step) => {
        const statusClass =
          step.status === "done" ? "is-done" : step.status === "error" ? "is-error" : "is-active";
        return `<li class="${statusClass}">${step.label}</li>`;
      })
      .join("");
  }

  function mapProgressPhase(event = {}) {
    const phase = String(event.phase || "");

    if (phase === "importing") {
      pushProgressStep(PROGRESS_LABELS[0]);
      return;
    }

    if (phase === "writing") {
      if (!progressSteps.some((step) => step.label === PROGRESS_LABELS[1])) {
        pushProgressStep(PROGRESS_LABELS[1]);
      }

      if (!progressSteps.some((step) => step.label === PROGRESS_LABELS[2])) {
        pushProgressStep(PROGRESS_LABELS[2]);
      }

      return;
    }

    if (phase === "assembling" || phase === "exporting") {
      completeProgressStep(PROGRESS_LABELS[2]);
      if (!progressSteps.some((step) => step.label === PROGRESS_LABELS[3])) {
        pushProgressStep(PROGRESS_LABELS[3]);
      }
      return;
    }

    if (phase === "complete" && event.blocks?.length) {
      completeProgressStep(PROGRESS_LABELS[3]);
      pushProgressStep(PROGRESS_LABELS[4], "done");
    }
  }

  function handleWorkflowProgress(event = {}) {
    setProgress(event.message || "Working...", event.detail || "");
    mapProgressPhase(event);

    if (event.phase === "complete" && event.blocks?.length) {
      showDownloadReady(event, { docDownloaded: Boolean(event.docDownloaded) });
    }
  }

  function showDownloadReady(result, { docDownloaded = false } = {}) {
    if (!result?.blocks?.length) {
      return;
    }

    const article = {
      title: result.title || "Snapshot document",
      blocks: result.blocks,
      filename: result.filename || "",
      imageCount: result.imageCount || result.snapshotCount || 0
    };

    pendingArticle = article;
    lastCompletedArticle = article;
    isCompleteState = true;

    showProgressPanel(true);
    openMenu();

    const menu = getMenu();
    const form = menu?.querySelector(".notebooktools-snapshot-workflow-form");
    const downloads = menu?.querySelector(".notebooktools-snapshot-workflow-downloads");
    const banner = menu?.querySelector(".notebooktools-snapshot-workflow-ready-banner");
    const completeNote = menu?.querySelector(".notebooktools-snapshot-workflow-complete-note");
    const docButton = menu?.querySelector('.notebooktools-snapshot-workflow-download-btn[data-format="doc"]');

    menu?.classList.add("is-complete", "is-doc-ready");
    menu?.classList.remove("is-error");

    if (form) {
      form.hidden = true;
    }

    if (downloads) {
      downloads.hidden = false;
    }

    if (banner) {
      banner.hidden = false;
      banner.textContent = docDownloaded
        ? `DOC downloaded — ${article.imageCount} snapshot image${article.imageCount === 1 ? "" : "s"} embedded inline`
        : `DOC ready — ${article.imageCount} snapshot image${article.imageCount === 1 ? "" : "s"} embedded inline`;
    }

    if (completeNote) {
      completeNote.hidden = false;
      completeNote.textContent = docDownloaded
        ? "Your document was saved. Download again below if needed."
        : "Click DOC below to download the article with inline snapshot images.";
    }

    if (docButton) {
      docButton.classList.add("is-pulse");
    }

    setBusy(false);
    setProgress("DOC ready.", docDownloaded ? "Downloaded to your computer." : "Click DOC to download.");
    positionMenu();
    showToast(docDownloaded ? "DOC downloaded with inline snapshot images." : "DOC ready — click DOC to download.");
    stopChatWatcher();
  }

  function setProgress(message, detail = "") {
    const status = getMenu()?.querySelector(".notebooktools-snapshot-workflow-status");
    const detailEl = getMenu()?.querySelector(".notebooktools-snapshot-workflow-detail");

    if (status) {
      status.textContent = message || "";
    }

    if (detailEl) {
      detailEl.textContent = detail || "";
      detailEl.hidden = !detail;
    }
  }

  function showProgressPanel(show) {
    const form = getMenu()?.querySelector(".notebooktools-snapshot-workflow-form");
    const progress = getMenu()?.querySelector(".notebooktools-snapshot-workflow-progress");

    if (form) {
      form.hidden = show;
    }

    if (progress) {
      progress.hidden = !show;
    }
  }

  function setPendingArticle(result) {
    if (!result?.blocks?.length) {
      return;
    }

    pendingArticle = {
      title: result.title || "Snapshot document",
      blocks: result.blocks,
      filename: result.filename
    };

    const downloads = getMenu()?.querySelector(".notebooktools-snapshot-workflow-downloads");

    if (downloads) {
      downloads.hidden = false;
    }
  }

  function stopChatWatcher() {
    if (chatWatcherTimer) {
      window.clearInterval(chatWatcherTimer);
      chatWatcherTimer = 0;
    }

    chatWatcherObserver?.disconnect();
    chatWatcherObserver = null;
  }

  function startChatWatcher() {
    stopChatWatcher();

    if (!session?.awaitingDoc || isCompleteState) {
      return;
    }

    const button = document.querySelector(".notebooktools-snapshot-workflow-btn");
    button?.classList.add("is-watching");

    chatWatcherObserver = new MutationObserver(() => {
      void checkForReadyResponse();
    });
    chatWatcherObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    chatWatcherTimer = window.setInterval(() => {
      void checkForReadyResponse();
    }, 2500);
  }

  async function checkForReadyResponse() {
    if (busy || isCompleteState) {
      return;
    }

    await resolveSession();

    if (!session?.awaitingDoc || !session?.snapshots?.length) {
      stopChatWatcher();
      return;
    }

    const ready = NotebookToolsSnapshotWorkflow.tryIsResponseReady({
      messageCountBefore: session.messageCountBefore,
      outputType: session.outputType,
      snapshotCount: session.snapshots.length
    });

    if (!ready) {
      return;
    }

    busy = true;
    resetProgressUi();
    showProgressPanel(true);
    openMenu();
    setBusy(true);
    setProgress("Article complete in chat.", "Building DOC with inline snapshot images...");

    try {
      const result = await NotebookToolsSnapshotWorkflow.buildDocFromReadyChat({
        session,
        outputType: session.outputType,
        onProgress: handleWorkflowProgress
      });

      showDownloadReady(result);
      await resolveSession();
    } catch (error) {
      getMenu()?.classList.add("is-error");
      setProgress("Failed to build DOC.", error.message || "Could not assemble document.");
      showToast(error.message || "Could not build DOC.", true);
    } finally {
      setBusy(false);
    }
  }

  async function resumeAwaitingDoc() {
    if (busy || isCompleteState || pendingRunStarted) {
      return;
    }

    await resolveSession();

    if (!session?.awaitingDoc || !session?.snapshots?.length) {
      if (session?.docReady && lastCompletedArticle) {
        restoreCompleteUi();
      }
      return;
    }

    if (
      NotebookToolsSnapshotWorkflow.tryIsResponseReady({
        messageCountBefore: session.messageCountBefore,
        outputType: session.outputType,
        snapshotCount: session.snapshots.length
      })
    ) {
      void checkForReadyResponse();
      return;
    }

    showProgressPanel(true);
    setProgress("Waiting for NotebookLM to finish writing...", "DOC will be built automatically when ready.");
    startChatWatcher();
  }

  function restoreCompleteUi() {
    if (!session?.docReady) {
      return;
    }

    isCompleteState = Boolean(lastCompletedArticle?.blocks?.length);
    const button = document.querySelector(".notebooktools-snapshot-workflow-btn");

    if (button && isCompleteState) {
      button.textContent = "DOC ready";
      button.classList.add("is-doc-ready");
    }

    if (lastCompletedArticle) {
      showDownloadReady(lastCompletedArticle);
    }
  }

  async function triggerFormatDownload(format, button) {
    if (!pendingArticle?.blocks?.length) {
      showToast("No document ready yet.", true);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "...";
    }

    try {
      const built = await NotebookToolsBlogDocExport.downloadFormat(pendingArticle, format);
      showToast(`Downloaded ${built.filename}`);
    } catch (error) {
      showToast(error.message || "Download failed.", true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = String(format || "").toUpperCase();
      }
    }
  }

  async function resolveSession() {
    const notebookId = getNotebookId();
    const localSnapshots = (await NotebookToolsSnapshotStore.list()).filter((item) => item?.dataUrl);
    const stored = notebookId ? await NotebookToolsSnapshotStore.getSession(notebookId) : null;

    if (stored?.snapshots?.length) {
      session = stored;
      return session;
    }

    if (notebookId && localSnapshots.length) {
      session = {
        notebookId,
        snapshots: localSnapshots,
        snapshotCount: localSnapshots.length,
        pageTitle: localSnapshots[0]?.title || "Captured screens",
        sourceIds: [],
        outputType: "blog"
      };
      return session;
    }

    session = null;
    return null;
  }

  async function runAction(outputType, { autoDownloadDoc = false } = {}) {
    if (busy) {
      return;
    }

    await resolveSession();

    if (!session?.snapshots?.length) {
      showToast("Capture snapshots in the Snapshots side panel first.", true);
      return;
    }

    setBusy(true);
    resetProgressUi();
    showProgressPanel(true);
    openMenu();
    setProgress("Starting...", "");
    startChatWatcher();

    try {
      const result = await NotebookToolsSnapshotWorkflow.runFromSession({
        outputType,
        autoDownloadDoc,
        onProgress: handleWorkflowProgress
      });

      await resolveSession();

      if (result?.blocks?.length) {
        showDownloadReady(result, { docDownloaded: autoDownloadDoc || session?.autoDownloadDoc });
      } else if (outputType === "discuss") {
        setProgress("Discussion started.", "Ask follow-up questions in chat.");
        stopChatWatcher();
      }
    } catch (error) {
      getMenu()?.classList.add("is-error");
      progressSteps = progressSteps.map((step) =>
        step.status === "active" ? { ...step, status: "error" } : step
      );
      renderProgressSteps();
      setProgress("Failed.", error.message || "Something went wrong.");
      showToast(error.message || "Snapshot workflow failed.", true);
      startChatWatcher();
    } finally {
      if (!isCompleteState) {
        setBusy(false);
      }
    }
  }

  async function runFullAuto() {
    if (busy) {
      return;
    }

    await resolveSession();

    if (!session?.snapshots?.length) {
      showToast("Capture snapshots in the Snapshots side panel first.", true);
      return;
    }

    const outputType = session.outputType || "blog";

    if (outputType === "discuss") {
      await runAction("discuss");
      return;
    }

    setBusy(true);
    resetProgressUi();
    showProgressPanel(true);
    openMenu();
    setProgress("Starting auto workflow...", "Prompt → generate → embed images → DOC");
    startChatWatcher();

    try {
      const result = await NotebookToolsSnapshotWorkflow.runFullAuto({
        outputType,
        autoDownloadDoc: true,
        onProgress: handleWorkflowProgress
      });

      if (result?.blocks?.length) {
        showDownloadReady(result, { docDownloaded: true });
      }
    } catch (error) {
      getMenu()?.classList.add("is-error");
      setProgress("Failed.", error.message || "Something went wrong.");
      showToast(error.message || "Snapshot workflow failed.", true);
      startChatWatcher();
    } finally {
      if (!isCompleteState) {
        setBusy(false);
      }
    }
  }

  async function maybeStartPendingRun() {
    if (busy || pendingRunStarted || !isNotebookPage()) {
      return;
    }

    const notebookId = getNotebookId();

    if (!notebookId) {
      return;
    }

    await resolveSession();

    if (!session?.pendingRun || !session?.snapshots?.length) {
      return;
    }

    pendingRunStarted = true;
    await NotebookToolsSnapshotStore.clearPendingRun(notebookId);

    const outputType = session.outputType || "blog";
    window.setTimeout(() => {
      if (outputType === "discuss") {
        void runAction("discuss");
        return;
      }

      void runAction(outputType, { autoDownloadDoc: session.autoDownloadDoc !== false });
    }, 1500);
  }

  async function buildDocOnly() {
    if (busy) {
      return;
    }

    await resolveSession();

    if (!session?.snapshots?.length) {
      showToast("Capture snapshots in the Snapshots side panel first.", true);
      return;
    }

    setBusy(true);
    resetProgressUi();
    showProgressPanel(true);
    setProgress("Building document from chat...", "");

    try {
      const result = await NotebookToolsSnapshotWorkflow.buildDocFromChat({
        session,
        onProgress: handleWorkflowProgress
      });

      showDownloadReady(result);
    } catch (error) {
      getMenu()?.classList.add("is-error");
      setProgress("Failed.", error.message || "Could not build document.");
      showToast(error.message || "Could not build document.", true);
    } finally {
      if (!isCompleteState) {
        setBusy(false);
      }
    }
  }

  function renderSessionSummary() {
    const summary = getMenu()?.querySelector(".notebooktools-snapshot-workflow-summary");

    if (!summary) {
      return;
    }

    if (!session?.snapshots?.length) {
      summary.textContent =
        "Capture snapshots in the side panel, then run Auto to write an article with inline images and download DOC.";
      return;
    }

    const uploaded = session.sourceIds?.length ? "images in notebook" : "will upload images on first run";
    const pending = session.pendingRun ? " · auto-start pending" : "";
    const waiting = session.awaitingDoc ? " · waiting for reply" : "";
    const ready = session.docReady ? " · DOC ready" : "";
    summary.textContent = `${session.snapshots.length} snapshot${session.snapshots.length === 1 ? "" : "s"} · ${uploaded}${pending}${waiting}${ready} · ${session.pageTitle || "Captured screens"}`;
  }

  function createMenuPortal() {
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.className = "notebooktools-snapshot-workflow-menu";
    menu.innerHTML = `
      <div class="notebooktools-snapshot-workflow-form">
        <p class="notebooktools-snapshot-workflow-summary"></p>
        <button type="button" class="notebooktools-snapshot-workflow-option is-primary" data-action="auto">Auto: prompt → inline images → DOC</button>
        <button type="button" class="notebooktools-snapshot-workflow-option" data-action="discuss">Discuss snapshots</button>
        <button type="button" class="notebooktools-snapshot-workflow-option" data-action="blog">Create blog with images</button>
        <button type="button" class="notebooktools-snapshot-workflow-option" data-action="guide">Create web app tutorial</button>
        <button type="button" class="notebooktools-snapshot-workflow-option secondary" data-action="build">Build DOC from current chat</button>
      </div>
      <div class="notebooktools-snapshot-workflow-progress" hidden>
        <p class="notebooktools-snapshot-workflow-ready-banner" hidden>DOC ready</p>
        <ol class="notebooktools-snapshot-workflow-steps" hidden></ol>
        <p class="notebooktools-snapshot-workflow-status"></p>
        <p class="notebooktools-snapshot-workflow-detail" hidden></p>
        <p class="notebooktools-snapshot-workflow-complete-note" hidden></p>
        <div class="notebooktools-snapshot-workflow-downloads" hidden>
          <p class="notebooktools-snapshot-workflow-downloads-label">Download as</p>
          <div class="notebooktools-snapshot-workflow-download-buttons"></div>
        </div>
      </div>
    `;

    const downloads = menu.querySelector(".notebooktools-snapshot-workflow-download-buttons");

    for (const format of DOWNLOAD_FORMATS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `notebooktools-snapshot-workflow-download-btn${format === "doc" ? " is-primary" : ""}`;
      button.dataset.format = format;
      button.textContent = format.toUpperCase();
      button.addEventListener("click", () => {
        void triggerFormatDownload(format, button);
      });
      downloads.append(button);
    }

    menu.querySelector('[data-action="auto"]')?.addEventListener("click", () => {
      void runFullAuto();
    });
    menu.querySelector('[data-action="discuss"]')?.addEventListener("click", () => {
      void runAction("discuss");
    });
    menu.querySelector('[data-action="blog"]')?.addEventListener("click", () => {
      void runAction("blog");
    });
    menu.querySelector('[data-action="guide"]')?.addEventListener("click", () => {
      void runAction("guide");
    });
    menu.querySelector('[data-action="build"]')?.addEventListener("click", () => {
      void buildDocOnly();
    });

    document.body.append(menu);
    bindMenuListeners();
  }

  function mountWorkflowBar() {
    if (!isNotebookPage() || document.getElementById(BAR_ID)) {
      return;
    }

    const anchor = findChatInputAnchor();

    if (!anchor) {
      return;
    }

    const exportBar =
      anchor.querySelector(".notebooktools-chat-export-bar") ||
      anchor.parentElement?.querySelector(".notebooktools-chat-export-bar");

    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "notebooktools-snapshot-workflow-bar";

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.className = "notebooktools-snapshot-workflow-wrap";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "notebooktools-snapshot-workflow-btn";
    button.textContent = "Snapshots";

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (isMenuOpen()) {
        closeMenu();
        return;
      }

      void resolveSession().then(() => {
        openMenu();
        renderSessionSummary();

        if (isCompleteState && lastCompletedArticle) {
          showDownloadReady(lastCompletedArticle);
        } else if (session?.awaitingDoc) {
          showProgressPanel(true);
          setProgress("Waiting for NotebookLM reply...", "DOC will build automatically when ready.");
        }

        positionMenu();
      });
    });

    wrap.append(button);
    bar.append(wrap);

    if (exportBar?.parentElement) {
      exportBar.parentElement.insertBefore(bar, exportBar);
    } else {
      anchor.insertBefore(bar, anchor.firstChild);
    }

    if (!getMenu()) {
      createMenuPortal();
    }

    document.addEventListener("click", (event) => {
      if (!isMenuOpen()) {
        return;
      }

      const target = event.target;

      if (target instanceof Node && (wrap.contains(target) || getMenu()?.contains(target))) {
        return;
      }

      closeMenu();
    });
  }

  async function refreshSession() {
    await resolveSession();
    mountWorkflowBar();
    renderSessionSummary();
    void maybeStartPendingRun();
    void resumeAwaitingDoc();

    if (
      session?.docReady &&
      !lastCompletedArticle?.blocks?.length &&
      session.snapshots?.length &&
      !busy &&
      !session.awaitingDoc
    ) {
      void NotebookToolsSnapshotWorkflow.buildDocFromChat({
        session,
        onProgress: handleWorkflowProgress
      })
        .then((result) => showDownloadReady(result))
        .catch(() => {});
    }
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      void refreshSession();
    }, 250);
  }

  function init() {
    if (!isNotebookPage()) {
      return;
    }

    void refreshSession();
    mountWorkflowBar();

    const observer = new MutationObserver(scheduleRender);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("popstate", scheduleRender);
    window.setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleRender();
      }
    }, 500);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (
        (area === "local" &&
          (changes.notebooktoolsSnapshots || changes.notebooktoolsSnapshotSessionsByNotebook)) ||
        (area === "session" && changes.notebooktoolsSnapshotSession)
      ) {
        scheduleRender();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
