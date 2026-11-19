/* Welcome checklist: ticks steps as the user finishes them.
   1. Pin: read from chrome.action.getUserSettings() (or marked by hand).
   2. NotebookLM: ticks when the user opens NotebookLM from here (or marks it).
   3. First import: ticks when notebooktoolsImportCount (stats.js) is above 0. */
(() => {
  const STEPS_KEY = "notebooktoolsWelcomeSteps";
  const IMPORT_KEY = window.NotebookToolsStats?.KEYS.imports || "notebooktoolsImportCount";

  const stepEls = {
    pin: document.querySelector("#stepPin"),
    signin: document.querySelector("#stepSignIn"),
    import: document.querySelector("#stepImport"),
  };
  const progressEl = document.querySelector("#welcomeProgress");

  let manual = {};
  let pinned = false;
  let imports = 0;

  function render() {
    const done = {
      pin: pinned || manual.pin === true,
      signin: manual.signin === true,
      import: imports > 0,
    };

    Object.entries(stepEls).forEach(([key, el]) => el?.classList.toggle("is-done", done[key]));

    const count = Object.values(done).filter(Boolean).length;
    if (progressEl) {
      progressEl.textContent = count === 3
        ? "All set. You're ready to import anything into NotebookLM."
        : `${count} of 3 steps done.`;
    }
  }

  async function readPinned() {
    try {
      const settings = await chrome.action?.getUserSettings?.();
      pinned = settings?.isOnToolbar === true;
    } catch (_error) {
      pinned = false;
    }
  }

  async function load() {
    try {
      const items = await chrome.storage.local.get([STEPS_KEY, IMPORT_KEY]);
      manual = items[STEPS_KEY] || {};
      imports = Number(items[IMPORT_KEY]) || 0;
    } catch (_error) {
      // Render with defaults.
    }
    await readPinned();
    render();
  }

  function markManual(key, value) {
    manual = { ...manual, [key]: value };
    render();
    chrome.storage.local.set({ [STEPS_KEY]: manual }).catch(() => {});
  }

  document.querySelectorAll("[data-manual]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-manual");
      markManual(key, manual[key] !== true);
    });
  });

  document.querySelector("#openNotebookLm")?.addEventListener("click", () => markManual("signin", true));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[IMPORT_KEY]) imports = Number(changes[IMPORT_KEY].newValue) || 0;
    if (changes[STEPS_KEY]) manual = changes[STEPS_KEY].newValue || {};
    if (changes[IMPORT_KEY] || changes[STEPS_KEY]) render();
  });

  // Pinning happens in Chrome's toolbar, so re-check when the user comes back to this tab.
  const recheckPin = () => readPinned().then(render);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void recheckPin();
  });
  window.addEventListener("focus", () => void recheckPin());
  window.setInterval(() => {
    if (!pinned && document.visibilityState === "visible") void recheckPin();
  }, 3000);

  void load();
})();
