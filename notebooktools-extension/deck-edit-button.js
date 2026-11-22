/* ==========================================================================
   "Edit slides" right on an open slide deck in Gemini Notebook.

   NotebookLM shows an open deck twice over: in the Studio panel and in the
   full-screen viewer. Both put a "View prompt and N sources" button under
   the deck's title. We add an Edit slides button next to it, find which
   deck is open by matching that title against the notebook's slide decks,
   and open it in the NotebookTools slide editor (editable text, movable
   pictures, PowerPoint download).
   ========================================================================== */
(function () {
  "use strict";

  const BTN_CLASS = "ntde-btn";
  const CHIP_TEXT = /^\s*view prompt\b/i;
  const CACHE_MS = 60000;
  const RETRY_MS = 15000;

  let decks = { notebookId: "", list: [], at: 0, loading: null };
  let lastMiss = 0;
  let timer = 0;

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

  /** Every Studio item of this notebook, cached for a minute (non-decks too,
   *  so an open audio overview is recognised without asking again). */
  async function loadDecks(force = false) {
    const id = notebookId();
    if (!id || !window.NotebookToolsNotebookLM?.listNotebookLmArtifacts) return [];
    const fresh = decks.notebookId === id && Date.now() - decks.at < CACHE_MS;
    if (fresh && !force) return decks.list;
    if (decks.loading && decks.notebookId === id) return decks.loading;
    decks.notebookId = id;
    decks.loading = window.NotebookToolsNotebookLM.listNotebookLmArtifacts(id)
      .catch(() => [])
      .then((list) => {
        decks = { notebookId: id, list, at: Date.now(), loading: null };
        return list;
      });
    return decks.loading;
  }

  /** Text inside `container` that comes before `el` (the header above the chip). */
  function textBefore(container, el) {
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEndBefore(el);
    return norm(range.toString()).slice(-300);
  }

  /** The Studio item whose title sits just above this chip, in the same view. */
  function deckForChip(chip, list, chips) {
    if (!list.length) return null;
    const byLength = [...list].sort((a, b) => b.title.length - a.title.length);
    let node = chip.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      // Stop at a container that also holds another view's chip
      if (chips.some((other) => other !== chip && node.contains(other))) break;
      const text = textBefore(node, chip);
      const hit = byLength.find((deck) => deck.title && text.includes(norm(deck.title)));
      if (hit) return hit;
    }
    return null;
  }

  function findChips() {
    return Array.from(document.querySelectorAll("button, a, [role='button']")).filter((el) => {
      if (el.classList.contains(BTN_CLASS) || el.closest(`.${BTN_CLASS}`)) return false;
      const text = el.textContent || "";
      return text.length < 60 && CHIP_TEXT.test(text) && el.offsetParent !== null;
    });
  }

  function makeButton(deck) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${BTN_CLASS}${isDarkPage() ? " is-dark" : ""}`;
    button.dataset.artifact = deck.id;
    button.title = "Edit text, move pictures and download PowerPoint (NotebookTools)";
    button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/><path d="m9.5 13.5 4.8-4.8 1.6 1.6-4.8 4.8H9.5z"/></svg><span>Edit slides</span>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const authUser = new URLSearchParams(location.search).get("authuser");
      try {
        chrome.runtime.sendMessage({
          type: "notebooktools-open-slide-editor",
          notebookId: notebookId(),
          artifactId: button.dataset.artifact,
          title: button.dataset.title || deck.title,
          authUser
        });
        const label = button.querySelector("span");
        label.textContent = "Opening…";
        window.setTimeout(() => { label.textContent = "Edit slides"; }, 2500);
      } catch (_error) {
        // The extension was reloaded: this page needs a refresh to talk to it again
        button.querySelector("span").textContent = "Reload page to edit";
      }
    });
    button.dataset.title = deck.title;
    return button;
  }

  /**
   * Where the button goes: just left of the deck's first action button
   * (the pencil in the Studio panel, Revise in the full-screen viewer), on
   * the title's line. Found by position, so it works however the page nests
   * its elements. Returns { header, before } or null.
   */
  function actionSlot(chip, chips) {
    const chipTop = chip.getBoundingClientRect().top;
    let header = chip.parentElement;
    for (let depth = 0; header && depth < 7; depth += 1, header = header.parentElement) {
      if (chips.some((other) => other !== chip && header.contains(other))) return null;
      const hr = header.getBoundingClientRect();
      const actions = Array.from(header.querySelectorAll("button, [role='button']")).filter((el) => {
        if (el === chip || el.classList.contains(BTN_CLASS) || el.closest(`.${BTN_CLASS}`) || el.offsetParent === null) return false;
        const r = el.getBoundingClientRect();
        // Above the chip, on the right half of the header
        return r.width > 0 && r.bottom <= chipTop + 4 && r.left > hr.left + hr.width * 0.4;
      });
      if (actions.length >= 2) {
        const first = actions.reduce((a, b) => (b.getBoundingClientRect().left < a.getBoundingClientRect().left ? b : a));
        // Step out of single-child wrappers (tooltip spans and the like)
        let before = first;
        while (before.parentElement && before.parentElement !== header && before.parentElement.children.length === 1) {
          before = before.parentElement;
        }
        return { header, before };
      }
    }
    return null;
  }

  async function scan() {
    if (!notebookId()) return;
    const chips = findChips();
    if (!chips.length) return;
    let list = await loadDecks();
    for (const chip of chips) {
      const slot = actionSlot(chip, chips);
      const scope = slot?.header || chip.parentElement;
      const existing = scope?.querySelector(`.${BTN_CLASS}`);
      let item = deckForChip(chip, list, chips);
      if (!item && Date.now() - lastMiss > RETRY_MS) {
        // Something just generated isn't in the cached list yet
        lastMiss = Date.now();
        list = await loadDecks(true);
        item = deckForChip(chip, list, chips);
      }
      const deck = item && item.typeCode === 8 && (!item.status || item.status === "ready") ? item : null;
      if (!deck) {
        existing?.remove(); // an audio overview, report or other non-deck item
        continue;
      }
      if (existing) {
        existing.dataset.artifact = deck.id;
        existing.dataset.title = deck.title;
        existing.classList.toggle("is-dark", isDarkPage());
        // Move it if it isn't where it belongs (e.g. the page re-rendered)
        if (slot && existing.nextElementSibling !== slot.before) {
          slot.before.insertAdjacentElement("beforebegin", existing);
          existing.classList.add("is-top");
        }
        continue;
      }
      const button = makeButton(deck);
      if (slot) {
        button.classList.add("is-top");
        slot.before.insertAdjacentElement("beforebegin", button);
      } else {
        chip.insertAdjacentElement("afterend", button); // fallback: beside "View prompt"
      }
    }
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

  window.NotebookToolsDeckEditButton = { scan, _deckForChip: deckForChip };
})();
