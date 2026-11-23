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
  let allShots = []; // every captured snapshot (the review box shows them all)
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

  // One NotebookTools dropdown open at a time: close when another one opens
  document.addEventListener("notebooktools-dropdown-open", (event) => { if (event.detail !== "snapshots") closeMenu(); });

  function isDarkPage() {
    for (const node of [document.body, document.documentElement]) {
      const m = node && getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (!m || Number(m[3] ?? 1) === 0) continue;
      const [r, g, b] = m.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  function openMenu() {
    document.dispatchEvent(new CustomEvent("notebooktools-dropdown-open", { detail: "snapshots" }));
    getWrap()?.classList.add("is-open");
    getMenu()?.classList.toggle("is-dark", isDarkPage());
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
    allShots = localSnapshots;
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
      showToast("Capture snapshots first: NotebookTools icon in the toolbar → Snapshots.", true);
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
      showToast("Capture snapshots first: NotebookTools icon in the toolbar → Snapshots.", true);
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
      showToast("Capture snapshots first: NotebookTools icon in the toolbar → Snapshots.", true);
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
    const menu = getMenu();
    const summary = menu?.querySelector(".notebooktools-snapshot-workflow-summary");

    if (!summary) {
      return;
    }

    const shots = allShots.length ? allShots : session?.snapshots || [];
    const strip = menu.querySelector(".nsw-strip");
    const review = menu.querySelector(".nsw-review");
    menu.classList.toggle("is-empty", !shots.length);

    if (review) {
      review.textContent = shots.length ? `Review ${shots.length}` : "Review";
    }

    if (strip) {
      const extra = shots.length - 4;
      strip.hidden = !shots.length;
      strip.innerHTML = shots
        .slice(0, 4)
        .map((shot) => `<img src="${shot.dataUrl}" alt="">`)
        .join("") + (extra > 0 ? `<span>+${extra}</span>` : "");
    }

    if (!shots.length) {
      summary.hidden = false;
      summary.textContent = "Capture screens, then turn them into an article with the images inline.";
      return;
    }

    const parts = [];
    parts.push(session?.sourceIds?.length ? `${session.snapshots.length} in this notebook` : "not in this notebook yet");
    if (session?.pendingRun) parts.push("starting soon");
    if (session?.awaitingDoc) parts.push("waiting for the reply");
    if (session?.docReady) parts.push("DOC ready");
    summary.textContent = parts.join(" · ");
    summary.hidden = !parts.length;
  }

  const MENU_ICONS = {
    stack: '<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    steps: '<path d="M4 6h4v4H4zM4 14h4v4H4zM12 8h8M12 16h8"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
  };

  function menuItem(action, iconName, label, hint = "") {
    return `<button type="button" class="notebooktools-snapshot-workflow-option" data-action="${action}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MENU_ICONS[iconName]}</svg><span>${label}${hint ? ` <small>${hint}</small>` : ""}</span></button>`;
  }

  async function startCapture(type) {
    closeMenu();
    try {
      const response = await chrome.runtime.sendMessage({
        type: type === "continuous" ? "notebooktools-snapshot-continuous-start" : "notebooktools-ribbon-snapshot"
      });
      if (response?.upgrade && window.NotebookToolsPlan) window.NotebookToolsPlan.showUpgrade(response.upgrade);
      else if (!response?.ok) showToast(response?.error || "Couldn't start capturing.", true);
    } catch (_error) {
      showToast("Reload this page to use snapshots.", true);
    }
  }

  function openReview() {
    closeMenu();
    window.NotebookToolsSnapshotReview?.open();
  }

  function createMenuPortal() {
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.className = "notebooktools-snapshot-workflow-menu";
    menu.innerHTML = `
      <div class="notebooktools-snapshot-workflow-form">
        <div class="nsw-head">
          <span class="nsw-title">Snapshots</span>
          <button type="button" class="nsw-review" data-action="review">Review</button>
        </div>
        <button type="button" class="nsw-strip" data-action="review" title="Review, crop or delete snapshots"></button>
        <p class="notebooktools-snapshot-workflow-summary"></p>
        <p class="nsw-label">Capture</p>
        ${menuItem("continuous", "stack", "Capture continuously", "screen after screen, any tab")}
        ${menuItem("area", "crop", "Capture an area", "of this page, with notes")}
        <p class="nsw-label nsw-create">Create from snapshots</p>
        ${menuItem("auto", "doc", "Write article", "images placed inline")}
        ${menuItem("blog", "image", "Blog post with images")}
        ${menuItem("guide", "steps", "Web app tutorial", "step by step")}
        ${menuItem("discuss", "chat", "Discuss in chat")}
        ${menuItem("build", "download", "Build DOC from chat", "after NotebookLM replies")}
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

    menu.querySelectorAll('[data-action="review"]').forEach((el) => el.addEventListener("click", openReview));
    menu.querySelector('[data-action="continuous"]')?.addEventListener("click", () => void startCapture("continuous"));
    menu.querySelector('[data-action="area"]')?.addEventListener("click", () => void startCapture("area"));
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
