(function () {
  "use strict";

  const WATCH_BTN_ID = "notebooktools-youtube-action";
  const STUDIO_BTN_ID = "notebooktools-youtube-studio";
  const DROPDOWN_ID = "notebooktools-youtube-dropdown";
  const WATCH_PANEL_ID = "notebooktools-youtube-panel";

  let watchButton = null;
  let studioButton = null;
  let activePanelMode = "import";
  let renderRaf = 0;
  let renderBackupTimer = 0;
  let navigationRetryTimers = [];
  let lastHref = location.href;
  let dropdownListenersBound = false;
  let actionsObserver = null;
  let observedActionsRoot = null;

  function isWatchPage() {
    return location.pathname === "/watch";
  }

  function normalizeWatchUrl(value) {
    try {
      const url = new URL(String(value || ""), location.href);
      const videoId = url.searchParams.get("v") || "";
      return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
        : "";
    } catch (_error) {
      return "";
    }
  }

  function getVideoTitle() {
    return (
      document.querySelector("[role='main'] h1.ytd-watch-metadata")?.textContent ||
      document.querySelector("h1.ytd-watch-metadata")?.textContent ||
      document.querySelector("h1.title")?.textContent ||
      document.title.replace(/\s+-\s+YouTube$/i, "")
    ).replace(/\s+/g, " ").trim();
  }

  function isElementVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
  }

  function queryShadowDeep(selector, root = document) {
    const direct = root.querySelector(selector);

    if (direct) {
      return direct;
    }

    const hosts = root.querySelectorAll ? root.querySelectorAll("*") : [];

    for (const host of hosts) {
      if (!host.shadowRoot) {
        continue;
      }

      const found = queryShadowDeep(selector, host.shadowRoot);

      if (found) {
        return found;
      }
    }

    return null;
  }

  function getWatchMetadataRoot() {
    const candidates = [
      ...document.querySelectorAll("ytd-watch-metadata"),
      ...document.querySelectorAll("ytd-watch-flexy #primary-inner"),
      ...document.querySelectorAll("#columns #primary #primary-inner")
    ];

    return candidates.find(isElementVisible) || candidates[0] || null;
  }

  function queryAllFromRoot(selector, root = document) {
    const matches = [];

    if (root.querySelectorAll) {
      matches.push(...root.querySelectorAll(selector));
    }

    const descendants = root.querySelectorAll ? root.querySelectorAll("*") : [];

    for (const element of descendants) {
      if (!element.shadowRoot) {
        continue;
      }

      matches.push(...queryAllFromRoot(selector, element.shadowRoot));
    }

    return matches;
  }

  function getWatchInsertPoint() {
    const metadataRoot = getWatchMetadataRoot();
    const searchRoots = metadataRoot ? [metadataRoot, document] : [document];
    const buttonSelectors = [
      "#top-level-buttons-computed",
      "#button-bar"
    ];

    for (const root of searchRoots) {
      for (const selector of buttonSelectors) {
        for (const node of queryAllFromRoot(selector, root)) {
          if (isElementVisible(node)) {
            return { node, mode: "prepend" };
          }
        }
      }

      for (const menuRenderer of queryAllFromRoot("ytd-menu-renderer", root)) {
        if (!isElementVisible(menuRenderer)) {
          continue;
        }

        const inner =
          menuRenderer.querySelector("#top-level-buttons-computed, #button-bar") ||
          queryShadowDeep("#top-level-buttons-computed, #button-bar", menuRenderer);

        if (inner && isElementVisible(inner)) {
          return { node: inner, mode: "prepend" };
        }

        return { node: menuRenderer, mode: "prepend" };
      }
    }

    const firstAction = queryShadowDeep(
      "ytd-watch-metadata yt-button-view-model, #actions yt-button-view-model, [role='main'] yt-button-view-model"
    );

    if (firstAction?.parentElement && isElementVisible(firstAction.parentElement)) {
      return { node: firstAction.parentElement, mode: "prepend" };
    }

    const actions = metadataRoot?.querySelector("#actions") ||
      queryShadowDeep("ytd-watch-metadata #actions, #actions");

    if (actions && isElementVisible(actions)) {
      return { node: actions, mode: "prepend" };
    }

    return null;
  }

  function isButtonInPlace(button, insertPoint) {
    if (!button?.isConnected || !insertPoint?.node || !isElementVisible(button)) {
      return false;
    }

    return insertPoint.node === button.parentElement || insertPoint.node.contains(button);
  }

  function areButtonsInPlace(insertPoint) {
    return (
      isButtonInPlace(watchButton, insertPoint) &&
      isButtonInPlace(studioButton, insertPoint)
    );
  }

  function getDropdown() {
    let dropdown = document.getElementById(DROPDOWN_ID);

    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.id = DROPDOWN_ID;
      dropdown.className = "notebooktools-youtube-dropdown";
      (document.body || document.documentElement).append(dropdown);
    }

    return dropdown;
  }

  function positionDropdown() {
    const wrapper =
      activePanelMode === "studio"
        ? document.getElementById(STUDIO_BTN_ID)
        : document.getElementById(WATCH_BTN_ID);
    const dropdown = document.getElementById(DROPDOWN_ID);
    const button = wrapper?.querySelector("button");

    if (!wrapper || !dropdown || !button || !dropdown.classList.contains("is-open")) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const panelWidth = dropdown.offsetWidth || 268;
    const panelHeight = dropdown.offsetHeight || 320;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - panelWidth - margin
    );
    const belowTop = rect.bottom + 6;
    const aboveTop = rect.top - panelHeight - 6;
    const top = belowTop + panelHeight > window.innerHeight - margin && aboveTop > margin
      ? aboveTop
      : belowTop;

    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${Math.max(margin, top)}px`;
    dropdown.style.transform = "";
  }

  function bindDropdownListeners() {
    if (dropdownListenersBound) {
      return;
    }

    dropdownListenersBound = true;
    window.addEventListener("scroll", positionDropdown, true);
    window.addEventListener("resize", positionDropdown);

    window.addEventListener("message", (event) => {
      if (event.data?.type !== "notebooktools-import-success") {
        return;
      }

      const panel = document.getElementById(WATCH_PANEL_ID);

      if (panel?.contentWindow && event.source === panel.contentWindow) {
        closePanel();
      }
    });

    document.addEventListener(
      "mousedown",
      (event) => {
        const wrapper = document.getElementById(WATCH_BTN_ID);
        const mapWrapper = document.getElementById(MINDMAP_BTN_ID);
        const dropdown = document.getElementById(DROPDOWN_ID);
        const target = event.target;

        if (!wrapper?.classList.contains("is-open") && !mapWrapper?.classList.contains("is-open")) {
          return;
        }

        if (
          target instanceof Node &&
          (wrapper?.contains(target) || mapWrapper?.contains(target) || dropdown?.contains(target))
        ) {
          return;
        }

        closePanel();
      },
      true
    );
  }

  function closePanel() {
    const dropdown = document.getElementById(DROPDOWN_ID);
    const wrappers = [watchButton, studioButton];

    dropdown?.classList.remove("is-open");
    dropdown?.replaceChildren();

    for (const wrapper of wrappers) {
      wrapper?.classList.remove("is-open");
      wrapper?.querySelector("button")?.setAttribute("aria-expanded", "false");
    }

    activePanelMode = "import";
  }

  function setOpenWrapper(mode) {
    const importOpen = mode === "import";
    watchButton?.classList.toggle("is-open", importOpen);
    studioButton?.classList.toggle("is-open", !importOpen);
    watchButton?.querySelector("button")?.setAttribute("aria-expanded", importOpen ? "true" : "false");
    studioButton?.querySelector("button")?.setAttribute("aria-expanded", importOpen ? "false" : "true");
  }

  function openWatchPanel(wrapper, mode = "import") {
    const youtubeUrl = normalizeWatchUrl(location.href);

    if (!youtubeUrl) {
      return;
    }

    const dropdown = getDropdown();
    const isSameMode = wrapper.classList.contains("is-open") && activePanelMode === mode;

    if (isSameMode) {
      closePanel();
      return;
    }

    dropdown.replaceChildren();

    const panel = document.createElement("iframe");
    const frameUrl = new URL(chrome.runtime.getURL("youtube-import.html"));
    frameUrl.searchParams.set("url", youtubeUrl);
    frameUrl.searchParams.set("title", getVideoTitle());

    if (mode === "studio") {
      frameUrl.searchParams.set("mode", "studio");
    }

    panel.id = WATCH_PANEL_ID;
    panel.className = `notebooktools-youtube-panel${mode === "studio" ? " is-studio" : ""}`;
    panel.title = mode === "studio" ? "Create from video" : "Import to NotebookLM";
    panel.src = frameUrl.toString();
    dropdown.append(panel);
    dropdown.classList.add("is-open");
    activePanelMode = mode;
    setOpenWrapper(mode);

    bindDropdownListeners();
    requestAnimationFrame(() => {
      positionDropdown();
      requestAnimationFrame(positionDropdown);
    });
  }

  function createActionButton({ id, label, title, mode, variant = "" }) {
    const wrapper = document.createElement("span");
    const button = document.createElement("button");
    const text = document.createElement("span");
    const mark = document.createElement("span");
    const markImg = document.createElement("img");

    wrapper.id = id;
    wrapper.className = `notebooktools-youtube-action${variant ? ` ${variant}` : ""}`;
    text.className = "notebooktools-youtube-text";
    text.textContent = label;
    mark.className = "notebooktools-youtube-mark";
    mark.setAttribute("aria-hidden", "true");
    markImg.src = chrome.runtime.getURL("icons/icon16.png");
    markImg.alt = "";
    markImg.width = 16;
    markImg.height = 16;
    mark.append(markImg);

    button.type = "button";
    button.title = title;
    button.setAttribute("aria-expanded", "false");
    button.append(mark, text);
    wrapper.append(button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openWatchPanel(wrapper, mode);
    });

    return wrapper;
  }

  function createWatchButton() {
    return createActionButton({
      id: WATCH_BTN_ID,
      label: "NotebookLM",
      title: "Import this video to NotebookLM",
      mode: "import"
    });
  }

  function createStudioButton() {
    return createActionButton({
      id: STUDIO_BTN_ID,
      label: "Studio",
      title: "Import video and create slides, podcast, flashcards, and more",
      mode: "studio",
      variant: "is-studio"
    });
  }

  function ensureWatchButton() {
    if (!watchButton) {
      watchButton = createWatchButton();
    }

    return watchButton;
  }

  function ensureStudioButton() {
    if (!studioButton) {
      studioButton = createStudioButton();
    }

    return studioButton;
  }

  function placeWatchButton(insertPoint) {
    const importButton = ensureWatchButton();
    const mapButton = ensureStudioButton();

    for (const button of [importButton, mapButton]) {
      if (button.parentElement && button.parentElement !== insertPoint.node) {
        button.remove();
      }
    }

    if (areButtonsInPlace(insertPoint)) {
      return;
    }

    if (insertPoint.mode === "prepend") {
      insertPoint.node.prepend(mapButton);
      insertPoint.node.prepend(importButton);
    } else {
      insertPoint.node.before(mapButton);
      insertPoint.node.before(importButton);
    }
  }

  function detachActionsObserver() {
    actionsObserver?.disconnect();
    actionsObserver = null;
    observedActionsRoot = null;
  }

  function attachActionsObserver(root) {
    if (!root) {
      return;
    }

    if (observedActionsRoot === root && actionsObserver) {
      return;
    }

    detachActionsObserver();
    observedActionsRoot = root;
    actionsObserver = new MutationObserver(scheduleRender);
    actionsObserver.observe(root, { childList: true, subtree: true });
  }

  function renderWatchButton() {
    if (!isWatchPage()) {
      watchButton?.remove();
      studioButton?.remove();
      closePanel();
      detachActionsObserver();
      return;
    }

    const insertPoint = getWatchInsertPoint();
    const importButton = ensureWatchButton();

    if (insertPoint && areButtonsInPlace(insertPoint)) {
      attachActionsObserver(
        insertPoint.node.closest("ytd-menu-renderer, #actions, ytd-watch-metadata") || insertPoint.node
      );
      return;
    }

    if (!insertPoint) {
      scheduleRender();
      return;
    }

    placeWatchButton(insertPoint);
    attachActionsObserver(
      insertPoint.node.closest("ytd-menu-renderer, #actions, ytd-watch-metadata") || insertPoint.node
    );
  }

  function clearNavigationRetries() {
    for (const timerId of navigationRetryTimers) {
      window.clearTimeout(timerId);
    }

    navigationRetryTimers = [];
  }

  function scheduleNavigationRetries() {
    clearNavigationRetries();

    for (const delay of [0, 60, 150, 300, 600, 1200, 2400]) {
      navigationRetryTimers.push(
        window.setTimeout(() => {
          if (isWatchPage()) {
            renderWatchButton();
          }
        }, delay)
      );
    }
  }

  function scheduleRender() {
    if (renderRaf) {
      window.cancelAnimationFrame(renderRaf);
    }

    renderRaf = window.requestAnimationFrame(() => {
      renderRaf = 0;
      renderWatchButton();
    });

    window.clearTimeout(renderBackupTimer);
    renderBackupTimer = window.setTimeout(() => {
      renderBackupTimer = 0;

      if (isWatchPage()) {
        renderWatchButton();
      }
    }, 120);
  }

  function onYouTubeNavigation() {
    const hrefChanged = location.href !== lastHref;
    lastHref = location.href;

    if (!hrefChanged && !isWatchPage()) {
      return;
    }

    closePanel();
    detachActionsObserver();
    clearNavigationRetries();

    if (hrefChanged && watchButton?.parentElement) {
      watchButton.remove();
      studioButton?.remove();
    }

    scheduleRender();

    if (isWatchPage()) {
      scheduleNavigationRetries();
    }
  }

  function bindYouTubeEvents() {
    const roots = [document, document.querySelector("ytd-app")].filter(Boolean);

    for (const root of roots) {
      root.addEventListener("yt-navigate-finish", onYouTubeNavigation);
      root.addEventListener("yt-page-data-updated", scheduleRender);
      root.addEventListener("yt-page-type-changed", onYouTubeNavigation);
    }
  }

  bindDropdownListeners();
  bindYouTubeEvents();
  scheduleRender();

  if (isWatchPage()) {
    scheduleNavigationRetries();
  }

  new MutationObserver(scheduleRender).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("popstate", onYouTubeNavigation);

  window.setInterval(() => {
    if (location.href !== lastHref) {
      onYouTubeNavigation();
      return;
    }

    if (!isWatchPage()) {
      return;
    }

    const insertPoint = getWatchInsertPoint();
    const importButton = document.getElementById(WATCH_BTN_ID);
    const mapButton = document.getElementById(MINDMAP_BTN_ID);

    if (
      !importButton ||
      !mapButton ||
      !isElementVisible(importButton) ||
      !isElementVisible(mapButton) ||
      (insertPoint && !areButtonsInPlace(insertPoint))
    ) {
      scheduleRender();
    }
  }, 250);
})();
