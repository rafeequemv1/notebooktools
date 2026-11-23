/* ==========================================================================
   Prompts tab of the notebooks dashboard: your own prompts (add, edit,
   rename, delete) and the slide templates. Your prompts appear first in the
   / menu in every NotebookLM chat (notebooklm-prompt-slash.js).
   Exposes window.NotebookToolsPromptsView = { open, close }.
   ========================================================================== */
(function () {
  "use strict";

  let viewEl = null;
  let mounted = false;
  const KEY = "notebooktoolsCustomPrompts";

  async function mount() {
    const root = viewEl.querySelector("#promptsRoot");
    if (!root || typeof NotebookToolsPromptLibraryUI === "undefined") return;
    await NotebookToolsPromptLibraryUI.mount(root);
    mounted = true;
  }

  // A prompt saved from a notebook's ribbon shows up here straight away
  // (unless a prompt is being written or renamed right now).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY] || !viewEl || viewEl.hidden || !mounted) return;
    const busy = viewEl.querySelector("#plMyForm:not([hidden]), #plRenameForm:not([hidden])");
    if (!busy) void mount();
  });

  window.NotebookToolsPromptsView = {
    open() {
      viewEl ||= document.querySelector("#promptsView");
      if (!viewEl) return;
      viewEl.hidden = false;
      if (!mounted) void mount();
    },
    close() {
      (viewEl || document.querySelector("#promptsView"))?.setAttribute("hidden", "");
    }
  };
})();
