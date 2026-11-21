/* ==========================================================================
   Style prompts at the point of use: when NotebookLM opens a Studio
   "Customise" dialog (slide deck today), add a row of NotebookTools style
   chips above its description box. Clicking a chip writes that style's
   prompt into the box. Pro feature (prompt library).
   ========================================================================== */
(function () {
  "use strict";

  const MARK = "data-nt-style-chips";
  const DIALOG = '[role="dialog"], mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane';

  // Which dialogs get chips, and which prompts they offer. Add Video
  // Overview / Infographic entries here when we have prompts for them.
  const TARGETS = [
    {
      match: /customi[sz]e\s+slide\s+deck/i,
      label: "Slide styles",
      prompts: () => window.NotebookToolsPromptLibrary?.slideDecks || []
    }
  ];

  let scanTimer = 0;
  let proUnlocked = false;

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function checkPlan() {
    window.NotebookToolsPlan?.can("prompt-library").then((ok) => {
      proUnlocked = ok;
      document.querySelectorAll(".nt-style-row").forEach((row) => row.classList.toggle("is-locked", !ok));
    });
  }

  function isDark(node) {
    for (let el = node; el && el !== document.documentElement; el = el.parentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!m) continue;
      const [r, g, b, a = 1] = m.map(Number);
      if (Number(a) === 0) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return false;
  }

  // Write into the dialog's textarea the way typing would, so NotebookLM's
  // own form state sees the change.
  function setValue(textarea, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function insertPrompt(row, textarea, prompt) {
    const current = textarea.value.trim();
    const last = row.dataset.lastPrompt || "";
    let next = prompt.prompt;
    if (current && current !== last) {
      // Keep the user's own words; swap out a style we inserted before.
      const own = last && current.endsWith(last) ? current.slice(0, -last.length).trim() : current;
      next = own ? `${own}\n\n${prompt.prompt}` : prompt.prompt;
    }
    setValue(textarea, next);
    row.dataset.lastPrompt = prompt.prompt;
    row.querySelectorAll(".nt-style-chip").forEach((chip) => chip.classList.toggle("is-on", chip.dataset.id === prompt.id));
    textarea.focus();
    textarea.setSelectionRange(next.length, next.length);
  }

  function buildRow(dialog, textarea, target) {
    const prompts = target.prompts();
    if (!prompts.length) return;
    const row = document.createElement("div");
    row.className = `nt-style-row${isDark(dialog) ? " is-dark" : ""}${proUnlocked ? "" : " is-locked"}`;
    row.innerHTML = `
      <div class="nt-style-head">
        <span class="nt-style-label">${esc(target.label)}</span>
        <span class="nt-style-by">by NotebookTools</span>
        <span class="nt-style-pro">PRO</span>
      </div>
      <div class="nt-style-chips" role="list">
        ${prompts.map((p) => `<button type="button" class="nt-style-chip" role="listitem" data-id="${esc(p.id)}" title="${esc(p.description || p.title)}">${esc(p.title.replace(/\s+deck$/i, ""))}</button>`).join("")}
      </div>`;
    row.addEventListener("click", async (event) => {
      const chip = event.target.closest(".nt-style-chip");
      if (!chip) return;
      event.preventDefault();
      event.stopPropagation();
      const prompt = prompts.find((p) => p.id === chip.dataset.id);
      if (!prompt) return;
      if (window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can("prompt-library"))) {
        window.NotebookToolsPlan.showUpgrade("prompt-library");
        return;
      }
      insertPrompt(row, textarea, prompt);
    });

    // Put the row right above the description box (above its form field
    // wrapper when there is one, so it doesn't sit inside the outline).
    const field = textarea.closest("mat-form-field, .mat-mdc-form-field") || textarea;
    field.parentElement.insertBefore(row, field);
    dialog.setAttribute(MARK, "1");
  }

  function scan() {
    for (const dialog of document.querySelectorAll(DIALOG)) {
      if (dialog.closest(`[${MARK}]`) || dialog.querySelector(`[${MARK}]`) || dialog.querySelector(".nt-style-row")) continue;
      const text = dialog.textContent || "";
      const target = TARGETS.find((t) => t.match.test(text));
      if (!target) continue;
      const textarea = dialog.querySelector("textarea");
      if (!textarea) continue;
      buildRow(dialog, textarea, target);
    }
  }

  function schedule() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 150);
  }

  checkPlan();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.notebooktoolsAuthProfile || changes.notebooktoolsAuthSession)) checkPlan();
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  window.NotebookToolsStudioPrompts = { scan };
})();
