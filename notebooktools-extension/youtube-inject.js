(function () {
  "use strict";

  const WATCH_BTN_ID = "notebooktools-youtube-action";
  const DROPDOWN_ID = "notebooktools-youtube-dropdown";
  const WATCH_PANEL_ID = "notebooktools-youtube-panel";

  let watchButton = null;
  let renderRaf = 0;
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

  function getWatchInsertPoint() {
    const topButtons = document.querySelector(
      "ytd-watch-metadata #top-level-buttons-computed, #actions #top-level-buttons-computed, #top-level-buttons-computed"
    );

    if (topButtons) {
      return { node: topButtons, mode: "prepend" };
    }

    const menuRenderer = document.querySelector(
      "ytd-watch-metadata ytd-menu-renderer, #actions ytd-menu-renderer, [role='main'] ytd-menu-renderer"
    );

    if (menuRenderer) {
      const inner = menuRenderer.querySelector("#top-level-buttons-computed");

      if (inner) {
        return { node: inner, mode: "prepend" };
      }

      return { node: menuRenderer, mode: "prepend" };
    }

    const firstAction = document.querySelector(
      "[role='main'] yt-button-view-model.ytd-menu-renderer, #actions yt-button-view-model.ytd-menu-renderer"
    );

    if (firstAction?.parentElement) {
      return { node: firstAction.parentElement, mode: "prepend" };
    }

    const actions = document.querySelector("ytd-watch-metadata #actions, #actions");

    if (actions) {
      return { node: actions, mode: "prepend" };
    }

    return null;
  }

  function isButtonInPlace(button, insertPoint) {
    if (!button?.isConnected || !insertPoint?.node) {
      return false;
    }

    return insertPoint.node === button.parentElement || insertPoint.node.contains(button);
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
    const wrapper = document.getElementById(WATCH_BTN_ID);
    const dropdown = document.getElementById(DROPDOWN_ID);
    const button = wrapper?.querySelector("button");

    if (!wrapper || !dropdown || !button || !wrapper.classList.contains("is-open")) {
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
        const dropdown = document.getElementById(DROPDOWN_ID);
        const target = event.target;

        if (!wrapper?.classList.contains("is-open")) {
          return;
        }

        if (target instanceof Node && (wrapper.contains(target) || dropdown?.contains(target))) {
          return;
        }

        closePanel();
      },
      true
    );
  }

  function closePanel() {
    const dropdown = document.getElementById(DROPDOWN_ID);
    const wrapper = document.getElementById(WATCH_BTN_ID);

    dropdown?.classList.remove("is-open");
    dropdown?.replaceChildren();
    wrapper?.classList.remove("is-open");
    wrapper?.querySelector("button")?.setAttribute("aria-expanded", "false");
  }

  function openWatchPanel(wrapper) {
    const youtubeUrl = normalizeWatchUrl(location.href);

    if (!youtubeUrl) {
      return;
    }

    const dropdown = getDropdown();
    dropdown.replaceChildren();

    const panel = document.createElement("iframe");
    const frameUrl = new URL(chrome.runtime.getURL("youtube-import.html"));
    frameUrl.searchParams.set("url", youtubeUrl);
    frameUrl.searchParams.set("title", getVideoTitle());

    panel.id = WATCH_PANEL_ID;
    panel.className = "notebooktools-youtube-panel";
    panel.title = "Import to NotebookLM";
    panel.src = frameUrl.toString();
    dropdown.append(panel);
    dropdown.classList.add("is-open");
    wrapper.classList.add("is-open");
    wrapper.querySelector("button")?.setAttribute("aria-expanded", "true");

    bindDropdownListeners();
    requestAnimationFrame(() => {
      positionDropdown();
      requestAnimationFrame(positionDropdown);
    });
  }

  function createWatchButton() {
    const wrapper = document.createElement("span");
    const button = document.createElement("button");
    const text = document.createElement("span");
    const mark = document.createElement("span");
    const markImg = document.createElement("img");

    wrapper.id = WATCH_BTN_ID;
    wrapper.className = "notebooktools-youtube-action";
    text.className = "notebooktools-youtube-text";
    text.textContent = "NotebookLM";
    mark.className = "notebooktools-youtube-mark";
    mark.setAttribute("aria-hidden", "true");
    markImg.src = chrome.runtime.getURL("icons/icon16.png");
    markImg.alt = "";
    markImg.width = 16;
    markImg.height = 16;
    mark.append(markImg);

    button.type = "button";
    button.title = "Import this video to NotebookLM";
    button.setAttribute("aria-expanded", "false");
    button.append(mark, text);
    wrapper.append(button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (wrapper.classList.contains("is-open")) {
        closePanel();
        return;
      }

      openWatchPanel(wrapper);
    });

    return wrapper;
  }

  function ensureWatchButton() {
    if (!watchButton) {
      watchButton = createWatchButton();
    }

    return watchButton;
  }

  function placeWatchButton(insertPoint) {
    const button = ensureWatchButton();

    if (button.parentElement && button.parentElement !== insertPoint.node) {
      button.remove();
    }

    if (isButtonInPlace(button, insertPoint)) {
      return;
    }

    if (insertPoint.mode === "prepend") {
      insertPoint.node.prepend(button);
    } else {
      insertPoint.node.before(button);
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
      closePanel();
      detachActionsObserver();
      return;
    }

    const insertPoint = getWatchInsertPoint();
    const button = ensureWatchButton();

    if (insertPoint && isButtonInPlace(button, insertPoint)) {
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

  function scheduleRender() {
    if (renderRaf) {
      return;
    }

    renderRaf = requestAnimationFrame(() => {
      renderRaf = 0;
      renderWatchButton();
    });
  }

  function onYouTubeNavigation() {
    const hrefChanged = location.href !== lastHref;
    lastHref = location.href;

    if (!hrefChanged && !isWatchPage()) {
      return;
    }

    closePanel();
    detachActionsObserver();

    if (hrefChanged && watchButton?.parentElement) {
      watchButton.remove();
    }

    scheduleRender();
  }

  bindDropdownListeners();
  scheduleRender();

  new MutationObserver(scheduleRender).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener("yt-navigate-finish", onYouTubeNavigation);
  document.addEventListener("yt-page-data-updated", scheduleRender);
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
    const button = document.getElementById(WATCH_BTN_ID);

    if (insertPoint && !isButtonInPlace(button, insertPoint)) {
      scheduleRender();
    }
  }, 200);
})();
