const NotebookToolsLinkExtract = (() => {
  const SKIP_PREFIXES = [
    "javascript:",
    "mailto:",
    "tel:",
    "data:",
    "chrome:",
    "chrome-extension:",
    "about:",
    "blob:",
    "file:"
  ];

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function normalizePageLink(href, baseUrl) {
    try {
      return new URL(href, baseUrl).href;
    } catch (_error) {
      return "";
    }
  }

  function shouldSkipUrl(url) {
    const lower = String(url || "").toLowerCase();

    return SKIP_PREFIXES.some((prefix) => lower.startsWith(prefix));
  }

  function uniqueLinks(links) {
    const seen = new Set();
    const results = [];

    for (const link of links) {
      const value = String(link || "").trim();

      if (!value || seen.has(value)) {
        continue;
      }

      seen.add(value);
      results.push(value);
    }

    return results;
  }

  async function extractLinksFromTab(tabId) {
    if (!tabId || !chrome?.scripting?.executeScript) {
      throw new Error("Link extraction is not available.");
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const skip = [
          "javascript:",
          "mailto:",
          "tel:",
          "data:",
          "chrome:",
          "chrome-extension:",
          "about:",
          "blob:",
          "file:"
        ];

        const contentSelectors = [
          "article",
          "main",
          '[role="main"]',
          ".article-body",
          ".article-content",
          ".article__body",
          ".post-content",
          ".entry-content",
          ".story-body",
          ".content-body",
          ".page-content",
          ".main-content",
          "#article-body",
          "#main-content",
          "#content",
          ".prose",
          ".markdown-body"
        ];

        const chromePattern =
          /\b(header|footer|nav|navbar|navigation|menu|sidebar|side-bar|breadcrumb|breadcrumbs|widget|social|share|comment|comments|related|newsletter|subscribe|subscription|promo|promotion|advert|advertisement|ads?-|ad-slot|cookie|consent|modal|popup|toolbar|site-header|site-footer|page-header|page-footer|global-nav|top-bar|bottom-bar|masthead|colophon|skip-link|pagination|pager)\b/i;

        function isHidden(element) {
          if (!element?.getBoundingClientRect) {
            return true;
          }

          const style = window.getComputedStyle(element);

          if (style.display === "none" || style.visibility === "hidden") {
            return true;
          }

          const rect = element.getBoundingClientRect();

          return rect.width <= 0 || rect.height <= 0;
        }

        function matchesChrome(element) {
          if (!element || element === document.documentElement) {
            return false;
          }

          const tag = String(element.tagName || "").toLowerCase();

          if (["header", "footer", "nav", "aside"].includes(tag)) {
            return true;
          }

          const role = String(element.getAttribute("role") || "").toLowerCase();

          if (["banner", "contentinfo", "navigation", "complementary", "search"].includes(role)) {
            return true;
          }

          const hint = `${element.id || ""} ${String(element.className || "")}`.toLowerCase();

          return chromePattern.test(hint);
        }

        function isInsideChrome(element) {
          let node = element;

          while (node && node !== document.body) {
            if (matchesChrome(node)) {
              return true;
            }

            node = node.parentElement;
          }

          return false;
        }

        function scoreContentRoot(element) {
          const text = String(element.innerText || "").replace(/\s+/g, " ").trim();
          const linkCount = element.querySelectorAll("a[href]").length;

          if (text.length < 80 && linkCount === 0) {
            return 0;
          }

          return text.length + linkCount * 40;
        }

        function collectContentRoots() {
          const candidates = [];

          for (const selector of contentSelectors) {
            for (const element of document.querySelectorAll(selector)) {
              if (isHidden(element) || isInsideChrome(element)) {
                continue;
              }

              const score = scoreContentRoot(element);

              if (score > 0) {
                candidates.push({ element, score });
              }
            }
          }

          if (!candidates.length) {
            for (const element of document.querySelectorAll("section, div")) {
              if (isHidden(element) || isInsideChrome(element)) {
                continue;
              }

              const score = scoreContentRoot(element);

              if (score >= 400) {
                candidates.push({ element, score });
              }
            }
          }

          candidates.sort((left, right) => right.score - left.score);

          const roots = candidates.map((entry) => entry.element);
          const deepest = roots.filter(
            (root) => !roots.some((other) => other !== root && root.contains(other))
          );

          if (deepest.length) {
            return deepest.slice(0, 3);
          }

          return [document.body];
        }

        function normalizeHref(anchor) {
          try {
            return new URL(anchor.getAttribute("href") || "", window.location.href).href;
          } catch (_error) {
            return "";
          }
        }

        function shouldKeepLink(href, anchor) {
          if (!href || isInsideChrome(anchor)) {
            return false;
          }

          const lower = href.toLowerCase();

          if (
            !(lower.startsWith("http://") || lower.startsWith("https://")) ||
            skip.some((prefix) => lower.startsWith(prefix))
          ) {
            return false;
          }

          try {
            const parsed = new URL(href);
            const current = new URL(window.location.href);

            if (parsed.origin === current.origin && parsed.pathname === current.pathname && parsed.hash) {
              return false;
            }
          } catch (_error) {
            return false;
          }

          return true;
        }

        const roots = collectContentRoots();
        const seen = new Set();
        const links = [];

        for (const root of roots) {
          for (const anchor of root.querySelectorAll("a[href]")) {
            const href = normalizeHref(anchor);

            if (!shouldKeepLink(href, anchor) || seen.has(href)) {
              continue;
            }

            seen.add(href);
            links.push(href);
          }
        }

        return links;
      }
    });

    return uniqueLinks(result?.result || []);
  }

  function filterImportableLinks(links) {
    const results = [];
    const seen = new Set();

    for (const link of links) {
      const classified = NotebookToolsStore.classifyImportUrl(link);

      if (!classified || seen.has(classified.url)) {
        continue;
      }

      seen.add(classified.url);
      results.push({
        url: classified.url,
        type: classified.type,
        title: classified.url
      });
    }

    return results;
  }

  function linksToText(links) {
    return uniqueLinks(links).join("\n");
  }

  return {
    extractLinksFromTab,
    filterImportableLinks,
    linksToText,
    uniqueLinks
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsLinkExtract = NotebookToolsLinkExtract;
}

if (typeof self !== "undefined") {
  self.NotebookToolsLinkExtract = NotebookToolsLinkExtract;
}
