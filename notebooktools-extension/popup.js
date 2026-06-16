const notebookLmSelect = document.querySelector("#notebookLmSelect");
const newNotebookLmName = document.querySelector("#newNotebookLmName");
const importYouTubeButton = document.querySelector("#importYouTubeButton");
const refreshNotebookLmButton = document.querySelector("#refreshNotebookLmButton");
const notebookSelect = document.querySelector("#notebookSelect");
const newNotebookName = document.querySelector("#newNotebookName");
const savePageButton = document.querySelector("#savePageButton");
const statusBox = document.querySelector("#status");

let notebookLmNotebooks = [];

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function selectedLocalNotebookName() {
  return (
    NotebookToolsStore.cleanNotebookName(newNotebookName.value) ||
    NotebookToolsStore.cleanNotebookName(notebookSelect.value)
  );
}

function selectedNotebookLmName() {
  return NotebookToolsStore.cleanNotebookName(newNotebookLmName.value);
}

function selectedNotebookLmId() {
  return notebookLmSelect.value || "";
}

async function refreshNotebookSelect() {
  const notebooks = await NotebookToolsStore.readNotebooks();
  notebookSelect.innerHTML = '<option value="">New notebook...</option>';

  for (const notebook of notebooks) {
    const option = document.createElement("option");
    option.value = notebook.name;
    option.textContent = `${notebook.name} (${notebook.items?.length || 0})`;
    notebookSelect.append(option);
  }
}

async function refreshNotebookLmSelect({ silent = false } = {}) {
  refreshNotebookLmButton.disabled = true;
  notebookLmSelect.disabled = true;
  notebookLmSelect.innerHTML = '<option value="">Loading NotebookLM notebooks...</option>';

  try {
    notebookLmNotebooks = await NotebookToolsNotebookLM.listNotebookLmNotebooks();
    notebookLmSelect.innerHTML = '<option value="">New NotebookLM notebook...</option>';

    for (const notebook of notebookLmNotebooks) {
      const option = document.createElement("option");
      option.value = notebook.id;
      option.textContent = notebook.title;
      notebookLmSelect.append(option);
    }

    if (!silent) {
      const suffix = notebookLmNotebooks.length === 1 ? "" : "s";
      setStatus(`Loaded ${notebookLmNotebooks.length} NotebookLM notebook${suffix}.`);
    }
  } catch (error) {
    notebookLmNotebooks = [];
    notebookLmSelect.innerHTML = '<option value="">Open NotebookLM and sign in first</option>';

    if (!silent) {
      setStatus(error.message || "Could not load NotebookLM notebooks.", "error");
    }
  } finally {
    refreshNotebookLmButton.disabled = false;
    notebookLmSelect.disabled = false;
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      resolve(tab);
    });
  });
}

function normalizeYouTubeVideoUrl(value) {
  let url;

  try {
    url = new URL(String(value || ""));
  } catch (_error) {
    return "";
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else {
      const pathMatch = url.pathname.match(/^\/(?:shorts|embed|v)\/([^/?#]+)/i);
      videoId = pathMatch?.[1] || "";
    }
  }

  return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "";
}

async function getCurrentYouTubeUrl() {
  const tab = await getActiveTab();
  const youtubeUrl = normalizeYouTubeVideoUrl(tab?.url);

  if (!youtubeUrl) {
    throw new Error("Open a YouTube video tab before importing.");
  }

  return youtubeUrl;
}

function sendPageMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "NOTEBOOKTOOLS_GET_PAGE" }, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function extractPageInTab() {
  const main = document.querySelector("main, article") || document.body;
  const text = main ? main.innerText : document.body.innerText;

  return {
    title: document.title || "Untitled page",
    url: window.location.href,
    content: text.replace(/\n{3,}/g, "\n\n").trim()
  };
}

async function executePageExtract(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageInTab
  });

  return result?.result;
}

async function importCurrentYouTubeVideo() {
  importYouTubeButton.disabled = true;
  setStatus("Preparing YouTube import...", "success");

  try {
    const youtubeUrl = await getCurrentYouTubeUrl();
    const newNotebookName = selectedNotebookLmName();
    let targetNotebook = null;

    if (newNotebookName) {
      setStatus("Creating NotebookLM notebook...", "success");
      targetNotebook = await NotebookToolsNotebookLM.createNotebookLmNotebook(newNotebookName);
    } else {
      const notebookId = selectedNotebookLmId();
      targetNotebook = notebookLmNotebooks.find((notebook) => notebook.id === notebookId) || null;

      if (!targetNotebook) {
        throw new Error("Choose an existing NotebookLM notebook or enter a new notebook name.");
      }
    }

    setStatus("Sending YouTube video to NotebookLM...", "success");
    await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);

    newNotebookLmName.value = "";
    await refreshNotebookLmSelect({ silent: true });
    notebookLmSelect.value = targetNotebook.id;
    setStatus(`Imported YouTube video into "${targetNotebook.title}".`);
  } catch (error) {
    setStatus(error.message || "Could not import this YouTube video.", "error");
  } finally {
    importYouTubeButton.disabled = false;
  }
}

async function getCurrentPageCapture() {
  const tab = await getActiveTab();

  if (!tab?.id || !tab.url || /^chrome:|^edge:|^about:/.test(tab.url)) {
    throw new Error("NotebookTools cannot read this browser page. Try a normal website tab.");
  }

  let page;

  try {
    page = await sendPageMessage(tab.id);
  } catch (_error) {
    page = await executePageExtract(tab.id);
  }

  if (!page?.content) {
    throw new Error("No readable page text was found.");
  }

  return {
    ...page,
    type: "webpage",
    createdAt: new Date().toISOString()
  };
}

async function saveCurrentPage() {
  savePageButton.disabled = true;
  setStatus("Reading this webpage...", "success");

  try {
    const notebookName = selectedLocalNotebookName();
    const capture = await getCurrentPageCapture();
    const notebook = await NotebookToolsStore.saveCaptureToNotebook(capture, notebookName);

    newNotebookName.value = "";
    await refreshNotebookSelect();
    notebookSelect.value = notebook.name;
    setStatus(`Saved webpage to "${notebook.name}".`);
  } catch (error) {
    setStatus(error.message || "Could not save this webpage.", "error");
  } finally {
    savePageButton.disabled = false;
  }
}

notebookLmSelect.addEventListener("change", () => {
  if (notebookLmSelect.value) {
    newNotebookLmName.value = "";
  }
});

newNotebookLmName.addEventListener("input", () => {
  if (newNotebookLmName.value.trim()) {
    notebookLmSelect.value = "";
  }
});

notebookSelect.addEventListener("change", () => {
  if (notebookSelect.value) {
    newNotebookName.value = "";
  }
});

newNotebookName.addEventListener("input", () => {
  if (newNotebookName.value.trim()) {
    notebookSelect.value = "";
  }
});

refreshNotebookLmButton.addEventListener("click", () => refreshNotebookLmSelect());
importYouTubeButton.addEventListener("click", importCurrentYouTubeVideo);
savePageButton.addEventListener("click", saveCurrentPage);
refreshNotebookLmSelect({ silent: true });
refreshNotebookSelect();
