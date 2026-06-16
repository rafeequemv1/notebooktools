const NOTEBOOKTOOLS_BUTTON_ID = "notebooktools-youtube-action";
const NOTEBOOKTOOLS_DROPDOWN_ID = "notebooktools-youtube-dropdown";
const NOTEBOOKTOOLS_PANEL_ID = "notebooktools-youtube-panel";

let lastUrl = "";
let renderTimer = null;
let positionListenersBound = false;

function normalizeYouTubeVideoUrl(value) {
  let url;

  try {
    url = new URL(String(value || ""), window.location.href);
  } catch (_error) {
    return "";
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else {
      const match = url.pathname.match(/^\/(?:shorts|embed|v)\/([^/?#]+)/i);
      videoId = match?.[1] || "";
    }
  }

  return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "";
}

function getVideoTitle() {
  return (
    document.querySelector("[role='main'] h1.ytd-watch-metadata")?.textContent ||
    document.querySelector("[role='main'] h1 .ytd-watch-metadata")?.textContent ||
    document.querySelector("h1.title")?.textContent ||
    document.title.replace(/\s+-\s+YouTube$/i, "")
  ).replace(/\s+/g, " ").trim();
}

function getActionAnchor() {
  return (
    document.querySelector("[role='main'] yt-button-view-model.ytd-menu-renderer") ||
    document.querySelector("#actions yt-button-view-model.ytd-menu-renderer") ||
    document.querySelector("#top-level-buttons-computed") ||
    document.querySelector("#actions")
  );
}

function getWrapper() {
  return document.getElementById(NOTEBOOKTOOLS_BUTTON_ID);
}

function getDropdown() {
  let dropdown = document.getElementById(NOTEBOOKTOOLS_DROPDOWN_ID);

  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = NOTEBOOKTOOLS_DROPDOWN_ID;
    dropdown.className = "notebooktools-youtube-dropdown";
    document.body.append(dropdown);
  }

  return dropdown;
}

function positionDropdown() {
  const wrapper = getWrapper();
  const dropdown = document.getElementById(NOTEBOOKTOOLS_DROPDOWN_ID);
  const button = wrapper?.querySelector("button");

  if (!wrapper || !dropdown || !button || !wrapper.classList.contains("is-open")) {
    return;
  }

  const rect = button.getBoundingClientRect();
  const panelWidth = dropdown.offsetWidth || 272;
  const panelHeight = dropdown.offsetHeight || 300;
  const margin = 8;
  const left = Math.min(
    Math.max(margin, rect.right - panelWidth),
    window.innerWidth - panelWidth - margin
  );
  const belowTop = rect.bottom + 6;
  const aboveTop = rect.top - panelHeight - 6;
  const top = belowTop + panelHeight > window.innerHeight - margin && aboveTop > margin
    ? aboveTop
    : belowTop;

  dropdown.style.left = `${left}px`;
  dropdown.style.top = `${Math.max(margin, top)}px`;
}

function bindPositionListeners() {
  if (positionListenersBound) {
    return;
  }

  positionListenersBound = true;
  window.addEventListener("scroll", positionDropdown, true);
  window.addEventListener("resize", positionDropdown);
}

function closePanel() {
  const wrapper = getWrapper();
  const dropdown = document.getElementById(NOTEBOOKTOOLS_DROPDOWN_ID);

  dropdown?.classList.remove("is-open");
  dropdown?.replaceChildren();
  wrapper?.classList.remove("is-open");
  wrapper?.querySelector("button")?.setAttribute("aria-expanded", "false");
}

function bindPanelMessageListener() {
  if (window.__notebooktoolsPanelMessageBound) {
    return;
  }

  window.__notebooktoolsPanelMessageBound = true;

  window.addEventListener("message", (event) => {
    if (event.data?.type !== "notebooktools-import-success") {
      return;
    }

    const panel = document.getElementById(NOTEBOOKTOOLS_PANEL_ID);

    if (panel?.contentWindow && event.source === panel.contentWindow) {
      closePanel();
    }
  });
}

function openPanel(wrapper) {
  const youtubeUrl = normalizeYouTubeVideoUrl(window.location.href);

  if (!youtubeUrl) {
    return;
  }

  const dropdown = getDropdown();
  dropdown.replaceChildren();

  const panel = document.createElement("iframe");
  const frameUrl = new URL(chrome.runtime.getURL("youtube-import.html"));
  frameUrl.searchParams.set("url", youtubeUrl);
  frameUrl.searchParams.set("title", getVideoTitle());

  panel.id = NOTEBOOKTOOLS_PANEL_ID;
  panel.className = "notebooktools-youtube-panel";
  panel.title = "Import to NotebookLM";
  panel.src = frameUrl.toString();
  dropdown.append(panel);
  dropdown.classList.add("is-open");
  wrapper.classList.add("is-open");
  wrapper.querySelector("button")?.setAttribute("aria-expanded", "true");

  bindPositionListeners();
  bindPanelMessageListener();
  requestAnimationFrame(() => {
    positionDropdown();
    requestAnimationFrame(positionDropdown);
  });
}

function togglePanel(wrapper) {
  if (wrapper.classList.contains("is-open")) {
    closePanel();
    return;
  }

  openPanel(wrapper);
}

function createButton() {
  const wrapper = document.createElement("span");
  const button = document.createElement("button");
  const mark = document.createElement("span");
  const text = document.createElement("span");

  wrapper.id = NOTEBOOKTOOLS_BUTTON_ID;
  wrapper.className = "notebooktools-youtube-action";
  mark.className = "notebooktools-youtube-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.8"/>
    <text x="16" y="22" text-anchor="middle" fill="currentColor" font-family="Roboto, Arial, sans-serif" font-size="15" font-weight="600">N</text>
  </svg>`;
  text.className = "notebooktools-youtube-text";
  text.textContent = "NotebookTools";

  button.type = "button";
  button.title = "Import this video to NotebookLM";
  button.setAttribute("aria-expanded", "false");
  button.append(mark, text);
  wrapper.append(button);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePanel(wrapper);
  });

  return wrapper;
}

function renderButton() {
  const youtubeUrl = normalizeYouTubeVideoUrl(window.location.href);
  const existingButton = getWrapper();

  if (!youtubeUrl) {
    existingButton?.remove();
    closePanel();
    return;
  }

  if (existingButton?.isConnected) {
    if (existingButton.classList.contains("is-open")) {
      positionDropdown();
    }
    return;
  }

  const anchor = getActionAnchor();

  if (!anchor) {
    return;
  }

  const button = createButton();

  if (anchor.matches?.("#top-level-buttons-computed, #actions")) {
    anchor.prepend(button);
  } else {
    anchor.before(button);
  }
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderButton, 250);
}

function watchNavigation() {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    closePanel();
    scheduleRender();
  }
}

document.addEventListener(
  "mousedown",
  (event) => {
    const wrapper = getWrapper();
    const dropdown = document.getElementById(NOTEBOOKTOOLS_DROPDOWN_ID);
    const target = event.target;

    if (!wrapper?.classList.contains("is-open")) {
      return;
    }

    if (
      target instanceof Node &&
      (wrapper.contains(target) || dropdown?.contains(target))
    ) {
      return;
    }

    closePanel();
  },
  true
);

new MutationObserver(scheduleRender).observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.setInterval(watchNavigation, 500);
scheduleRender();
