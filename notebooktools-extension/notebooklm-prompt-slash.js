(function () {
  "use strict";

  const MENU_ID = "notebooktools-prompt-slash-menu";
  const CUSTOM_PROMPTS_KEY = "notebooktoolsCustomPrompts";

  let allPrompts = [];
  let proUnlocked = false;
  const checkPlan = () => window.NotebookToolsPlan?.can("prompt-library").then((ok) => { proUnlocked = ok; });
  checkPlan();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.notebooktoolsAuthProfile || changes.notebooktoolsAuthSession)) checkPlan();
  });
  let activeInput = null;
  let slashContext = null;
  let selectedIndex = 0;
  let menuEl = null;
  let boundInputs = new WeakSet();
  let loadPromise = null;

  function isNotebookPage() {
    return /\/notebook\/[^/?#]+/i.test(location.pathname);
  }

  function findChatInputs() {
    const selectors = [
      "textarea[placeholder*='Ask']",
      "textarea[aria-label='Query box']",
      "textarea[placeholder*='Start typing']",
      "textarea[aria-label*='Query']",
      "textarea.query-box-input"
    ];

    const inputs = new Set();

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => inputs.add(node));
    }

    return [...inputs];
  }

  function builtinPrompts() {
    if (!window.NotebookToolsPromptLibrary?.slideDecks) {
      return [];
    }

    return NotebookToolsPromptLibrary.slideDecks.map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      prompt: prompt.prompt,
      group: "Slide deck styles"
    }));
  }

  async function loadPrompts() {
    if (!loadPromise) {
      loadPromise = (async () => {
        const stored = await chrome.storage.local.get(CUSTOM_PROMPTS_KEY);
        const custom = Array.isArray(stored[CUSTOM_PROMPTS_KEY]) ? stored[CUSTOM_PROMPTS_KEY] : [];

        const customPrompts = custom
          .filter((item) => item && item.prompt)
          .map((item) => ({
            id: item.id || `custom-${item.title}`,
            title: item.title || "Untitled prompt",
            prompt: item.prompt,
            group: "My prompts"
          }));

        allPrompts = [...customPrompts, ...builtinPrompts()];
      })();
    }

    await loadPromise;
    return allPrompts;
  }

  function getSlashContext(input) {
    if (!(input instanceof HTMLTextAreaElement)) {
      return null;
    }

    const value = input.value;
    const pos = input.selectionStart;
    const before = value.slice(0, pos);
    const match = before.match(/(?:^|\s)\/([^\s/]*)$/);

    if (!match) {
      return null;
    }

    return {
      query: match[1].toLowerCase(),
      replaceStart: pos - match[1].length - 1,
      replaceEnd: pos
    };
  }

  function filteredPrompts(query) {
    if (!query) {
      return allPrompts.slice(0, 12);
    }

    return allPrompts
      .filter((item) => {
        const haystack = `${item.title} ${item.group}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 12);
  }

  function ensureMenu() {
    if (menuEl) {
      return menuEl;
    }

    menuEl = document.createElement("div");
    menuEl.id = MENU_ID;
    menuEl.className = "notebooktools-prompt-slash-menu";
    menuEl.hidden = true;
    document.body.append(menuEl);
    return menuEl;
  }

  // One NotebookTools dropdown open at a time: close when another one opens
  document.addEventListener("notebooktools-dropdown-open", (event) => { if (event.detail !== "slash") hideMenu(); });

  function hideMenu() {
    slashContext = null;
    activeInput = null;
    selectedIndex = 0;

    if (menuEl) {
      menuEl.hidden = true;
      menuEl.innerHTML = "";
    }
  }

  // Dark when the NotebookLM page is dark, or the system prefers dark.
  function isDarkTheme() {
    for (const node of [document.body, document.documentElement]) {
      const m = node && getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (!m) continue;
      const [r, g, b, a = 1] = m.map(Number);
      if (Number(a) === 0) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  function positionMenu(input) {
    if (!menuEl || menuEl.hidden) {
      return;
    }

    // Always open above the chat box (it sits at the bottom of the page),
    // using the space between the box and the top of the window.
    const rect = input.getBoundingClientRect();
    const width = Math.min(420, Math.max(260, rect.width));
    menuEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    menuEl.style.top = "auto";
    menuEl.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 10)}px`;
    menuEl.style.width = `${width}px`;
    menuEl.style.maxHeight = `${Math.max(120, Math.min(360, rect.top - 24))}px`;
    menuEl.classList.toggle("is-dark", isDarkTheme());
  }

  function renderMenu(input, context) {
    const items = filteredPrompts(context.query);
    const menu = ensureMenu();

    if (!items.length) {
      hideMenu();
      return;
    }

    if (selectedIndex >= items.length) {
      selectedIndex = 0;
    }

    let lastGroup = "";
    const rows = items
      .map((item, index) => {
        const active = index === selectedIndex ? " is-active" : "";
        const snippet = item.prompt.slice(0, 90) + (item.prompt.length > 90 ? "…" : "");
        const heading = item.group !== lastGroup
          ? `<p class="notebooktools-prompt-slash-group">${escapeHtml(item.group)}</p>`
          : "";
        lastGroup = item.group;

        return `${heading}
          <button type="button" class="notebooktools-prompt-slash-item${active}" data-index="${index}">
            <span class="notebooktools-prompt-slash-title">${escapeHtml(item.title)}</span>
            <span class="notebooktools-prompt-slash-snippet">${escapeHtml(snippet)}</span>
          </button>
        `;
      })
      .join("");

    menu.innerHTML = `
      <div class="notebooktools-prompt-slash-head">
        <span class="notebooktools-prompt-slash-heading">Prompt library</span>
        <span class="notebooktools-prompt-slash-query">${context.query ? `“${escapeHtml(context.query)}”` : "Type to filter"}</span>
      </div>
      <div class="notebooktools-prompt-slash-list">${rows}</div>
      <div class="notebooktools-prompt-slash-foot"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> insert <kbd>Esc</kbd> close</div>`;

    if (menu.hidden) document.dispatchEvent(new CustomEvent("notebooktools-dropdown-open", { detail: "slash" }));
    menu.hidden = false;
    activeInput = input;
    slashContext = context;
    positionMenu(input);
    menu.querySelector(".notebooktools-prompt-slash-item.is-active")?.scrollIntoView({ block: "nearest" });

    menu.querySelectorAll("[data-index]").forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectPrompt(Number(button.dataset.index));
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function selectPrompt(index) {
    // The prompt library is a Pro feature (plan-gate.js); check before inserting.
    if (window.NotebookToolsPlan && !proUnlocked) {
      hideMenu();
      window.NotebookToolsPlan.can("prompt-library").then((ok) => {
        proUnlocked = ok;
        if (!ok) window.NotebookToolsPlan.showUpgrade("prompt-library");
      });
      return;
    }
    const items = filteredPrompts(slashContext?.query || "");

    if (!activeInput || !slashContext || !items[index]) {
      hideMenu();
      return;
    }

    const item = items[index];
    const input = activeInput;
    const value = input.value;
    const nextValue =
      value.slice(0, slashContext.replaceStart) + item.prompt + value.slice(slashContext.replaceEnd);
    const caret = slashContext.replaceStart + item.prompt.length;

    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    input.setSelectionRange(caret, caret);
    hideMenu();
  }

  async function onInput(event) {
    const input = event.target;

    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    await loadPrompts();

    const context = getSlashContext(input);

    if (!context) {
      hideMenu();
      return;
    }

    selectedIndex = 0;
    renderMenu(input, context);
  }

  function onKeyDown(event) {
    if (!menuEl || menuEl.hidden || event.target !== activeInput) {
      return;
    }

    const items = filteredPrompts(slashContext?.query || "");

    if (!items.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      renderMenu(activeInput, slashContext);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      renderMenu(activeInput, slashContext);
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectPrompt(selectedIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      hideMenu();
    }
  }

  function bindInput(input) {
    if (boundInputs.has(input)) {
      return;
    }

    boundInputs.add(input);
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeyDown);
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (!menuEl?.matches(":hover")) {
          hideMenu();
        }
      }, 120);
    });
  }

  function scanInputs() {
    if (!isNotebookPage()) {
      hideMenu();
      return;
    }

    findChatInputs().forEach(bindInput);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[CUSTOM_PROMPTS_KEY]) {
      loadPromise = null;
      void loadPrompts();
    }
  });

  document.addEventListener(
    "mousedown",
    (event) => {
      if (menuEl?.hidden) {
        return;
      }

      if (event.target instanceof Node && menuEl?.contains(event.target)) {
        return;
      }

      hideMenu();
    },
    true
  );

  window.addEventListener("resize", () => {
    if (activeInput) {
      positionMenu(activeInput);
    }
  });

  new MutationObserver(() => {
    scanInputs();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  void loadPrompts();
  scanInputs();
})();
