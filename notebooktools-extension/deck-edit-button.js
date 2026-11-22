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
  function findChips() {
    let chips = [...document.querySelectorAll("button, a, [role='button']")]
      .filter((b) => visible(b) && !b.closest(`.${BTN_CLASS}`) && CHIP_TEXT.test(label(b)));
    if (!chips.length) {
      // Not a real button (a clickable chip made of plain elements): any short text that says it
      chips = [...document.querySelectorAll("span, div, mat-chip, [jsaction]")]
        .filter((el) => el.textContent.length < 60 && CHIP_TEXT.test(el.textContent) && visible(el) && !el.closest(`.${BTN_CLASS}`));
    }
    return chips;
  }

  function openDecks() {
    let chips = findChips();
    // A chip can match twice (a button and an element inside it): keep the outer one
    chips = chips.filter((c) => !chips.some((o) => o !== c && o.contains(c)));
    const views = [];
    for (const chip of chips) {
      let panel = chip.parentElement;
      for (let i = 0; panel && i < 6; i += 1, panel = panel.parentElement) {
        // Stop at a container that holds another deck view's chip
        if (chips.some((other) => other !== chip && panel.contains(other))) break;
        const more = [...panel.querySelectorAll("button, [role='button']")]
          .find((b) => b !== chip && !chip.contains(b) && visible(b) && MORE_TEXT.test(label(b)));
        if (more) {
          if (!views.some((v) => v.panel === panel)) views.push({ chip, panel, more, title: deckTitle(panel, chip) });
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
      const original = labelEl.dataset.text || (labelEl.dataset.text = labelEl.textContent);
      try {
        chrome.runtime.sendMessage({
          type: "notebooktools-open-slide-editor",
          notebookId: notebookId(),
          artifactId: button.dataset.artifact || "",
          title: button.dataset.title || "Slide deck",
          authUser
        });
        labelEl.textContent = "Opening…";
        window.setTimeout(() => { labelEl.textContent = original; }, 2500);
      } catch (_error) {
        // The extension was reloaded: this page needs a refresh to talk to it again
        labelEl.textContent = "Reload page to edit";
      }
    });
    return button;
  }

  let lastLog = "";
  function log(message) {
    if (message === lastLog) return;
    lastLog = message;
    console.debug(`[NotebookTools] Edit slides: ${message}`);
  }

  /** The list if it's ready (or arrives within 0.6 s); otherwise null and a rescan once it's in. */
  async function itemsNow() {
    const id = notebookId();
    if (decks.notebookId === id && Date.now() - decks.at < CACHE_MS) return decks.list;
    const pending = loadItems();
    const quick = await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve(null), 600))]);
    if (quick === null) pending.then(() => schedule());
    return quick;
  }

  async function scan() {
    if (!notebookId()) return;
    const views = openDecks();
    // A deck open but no ⋮ found near it: put the button right after "View prompt"
    const loose = views.length ? [] : findChips().filter((c) => !findChips().some((o) => o !== c && o.contains(c)));
    for (const chip of loose) {
      let panel = chip.parentElement;
      for (let i = 0; panel && i < 4 && norm(panel.textContent).length < 120; i += 1) panel = panel.parentElement;
      views.push({ chip, panel: panel || chip.parentElement, more: null, title: deckTitle(panel || chip.parentElement, chip) });
    }
    let list = await itemsNow();
    if (list) placeRowButtons(list, views);
    if (!views.length) {
      log("no open deck on the page");
      return;
    }
    for (const view of views) {
      let item = list ? itemFor(view, list) : null;
      if (list && !item && !decks.failed && Date.now() - lastMiss > RETRY_MS) {
        lastMiss = Date.now(); // something just generated isn't in the cached list yet
        list = await loadItems(true);
        item = itemFor(view, list);
      }
      // Hide only when the Studio list says it's something else (audio, report…)
      const isDeck = item ? item.typeCode === 8 : true;
      const existing = view.panel.querySelector(`.${BTN_CLASS}`);
      if (!isDeck) {
        existing?.remove();
        log(`"${view.title}" is not a slide deck (Studio type ${item.typeCode})`);
        continue;
      }
      const button = existing || makeButton();
      button.dataset.artifact = item?.id || "";
      button.dataset.title = item?.title || view.title;
      button.classList.toggle("is-dark", isDarkPage());
      // In the deck's row of icons, just before ⋮ (where it stays visible).
      // Only moved when it's missing from that row, so it never fights other
      // add-ons' icons or NotebookLM's own redraws (no flicker).
      if (!view.more) {
        if (!button.isConnected) view.chip.insertAdjacentElement("afterend", button);
      } else if (!button.isConnected || button.parentElement !== view.more.parentElement) {
        try {
          view.more.parentElement.insertBefore(button, view.more);
          placed.set(button, view.more);
          button.classList.add("is-top");
        } catch (_error) {
          view.chip.insertAdjacentElement("afterend", button);
        }
      }
      log(`button on "${button.dataset.title}"${item ? ` (deck ${item.id})` : list ? " (not matched in the Studio list)" : " (Studio list still loading)"}`);
    }
  }

  /* ---------- An Edit button on each slide deck in the Studio list ---------- */
  // A row is the smallest box round the deck's title that holds exactly one
  // ⋮ (More options) button. The open deck's own header is left alone.
  function placeRowButtons(list, views) {
    const deckTitles = new Map(list.filter((a) => a.typeCode === 8 && a.title).map((a) => [norm(a.title), a]));
    if (!deckTitles.size) return;
    const skip = new Set(views.map((v) => v.more).filter(Boolean));
    for (const more of document.querySelectorAll("button, [role='button']")) {
      if (skip.has(more) || !MORE_TEXT.test(label(more)) || !visible(more)) continue;
      if (more.closest("#notebooktools-ribbon, .ntr-menu")) continue;
      let row = null;
      let item = null;
      for (let node = more.parentElement, i = 0; node && i < 6; i += 1, node = node.parentElement) {
        const mores = [...node.querySelectorAll("button, [role='button']")].filter((b) => MORE_TEXT.test(label(b)));
        if (mores.length > 1 || node.textContent.length > 400) break; // climbed past this item
        item = rowDeck(node, deckTitles);
        if (item) { row = node; break; }
      }
      if (!row) continue;
      if (findChips().some((c) => row.contains(c))) continue; // the open deck's header
      // Beside ⋮'s own box (a direct child of the row), never inside it:
      // that box is sized for ⋮ alone, and the button would push ⋮ out of view
      let slot = more;
      while (slot.parentElement && slot.parentElement !== row) slot = slot.parentElement;
      let button = row.querySelector(`.${BTN_CLASS}`);
      if (!button) {
        button = makeButton();
        button.classList.add("is-row");
        button.querySelector("span").textContent = "Edit";
      }
      if (button.nextElementSibling !== slot) {
        slot.parentElement.insertBefore(button, slot);
        placed.set(button, slot);
      }
      button.dataset.artifact = item.id || "";
      button.dataset.title = item.title;
      button.classList.toggle("is-dark", isDarkPage());
    }
  }

  /** The deck whose title is one of this row's own lines of text. */
  function rowDeck(row, deckTitles) {
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (text.parentElement?.closest(`.${BTN_CLASS}`)) continue;
      const hit = deckTitles.get(norm(text.nodeValue));
      if (hit) return hit;
    }
    return null;
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
    // Deck not open: its row in the Studio list has a ⋮ with Download too
    const more = view?.more || studioRowMore(title);
    if (!more) return { ok: false, error: "Couldn't find the deck in NotebookLM. Open it in Studio, then click Edit slides again." };
    const before = new Set(document.querySelectorAll("[role='menu'], [role='menuitem']"));
    more.click();
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
    return { ok: true, title: view?.title || title };
  }

  /** The ⋮ button of the Studio list row titled `title` (the deck's own row, not the open view). */
  function studioRowMore(title) {
    const want = norm(title);
    if (!want) return null;
    for (const more of document.querySelectorAll("button, [role='button']")) {
      if (!MORE_TEXT.test(label(more))) continue;
      let row = more.parentElement;
      for (let i = 0; row && i < 5; i += 1, row = row.parentElement) {
        // Climbed past this item's row: it holds another item's ⋮, or a lot of text
        const mores = [...row.querySelectorAll("button, [role='button']")].filter((b) => MORE_TEXT.test(label(b)));
        if (mores.length > 1 || norm(row.innerText).length > 400) break;
        if (norm(row.innerText).includes(want)) return more;
      }
    }
    return null;
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

  // Where each button belongs (its deck's ⋮), to put it straight back when
  // NotebookLM redraws the header and drops it: done in the observer, before
  // the next paint, so it never visibly disappears (no flicker).
  const placed = new Map();
  let restores = [];

  function restoreDropped(mutations) {
    for (const m of mutations) {
      for (const node of m.removedNodes) {
        if (node.nodeType !== 1) continue;
        const buttons = node.classList?.contains(BTN_CLASS) ? [node] : [...node.querySelectorAll?.(`.${BTN_CLASS}`) || []];
        for (const button of buttons) {
          const more = placed.get(button);
          if (button.isConnected) continue;
          if (!more?.isConnected) {
            placed.delete(button);
            void scan(); // the whole row was rebuilt: place it again right away
            continue;
          }
          // At most 20 a second, in case something keeps removing it
          const now = Date.now();
          restores = restores.filter((t) => now - t < 1000);
          if (restores.length >= 20) continue;
          restores.push(now);
          if (more.parentElement) more.parentElement.insertBefore(button, more);
        }
      }
    }
  }

  new MutationObserver((mutations) => {
    restoreDropped(mutations);
    // Ignore only our own insertions and our label changing; a removal always rescans
    const ours = (m) => m.target.closest?.(`.${BTN_CLASS}`)
      || (m.removedNodes.length === 0 && [...m.addedNodes].every((n) => n.nodeType === 1 && n.classList?.contains(BTN_CLASS)));
    if (mutations.every(ours)) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  window.NotebookToolsDeckEditButton = { scan, openDecks, downloadDeck };
})();
