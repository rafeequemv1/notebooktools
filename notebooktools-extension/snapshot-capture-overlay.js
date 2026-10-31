(function () {
  "use strict";

  const ROOT_ID = "notebooktools-snapshot-overlay";

  if (document.getElementById(ROOT_ID)) {
    return;
  }

  let startX = 0;
  let startY = 0;
  let currentRect = null;
  let dragging = false;
  let busy = false;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="nt-snapshot-shade"></div>
    <div class="nt-snapshot-selection"></div>
    <div class="nt-snapshot-toolbar">
      <span>Drag to select · Esc cancel · Annotate after capture</span>
      <button type="button" class="secondary" data-action="full">Full page</button>
      <button type="button" data-action="capture" disabled>Capture</button>
      <button type="button" class="secondary" data-action="cancel">Cancel</button>
    </div>
  `;

  const selection = root.querySelector(".nt-snapshot-selection");
  const captureButton = root.querySelector('[data-action="capture"]');
  const fullButton = root.querySelector('[data-action="full"]');
  const cancelButton = root.querySelector('[data-action="cancel"]');

  function cleanup() {
    root.remove();
    window.removeEventListener("keydown", onKeyDown, true);
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    root.classList.toggle("is-busy", nextBusy);
    captureButton.disabled = nextBusy || !currentRect;
    fullButton.disabled = nextBusy;
    cancelButton.disabled = nextBusy;
  }

  function normalizeRect(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    return {
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  function showRect(rect) {
    if (!rect || rect.width < 4 || rect.height < 4) {
      selection.style.display = "none";
      currentRect = null;
      captureButton.disabled = true;
      return;
    }

    currentRect = rect;
    selection.style.display = "block";
    selection.style.left = `${rect.x}px`;
    selection.style.top = `${rect.y}px`;
    selection.style.width = `${rect.width}px`;
    selection.style.height = `${rect.height}px`;
    captureButton.disabled = busy;
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cleanup();
    }
  }

  async function saveSnapshot(dataUrl) {
    const response = await chrome.runtime.sendMessage({
      type: "notebooktools-save-snapshot",
      dataUrl
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Capture failed.");
    }
  }

  async function annotateAndSave(dataUrl) {
    if (typeof window.NotebookToolsSnapshotAnnotate?.open !== "function") {
      await saveSnapshot(dataUrl);
      return;
    }

    cleanup();

    try {
      const annotated = await window.NotebookToolsSnapshotAnnotate.open(dataUrl);
      await saveSnapshot(annotated);
    } catch (error) {
      if (error?.message !== "Annotation cancelled.") {
        window.alert(error.message || "Could not save annotated snapshot.");
      }
    }
  }

  async function sendCapture(rect) {
    setBusy(true);
    root.style.visibility = "hidden";

    try {
      const dataUrl = await window.NotebookToolsSnapshotPageCapture.capture(rect);
      await annotateAndSave(dataUrl);
    } catch (error) {
      if (error?.message !== "Annotation cancelled.") {
        root.style.visibility = "";
        setBusy(false);
        window.alert(error.message || "Could not capture snapshot.");
        return;
      }
    }
  }

  root.addEventListener("mousedown", (event) => {
    if (busy || event.target.closest(".nt-snapshot-toolbar")) {
      return;
    }

    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    showRect(normalizeRect(startX, startY, startX, startY));
    event.preventDefault();
  });

  window.addEventListener(
    "mousemove",
    (event) => {
      if (!dragging || busy) {
        return;
      }

      showRect(normalizeRect(startX, startY, event.clientX, event.clientY));
    },
    true
  );

  window.addEventListener(
    "mouseup",
    (event) => {
      if (!dragging || busy) {
        return;
      }

      dragging = false;
      const rect = normalizeRect(startX, startY, event.clientX, event.clientY);
      showRect(rect);
      event.preventDefault();

      if (rect.width >= 12 && rect.height >= 12) {
        void sendCapture(rect);
      }
    },
    true
  );

  captureButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (currentRect) {
      void sendCapture(currentRect);
    }
  });

  fullButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void sendCapture(null);
  });

  cancelButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  });

  document.documentElement.append(root);
  window.addEventListener("keydown", onKeyDown, true);
})();
