const NOTEBOOKTOOLS_BUTTON_ID = "notebooktools-youtube-action";
const NOTEBOOKTOOLS_PANEL_ID = "notebooktools-youtube-panel";

let lastUrl = "";
let renderTimer = null;

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

function closePanel() {
  document.getElementById(NOTEBOOKTOOLS_PANEL_ID)?.remove();
  document.getElementById(NOTEBOOKTOOLS_BUTTON_ID)?.classList.remove("is-open");
}

function positionPanel(button, panel) {
  const rect = button.getBoundingClientRect();
  const margin = 8;
  const panelWidth = panel.offsetWidth || 380;
  const panelHeight = panel.offsetHeight || 470;
  const left = Math.min(
    Math.max(margin, rect.right - panelWidth),
    window.innerWidth - panelWidth - margin
  );
  const top = Math.min(rect.bottom + margin, window.innerHeight - panelHeight - margin);

  panel.style.left = `${Math.max(margin, left)}px`;
  panel.style.top = `${Math.max(margin, top)}px`;
}

function togglePanel(button) {
  const existingPanel = document.getElementById(NOTEBOOKTOOLS_PANEL_ID);

  if (existingPanel) {
    closePanel();
    return;
  }

  const youtubeUrl = normalizeYouTubeVideoUrl(window.location.href);

  if (!youtubeUrl) {
    return;
  }

  const panel = document.createElement("iframe");
  const frameUrl = new URL(chrome.runtime.getURL("youtube-import.html"));
  frameUrl.searchParams.set("url", youtubeUrl);
  frameUrl.searchParams.set("title", getVideoTitle());

  panel.id = NOTEBOOKTOOLS_PANEL_ID;
  panel.className = "notebooktools-youtube-panel";
  panel.title = "NotebookTools YouTube import";
  panel.src = frameUrl.toString();
  document.body.append(panel);
  button.classList.add("is-open");
  positionPanel(button, panel);
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
  mark.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 20V10C4 10 7 6 12 6C17 6 20 10 20 10V20" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>
    <path d="M7 20V12C7 12 9 9 12 9C15 9 17 12 17 12V20" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>
    <path d="M10 20V14C10 14 11 12 12 12C13 12 14 14 14 14V20" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>
  </svg>`;
  text.className = "notebooktools-youtube-text";
  text.textContent = "NotebookLM";

  button.type = "button";
  button.title = "Import this YouTube video to NotebookLM";
  button.append(mark, text);
  wrapper.append(button);
  wrapper.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePanel(wrapper);
  });

  return wrapper;
}

function renderButton() {
  const youtubeUrl = normalizeYouTubeVideoUrl(window.location.href);
  const existingButton = document.getElementById(NOTEBOOKTOOLS_BUTTON_ID);

  if (!youtubeUrl) {
    existingButton?.remove();
    closePanel();
    return;
  }

  if (existingButton?.isConnected) {
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

  anchor.closest?.("#actions")?.style.setProperty("padding-right", "1px");
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

document.addEventListener("click", (event) => {
  const target = event.target;

  if (
    target instanceof Node &&
    !document.getElementById(NOTEBOOKTOOLS_BUTTON_ID)?.contains(target) &&
    !document.getElementById(NOTEBOOKTOOLS_PANEL_ID)?.contains(target)
  ) {
    closePanel();
  }
});

window.addEventListener("resize", () => {
  const button = document.getElementById(NOTEBOOKTOOLS_BUTTON_ID);
  const panel = document.getElementById(NOTEBOOKTOOLS_PANEL_ID);

  if (button && panel) {
    positionPanel(button, panel);
  }
});

new MutationObserver(scheduleRender).observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.setInterval(watchNavigation, 500);
scheduleRender();
