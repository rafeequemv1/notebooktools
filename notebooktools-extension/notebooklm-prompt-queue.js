/* Prompt queue: several prompts sent to this notebook's chat one after another.
   Each prompt goes in only when NotebookLM has finished answering the one
   before it, with a pause between them. The person starts it, can pause or stop
   it at any time, and it runs only while this tab is open; nothing runs in the
   background. Answers are collected so they can be copied or saved together. */
(function () {
  "use strict";

  if (window.NotebookToolsPromptQueue) return;

  const PANEL_ID = "notebooktools-prompt-queue";
  const STORE_PREFIX = "notebooktoolsPromptQueue:";
  const CUSTOM_PROMPTS_KEY = "notebooktoolsCustomPrompts";
  const MAX_ITEMS = 25; // one sitting's worth: this is a helper, not a bulk sender
  const DELAYS = [3, 5, 10, 20, 30];
  const ANSWER_TIMEOUT_MS = 6 * 60 * 1000;
  const SEND_TIMEOUT_MS = 45 * 1000;
  const STABLE_MS = 4500;
  const LIMIT_RE = /(reached|hit|exceeded)\s+(your|the)\s+(daily\s+)?(chat\s+|query\s+)?(limit|quota)|too many (requests|queries)|try again (later|tomorrow)/i;

  const state = {
    notebook: "",
    items: [], // { id, text, status: waiting|sending|answering|done|failed|skipped, answer, error }
    delay: 5,
    running: false,
    stopAfterCurrent: false,
    message: "",
    collapsed: false
  };
  let panel = null;
  let loopToken = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const notebookId = () => location.pathname.match(/\/notebook\/([^/?#]+)/i)?.[1] || "";
  const chat = () => window.NotebookToolsBlogChatAutomation;
  const extract = () => window.NotebookToolsNotebookLmChatExtract || (typeof NotebookToolsNotebookLmChatExtract !== "undefined" ? NotebookToolsNotebookLmChatExtract : null);

  function isDarkPage() {
    for (const node of [document.body, document.documentElement]) {
      const m = node && getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
      if (!m) continue;
      const [r, g, b, a = 1] = m.map(Number);
      if (Number(a) === 0) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  }

  /* ---------- Storage (per notebook) ---------- */
  async function load() {
    state.notebook = notebookId();
    if (!state.notebook) return;
    try {
      const key = STORE_PREFIX + state.notebook;
      const stored = (await chrome.storage.local.get(key))[key];
      if (stored && Array.isArray(stored.items)) {
        // A run never resumes by itself after a reload: anything mid-way waits again
        state.items = stored.items.slice(0, MAX_ITEMS).map((it) => ({ ...it, status: ["sending", "answering"].includes(it.status) ? "waiting" : it.status }));
        state.delay = DELAYS.includes(stored.delay) ? stored.delay : 5;
      } else {
        state.items = [];
      }
    } catch (_error) { /* storage unavailable: start empty */ }
  }

  function save() {
    if (!state.notebook) return;
    const items = state.items.map(({ id, text, status, answer, error }) => ({ id, text, status, error: error || "", answer: answer ? String(answer).slice(0, 20000) : "" }));
    try { chrome.storage.local.set({ [STORE_PREFIX + state.notebook]: { items, delay: state.delay, updatedAt: Date.now() } }); } catch (_error) { /* ignore */ }
  }

  async function savedPrompts() {
    try {
      const stored = await chrome.storage.local.get(CUSTOM_PROMPTS_KEY);
      return (Array.isArray(stored[CUSTOM_PROMPTS_KEY]) ? stored[CUSTOM_PROMPTS_KEY] : []).filter((p) => p && p.prompt).map((p) => ({ title: p.title || "Untitled prompt", prompt: p.prompt }));
    } catch (_error) {
      return [];
    }
  }

  /* ---------- Queue edits ---------- */
  function addPrompts(texts) {
    const room = MAX_ITEMS - state.items.length;
    const clean = texts.map((t) => String(t || "").trim()).filter(Boolean);
    if (!clean.length) return 0;
    const taken = clean.slice(0, Math.max(0, room));
    taken.forEach((text) => state.items.push({ id: uid(), text, status: "waiting", answer: "", error: "" }));
    state.message = clean.length > taken.length ? `A queue holds up to ${MAX_ITEMS} prompts. ${clean.length - taken.length} not added.` : "";
    save();
    render();
    return taken.length;
  }

  function move(id, by) {
    const i = state.items.findIndex((it) => it.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= state.items.length) return;
    [state.items[i], state.items[j]] = [state.items[j], state.items[i]];
    save();
    render();
  }

  function remove(id) {
    state.items = state.items.filter((it) => it.id !== id);
    save();
    render();
  }

  /* ---------- Running ---------- */
  const pending = () => state.items.filter((it) => it.status === "waiting");
  const current = () => state.items.find((it) => it.status === "sending" || it.status === "answering");

  function lastAnswer(messagesBefore) {
    const ex = extract();
    if (!ex) return null;
    const messages = ex.extractNotebookLmMessages();
    if (messages.length <= messagesBefore) return { messages, body: "" };
    const answers = messages.filter((m) => !/^you$/i.test(String(m.role || "").trim()));
    const last = answers[answers.length - 1];
    // the newest message must be NotebookLM's (not still only our question)
    const newest = messages[messages.length - 1];
    if (!last || newest !== last) return { messages, body: "" };
    const body = String(last.body || "").trim();
    // "Thinking…", "Reading sources" and loading dots aren't the answer yet
    if (body.length < 60 && /^(…|\.{2,}|thinking|reading|searching|generating|loading|working|analy[sz]ing)/i.test(body)) return { messages, body: "" };
    return { messages, body };
  }

  async function sendOne(item, token) {
    const auto = chat();
    if (!auto || !extract()) throw new Error("Chat tools are still loading. Try again in a moment.");
    const input = auto.findChatInput();
    if (!input) throw new Error("Chat box not found. Open the chat in this notebook.");
    // Never overwrite something the person is typing
    if (input.value.trim() && input.value.trim() !== item.text) throw new Error("The chat box has text in it. Clear it, then press Start to continue.");

    item.status = "sending";
    item.error = "";
    render();
    const { messageCountBefore } = await auto.submitPrompt(item.text);

    // Sent? The question appears in the chat (or the box empties)
    const sentBy = Date.now() + SEND_TIMEOUT_MS;
    while (Date.now() < sentBy) {
      if (token !== loopToken) return;
      const count = extract().extractNotebookLmMessages().length;
      if (count > messageCountBefore || !input.value.trim()) break;
      await sleep(500);
    }
    if (extract().extractNotebookLmMessages().length <= messageCountBefore && input.value.trim()) {
      throw new Error("NotebookLM didn't take the prompt. It may be busy; press Start to try again.");
    }

    item.status = "answering";
    render();
    const doneBy = Date.now() + ANSWER_TIMEOUT_MS;
    let last = "", stableSince = 0;
    while (Date.now() < doneBy) {
      if (token !== loopToken) return;
      const read = lastAnswer(messageCountBefore);
      const body = read?.body || "";
      if (body) {
        if (body === last) {
          stableSince ||= Date.now();
          // finished: the answer stopped changing and the chat box is ready again
          const box = auto.findChatInput();
          if (Date.now() - stableSince >= STABLE_MS && box && !box.disabled) {
            item.answer = body;
            item.status = "done";
            if (LIMIT_RE.test(body.slice(0, 400)) && body.length < 600) {
              item.status = "failed";
              item.error = "NotebookLM says a usage limit was reached.";
              throw Object.assign(new Error("NotebookLM reported a usage limit, so the queue stopped. Try again later."), { limit: true });
            }
            return;
          }
        } else {
          last = body;
          stableSince = 0;
        }
      }
      await sleep(800);
    }
    throw new Error("No complete answer after 6 minutes, so the queue paused.");
  }

  async function run() {
    if (state.running) return;
    if (!pending().length) { state.message = "Add a prompt to the queue first."; return render(); }
    if (window.NotebookToolsPlan && !(await window.NotebookToolsPlan.can("prompt-queue"))) {
      window.NotebookToolsPlan.showUpgrade("prompt-queue");
      return;
    }
    const token = ++loopToken;
    let problem = "";
    state.running = true;
    state.stopAfterCurrent = false;
    state.message = "";
    render();
    try {
      while (token === loopToken) {
        const item = pending()[0];
        if (!item) break;
        try {
          await sendOne(item, token);
        } catch (error) {
          if (token !== loopToken) break;
          if (item.status !== "failed") { item.status = "waiting"; }
          problem = error.message || "Something went wrong.";
          break;
        }
        save();
        render();
        if (token !== loopToken || state.stopAfterCurrent || !pending().length) break;
        // a pause between prompts, like a person reading the answer
        for (let s = state.delay; s > 0 && token === loopToken && !state.stopAfterCurrent; s -= 1) {
          state.message = `Next prompt in ${s} s`;
          render();
          await sleep(1000);
        }
        state.message = "";
      }
    } finally {
      if (token === loopToken) {
        state.running = false;
        const done = state.items.filter((it) => it.status === "done").length;
        state.message = problem || (pending().length ? "Paused." : `Finished: ${done} answer${done === 1 ? "" : "s"}.`);
        state.stopAfterCurrent = false;
        save();
        render();
      }
    }
  }

  function pause() {
    if (!state.running) return;
    state.stopAfterCurrent = true;
    state.message = current() ? "Pausing after this answer…" : "Paused.";
    render();
  }

  function stop() {
    loopToken += 1; // the loop sees this and ends; NotebookLM may still finish its answer
    state.running = false;
    state.stopAfterCurrent = false;
    state.items.forEach((it) => { if (it.status === "sending" || it.status === "answering") it.status = "waiting"; });
    state.message = "Stopped. The prompt that was running will go again when you press Start.";
    save();
    render();
  }

  function resetAll() {
    state.items.forEach((it) => { it.status = "waiting"; it.answer = ""; it.error = ""; });
    state.message = "";
    save();
    render();
  }

  /* ---------- Results ---------- */
  function answersMarkdown() {
    const title = document.querySelector("h1")?.textContent?.trim() || document.title.replace(/\s*-\s*NotebookLM.*$/i, "") || "Notebook";
    const parts = [`# ${title}: prompt queue answers`, ""];
    state.items.filter((it) => it.answer).forEach((it, i) => parts.push(`## ${i + 1}. ${it.text.split("\n")[0].slice(0, 120)}`, "", `> ${it.text.replace(/\n/g, "\n> ")}`, "", it.answer, ""));
    return parts.join("\n");
  }

  async function copyAnswers() {
    if (!state.items.some((it) => it.answer)) return;
    try {
      await navigator.clipboard.writeText(answersMarkdown());
      state.message = "All answers copied as Markdown.";
    } catch (_error) {
      state.message = "Couldn't copy. Use Download instead.";
    }
    render();
  }

  function downloadAnswers() {
    if (!state.items.some((it) => it.answer)) return;
    const blob = new Blob([answersMarkdown()], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prompt-queue-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- Panel ---------- */
  const ICON = {
    queue: '<path d="M4 6h11M4 12h11M4 18h7"/><path d="M17 15l4 3-4 3z" fill="currentColor"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    min: '<path d="M6 12h12"/>'
  };
  const icon = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  const STATUS = { waiting: "Waiting", sending: "Sending", answering: "Answering…", done: "Done", failed: "Failed", skipped: "Skipped" };

  function render() {
    if (!panel) return;
    panel.classList.toggle("is-dark", isDarkPage());
    panel.classList.toggle("is-collapsed", state.collapsed);
    const total = state.items.length;
    const done = state.items.filter((it) => it.status === "done").length;
    const answered = state.items.some((it) => it.answer);
    const now = current();
    const head = `
      <div class="ntq-head">
        <span class="ntq-mark">${icon("queue", 18)}</span>
        <div class="ntq-titles"><p class="ntq-title">Prompt queue</p><p class="ntq-sub">${total ? `${done} of ${total} answered${state.running ? (now ? ` · ${now.status === "sending" ? "sending" : "answering"} #${state.items.indexOf(now) + 1}` : " · running") : ""}` : "Prompts run one after another, each when the last answer is done"}</p></div>
        <button type="button" class="ntq-icon" data-q="collapse" title="${state.collapsed ? "Expand" : "Minimise"}">${icon("min")}</button>
        <button type="button" class="ntq-icon" data-q="close" title="Close${state.running ? " (the queue keeps running)" : ""}">${icon("close")}</button>
      </div>`;
    if (state.collapsed) {
      panel.innerHTML = head;
      return;
    }
    const list = total ? `<ol class="ntq-list">${state.items.map((it, i) => `
        <li class="ntq-item is-${it.status}" data-id="${it.id}">
          <span class="ntq-num">${i + 1}</span>
          <div class="ntq-text"><p title="${esc(it.text)}">${esc(it.text)}</p>${it.error ? `<small class="ntq-err">${esc(it.error)}</small>` : ""}</div>
          <span class="ntq-chip">${STATUS[it.status] || it.status}</span>
          ${state.running ? "" : `<span class="ntq-tools">
            <button type="button" class="ntq-icon" data-q="up" title="Move up"${i === 0 ? " disabled" : ""}>${icon("up", 14)}</button>
            <button type="button" class="ntq-icon" data-q="down" title="Move down"${i === total - 1 ? " disabled" : ""}>${icon("down", 14)}</button>
            <button type="button" class="ntq-icon" data-q="remove" title="Remove">${icon("trash", 14)}</button>
          </span>`}
        </li>`).join("")}</ol>` : `<p class="ntq-empty">Add the prompts you want answered. Each one is sent when NotebookLM has finished the one before.</p>`;
    const adder = state.running ? "" : `
      <div class="ntq-add">
        <textarea class="ntq-input" rows="2" placeholder="Write a prompt, then press Enter to add it"${total >= MAX_ITEMS ? " disabled" : ""}></textarea>
        <div class="ntq-add-row">
          <button type="button" class="ntq-ghost" data-q="add">Add</button>
          <button type="button" class="ntq-ghost" data-q="add-lines" title="Each line becomes its own prompt">Add each line</button>
          <button type="button" class="ntq-ghost" data-q="from-saved">From my prompts</button>
          <span class="ntq-count">${total}/${MAX_ITEMS}</span>
        </div>
        <div class="ntq-saved" hidden></div>
      </div>`;
    const settings = `
      <div class="ntq-settings">
        <label>Pause between prompts
          <select data-q="delay"${state.running ? " disabled" : ""}>${DELAYS.map((d) => `<option value="${d}"${d === state.delay ? " selected" : ""}>${d} s</option>`).join("")}</select>
        </label>
        ${state.running ? "" : `${done ? `<button type="button" class="ntq-link" data-q="reset">Run again</button>` : ""}${total ? `<button type="button" class="ntq-link" data-q="clear">Clear</button>` : ""}`}
      </div>`;
    const actions = `
      <div class="ntq-actions">
        ${answered ? `<button type="button" class="ntq-ghost" data-q="copy">Copy answers</button><button type="button" class="ntq-ghost" data-q="download">Download</button>` : ""}
        <span class="ntq-spacer"></span>
        ${state.running
          ? `<button type="button" class="ntq-ghost" data-q="pause"${state.stopAfterCurrent ? " disabled" : ""}>Pause</button><button type="button" class="ntq-primary" data-q="stop">Stop</button>`
          : `<button type="button" class="ntq-primary" data-q="start"${pending().length ? "" : " disabled"}>${done && pending().length ? "Continue" : "Start"}</button>`}
      </div>`;
    const note = `<p class="ntq-note${/limit|didn't|No complete|text in it|not found|loading|wrong/i.test(state.message) ? " is-warn" : ""}">${esc(state.message || (state.running ? "Keep this tab open while the queue runs." : ""))}</p>`;
    // keep what the person was typing across re-renders
    const draft = panel.querySelector(".ntq-input")?.value || "";
    panel.innerHTML = head + `<div class="ntq-body">${list}${adder}${settings}${note}${actions}</div>`;
    const box = panel.querySelector(".ntq-input");
    if (box && draft) box.value = draft;
    panel.querySelector(".ntq-item.is-sending, .ntq-item.is-answering")?.scrollIntoView({ block: "nearest" });
  }

  async function showSaved() {
    const holder = panel.querySelector(".ntq-saved");
    if (!holder) return;
    if (!holder.hidden) { holder.hidden = true; return; }
    const list = await savedPrompts();
    holder.innerHTML = list.length
      ? list.map((p, i) => `<button type="button" class="ntq-saved-item" data-q="pick" data-i="${i}"><b>${esc(p.title)}</b><span>${esc(p.prompt.slice(0, 90))}</span></button>`).join("")
      : `<p class="ntq-empty">No saved prompts yet. Save one from the ribbon's Prompts menu.</p>`;
    holder._list = list;
    holder.hidden = false;
    document.dispatchEvent(new CustomEvent("notebooktools-dropdown-open", { detail: "queue-saved" }));
  }

  function onClick(event) {
    const el = event.target.closest("[data-q]");
    if (!el || el.tagName === "SELECT") return;
    const id = el.closest(".ntq-item")?.dataset.id;
    const box = panel.querySelector(".ntq-input");
    switch (el.dataset.q) {
      case "close": return close();
      case "collapse": state.collapsed = !state.collapsed; return render();
      case "up": return move(id, -1);
      case "down": return move(id, 1);
      case "remove": return remove(id);
      case "add": if (box && addPrompts([box.value])) { box.value = ""; panel.querySelector(".ntq-input")?.focus(); } return;
      case "add-lines": if (box && addPrompts(box.value.split(/\n+/))) { box.value = ""; panel.querySelector(".ntq-input")?.focus(); } return;
      case "from-saved": return showSaved();
      case "pick": {
        const list = panel.querySelector(".ntq-saved")?._list || [];
        const p = list[Number(el.dataset.i)];
        if (p) addPrompts([p.prompt]);
        return;
      }
      case "start": return run();
      case "pause": return pause();
      case "stop": return stop();
      case "reset": return resetAll();
      case "clear": state.items = []; state.message = ""; save(); return render();
      case "copy": return copyAnswers();
      case "download": return downloadAnswers();
      default:
    }
  }

  function onKey(event) {
    const box = event.target.closest?.(".ntq-input");
    if (box && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (addPrompts([box.value])) { panel.querySelector(".ntq-input").value = ""; panel.querySelector(".ntq-input").focus(); }
    }
    event.stopPropagation(); // NotebookLM's own shortcuts stay out of the panel
  }

  async function open() {
    if (!notebookId()) return;
    if (notebookId() !== state.notebook) { if (state.running) stop(); await load(); }
    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.className = "ntq";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Prompt queue");
      panel.addEventListener("click", onClick);
      panel.addEventListener("keydown", onKey);
      panel.addEventListener("change", (event) => {
        if (event.target.matches("select[data-q='delay']")) { state.delay = Number(event.target.value) || 5; save(); }
      });
      document.body.append(panel);
    }
    state.collapsed = false;
    panel.hidden = false;
    render();
    panel.querySelector(".ntq-input")?.focus();
  }

  function close() {
    if (!panel) return;
    if (state.running) { state.collapsed = true; render(); return; } // a running queue stays as a small bar
    panel.hidden = true;
  }

  // Leaving the notebook ends a run (it belongs to that notebook's chat)
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    if (state.running && notebookId() !== state.notebook) stop();
    if (panel && !notebookId()) panel.hidden = true;
  }, 1000);

  window.NotebookToolsPromptQueue = { open, close, add: addPrompts, start: run, pause, stop, get state() { return state; } };
})();
