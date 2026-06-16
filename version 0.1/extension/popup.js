const notebookLmSelect = document.querySelector("#notebookLmSelect");
const newNotebookLmName = document.querySelector("#newNotebookLmName");
const importYouTubeButton = document.querySelector("#importYouTubeButton");
const refreshNotebookLmButton = document.querySelector("#refreshNotebookLmButton");
const statusBox = document.querySelector("#status");

let notebookLmNotebooks = [];

function setStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function selectedNotebookLmName() {
  return NotebookToolsStore.cleanNotebookName(newNotebookLmName.value);
}

function selectedNotebookLmId() {
  return notebookLmSelect.value || "";
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

refreshNotebookLmButton.addEventListener("click", () => refreshNotebookLmSelect());
importYouTubeButton.addEventListener("click", importCurrentYouTubeVideo);
refreshNotebookLmSelect({ silent: true });
