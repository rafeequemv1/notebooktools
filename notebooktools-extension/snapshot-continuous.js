/* ==========================================================================
   Continuous capture: a small floating bar that stays on the page (and
   follows you to other tabs) so you can capture screen after screen.

   Area: drag a box, it's saved straight away, and you're back on the page.
   Screen: saves what's visible. Done: ends the session and opens the review
   box (back in the notebook it was started from).

   Injected by the background (snapshot-capture.js); captures go through
   "notebooktools-capture-region", which saves them to the snapshot store.
   ========================================================================== */
(function () {
  "use strict";

  if (window.NotebookToolsContinuousCapture) {
    window.NotebookToolsContinuousCapture.show();
    return;
  }

  const BAR_ID = "notebooktools-continuous-bar";
  const SHADE_ID = "notebooktools-continuous-shade";
  const KEY = "notebooktoolsSnapshots";

  const ICON = {
    area: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/>',
    screen: '<rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M8 21h8M12 17.5V21"/>',
    check: '<path d="m5 12 5 5 9-10"/>'
  };
  const svg = (name) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

  let bar = null;
  let shade = null;
  let busy = false;

  function build() {
    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "NotebookTools continuous capture");
    bar.innerHTML = `
      <span class="ntcc-rec" aria-hidden="true"></span>
      <span class="ntcc-count" aria-live="polite">0 captured</span>
      <span class="ntcc-thumbs"></span>
      <button type="button" data-act="area" title="Drag a box to capture (Alt+Shift+S)">${svg("area")}<span>Area</span></button>
      <button type="button" data-act="screen" title="Capture what's visible">${svg("screen")}<span>Screen</span></button>
      <button type="button" class="is-primary" data-act="done" title="Stop and review the snapshots">${svg("check")}<span>Done</span></button>`;
    bar.addEventListener("click", (event) => {
      const act = event.target.closest("[data-act]")?.dataset.act;
      if (act === "area") startArea();
      if (act === "screen") void capture(null);
      if (act === "done") void done();
    });
    document.documentElement.append(bar);
    void refresh();
  }

  async function refresh() {
    if (!bar) return;
    const stored = await chrome.storage.local.get(KEY).catch(() => ({}));
    const shots = Array.isArray(stored[KEY]) ? stored[KEY] : [];
    bar.querySelector(".ntcc-count").textContent = `${shots.length} captured`;
    bar.querySelector(".ntcc-thumbs").innerHTML = shots.slice(-3).map((s) => `<img src="${s.dataUrl}" alt="">`).join("");
  }

  /* ---------- Drag an area ---------- */
  function startArea() {
    if (busy || shade) return;
    shade = document.createElement("div");
    shade.id = SHADE_ID;
    shade.innerHTML = '<div class="ntcc-box"></div><p class="ntcc-hint">Drag to capture · Esc to cancel</p>';
    const box = shade.querySelector(".ntcc-box");
    let start = null;
    let rect = null;
    shade.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY };
      shade.setPointerCapture(e.pointerId);
      shade.classList.add("is-dragging");
    });
    shade.addEventListener("pointermove", (e) => {
      if (!start) return;
      rect = {
        x: Math.min(start.x, e.clientX),
        y: Math.min(start.y, e.clientY),
        width: Math.abs(e.clientX - start.x),
        height: Math.abs(e.clientY - start.y)
      };
      Object.assign(box.style, { display: "block", left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    });
    shade.addEventListener("pointerup", () => {
      const r = rect;
      endArea();
      if (r && r.width >= 12 && r.height >= 12) void capture(r);
    });
    document.documentElement.append(shade);
    window.addEventListener("keydown", onKey, true);
  }

  function endArea() {
    shade?.remove();
    shade = null;
    window.removeEventListener("keydown", onKey, true);
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      endArea();
    }
  }

  /* ---------- Capture ---------- */
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  async function capture(rect) {
    if (busy) return;
    busy = true;
    bar.style.visibility = "hidden"; // keep the bar out of the picture
    await nextFrame();
    try {
      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-capture-region",
        rect,
        devicePixelRatio: window.devicePixelRatio || 1
      });
      if (!response?.ok) throw new Error(response?.error || "Capture failed.");
      flash(rect);
    } catch (error) {
      toast(error?.message || "Capture failed.");
    } finally {
      bar.style.visibility = "";
      busy = false;
      void refresh();
    }
  }

  function flash(rect) {
    const el = document.createElement("div");
    el.className = "ntcc-flash";
    if (rect) Object.assign(el.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`, inset: "auto" });
    document.documentElement.append(el);
    setTimeout(() => el.remove(), 450);
    bar.classList.remove("is-pulse");
    void bar.offsetWidth;
    bar.classList.add("is-pulse");
  }

  function toast(text) {
    const el = document.createElement("div");
    el.className = "ntcc-toast";
    el.textContent = text;
    document.documentElement.append(el);
    setTimeout(() => el.remove(), 3200);
  }

  async function done() {
    endArea();
    try {
      await chrome.runtime.sendMessage({ type: "notebooktools-snapshot-continuous-done" });
    } catch (_error) {
      /* extension reloaded */
    }
    hide();
  }

  function show() {
    if (!bar || !bar.isConnected) build();
    else void refresh();
  }

  function hide() {
    endArea();
    bar?.remove();
    bar = null;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) void refresh();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "ntcc-stop") hide();
    if (message?.type === "ntcc-area") { show(); startArea(); }
  });

  window.NotebookToolsContinuousCapture = { show, hide, startArea };
  build();
})();
