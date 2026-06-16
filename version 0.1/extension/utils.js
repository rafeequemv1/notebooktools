function cleanNotebookName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

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

function isYouTubeUrl(value) {
  return Boolean(normalizeYouTubeVideoUrl(value));
}

function normalizeWebpageUrl(value) {
  let url;

  try {
    url = new URL(String(value || ""));
  } catch (_error) {
    return "";
  }

  if (!/^https?:$/i.test(url.protocol)) {
    return "";
  }

  if (isYouTubeUrl(url.href)) {
    return "";
  }

  const blockedHosts = new Set([
    "chrome.google.com",
    "chromewebstore.google.com",
    "notebooklm.google.com",
    "newtab"
  ]);

  if (blockedHosts.has(url.hostname.replace(/^www\./, "").toLowerCase())) {
    return "";
  }

  return url.href;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setImportStatus(element, options = {}) {
  if (!element) {
    return;
  }

  const message = String(options.message || "").trim();
  const type = options.type === "error" ? "error" : "success";
  const loading = options.loading === true;
  const done = options.done === true;

  if (!message) {
    element.textContent = "";
    element.className = "status";
    return;
  }

  let iconHtml = "";

  if (loading) {
    iconHtml = '<span class="status-spinner" aria-hidden="true"></span>';
  } else if (done) {
    iconHtml = `<span class="status-icon-check" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 8.5 6.8 11.3 12 5.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  } else if (type === "error") {
    iconHtml = '<span class="status-icon-error" aria-hidden="true">!</span>';
  }

  element.innerHTML = `${iconHtml}<span class="status-text">${escapeHtml(message)}</span>`;

  const classes = ["status", "show"];

  if (loading) {
    classes.push("loading");
  } else if (done) {
    classes.push("success", "done");
  } else {
    classes.push(type);
  }

  element.className = classes.join(" ");
}

function setImportButtonState(button, isLoading, idleLabel = "Import") {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  button.textContent = isLoading ? "Adding..." : idleLabel;
}

window.NotebookToolsStore = {
  cleanNotebookName,
  normalizeYouTubeVideoUrl,
  normalizeWebpageUrl,
  isYouTubeUrl
};

window.NotebookToolsUI = {
  setImportStatus,
  setImportButtonState
};
