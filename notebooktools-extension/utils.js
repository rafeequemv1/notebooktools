function cleanNotebookName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeYouTubeVideoUrl(value) {
  let url;

  try {
    const base =
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : "https://www.youtube.com/";
    url = new URL(String(value || ""), base);
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

function classifyYouTubeBatchUrl(value) {
  let url;

  try {
    url = new URL(String(value || ""));
  } catch (_error) {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (!["youtube.com", "m.youtube.com", "www.youtube.com"].includes(host)) {
    return null;
  }

  const listId = url.searchParams.get("list");

  if (url.pathname === "/playlist" && listId) {
    return { type: "playlist", url: url.href, listId };
  }

  if (/\/videos\/?$/.test(url.pathname)) {
    return { type: "channel", url: url.href };
  }

  if (/^\/@[^/]+\/?$/.test(url.pathname)) {
    return { type: "channel", url: url.href };
  }

  if (url.pathname.startsWith("/channel/") && !url.pathname.includes("/watch")) {
    return { type: "channel", url: url.href };
  }

  if (listId && url.pathname === "/watch") {
    return { type: "playlist", url: url.href, listId };
  }

  return null;
}

function isYouTubeBatchUrl(value) {
  return Boolean(classifyYouTubeBatchUrl(value));
}

function suggestBatchNotebookName(collection) {
  const collectionType = collection?.type || "playlist";
  const title = cleanNotebookName(collection?.notebookName || collection?.title || "");

  if (title) {
    return title.slice(0, 80);
  }

  return collectionType === "channel" ? "YouTube channel videos" : "YouTube playlist";
}

function chunkItems(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
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

  url.hash = "";
  return url.href;
}

function classifyImportUrl(value) {
  const youtubeUrl = normalizeYouTubeVideoUrl(value);

  if (youtubeUrl) {
    return { type: "youtube", url: youtubeUrl };
  }

  const webpageUrl = normalizeWebpageUrl(value);

  if (webpageUrl) {
    return { type: "webpage", url: webpageUrl };
  }

  return null;
}

function parseLinkList(text) {
  const raw = String(text || "");
  const parts = raw.split(/[\n,]+/);
  const results = [];
  const seen = new Set();

  for (const part of parts) {
    const candidate = part.trim();

    if (!candidate) {
      continue;
    }

    let value = candidate;

    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value}`;
    }

    const classified = classifyImportUrl(value);

    if (!classified || seen.has(classified.url)) {
      continue;
    }

    seen.add(classified.url);
    results.push(classified);
  }

  return results;
}

function queueItemKey(item) {
  return `${item.type}:${item.url}`;
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

function notebookArtifactUrl(notebookId, artifactId, authUser) {
  const url = new URL(
    `https://notebooklm.google.com/notebook/${encodeURIComponent(String(notebookId || "").trim())}`
  );
  const targetArtifactId = String(artifactId || "").trim();

  if (targetArtifactId) {
    url.searchParams.set("artifactId", targetArtifactId);
  }

  const parsedAuthUser = Number(authUser);

  if (Number.isInteger(parsedAuthUser) && parsedAuthUser >= 0 && String(authUser) !== "default") {
    url.searchParams.set("authuser", String(parsedAuthUser));
  }

  return url.toString();
}

function setImportButtonState(button, isLoading, idleLabel = "Import") {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  button.textContent = isLoading ? "Adding..." : idleLabel;
}

if (typeof window !== "undefined") {
  window.NotebookToolsStore = {
    cleanNotebookName,
    normalizeYouTubeVideoUrl,
    normalizeWebpageUrl,
    isYouTubeUrl,
    classifyYouTubeBatchUrl,
    isYouTubeBatchUrl,
    suggestBatchNotebookName,
    chunkItems,
    classifyImportUrl,
    parseLinkList,
    queueItemKey,
    escapeHtml,
    notebookArtifactUrl
  };

  window.NotebookToolsUI = {
    setImportStatus,
    setImportButtonState
  };
}
