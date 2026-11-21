/* Toolbar dropdown: add the current page or YouTube video to a notebook in
   one step. Bigger tools (Bulk, Snapshots, Prompts) open in the side panel. */
const $ = (selector) => document.querySelector(selector);

const addButton = $("#addButton");
const statusEl = $("#status");
const newNameInput = $("#newNotebookName");
const toggleNew = $("#toggleNew");

let activeTab = null;
let mode = "";

function setStatus(message, kind = "") {
  statusEl.className = `qp-status${kind ? ` is-${kind}` : ""}`;
  statusEl.textContent = message || "";
}

const picker = NotebookToolsPicker.create({
  selectEl: $("#notebookSelect"),
  newNameInput,
  onStatus: (message, options = {}) => {
    if (options.type === "error") {
      statusEl.className = "qp-status is-error";
      statusEl.innerHTML = "";
      statusEl.append(`${message} `);
      const link = document.createElement("a");
      link.href = "https://notebook.google.com/";
      link.target = "_blank";
      link.textContent = "Open NotebookLM";
      statusEl.append(link);
    } else if (options.loading) {
      setStatus(message);
    }
  },
  onNotebookChange: updateButton
});

function updateButton() {
  const hasTarget = Boolean(picker.selectedNotebookId() || picker.selectedNotebookName());
  addButton.disabled = !mode || !hasTarget;
  addButton.textContent = mode === "youtube" ? "Add video to notebook" : "Add page to notebook";
}

async function describeTab() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = activeTab?.url || "";
  const youtube = NotebookToolsStore.normalizeYouTubeVideoUrl(url);
  const webpage = NotebookToolsStore.normalizeWebpageUrl(url);
  mode = youtube ? "youtube" : webpage ? "webpage" : "";

  $("#pageKind").textContent = mode === "youtube" ? "YouTube video" : mode === "webpage" ? "Web page" : "This page";
  $("#pageTitle").textContent = mode ? activeTab.title || url : "Can't be imported. Open a web page or YouTube video.";
  if (mode && activeTab.favIconUrl && /^https?:/.test(activeTab.favIconUrl)) {
    const icon = $("#pageIcon");
    icon.src = activeTab.favIconUrl;
    icon.hidden = false;
  }
}

async function addToNotebook() {
  addButton.disabled = true;
  try {
    const target = await picker.resolveTarget();
    setStatus("Sending to NotebookLM…");
    if (mode === "youtube") {
      await NotebookToolsNotebookLM.addYoutubeToNotebookLm(target.id, NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab.url));
    } else {
      await NotebookToolsNotebookLM.addWebpageToNotebookLm(target.id, NotebookToolsStore.normalizeWebpageUrl(activeTab.url));
    }
    void NotebookToolsStats?.recordImport?.();
    statusEl.className = "qp-status is-ok";
    statusEl.innerHTML = "";
    statusEl.append(`Added to "${target.title}". `);
    const link = document.createElement("a");
    link.href = `https://notebook.google.com/notebook/${encodeURIComponent(target.id)}`;
    link.target = "_blank";
    link.textContent = "Open";
    statusEl.append(link);
    newNameInput.value = "";
    newNameInput.hidden = true;
    toggleNew.setAttribute("aria-expanded", "false");
  } catch (error) {
    setStatus(error.message || "Import failed.", "error");
  } finally {
    updateButton();
  }
}

// Opens the side panel in this window (the click in the popup counts as the
// user gesture Chrome requires), then closes the popup.
async function openPanel(panel = "import") {
  const path = `sidepanel.html${panel === "import" ? "" : `?panel=${panel}`}`;
  try {
    await chrome.sidePanel.setOptions({ path, enabled: true });
    await chrome.sidePanel.open({ windowId: activeTab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT });
  } catch (_error) {
    chrome.windows.create({ url: chrome.runtime.getURL(path), type: "popup", width: 420, height: 760 });
  }
  window.close();
}

addButton.addEventListener("click", addToNotebook);
toggleNew.addEventListener("click", () => {
  const open = newNameInput.hidden;
  newNameInput.hidden = !open;
  toggleNew.setAttribute("aria-expanded", String(open));
  if (open) {
    newNameInput.focus();
  } else {
    newNameInput.value = "";
    newNameInput.dispatchEvent(new Event("input"));
  }
});
newNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !addButton.disabled) addToNotebook();
});
$("#openPanel").addEventListener("click", () => openPanel("import"));
document.querySelectorAll("[data-panel]").forEach((button) => {
  button.addEventListener("click", () => openPanel(button.dataset.panel));
});
$("#openHub").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("notebooks.html") });
  window.close();
});

(async () => {
  await NotebookToolsTheme.init();
  await describeTab();
  picker.bind();
  updateButton();
  await picker.refresh({ silent: true });
  if (!picker.notebooks.length) {
    setStatus("");
    picker.refresh();
  }
  updateButton();
})();
