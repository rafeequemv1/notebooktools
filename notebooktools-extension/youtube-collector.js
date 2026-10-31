async function collectYouTubePageInTab() {
  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getVideoId(href) {
    try {
      const url = new URL(String(href || ""), location.href);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();

      if (host === "youtu.be") {
        return (url.pathname.split("/").filter(Boolean)[0] || "").slice(0, 11);
      }

      if (url.pathname === "/watch") {
        return (url.searchParams.get("v") || "").slice(0, 11);
      }

      const match = url.pathname.match(/^\/(?:shorts|embed|v)\/([^/?#]+)/i);
      return (match?.[1] || "").slice(0, 11);
    } catch (_error) {
      return "";
    }
  }

  function getInitialData() {
    if (window.ytInitialData) {
      return window.ytInitialData;
    }

    try {
      const raw = document.querySelector("script#ytInitialData")?.textContent;
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function getYtClientContext() {
    const data = window.ytcfg?.data_ || {};
    const apiKey = data.INNERTUBE_API_KEY || "";

    if (!apiKey) {
      return { apiKey: "", context: null };
    }

    return {
      apiKey,
      context: data.INNERTUBE_CONTEXT || {
        client: {
          clientName: data.INNERTUBE_CLIENT_NAME || "WEB",
          clientVersion: data.INNERTUBE_CLIENT_VERSION || "2.20240101.00.00",
          originalUrl: location.href,
          hl: data.LANGUAGE || "en",
          gl: data.GL || "US"
        }
      }
    };
  }

  function detectCollectionType() {
    const url = new URL(location.href);
    const listId = url.searchParams.get("list");

    if (url.pathname === "/playlist" && listId) {
      return "playlist";
    }

    if (/\/videos\/?$/.test(url.pathname)) {
      return "channel";
    }

    if (/^\/@[^/]+\/?$/.test(url.pathname)) {
      return "channel";
    }

    if (url.pathname.startsWith("/channel/") && !url.pathname.includes("/watch")) {
      return "channel";
    }

    if (listId && url.pathname === "/watch") {
      return "playlist";
    }

    return "unknown";
  }

  function readTextNode(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return cleanText(value);
    }

    if (value.simpleText) {
      return cleanText(value.simpleText);
    }

    if (Array.isArray(value.runs)) {
      return cleanText(value.runs.map((run) => run.text || "").join(""));
    }

    return "";
  }

  function readMetadataTitle(data, collectionType) {
    const sidebarTitle = readTextNode(
      data?.sidebar?.playlistSidebarRenderer?.title ||
        data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer?.title
    );
    const playlistTitle = readTextNode(data?.metadata?.playlistMetadataRenderer?.title) || sidebarTitle;
    const channelTitle = readTextNode(data?.metadata?.channelMetadataRenderer?.title);

    if (collectionType === "playlist" && playlistTitle) {
      return playlistTitle;
    }

    if (channelTitle) {
      return channelTitle;
    }

    if (playlistTitle) {
      return playlistTitle;
    }

    const domPlaylistTitle = cleanText(
      document.querySelector("ytd-playlist-panel-renderer #title")?.textContent ||
        document.querySelector("ytd-playlist-header-renderer #title")?.textContent ||
        document.querySelector("h3.ytd-playlist-panel-renderer")?.textContent ||
        ""
    );

    if (domPlaylistTitle) {
      return domPlaylistTitle;
    }

    return cleanText(document.title.replace(/\s*-\s*YouTube$/i, ""));
  }

  function suggestNotebookName(collectionType, title) {
    const cleaned = cleanText(title)
      .replace(/\s*-\s*YouTube$/i, "")
      .replace(/\s*-\s*Videos$/i, "")
      .replace(/\s*-\s*Playlists$/i, "");

    if (!cleaned) {
      return collectionType === "playlist" ? "YouTube playlist" : "YouTube channel";
    }

    if (collectionType === "channel" && !/videos$/i.test(cleaned)) {
      return `${cleaned} videos`.slice(0, 80);
    }

    return cleaned.slice(0, 80);
  }

  function addVideo(videos, videoId, title) {
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return;
    }

    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

    if (!videos.has(url)) {
      videos.set(url, {
        url,
        title: cleanText(title) || url
      });
    }
  }

  function harvestRendererVideo(renderer, videos) {
    if (!renderer?.videoId) {
      return;
    }

    const title =
      readTextNode(renderer.title) ||
      readTextNode(renderer.headline) ||
      readTextNode(renderer.shortBylineText);

    addVideo(videos, renderer.videoId, title);
  }

  function harvestDomVideos(videos) {
    const hostSelectors = [
      "ytd-playlist-panel-video-renderer",
      "ytd-playlist-video-renderer",
      "ytd-rich-item-renderer",
      "ytd-grid-video-renderer",
      "ytd-video-renderer"
    ];

    for (const hostSelector of hostSelectors) {
      for (const host of document.querySelectorAll(hostSelector)) {
        const titleLink =
          host.querySelector("a#video-title") ||
          host.querySelector("a#video-title-link") ||
          host.querySelector("#video-title");
        const thumbLink = host.querySelector("a#thumbnail") || host.querySelector("#thumbnail");

        for (const link of [titleLink, thumbLink]) {
          if (!link) {
            continue;
          }

          const href = link.href || link.getAttribute("href") || "";
          const videoId = getVideoId(href);

          if (!videoId) {
            continue;
          }

          addVideo(videos, videoId, link.textContent || link.getAttribute("title") || "");
        }
      }
    }
  }

  function collectContinuations(node, tokens) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        collectContinuations(entry, tokens);
      }
      return;
    }

    const token =
      node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
      node.continuationEndpoint?.continuationCommand?.token ||
      node.continuationCommand?.token;

    if (token) {
      tokens.add(token);
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        collectContinuations(value, tokens);
      }
    }
  }

  function harvestInitialDataVideos(data, videos) {
    function visit(node) {
      if (!node || typeof node !== "object") {
        return;
      }

      if (Array.isArray(node)) {
        for (const entry of node) {
          visit(entry);
        }
        return;
      }

      harvestRendererVideo(node.playlistPanelVideoRenderer, videos);
      harvestRendererVideo(node.playlistVideoRenderer, videos);
      harvestRendererVideo(node.gridVideoRenderer, videos);
      harvestRendererVideo(node.richItemRenderer?.content?.videoRenderer, videos);
      harvestRendererVideo(node.videoRenderer, videos);

      for (const value of Object.values(node)) {
        if (value && typeof value === "object") {
          visit(value);
        }
      }
    }

    visit(data?.sidebar?.playlistSidebarRenderer?.items);
    visit(data?.engagementPanels);
    visit(data?.contents);
    visit(data);
  }

  function getPlaylistScrollContainer() {
    return (
      document.querySelector("#playlist-items") ||
      document.querySelector("ytd-playlist-panel-renderer #items") ||
      document.querySelector("ytd-playlist-panel-renderer #scroll-container") ||
      document.querySelector("ytd-playlist-video-list-renderer #container") ||
      null
    );
  }

  async function autoScrollPlaylistPanel(videos, maxVideos) {
    const container = getPlaylistScrollContainer();

    if (!container) {
      return false;
    }

    let stablePasses = 0;
    let previousCount = videos.size;

    for (let pass = 0; pass < 24 && videos.size < maxVideos; pass += 1) {
      container.scrollTop = container.scrollHeight;
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      harvestDomVideos(videos);

      if (videos.size >= maxVideos) {
        break;
      }

      if (videos.size === previousCount) {
        stablePasses += 1;
      } else {
        stablePasses = 0;
        previousCount = videos.size;
      }

      if (stablePasses >= 3) {
        break;
      }
    }

    return true;
  }

  async function autoScrollPage(videos, maxVideos) {
    let stablePasses = 0;
    let previousCount = videos.size;

    for (let pass = 0; pass < 16 && videos.size < maxVideos; pass += 1) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      harvestDomVideos(videos);

      if (videos.size >= maxVideos) {
        break;
      }

      if (videos.size === previousCount) {
        stablePasses += 1;
      } else {
        stablePasses = 0;
        previousCount = videos.size;
      }

      if (stablePasses >= 2) {
        break;
      }
    }

    window.scrollTo(0, 0);
  }

  function harvestContinuationItems(payload, videos) {
    function visit(node) {
      if (!node || typeof node !== "object") {
        return;
      }

      if (Array.isArray(node)) {
        for (const entry of node) {
          visit(entry);
        }
        return;
      }

      harvestRendererVideo(node.playlistPanelVideoRenderer, videos);
      harvestRendererVideo(node.playlistVideoRenderer, videos);

      for (const value of Object.values(node)) {
        if (value && typeof value === "object") {
          visit(value);
        }
      }
    }

    visit(payload?.onResponseReceivedActions);
    visit(payload?.continuationContents);
    visit(payload);
  }

  async function fetchContinuations(data, videos, maxVideos) {
    const { apiKey, context } = getYtClientContext();

    if (!apiKey || !context) {
      return;
    }

    const tokens = new Set();
    collectContinuations(data?.sidebar?.playlistSidebarRenderer, tokens);
    collectContinuations(data?.contents, tokens);

    const seenTokens = new Set();

    while (tokens.size && videos.size < maxVideos) {
      const token = [...tokens].find((entry) => !seenTokens.has(entry));

      if (!token) {
        break;
      }

      seenTokens.add(token);
      tokens.delete(token);

      try {
        const response = await fetch(
          `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              context,
              continuation: token
            })
          }
        );

        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        const before = videos.size;
        harvestContinuationItems(payload, videos);
        collectContinuations(payload, tokens);

        if (videos.size === before && !tokens.size) {
          break;
        }
      } catch (_error) {
        break;
      }
    }
  }

  async function openPlaylistPanelIfNeeded() {
    const showButton = document.querySelector(
      "ytd-watch-metadata ytd-button-renderer button[aria-label*='playlist' i], " +
        "button[aria-label*='Show playlist' i], " +
        "#playlist-action-button button"
    );

    if (showButton && !getPlaylistScrollContainer()) {
      showButton.click();
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
  }

  const collectionType = detectCollectionType();
  const pageUrl = new URL(location.href);
  const listId = pageUrl.searchParams.get("list");
  const initialData = getInitialData();
  const title = readMetadataTitle(initialData, collectionType);
  const videos = new Map();

  if (collectionType === "playlist" && listId && pageUrl.pathname === "/watch") {
    await openPlaylistPanelIfNeeded();
  }

  harvestDomVideos(videos);
  harvestInitialDataVideos(initialData, videos);

  if (collectionType === "playlist") {
    const scrolledPanel = await autoScrollPlaylistPanel(videos, 120);

    if (!scrolledPanel) {
      await autoScrollPage(videos, 120);
    }

    await fetchContinuations(initialData, videos, 120);
  } else {
    await autoScrollPage(videos, 120);
  }

  if (!videos.size && collectionType === "playlist" && listId) {
    const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;

    if (location.href !== playlistUrl) {
      return {
        type: collectionType,
        title,
        notebookName: suggestNotebookName(collectionType, title),
        pageUrl: location.href,
        playlistUrl,
        videos: [],
        needsPlaylistPage: true
      };
    }
  }

  return {
    type: collectionType,
    title,
    notebookName: suggestNotebookName(collectionType, title),
    pageUrl: location.href,
    playlistUrl: listId
      ? `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`
      : "",
    videos: [...videos.values()]
  };
}

const NotebookToolsYouTubeCollector = {
  async collectFromTab(tabId) {
    if (!tabId) {
      throw new Error("No active YouTube tab found.");
    }

    let [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectYouTubePageInTab
    });

    let result = injection?.result || null;

    if (result?.needsPlaylistPage && result.playlistUrl) {
      const created = await chrome.tabs.create({ url: result.playlistUrl, active: false });

      try {
        await this.waitForTabLoad(created.id);
        [injection] = await chrome.scripting.executeScript({
          target: { tabId: created.id },
          func: collectYouTubePageInTab
        });
        result = injection?.result || null;
      } finally {
        if (created.id) {
          await chrome.tabs.remove(created.id).catch(() => {});
        }
      }
    }

    return result;
  },

  waitForTabLoad(tabId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();

      function check() {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (tab.status === "complete") {
            window.setTimeout(resolve, 800);
            return;
          }

          if (Date.now() - started > timeoutMs) {
            reject(new Error("Timed out loading YouTube playlist."));
            return;
          }

          window.setTimeout(check, 250);
        });
      }

      check();
    });
  },

  async collectFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return this.collectFromTab(tab?.id);
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsYouTubeCollector = NotebookToolsYouTubeCollector;
}
