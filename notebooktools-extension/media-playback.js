const NotebookToolsMediaPlayback = (() => {
  function uniqueUrls(urls) {
    const seen = new Set();
    const result = [];

    for (const url of urls) {
      if (typeof url !== "string" || !/^https?:\/\//i.test(url) || seen.has(url)) {
        continue;
      }

      seen.add(url);
      result.push(url);
    }

    return result;
  }

  function needsAuthenticatedFetch(url) {
    return /googleusercontent\.com|googleapis\.com|gstatic\.com/i.test(url);
  }

  async function fetchArrayBuffer(url) {
    const response = await fetch(url, {
      credentials: "include",
      mode: "cors",
      referrer: "https://notebook.google.com/",
      referrerPolicy: "strict-origin-when-cross-origin"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const type = response.headers.get("content-type") || "audio/mpeg";

    return { buffer, type };
  }

  async function fetchViaBackground(url) {
    if (!chrome?.runtime?.sendMessage) {
      throw new Error("Background fetch unavailable");
    }

    const response = await chrome.runtime.sendMessage({
      type: "notebooktools-fetch-media",
      url
    });

    if (!response?.ok || !Array.isArray(response.buffer)) {
      throw new Error(response?.error || "Background fetch failed");
    }

    return {
      buffer: Uint8Array.from(response.buffer).buffer,
      type: response.type || "audio/mpeg"
    };
  }

  async function resolveBlobUrl(mediaUrl, { downloadUrl = "" } = {}) {
    const candidates = uniqueUrls([downloadUrl, mediaUrl]);

    for (const url of candidates) {
      const attempts = needsAuthenticatedFetch(url)
        ? [fetchArrayBuffer, fetchViaBackground]
        : [fetchArrayBuffer];

      for (const attempt of attempts) {
        try {
          const { buffer, type } = await attempt(url);
          const blob = new Blob([buffer], { type });
          return URL.createObjectURL(blob);
        } catch (_error) {
          // Try next method / URL.
        }
      }
    }

    return "";
  }

  return {
    resolveBlobUrl,
    needsAuthenticatedFetch
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsMediaPlayback = NotebookToolsMediaPlayback;
}
