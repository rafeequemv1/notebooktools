const PLATFORM_BUTTON_ID = "notebooktools-platform-action";
const PLATFORM_DROPDOWN_ID = "notebooktools-platform-dropdown";
const PLATFORM_PANEL_ID = "notebooktools-platform-panel";
const PLATFORM_BAR_ID = "notebooktools-platform-bar";

let lastUrl = "";
let renderTimer = null;
let positionListenersBound = false;
let currentPlatform = "";
let pendingImportPayload = null;

const PLATFORM_HOSTS = {
  chatgpt: ["chatgpt.com", "chat.openai.com"],
  gemini: ["gemini.google.com"],
  x: ["x.com", "twitter.com"]
};

function detectPlatform() {
  const host = window.location.hostname.replace(/^www\./, "").toLowerCase();

  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
    if (hosts.includes(host)) {
      return platform;
    }
  }

  return "";
}

function isDarkTheme() {
  if (document.documentElement.classList.contains("dark") ||
      document.body?.classList?.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark") {
    return true;
  }

  if (currentPlatform === "gemini") {
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/\d+/g);

    if (match && match.length >= 3) {
      const brightness = (Number(match[0]) * 299 + Number(match[1]) * 587 + Number(match[2]) * 114) / 1000;
      return brightness < 128;
    }
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
}

function isSupportedPage(platform) {
  const path = window.location.pathname;

  if (platform === "chatgpt") {
    return /\/c\//.test(path) || /\/g\//.test(path) || NotebookToolsExtractors.pageHasContent("chatgpt");
  }

  if (platform === "gemini") {
    return /\/app/.test(path) || NotebookToolsExtractors.pageHasContent("gemini");
  }

  if (platform === "x") {
    return /\/status\//.test(path) || /\/article\//.test(path) || /\/i\/article\//.test(path) ||
      NotebookToolsExtractors.pageHasContent("x");
  }

  return false;
}

function getWrapper() {
  return document.getElementById(PLATFORM_BUTTON_ID);
}

function getDropdown() {
  let dropdown = document.getElementById(PLATFORM_DROPDOWN_ID);

  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = PLATFORM_DROPDOWN_ID;
    dropdown.className = "notebooktools-platform-dropdown";
    document.body.append(dropdown);
  }

  return dropdown;
}

function positionDropdown() {
  const wrapper = getWrapper();
  const dropdown = document.getElementById(PLATFORM_DROPDOWN_ID);
  const button = wrapper?.querySelector("button");

  if (!wrapper || !dropdown || !button || !wrapper.classList.contains("is-open")) {
    return;
  }

  const rect = button.getBoundingClientRect();
  const panelWidth = dropdown.offsetWidth || 288;
  const panelHeight = dropdown.offsetHeight || 320;
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
  const dropdown = document.getElementById(PLATFORM_DROPDOWN_ID);

  dropdown?.classList.remove("is-open");
  dropdown?.replaceChildren();
  wrapper?.classList.remove("is-open");
  wrapper?.querySelector("button")?.setAttribute("aria-expanded", "false");
  pendingImportPayload = null;
}

function cacheImportPayload(payload) {
  pendingImportPayload = payload;

  try {
    chrome.runtime.sendMessage({
      type: "notebooktools-store-platform-import",
      payload
    });
  } catch (_error) {
    // Background cache is optional.
  }
}

function sendPayloadToPanel(panel) {
  if (!panel?.contentWindow || !pendingImportPayload) {
    return;
  }

  panel.contentWindow.postMessage({
    type: "notebooktools-import-payload",
    payload: pendingImportPayload
  }, "*");
}

function openPanel(wrapper) {
  let extracted;

  try {
    extracted = NotebookToolsExtractors.extractForPlatform(currentPlatform);
  } catch (error) {
    window.alert(error.message || "Nothing to import on this page yet.");
    return;
  }

  cacheImportPayload(extracted);

  const dropdown = getDropdown();
  dropdown.replaceChildren();

  const panel = document.createElement("iframe");
  const frameUrl = new URL(chrome.runtime.getURL("platform-import.html"));
  frameUrl.searchParams.set("platform", currentPlatform);

  panel.id = PLATFORM_PANEL_ID;
  panel.className = "notebooktools-platform-panel";
  panel.title = "Import to NotebookLM";
  panel.src = frameUrl.toString();
  panel.addEventListener("load", () => {
    sendPayloadToPanel(panel);
  });

  dropdown.append(panel);
  dropdown.classList.add("is-open");
  wrapper.classList.add("is-open");
  wrapper.querySelector("button")?.setAttribute("aria-expanded", "true");

  bindPositionListeners();
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

  wrapper.id = PLATFORM_BUTTON_ID;
  wrapper.className = "notebooktools-platform-action";

  if (isDarkTheme()) {
    wrapper.classList.add("notebooktools-platform-theme-dark");
  }

  mark.className = "notebooktools-platform-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "N";
  text.className = "notebooktools-platform-text";
  text.textContent = "NotebookLM";

  button.type = "button";
  button.title = "Import this conversation to NotebookLM";
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

function findHeaderAnchor(platform) {
  if (platform === "chatgpt") {
    return (
      document.querySelector("#conversation-header-actions") ||
      document.querySelector("header [class*='justify-end']") ||
      document.querySelector("header .flex.items-center.gap-2") ||
      document.querySelector("main header > div:last-child") ||
      document.querySelector("main header")
    );
  }

  if (platform === "gemini") {
    return (
      document.querySelector("top-bar-actions .right-section") ||
      document.querySelector("top-bar-actions") ||
      document.querySelector(".top-bar-actions") ||
      document.querySelector("header .right-section") ||
      document.querySelector("header")
    );
  }

  if (platform === "x") {
    return (
      document.querySelector('[data-testid="primaryColumn"] [role="navigation"]') ||
      document.querySelector('[data-testid="placementTracking"]') ||
      document.querySelector("header nav")
    );
  }

  return null;
}

function mountFloatingBar(button) {
  if (document.getElementById(PLATFORM_BAR_ID)) {
    return;
  }

  const bar = document.createElement("div");
  bar.id = PLATFORM_BAR_ID;
  bar.className = "notebooktools-platform-bar";

  if (isDarkTheme()) {
    bar.classList.add("notebooktools-platform-theme-dark");
  }

  bar.append(button);
  document.body.prepend(bar);
  document.body.classList.add("notebooktools-platform-bar-active");
}

function renderButton() {
  currentPlatform = detectPlatform();

  if (!currentPlatform || !isSupportedPage(currentPlatform)) {
    document.getElementById(PLATFORM_BUTTON_ID)?.remove();
    document.getElementById(PLATFORM_BAR_ID)?.remove();
    document.body.classList.remove("notebooktools-platform-bar-active");
    closePanel();
    return;
  }

  const existing = getWrapper();

  if (existing?.isConnected) {
    existing.classList.toggle("notebooktools-platform-theme-dark", isDarkTheme());

    if (existing.classList.contains("is-open")) {
      positionDropdown();
    }

    return;
  }

  const button = createButton();
  const anchor = findHeaderAnchor(currentPlatform);

  if (anchor) {
    anchor.append(button);
    return;
  }

  mountFloatingBar(button);
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderButton, 300);
}

function watchNavigation() {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    document.getElementById(PLATFORM_BUTTON_ID)?.remove();
    document.getElementById(PLATFORM_BAR_ID)?.remove();
    document.body.classList.remove("notebooktools-platform-bar-active");
    closePanel();
    scheduleRender();
  }
}

document.addEventListener(
  "mousedown",
  (event) => {
    const wrapper = getWrapper();
    const dropdown = document.getElementById(PLATFORM_DROPDOWN_ID);
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

window.addEventListener("message", (event) => {
  if (event.data?.type === "notebooktools-request-import") {
    const panel = document.getElementById(PLATFORM_PANEL_ID);

    if (panel?.contentWindow && event.source === panel.contentWindow) {
      sendPayloadToPanel(panel);
    }

    return;
  }

  if (event.data?.type === "notebooktools-import-success") {
    const panel = document.getElementById(PLATFORM_PANEL_ID);

    if (panel?.contentWindow && event.source === panel.contentWindow) {
      closePanel();
    }
  }
});

new MutationObserver(scheduleRender).observe(document.documentElement, {
  childList: true,
  subtree: true
});

lastUrl = window.location.href;
scheduleRender();
window.setInterval(watchNavigation, 500);
