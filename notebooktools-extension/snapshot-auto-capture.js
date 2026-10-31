(function () {
  "use strict";

  const BAR_ID = "notebooktools-auto-capture-bar";
  const ROOT_ATTR = "data-notebooktools-auto-capture";

  if (document.documentElement.getAttribute(ROOT_ATTR) === "1") {
    return;
  }

  document.documentElement.setAttribute(ROOT_ATTR, "1");

  let active = true;
  let captureCount = 0;
  let busy = false;
  let lastCaptureAt = 0;
  let pointerSession = null;
  let pendingClickTimer = 0;

  const DEBOUNCE_MS = 650;
  const MIN_DRAG_PX = 18;
  const CLICK_DELAY_MS = 280;

  const ACTION_TYPE_LABELS = {
    "left-click": "Left click",
    "right-click": "Right click",
    "middle-click": "Middle click",
    "double-click": "Double click",
    drag: "Click and drag",
    "scroll-up": "Scroll up",
    "scroll-down": "Scroll down",
    "scroll-left": "Scroll left",
    "scroll-right": "Scroll right",
    key: "Key press",
    "key-combo": "Keyboard shortcut",
    change: "Change value",
    submit: "Submit / Enter",
    hotkey: "Manual capture"
  };

  const bar = document.createElement("div");
  bar.id = BAR_ID;
  bar.innerHTML = `
    <span class="nt-auto-dot" aria-hidden="true"></span>
    <span class="nt-auto-label">Auto recording · <span class="nt-auto-count">0</span> captured</span>
    <span class="nt-auto-hint">Recording clicks, scroll, keys</span>
    <button type="button" data-action="stop">Stop</button>
  `;

  const countEl = bar.querySelector(".nt-auto-count");

  function isOwnUi(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(`#${BAR_ID}`) ||
        target.closest("#notebooktools-snapshot-overlay") ||
        target.closest("#notebooktools-snapshot-annotate")
    );
  }

  function shouldIgnoreTarget(target) {
    if (!(target instanceof Element)) {
      return true;
    }

    if (isOwnUi(target)) {
      return true;
    }

    const tag = target.tagName;

    if (tag === "HTML" || tag === "BODY") {
      return true;
    }

    return false;
  }

  function describeTarget(target) {
    if (!(target instanceof Element)) {
      return "";
    }

    const aria = target.getAttribute("aria-label") || target.getAttribute("title") || "";
    const placeholder = target.getAttribute("placeholder") || "";
    const name = target.getAttribute("name") || "";
    const role = target.getAttribute("role") || "";
    const text = target.textContent?.replace(/\s+/g, " ").trim().slice(0, 72) || "";
    const tag = target.tagName.toLowerCase();

    if (aria) {
      return aria;
    }

    if (placeholder) {
      return placeholder;
    }

    if (text && text.length <= 72) {
      return text;
    }

    if (name) {
      return `${tag}[${name}]`;
    }

    if (role) {
      return `${role} (${tag})`;
    }

    return tag;
  }

  function formatModifiers(event = {}) {
    const parts = [];

    if (event.ctrlKey) {
      parts.push("Ctrl");
    }

    if (event.metaKey) {
      parts.push("Cmd");
    }

    if (event.altKey) {
      parts.push("Alt");
    }

    if (event.shiftKey) {
      parts.push("Shift");
    }

    return parts;
  }

  function formatKeyLabel(event) {
    const key = String(event.key || "");

    if (!key || key === "Shift" || key === "Control" || key === "Alt" || key === "Meta") {
      return "";
    }

    if (key === " ") {
      return "Space";
    }

    if (key.length === 1) {
      return key.toUpperCase();
    }

    return key;
  }

  function buildActionText(actionType, target, event = {}, extra = "") {
    const base = ACTION_TYPE_LABELS[actionType] || actionType;
    const mods = formatModifiers(event);
    const targetLabel = describeTarget(target);
    let text = base;

    if (mods.length) {
      text = `${mods.join(" + ")} + ${base}`;
    }

    if (extra) {
      text = `${text} · ${extra}`;
    } else if (targetLabel) {
      text = `${text} · ${targetLabel}`;
    }

    return text;
  }

  function updateBar() {
    countEl.textContent = String(captureCount);
  }

  function cleanup() {
    active = false;
    window.clearTimeout(pendingClickTimer);
    document.documentElement.removeAttribute(ROOT_ATTR);
    bar.remove();
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("dblclick", onDoubleClick, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("wheel", onWheel, true);
    window.removeEventListener("change", onChange, true);
    window.removeEventListener("keydown", onKeyDown, true);
    void chrome.runtime.sendMessage({ type: "notebooktools-auto-capture-stopped" });
  }

  async function captureNow(payload) {
    if (!active || busy) {
      return;
    }

    const now = Date.now();

    if (now - lastCaptureAt < DEBOUNCE_MS) {
      return;
    }

    if (payload?.target && shouldIgnoreTarget(payload.target)) {
      return;
    }

    busy = true;
    lastCaptureAt = now;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "notebooktools-auto-capture-shot",
        action: payload.action,
        actionType: payload.actionType,
        caption: payload.action,
        triggerType: payload.actionType
      });

      if (response?.ok) {
        captureCount += 1;
        updateBar();
      }
    } catch (error) {
      console.warn("NotebookTools auto capture failed:", error);
    } finally {
      busy = false;
    }
  }

  function scheduleClickCapture(target, event) {
    window.clearTimeout(pendingClickTimer);

    pendingClickTimer = window.setTimeout(() => {
      const button = pointerSession?.button ?? 0;
      let actionType = "left-click";

      if (button === 1) {
        actionType = "middle-click";
      } else if (button === 2) {
        actionType = "right-click";
      }

      void captureNow({
        target,
        event,
        actionType,
        action: buildActionText(actionType, target, event)
      });
    }, CLICK_DELAY_MS);
  }

  function onPointerDown(event) {
    if (!active || isOwnUi(event.target)) {
      return;
    }

    pointerSession = {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      target: event.target,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey
    };
  }

  function onPointerUp(event) {
    if (!active || isOwnUi(event.target) || !pointerSession) {
      pointerSession = null;
      return;
    }

    const distance = Math.hypot(event.clientX - pointerSession.x, event.clientY - pointerSession.y);
    const target = event.target instanceof Element ? event.target : pointerSession.target;
    const mergedEvent = {
      ctrlKey: event.ctrlKey || pointerSession.ctrlKey,
      metaKey: event.metaKey || pointerSession.metaKey,
      altKey: event.altKey || pointerSession.altKey,
      shiftKey: event.shiftKey || pointerSession.shiftKey,
      button: event.button
    };

    pointerSession = null;

    if (distance >= MIN_DRAG_PX) {
      window.clearTimeout(pendingClickTimer);
      void captureNow({
        target,
        event: mergedEvent,
        actionType: "drag",
        action: buildActionText("drag", target, mergedEvent)
      });
      return;
    }

    if (distance < 8 && event.button !== 2) {
      scheduleClickCapture(target, mergedEvent);
    }
  }

  function onDoubleClick(event) {
    if (!active || isOwnUi(event.target)) {
      return;
    }

    window.clearTimeout(pendingClickTimer);

    void captureNow({
      target: event.target,
      event,
      actionType: "double-click",
      action: buildActionText("double-click", event.target, event)
    });
  }

  function onContextMenu(event) {
    if (!active || isOwnUi(event.target)) {
      return;
    }

    window.clearTimeout(pendingClickTimer);

    void captureNow({
      target: event.target,
      event,
      actionType: "right-click",
      action: buildActionText("right-click", event.target, event)
    });
  }

  function onWheel(event) {
    if (!active || isOwnUi(event.target)) {
      return;
    }

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);

    if (absX < 8 && absY < 8) {
      return;
    }

    let actionType = "scroll-down";

    if (absY >= absX) {
      actionType = event.deltaY < 0 ? "scroll-up" : "scroll-down";
    } else {
      actionType = event.deltaX < 0 ? "scroll-left" : "scroll-right";
    }

    void captureNow({
      target: event.target,
      event,
      actionType,
      action: buildActionText(actionType, event.target, event)
    });
  }

  function onChange(event) {
    if (!active || isOwnUi(event.target)) {
      return;
    }

    const target = event.target;

    if (
      target instanceof HTMLSelectElement ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      void captureNow({
        target,
        event,
        actionType: "change",
        action: buildActionText("change", target, event)
      });
    }
  }

  function shouldCaptureKey(event) {
    if (event.repeat) {
      return false;
    }

    const mods = formatModifiers(event);

    if (mods.length) {
      return true;
    }

    const special = new Set([
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Insert",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12"
    ]);

    return special.has(event.key);
  }

  function onKeyDown(event) {
    if (!active || isOwnUi(event.target)) {
      return;
    }

    if (event.key === "Escape") {
      cleanup();
      return;
    }

    if (!shouldCaptureKey(event)) {
      return;
    }

    const keyLabel = formatKeyLabel(event);
    const mods = formatModifiers(event);
    const hasCombo = mods.length > 0 && keyLabel;
    const actionType = hasCombo ? "key-combo" : "key";
    const target = event.target instanceof Element ? event.target : null;
    const extra = hasCombo ? keyLabel : keyLabel || event.key;

    void captureNow({
      target,
      event,
      actionType,
      action: buildActionText(actionType, target, event, extra)
    });
  }

  bar.querySelector('[data-action="stop"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  });

  document.documentElement.append(bar);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("dblclick", onDoubleClick, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("wheel", onWheel, true);
  window.addEventListener("change", onChange, true);
  window.addEventListener("keydown", onKeyDown, true);

  void chrome.runtime.sendMessage({ type: "notebooktools-auto-capture-started" });
})();
