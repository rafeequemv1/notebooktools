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
  x: ["x.com", "twitter.com"],
  claude: ["claude.ai"],
  perplexity: ["perplexity.ai"],
  grok: ["grok.com"],
  kimi: ["kimi.com", "kimi.moonshot.cn"],
  reddit: ["reddit.com", "old.reddit.com"],
  linkedin: ["linkedin.com"],
  googledocs: ["docs.google.com"]
};

// Paths that always count as an importable page. Chat apps also show the button
// whenever their conversation selectors find messages (see CONTENT_DETECT_PLATFORMS).
const PLATFORM_PATHS = {
  chatgpt: /\/(c|g|share)\//,
  gemini: /\/(app|gem|share)(\/|$)/,
  x: /\/status\/|\/article\/|\/i\/article\//,
  claude: /^\/(chat|share)\//,
  perplexity: /^\/(search|page)\//,
  grok: /^\/(c|chat|share)\/|^\/i\/grok/,
  kimi: /^\/(chat|share)\//,
  reddit: /\/comments\//,
  linkedin: /^\/(posts|pulse)\/|^\/feed\/update\//,
  googledocs: /^\/document\/(u\/\d+\/)?d\//
};

const CONTENT_DETECT_PLATFORMS = new Set(["chatgpt", "gemini", "x", "claude", "perplexity", "grok", "kimi"]);
const CONVERSATION_PLATFORMS = new Set(["chatgpt", "gemini", "claude", "perplexity", "grok", "kimi"]);
// Platforms that keep the original full-width top bar when no header anchor exists.
const BAR_FALLBACK_PLATFORMS = new Set(["x"]);
// Floating pill position per platform (default: top-right, below the site header).
const FLOAT_BOTTOM_PLATFORMS = new Set(["googledocs"]);

function detectPlatform() {
  const host = window.location.hostname.replace(/^www\./, "").toLowerCase();

  if ((host === "x.com" || host === "twitter.com") && /^\/i\/grok/.test(window.location.pathname)) {
    return "grok";
  }

  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
    if (hosts.includes(host)) {
      return platform;
    }
  }

  return "";
}

function backgroundBrightness(element) {
  if (!element) {
    return null;
  }

  const match = window.getComputedStyle(element).backgroundColor.match(/rgba?\(([^)]+)\)/);

  if (!match) {
    return null;
  }

  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);

  if (parts.length < 3 || (parts.length >= 4 && parts[3] === 0)) {
    return null;
  }

  return (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
}

function isDarkTheme() {
  const root = document.documentElement;
  const body = document.body;
  const darkClasses = ["dark", "theme-dark", "theme--dark", "dark-theme", "dark-mode"];

  if (darkClasses.some((name) => root.classList.contains(name) || body?.classList?.contains(name)) ||
      root.getAttribute("data-theme") === "dark" ||
      root.getAttribute("data-mode") === "dark" ||
      root.getAttribute("data-color-mode") === "dark" ||
      root.style.colorScheme === "dark") {
    return true;
  }

  for (const element of [body, root, document.querySelector("main")]) {
    const brightness = backgroundBrightness(element);

    if (brightness !== null) {
      return brightness < 128;
    }
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
}

function isSupportedPage(platform) {
  const pattern = PLATFORM_PATHS[platform];

  if (!pattern) {
    return false;
  }

  if (pattern.test(window.location.pathname)) {
    return true;
  }

  return CONTENT_DETECT_PLATFORMS.has(platform) &&
    NotebookToolsExtractors.pageHasContent(platform, { specificOnly: true });
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

async function openPanel(wrapper) {
  const button = wrapper.querySelector("button");
  const platform = currentPlatform;
  let extracted;

  if (wrapper.classList.contains("is-loading")) {
    return;
  }

  wrapper.classList.add("is-loading");
  button?.setAttribute("aria-busy", "true");

  try {
    extracted = await NotebookToolsExtractors.extractForPlatform(platform);
  } catch (error) {
    window.alert(error.message || "Nothing to import on this page yet.");
    return;
  } finally {
    wrapper.classList.remove("is-loading");
    button?.removeAttribute("aria-busy");
  }

  if (!wrapper.isConnected || platform !== currentPlatform) {
    return;
  }

  cacheImportPayload(extracted);

  const dropdown = getDropdown();
  dropdown.replaceChildren();
  dropdown.classList.toggle("notebooktools-platform-theme-dark", isDarkTheme());

  const panel = document.createElement("iframe");
  const frameUrl = new URL(chrome.runtime.getURL("platform-import.html"));
  frameUrl.searchParams.set("platform", platform);

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
  const markImg = document.createElement("img");
  markImg.src = chrome.runtime.getURL("icons/icon16.png");
  markImg.alt = "";
  markImg.width = 16;
  markImg.height = 16;
  mark.append(markImg);
  text.className = "notebooktools-platform-text";
  text.textContent = "NotebookLM";

  button.type = "button";
  button.title = CONVERSATION_PLATFORMS.has(currentPlatform)
    ? "Import this conversation to NotebookLM"
    : "Import this page to NotebookLM";
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

function mountFloatingButton(button) {
  button.classList.add("notebooktools-platform-floating");
  button.classList.toggle("notebooktools-platform-float-bottom", FLOAT_BOTTOM_PLATFORMS.has(currentPlatform));
  document.body.append(button);
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

  if (BAR_FALLBACK_PLATFORMS.has(currentPlatform)) {
    mountFloatingBar(button);
    return;
  }

  mountFloatingButton(button);
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
