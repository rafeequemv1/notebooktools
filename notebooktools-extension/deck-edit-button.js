/* ==========================================================================
   "Edit slides" right on an open slide deck in Gemini Notebook.

   Found by what the person sees, never by Google's class names: the open
   deck's "View prompt and N sources" button, the panel round it, and the
   deck's ⋮ (More options) button. The Edit slides button goes in the deck's
   own row of icons, just before ⋮, and shows as soon as a deck is open.
   Which deck it is comes from the notebook's Studio list (matched by title);
   if that list can't be read, the button still shows on a panel of slides.

   It also answers "ntde-download-deck": open the deck's ⋮ menu and choose
   Download → PDF, so NotebookLM itself downloads the deck with the page's
   own sign-in (the editor's fallback when a direct download is refused).
   ========================================================================== */
(function () {
  "use strict";

  if (window.__ntDeckEditButton) return;
  window.__ntDeckEditButton = true;

  const BTN_CLASS = "ntde-btn";
  const CHIP_TEXT = /^\s*view prompt and \d+ sources?/i;
  const MORE_TEXT = /^(more|more options|more actions|options)$/i;
  const CACHE_MS = 60000;
  const RETRY_MS = 15000;

  let decks = { notebookId: "", list: [], at: 0, loading: null, failed: false };
  let lastMiss = 0;
  let timer = 0;

  const visible = (el) => !!el && el.getClientRects().length > 0;
  const label = (el) => ((el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("mattooltip"))) || el.textContent || "").trim();

  function notebookId() {
    return location.pathname.match(/\/notebook\/([^/?#]+)/i)?.[1] || "";
  }

  function norm(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isDarkPage() {
    for (const node of [document.body, document.documentElement]) {
      const m = getComputedStyle(node).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const [r, g, b, a = 1] = m[1].split(",").map(parseFloat);
      if (a === 0) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  /* ---------- The notebook's Studio items (to know which deck is open) ---------- */
  async function loadItems(force = false) {
    const id = notebookId();
    if (!id || !window.NotebookToolsNotebookLM?.listNotebookLmArtifacts) return [];
    const fresh = decks.notebookId === id && Date.now() - decks.at < CACHE_MS;
    if (fresh && !force) return decks.list;
    if (decks.loading && decks.notebookId === id) return decks.loading;
    decks.notebookId = id;
    decks.loading = window.NotebookToolsNotebookLM.listNotebookLmArtifacts(id)
      .then((list) => ({ list, failed: false }))
      .catch(() => ({ list: [], failed: true }))
      .then(({ list, failed }) => {
        decks = { notebookId: id, list, at: Date.now(), loading: null, failed };
        return list;
      });
    return decks.loading;
  }

  /* ---------- Finding the open deck on the page ---------- */
  /** Every open deck view: { chip, panel, more, title }. */
  function openDecks() {
    const chips = [...document.querySelectorAll("button, a, [role='button']")]
      .filter((b) => visible(b) && !b.closest(`.${BTN_CLASS}`) && CHIP_TEXT.test(label(b)));
    const views = [];
    for (const chip of chips) {
      let panel = chip.parentElement;
      for (let i = 0; panel && i < 6; i += 1, panel = panel.parentElement) {
        if (chips.some((other) => other !== chip && panel.contains(other))) break;
        const more = [...panel.querySelectorAll("button, [role='button']")]
          .find((b) => b !== chip && visible(b) && MORE_TEXT.test(label(b)));
        if (more) {
          views.push({ chip, panel, more, title: deckTitle(panel, chip) });
          break;
        }
      }
    }
    return views;
  }

  /** The title shown above the chip: a heading, else the text just before it. */
  function deckTitle(panel, chip) {
    const heading = panel.querySelector("h1, h2, h3, [role='heading']");
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    const range = document.createRange();
    range.setStart(panel, 0);
    range.setEndBefore(chip);
    const lines = range.toString().split("\n").map((s) => s.trim()).filter(Boolean);
    return lines[lines.length - 1] || "Slide deck";
  }

  /** Slides show as large pictures; reports and audio don't. */
  function showsSlides(panel) {
    return [...panel.querySelectorAll("img, canvas")].some((el) => (el.alt || "").length > 15 || el.naturalWidth > 600 || el.width > 600 || el.getBoundingClientRect().width > 280);
  }

  function itemFor(view, list) {
    const title = norm(view.title);
    const byLength = [...list].sort((a, b) => b.title.length - a.title.length);
    return byLength.find((a) => norm(a.title) === title) || byLength.find((a) => a.title && title.includes(norm(a.title))) || null;
  }

  /* ---------- The button ---------- */
  function makeButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BTN_CLASS;
    button.title = "Edit text, move pictures and download PowerPoint (NotebookTools)";
    button.setAttribute("aria-label", "Edit slides with NotebookTools");
    button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/><path d="m9.5 13.5 4.8-4.8 1.6 1.6-4.8 4.8H9.5z"/></svg><span>Edit slides</span>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const authUser = window.NotebookToolsNotebookLM?.currentPageAuthUser?.() ?? new URLSearchParams(location.search).get("authuser");
      const labelEl = button.querySelector("span");
      try {
        chrome.runtime.sendMessage({
          type: "notebooktools-open-slide-editor",
          notebookId: notebookId(),
          artifactId: button.dataset.artifact || "",
          title: button.dataset.title || "Slide deck",
          authUser
        });
        labelEl.textContent = "Opening…";
        window.setTimeout(() => { labelEl.textContent = "Edit slides"; }, 2500);
      } catch (_error) {
        // The extension was reloaded: this page needs a refresh to talk to it again
        labelEl.textContent = "Reload page to edit";
      }
    });
    return button;
  }

  async function scan() {
    if (!notebookId()) return;
    const views = openDecks();
    if (!views.length) return;
    let list = await loadItems();
    for (const view of views) {
      let item = itemFor(view, list);
      if (!item && !decks.failed && Date.now() - lastMiss > RETRY_MS) {
        lastMiss = Date.now(); // something just generated isn't in the cached list yet
        list = await loadItems(true);
        item = itemFor(view, list);
      }
      const isDeck = item ? item.typeCode === 8 : showsSlides(view.panel);
      const existing = view.panel.querySelector(`.${BTN_CLASS}`);
      if (!isDeck) {
        existing?.remove(); // an audio overview, report or other non-deck item
        continue;
      }
      const button = existing || makeButton();
      button.dataset.artifact = item?.id || "";
      button.dataset.title = item?.title || view.title;
      button.classList.toggle("is-dark", isDarkPage());
      // In the deck's row of icons, just before ⋮ (where it stays visible)
      if (button.nextElementSibling !== view.more || button.parentElement !== view.more.parentElement) {
        try {
          view.more.parentElement.insertBefore(button, view.more);
          button.classList.add("is-top");
        } catch (_error) {
          view.chip.insertAdjacentElement("afterend", button);
        }
      }
    }
  }

  /* ---------- Download through NotebookLM's own menu ---------- */
  function waitFor(fn, ms) {
    return new Promise((resolve) => {
      const end = Date.now() + ms;
      const tick = () => {
        const value = fn();
        if (value) resolve(value);
        else if (Date.now() > end) resolve(null);
        else setTimeout(tick, 80);
      };
      tick();
    });
  }

  /** The deck's ⋮ menu, then Download (PDF when it asks which). True when a download was asked for. */
  async function downloadDeck(title) {
    const views = openDecks();
    const view = views.find((v) => title && norm(v.title) === norm(title)) || views[0];
    if (!view) return { ok: false, error: "Open the slide deck in NotebookLM (click it in Studio), then try again." };
    const before = new Set(document.querySelectorAll("[role='menu'], [role='menuitem']"));
    view.more.click();
    const items = await waitFor(() => {
      const found = [...document.querySelectorAll("[role='menuitem'], [role='menu'] button, .mat-mdc-menu-item")].filter((m) => visible(m) && !before.has(m));
      return found.length ? found : null;
    }, 2500);
    if (!items) return { ok: false, error: "NotebookLM's menu didn't open." };
    const pdf = items.find((m) => /download/i.test(label(m)) && /pdf/i.test(label(m)));
    const download = pdf || items.find((m) => /download/i.test(label(m)));
    if (!download) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { ok: false, error: "This deck's menu has no Download." };
    }
    download.click();
    // Download with a choice of kinds (PDF, PowerPoint): the PDF
    const sub = await waitFor(() => [...document.querySelectorAll("[role='menuitem'], [role='menu'] button")].find((m) => visible(m) && m !== download && /pdf/i.test(label(m))) || null, 1200);
    if (sub) sub.click();
    return { ok: true, title: view.title };
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "ntde-download-deck") return false;
      downloadDeck(message.title).then(sendResponse, (error) => sendResponse({ ok: false, error: String(error?.message || error) }));
      return true;
    });
  } catch (_error) {
    /* not running as an extension content script (tests) */
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void scan(), 300);
  }

  new MutationObserver((mutations) => {
    // Ignore our own insertions
    if (mutations.every((m) => [...m.addedNodes].every((n) => n.nodeType === 1 && n.classList?.contains(BTN_CLASS)))) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  window.NotebookToolsDeckEditButton = { scan, openDecks, downloadDeck };
})();
