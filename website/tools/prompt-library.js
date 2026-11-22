/* NotebookLM prompt library: pick where the prompt goes (destination tabs),
   pick a prompt card, fill the blanks right inside the prompt text, and copy.
   Slide deck prompts can take one of the 14 NotebookTools visual styles.
   Data: /tools/prompts.json (also used to build one page per prompt). */
(async () => {
  const { $, esc, copy } = window.NTTools;
  const styles = window.NotebookToolsPromptLibrary?.slideDecks || [];
  const previewCopy = window.NotebookToolsPromptLibrary?.previewCopy || {};

  const ICONS = {
    chat: '<path d="M5 5h14v10H9l-4 4V5Z"/>',
    audio: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    slides: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M12 17v3M8 20h8"/>',
    report: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M9.5 12.5h6M9.5 16h6"/>',
    flashcards: '<rect x="4" y="7" width="12" height="13" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v11"/>',
    quiz: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 16.5h.01"/>',
    infographic: '<path d="M5 20V10M10 20V5M15 20v-7M20 20V8"/>',
    all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'
  };
  const svg = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.chat}</svg>`;

  const root = $("#plApp");
  let data;
  try {
    data = await (await fetch("/tools/prompts.json")).json();
  } catch (_error) {
    root.innerHTML = '<p class="tool-empty">Could not load the prompts. Refresh the page.</p>';
    return;
  }
  const D = data.destinations;
  const state = { dest: "all", job: "all", query: "", id: "", values: {}, style: "" };

  // Deep link: /tools/notebooklm-prompts#prompt-id
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (data.prompts.some((p) => p.id === fromHash)) state.id = fromHash;

  function list() {
    const q = state.query.trim().toLowerCase();
    return data.prompts.filter((p) =>
      (state.dest === "all" || p.dest === state.dest) &&
      (state.job === "all" || p.jobs.includes(state.job)) &&
      (!q || `${p.title} ${p.summary} ${D[p.dest].label} ${p.jobs.join(" ")}`.toLowerCase().includes(q)));
  }

  function current() {
    return data.prompts.find((p) => p.id === state.id) || null;
  }

  /* ---------- Shell ---------- */
  root.innerHTML = `
    <div class="pl-layout">
      <nav class="pl-nav" aria-label="Where the prompt goes">
        <p class="pl-nav-label">Where it goes</p>
        <div class="pl-dock" role="tablist" aria-orientation="vertical" id="plDock"></div>
      </nav>
      <div class="pl-main">
        <div class="pl-top">
          <label class="pl-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>
            <input type="search" id="plSearch" placeholder="Search ${data.prompts.length} prompts: exam, debate, pitch deck…" aria-label="Search prompts">
            <kbd>/</kbd>
          </label>
          <div class="pl-jobs" id="plJobs" aria-label="Job"></div>
        </div>
        <div class="pl-body">
          <div class="pl-grid" id="plGrid" aria-live="polite"></div>
          <aside class="pl-bench" id="plBench" aria-label="Prompt"></aside>
        </div>
      </div>
    </div>`;

  function renderDock() {
    const count = (k) => data.prompts.filter((p) => (k === "all" || p.dest === k) && (state.job === "all" || p.jobs.includes(state.job))).length;
    const tabs = [["all", { label: "All", color: "#1f1f1f" }], ...Object.entries(D)];
    $("#plDock").innerHTML = tabs.map(([k, d]) => `
      <button type="button" role="tab" class="pl-tab${state.dest === k ? " is-on" : ""}" data-dest="${k}" aria-selected="${state.dest === k}" style="--c:${d.color}">
        <span class="pl-tab-icon">${svg(k)}</span><span class="pl-tab-label">${esc(d.label)}</span><span class="pl-tab-n">${count(k)}</span>
      </button>`).join("");
    $("#plJobs").innerHTML = ["all", ...data.jobs].map((j) => `<button type="button" class="pl-job${state.job === j ? " is-on" : ""}" data-job="${esc(j)}">${j === "all" ? "Any job" : esc(j)}</button>`).join("");
  }

  function renderGrid() {
    const items = list();
    if (!items.some((p) => p.id === state.id)) state.id = items[0]?.id || "";
    $("#plGrid").innerHTML = items.length ? items.map((p) => `
      <button type="button" class="pl-card${p.id === state.id ? " is-on" : ""}" data-id="${esc(p.id)}" style="--c:${D[p.dest].color}">
        <span class="pl-card-dest">${svg(p.dest, 14)}${esc(D[p.dest].label)}</span>
        <strong>${esc(p.title)}</strong>
        <span>${esc(p.summary)}</span>
      </button>`).join("") : '<p class="tool-empty">No prompts match. Try another word or clear the filters.</p>';
  }

  /* ---------- Workbench: blanks live inside the prompt ---------- */
  function fieldWidth(text, min = 6) {
    return `${Math.max(min, Math.min(42, String(text || "").length + 1))}ch`;
  }

  function promptBody(p) {
    const parts = p.prompt.split(/(\{\{\w+\}\})/);
    return parts.map((part) => {
      const m = part.match(/^\{\{(\w+)\}\}$/);
      if (!m) return esc(part).replace(/\n/g, "<br>");
      const blank = p.blanks.find((b) => b.key === m[1]);
      const value = state.values[m[1]] || "";
      return `<input type="text" class="pl-blank${value ? " is-filled" : ""}" data-key="${esc(m[1])}" value="${esc(value)}" placeholder="${esc(blank.label)}" aria-label="${esc(blank.label)}" style="width:${fieldWidth(value || blank.label)}">`;
    }).join("");
  }

  function finalText(p, useExamples = false) {
    let text = p.prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = state.values[key]?.trim();
      if (v) return v;
      const blank = p.blanks.find((b) => b.key === key);
      return useExamples ? blank.example : `[${blank.label}]`;
    });
    if (p.dest === "slides") {
      const style = styles.find((s) => s.id === state.style);
      if (style) text += `\n\nVisual style: ${style.prompt}`;
    }
    return text;
  }

  function stylePicker() {
    if (!styles.length) return "";
    return `<div class="pl-styles-head"><strong>Add a visual style</strong><span>optional</span></div>
      <div class="pl-styles">${styles.map((s) => {
        const c = previewCopy[s.preview] || { kicker: "", title: s.title.split(" ")[0], sub: "" };
        return `<button type="button" class="pl-style${state.style === s.id ? " is-on" : ""}" data-style="${esc(s.id)}" title="${esc(s.description)}">
          <span class="pl-style-thumb" aria-hidden="true"><span class="pl-preview pl-preview--${esc(s.preview)}"><span class="pl-preview-inner"><span class="pl-preview-accent"></span><span class="pl-preview-kicker">${esc(c.kicker)}</span><span class="pl-preview-title">${esc(c.title)}</span><span class="pl-preview-sub">${esc(c.sub)}</span></span></span></span>
          <span class="pl-style-name">${esc(s.title.replace(/\s+deck$/i, ""))}</span></button>`;
      }).join("")}</div>`;
  }

  function renderBench() {
    const p = current();
    const bench = $("#plBench");
    if (!p) {
      bench.innerHTML = '<p class="tool-empty">Pick a prompt on the left.</p>';
      return;
    }
    const d = D[p.dest];
    const missing = p.blanks.filter((b) => !state.values[b.key]?.trim()).length;
    bench.style.setProperty("--c", d.color);
    bench.innerHTML = `
      <div class="pl-bench-head">
        <span class="pl-card-dest">${svg(p.dest, 14)}${esc(d.label)}</span>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
      </div>
      <div class="pl-sheet">
        <div class="pl-sheet-bar">
          <span>${missing ? `${missing} blank${missing === 1 ? "" : "s"} to fill` : "Ready to copy"}</span>
          <button type="button" class="pl-mini" data-act="examples">Use examples</button>
          <button type="button" class="pl-mini" data-act="clear">Clear</button>
        </div>
        <div class="pl-prompt">${promptBody(p)}</div>
      </div>
      ${p.dest === "slides" ? stylePicker() : ""}
      <div class="tool-actions">
        <button type="button" class="tool-btn is-primary" data-act="copy">Copy prompt</button>
        <a class="tool-btn" href="/tools/notebooklm-prompts/${esc(p.id)}">Open prompt page</a>
      </div>
      <div class="pl-where">
        <strong>Paste it here</strong>
        <ol>${d.where.map((w) => `<li>${esc(w)}</li>`).join("")}</ol>
      </div>
      <p class="pl-when"><strong>When to use it.</strong> ${esc(p.when)}</p>
      ${p.tip ? `<p class="pl-when"><strong>Tip.</strong> ${esc(p.tip)}</p>` : ""}`;
  }

  function render() {
    renderDock();
    renderGrid();
    renderBench();
    if (state.id) history.replaceState(null, "", `#${state.id}`);
  }

  /* ---------- Events ---------- */
  root.addEventListener("click", (event) => {
    const t = event.target;
    const dest = t.closest("[data-dest]");
    if (dest) { state.dest = dest.dataset.dest; return render(); }
    const job = t.closest("[data-job]");
    if (job) { state.job = job.dataset.job; return render(); }
    const card = t.closest(".pl-card");
    if (card) {
      if (card.dataset.id !== state.id) { state.id = card.dataset.id; state.values = {}; state.style = ""; }
      render();
      if (window.innerWidth < 900) $("#plBench").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const style = t.closest("[data-style]");
    if (style) { state.style = state.style === style.dataset.style ? "" : style.dataset.style; return renderBench(); }
    const act = t.closest("[data-act]")?.dataset.act;
    const p = current();
    if (!act || !p) return;
    if (act === "examples") { p.blanks.forEach((b) => (state.values[b.key] = b.example)); return renderBench(); }
    if (act === "clear") { state.values = {}; return renderBench(); }
    if (act === "copy") copy(finalText(p), t.closest("[data-act]"));
  });

  root.addEventListener("input", (event) => {
    const t = event.target;
    if (t.id === "plSearch") {
      state.query = t.value;
      renderGrid();
      renderBench();
      return;
    }
    if (t.classList.contains("pl-blank")) {
      state.values[t.dataset.key] = t.value;
      t.classList.toggle("is-filled", Boolean(t.value.trim()));
      t.style.width = fieldWidth(t.value || t.placeholder);
      const p = current();
      const missing = p.blanks.filter((b) => !state.values[b.key]?.trim()).length;
      const bar = root.querySelector(".pl-sheet-bar span");
      if (bar) bar.textContent = missing ? `${missing} blank${missing === 1 ? "" : "s"} to fill` : "Ready to copy";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
      event.preventDefault();
      $("#plSearch").focus();
    }
  });

  render();
})();

// Up/Down arrows move through the destination list (it's a vertical tablist).
document.addEventListener("keydown", (event) => {
  const tab = event.target.closest?.("#plDock .pl-tab");
  if (!tab || !["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
  const tabs = [...document.querySelectorAll("#plDock .pl-tab")];
  const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  event.preventDefault();
  next.click();
  document.querySelector(`#plDock .pl-tab[data-dest="${next.dataset.dest}"]`)?.focus();
});
