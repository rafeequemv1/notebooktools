const store = window.NotebookToolsNotebookFolders;
const cache = window.NotebookToolsNotebooksCache;

const searchInput = document.querySelector("#searchInput");
const mainEl = document.querySelector("#notebooksMain");
const pageStatus = document.querySelector("#pageStatus");
const refreshButton = document.querySelector("#refreshButton");
const createButton = document.querySelector("#createButton");
const folderBar = document.querySelector("#folderBar");
const tagBar = document.querySelector("#tagBar");
const sortSelect = document.querySelector("#sortSelect");
const folderBreadcrumb = document.querySelector("#folderBreadcrumb");
const folderBackButton = document.querySelector("#folderBackButton");
const folderCurrentName = document.querySelector("#folderCurrentName");
const profileButton = document.querySelector("#profileButton");
const profileDropdown = document.querySelector("#profileDropdown");
const profileInitial = document.querySelector("#profileInitial");
const viewFoldersButton = document.querySelector("#viewFoldersButton");
const viewGridButton = document.querySelector("#viewGridButton");
const viewListButton = document.querySelector("#viewListButton");
const deleteModal = document.querySelector("#deleteModal");
const deleteModalText = document.querySelector("#deleteModalText");
const deleteModalCancel = document.querySelector("#deleteModalCancel");
const deleteModalConfirm = document.querySelector("#deleteModalConfirm");
const renameModal = document.querySelector("#renameModal");
const renameModalInput = document.querySelector("#renameModalInput");
const renameModalCancel = document.querySelector("#renameModalCancel");
const renameModalConfirm = document.querySelector("#renameModalConfirm");
const notebooksBulkDeleteEl = document.querySelector("#notebooksBulkDelete");
const notebooksSelectToggleEl = document.querySelector("#notebooksSelectToggle");
const notebooksListChrome = document.querySelector("#notebooksListChrome");
const notebooksListView = document.querySelector("#notebooksListView");
const podcastView = document.querySelector("#podcastView");

let notebooks = [];
let folderState = { assignments: {}, folders: [], tags: [], tagAssignments: {}, pinned: [], favorites: [] };
let activeTag = "all";
let sortMode = "title";
let accounts = [];
let activeAccount = null;
let activeFolder = "all";
let browseMode = "all";
let openFolder = null;
let viewMode = "grid";
let loading = false;
let openMenuId = null;
let pendingDelete = null;
let pendingBulkDelete = false;
let pendingRename = null;
let appSettings = null;
let listScreen = "notebooks";
let notebookSelectMode = false;
let selectedNotebookIds = new Set();

async function loadAppSettings() {
  appSettings = await NotebookToolsSettings.getAppSettings();
}

function notebookUrl(id) {
  const url = new URL(`https://notebooklm.google.com/notebook/${encodeURIComponent(id)}`);

  if (activeAccount?.authUser && activeAccount.authUser !== "default") {
    url.searchParams.set("authuser", activeAccount.authUser);
  }

  return url.toString();
}

function authUserOption(account) {
  if (!account || account.authUser === "default") {
    return {};
  }

  return { authUser: account.authUser };
}

function setPageStatus(message, type = "") {
  if (!message) {
    pageStatus.hidden = true;
    pageStatus.textContent = "";
    pageStatus.className = "notebooks-status";
    return;
  }

  pageStatus.hidden = false;
  pageStatus.textContent = message;
  pageStatus.className = `notebooks-status${type ? ` is-${type}` : ""}`;
}

function sourceMeta(notebook) {
  if (typeof notebook.sourceCount !== "number") {
    return "—";
  }

  const limit = NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;
  const label = `${notebook.sourceCount}/${limit}`;

  if (notebook.sourceCount >= limit) {
    return `${label} · Full`;
  }

  return label;
}

function folderForNotebook(notebookId) {
  return folderState.assignments[notebookId] || "";
}

function tagsForNotebook(notebookId) {
  return Array.isArray(folderState.tagAssignments[notebookId]) ? folderState.tagAssignments[notebookId] : [];
}

function isPinnedNotebook(notebookId) {
  return store.isPinned(folderState, notebookId);
}

function isFavoriteNotebook(notebookId) {
  return store.isFavorite(folderState, notebookId);
}

function compareNotebooks(a, b) {
  if (sortMode === "sources") {
    const aCount = typeof a.sourceCount === "number" ? a.sourceCount : -1;
    const bCount = typeof b.sourceCount === "number" ? b.sourceCount : -1;
    return bCount - aCount || a.title.localeCompare(b.title);
  }

  if (sortMode === "tags") {
    const aTags = tagsForNotebook(a.id).join(", ");
    const bTags = tagsForNotebook(b.id).join(", ");
    return aTags.localeCompare(bTags) || a.title.localeCompare(b.title);
  }

  if (sortMode === "favorites") {
    const aFavorite = isFavoriteNotebook(a.id) ? 0 : 1;
    const bFavorite = isFavoriteNotebook(b.id) ? 0 : 1;
    return aFavorite - bFavorite || a.title.localeCompare(b.title);
  }

  return a.title.localeCompare(b.title);
}

function sortNotebooks(items) {
  const pinnedIds = Array.isArray(folderState.pinned) ? folderState.pinned : [];
  const pinnedSet = new Set(pinnedIds);
  const pinned = pinnedIds
    .map((id) => items.find((notebook) => notebook.id === id))
    .filter(Boolean);
  const rest = [...items].filter((notebook) => !pinnedSet.has(notebook.id));
  rest.sort(compareNotebooks);
  return [...pinned, ...rest];
}

function renderMarkerButtons(notebookId) {
  const pinned = isPinnedNotebook(notebookId);
  const favorite = isFavoriteNotebook(notebookId);

  return `
    <div class="nb-card-markers">
      <button type="button" class="nb-star-btn${favorite ? " is-active" : ""}" data-star-id="${notebookId}" aria-label="${favorite ? "Remove favorite" : "Add favorite"}" title="${favorite ? "Remove favorite" : "Add favorite"}">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.55 5.17 5.7.83-4.12 4.02.97 5.67L12 16.9l-5.1 2.69.97-5.67-4.12-4.02 5.7-.83L12 3.5Z" fill="${favorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
      <button type="button" class="nb-pin-btn${pinned ? " is-active" : ""}" data-pin-id="${notebookId}" aria-label="${pinned ? "Unpin" : "Pin to top"}" title="${pinned ? "Unpin" : "Pin to top"}">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z" fill="${pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"/><path d="M12 6.75V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.25 14h7.5l-1.5 6h-4.5l-1.5-6Z" fill="${pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;
}

function openNotebookInApp(notebook, tab = "sources") {
  NotebookToolsNotebookDetail.open(notebook, {
    tab,
    authOptions: authUserOption(activeAccount),
    notebookUrl: notebookUrl(notebook.id),
    onSourcesChanged: async (notebookId, count) => {
      notebooks = notebooks.map((item) =>
        item.id === notebookId ? { ...item, sourceCount: count } : item
      );
      await cache.updateNotebook(activeAccount?.authUser, notebookId, { sourceCount: count });
      renderMain();
    },
    onStudioCountsChanged: async (notebookId, studioCounts) => {
      notebooks = notebooks.map((item) =>
        item.id === notebookId ? { ...item, studioCounts } : item
      );
      await cache.updateNotebook(activeAccount?.authUser, notebookId, { studioCounts });

      const listView = document.querySelector("#notebooksListView");

      if (listView && !listView.hidden) {
        renderMain();
      }
    }
  });
}

function renderTagPills(notebookId) {
  const tags = tagsForNotebook(notebookId);

  if (!tags.length) {
    return "";
  }

  return `<div class="nb-card-tags">${tags
    .map((tag) => `<span class="nb-tag-pill">${NotebookToolsStore.escapeHtml(tag)}</span>`)
    .join("")}</div>`;
}

function folderLabel(folderId) {
  return folderId === "unfiled" ? "Unfiled" : folderId;
}

function countInFolder(folderId) {
  return notebooks.filter((notebook) => {
    const folder = folderForNotebook(notebook.id);
    return folderId === "unfiled" ? !folder : folder === folderId;
  }).length;
}

function extractEmailFromHtml(html) {
  const matches = String(html || "").match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const filtered = [...new Set(matches)].filter(
    (email) => !email.endsWith(".png") && !email.includes("googleusercontent")
  );

  return filtered[0] || "";
}

async function discoverAccounts() {
  const found = [];
  const candidates = [
    { authUser: "default", index: null },
    { authUser: "0", index: 0 },
    { authUser: "1", index: 1 },
    { authUser: "2", index: 2 },
    { authUser: "3", index: 3 }
  ];

  for (const candidate of candidates) {
    try {
      const url = new URL("https://notebooklm.google.com/");

      if (candidate.index !== null) {
        url.searchParams.set("authuser", String(candidate.index));
      }

      const response = await fetch(url.toString(), { credentials: "include", redirect: "error" });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();

      if (!html.includes("SNlM0e")) {
        continue;
      }

      const email = extractEmailFromHtml(html);
      const label = email || (candidate.index === null ? "Default account" : `Account ${candidate.index + 1}`);

      if (found.some((item) => item.label === label)) {
        continue;
      }

      found.push({
        authUser: candidate.authUser,
        label,
        initial: label.charAt(0).toUpperCase()
      });
    } catch (_error) {
      // Try next account slot.
    }
  }

  return found.length ? found : [{ authUser: "default", label: "Default account", initial: "A" }];
}

function getFilteredNotebooks() {
  const query = searchInput?.value?.trim().toLowerCase() || "";

  const filtered = notebooks.filter((notebook) => {
    const folder = folderForNotebook(notebook.id);

    if (browseMode === "folders" && openFolder) {
      if (openFolder === "unfiled" && folder) {
        return false;
      }

      if (openFolder !== "unfiled" && folder !== openFolder) {
        return false;
      }
    } else if (browseMode === "all") {
      if (activeFolder === "unfiled" && folder) {
        return false;
      }

      if (activeFolder !== "all" && activeFolder !== "unfiled" && folder !== activeFolder) {
        return false;
      }
    }

    if (query && !notebook.title.toLowerCase().includes(query)) {
      return false;
    }

    if (activeTag !== "all") {
      const tags = tagsForNotebook(notebook.id);

      if (!tags.includes(activeTag)) {
        return false;
      }
    }

    return true;
  });

  return sortNotebooks(filtered);
}

function closeMenus() {
  openMenuId = null;
  document.querySelectorAll(".nb-dropdown-menu, .nb-move-menu, .nb-tag-menu").forEach((node) => node.remove());
  profileDropdown.hidden = true;
  profileButton?.setAttribute("aria-expanded", "false");
}

function renderMoveMenu(anchor, notebookId) {
  closeMenus();
  openMenuId = notebookId;

  const menu = document.createElement("div");
  menu.className = "nb-move-menu";
  const current = folderForNotebook(notebookId) || "Unfiled";

  const addItem = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `nb-move-item${current === label ? " is-active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await store.setNotebookFolder(notebookId, value);
      folderState = await store.getState();
      closeMenus();
      renderAll();
    });
    menu.appendChild(btn);
  };

  addItem("Unfiled", "");

  folderState.folders.forEach((folder) => addItem(folder, folder));

  const newRow = document.createElement("div");
  newRow.className = "nb-move-new";
  newRow.innerHTML = `
    <input type="text" class="nb-move-input" placeholder="New folder" maxlength="40" />
    <button type="button" class="nb-move-create">Add</button>
  `;

  const input = newRow.querySelector("input");
  const createBtn = newRow.querySelector("button");

  createBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const name = input.value.trim();

    if (!name) {
      input.focus();
      return;
    }

    await store.addFolder(name);
    await store.setNotebookFolder(notebookId, name);
    folderState = await store.getState();
    closeMenus();
    renderAll();
  });

  menu.appendChild(newRow);
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, rect.right - 180)}px`;
  menu.style.top = `${rect.bottom + 4}px`;
}

function renderTagMenu(anchor, notebookId) {
  closeMenus();
  openMenuId = notebookId;

  const menu = document.createElement("div");
  menu.className = "nb-move-menu nb-tag-menu";
  const current = tagsForNotebook(notebookId);

  const addItem = (label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `nb-move-item${current.includes(label) ? " is-active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderState = await store.toggleNotebookTag(notebookId, label);
      closeMenus();
      renderAll();
    });
    menu.appendChild(btn);
  };

  if (!folderState.tags.length) {
    menu.innerHTML = `<p class="nb-tag-menu-empty">No tags yet. Create one below.</p>`;
  } else {
    folderState.tags.forEach((tag) => addItem(tag));
  }

  const newRow = document.createElement("div");
  newRow.className = "nb-move-new";
  newRow.innerHTML = `
    <input type="text" class="nb-move-input" placeholder="New tag" maxlength="32" />
    <button type="button" class="nb-move-create">Add</button>
  `;

  const input = newRow.querySelector("input");
  const createBtn = newRow.querySelector("button");

  createBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const name = input.value.trim();

    if (!name) {
      input.focus();
      return;
    }

    await store.addTag(name);
    folderState = await store.toggleNotebookTag(notebookId, name);
    closeMenus();
    renderAll();
  });

  menu.appendChild(newRow);
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, rect.right - 180)}px`;
  menu.style.top = `${rect.bottom + 4}px`;
}

function openNotebookMenu(anchor, notebookId) {
  closeMenus();
  openMenuId = notebookId;

  const menu = document.createElement("div");
  menu.className = "nb-dropdown-menu";
  menu.innerHTML = `
    <button type="button" class="nb-menu-item" data-action="pin" data-id="${notebookId}">${isPinnedNotebook(notebookId) ? "Unpin" : "Pin to top"}</button>
    <button type="button" class="nb-menu-item" data-action="favorite" data-id="${notebookId}">${isFavoriteNotebook(notebookId) ? "Remove favorite" : "Add favorite"}</button>
    <button type="button" class="nb-menu-item" data-action="rename" data-id="${notebookId}">Rename</button>
    <button type="button" class="nb-menu-item" data-action="tags" data-id="${notebookId}">Manage tags</button>
    <button type="button" class="nb-menu-item" data-action="move" data-id="${notebookId}">Move to folder</button>
    <button type="button" class="nb-menu-item is-danger" data-action="delete" data-id="${notebookId}">Delete</button>
  `;

  menu.querySelector('[data-action="pin"]')?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    folderState = await store.togglePin(notebookId);
    renderMain();
  });

  menu.querySelector('[data-action="favorite"]')?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    folderState = await store.toggleFavorite(notebookId);
    renderMain();
  });

  menu.querySelector('[data-action="rename"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    const notebook = notebooks.find((item) => item.id === notebookId);

    if (notebook) {
      openRenameModal(notebook);
    }
  });

  menu.querySelector('[data-action="move"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    renderMoveMenu(anchor, notebookId);
  });

  menu.querySelector('[data-action="tags"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    renderTagMenu(anchor, notebookId);
  });

  menu.querySelector('[data-action="delete"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    const notebook = notebooks.find((item) => item.id === notebookId);

    if (notebook) {
      openDeleteModal(notebook);
    }
  });

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, rect.right - 160)}px`;
  menu.style.top = `${rect.bottom + 4}px`;
}

function renderStudioTag(notebook) {
  if (!NotebookToolsSettings.isCardTagEnabled(appSettings, "notebookStudio")) {
    return "";
  }

  const counts = notebook.studioCounts;

  if (!counts?.total) {
    return "";
  }

  const label = Object.entries(counts.byType || {})
    .map(([type, count]) => `${count} ${type}`)
    .join(" · ");

  return `<span class="nb-studio-tag" title="Studio outputs (saved locally)">${NotebookToolsStore.escapeHtml(label)}</span>`;
}

function renderSourcesTag(notebook) {
  if (!NotebookToolsSettings.isCardTagEnabled(appSettings, "notebookSources")) {
    return "";
  }

  const meta = sourceMeta(notebook);
  const label = typeof notebook.sourceCount === "number" ? `${notebook.sourceCount} sources` : "Sources";
  const full =
    typeof notebook.sourceCount === "number" &&
    notebook.sourceCount >= NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;

  return `<button type="button" class="nb-sources-tag${full ? " is-full" : ""}" data-sources-id="${notebook.id}" title="View sources (${NotebookToolsStore.escapeHtml(meta)})">${NotebookToolsStore.escapeHtml(label)}</button>`;
}

function renderMenuButton(notebookId) {
  if (notebookSelectMode) {
    return "";
  }

  return `
    <button type="button" class="nb-menu-btn" data-menu-id="${notebookId}" aria-label="Notebook actions" title="Actions">⋯</button>
  `;
}

function renderSelectCheckbox(notebookId) {
  if (!notebookSelectMode) {
    return "";
  }

  const checked = selectedNotebookIds.has(notebookId);

  return `
    <label class="src-select-wrap nb-select-wrap">
      <input type="checkbox" class="src-select-input" data-nb-select-id="${notebookId}"${checked ? " checked" : ""} aria-label="Select notebook" />
      <span class="src-select-box" aria-hidden="true"></span>
    </label>
  `;
}

function updateNotebookBulkUi() {
  if (notebooksSelectToggleEl) {
    notebooksSelectToggleEl.textContent = notebookSelectMode ? "Done" : "Select";
    notebooksSelectToggleEl.classList.toggle("is-active", notebookSelectMode);
  }

  const showBulk = notebookSelectMode && selectedNotebookIds.size > 0 && listScreen === "notebooks";

  if (notebooksBulkDeleteEl) {
    notebooksBulkDeleteEl.hidden = !showBulk;
    notebooksBulkDeleteEl.textContent =
      selectedNotebookIds.size > 0 ? `Delete (${selectedNotebookIds.size})` : "Delete";
  }
}

function toggleNotebookSelected(notebookId) {
  if (selectedNotebookIds.has(notebookId)) {
    selectedNotebookIds.delete(notebookId);
  } else {
    selectedNotebookIds.add(notebookId);
  }

  renderMain();
  updateNotebookBulkUi();
}

function bindNotebookSelection() {
  mainEl.querySelectorAll("[data-nb-select-id]").forEach((input) => {
    input.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    input.addEventListener("change", (event) => {
      event.stopPropagation();
      toggleNotebookSelected(input.dataset.nbSelectId);
    });
  });

  mainEl.querySelectorAll(".nb-card.is-selectable, .nb-table tbody tr.is-selectable").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (
        !notebookSelectMode ||
        event.target.closest(".src-select-wrap") ||
        event.target.closest("[data-pin-id]") ||
        event.target.closest("[data-star-id]") ||
        event.target.closest("[data-sources-id]")
      ) {
        return;
      }

      const notebookId = row.dataset.notebookId;
      toggleNotebookSelected(notebookId);
    });
  });
}

function setListScreen(screen) {
  listScreen = screen;
  const isNotebooks = screen === "notebooks";

  if (notebooksListChrome) {
    notebooksListChrome.classList.toggle("is-hidden", !isNotebooks);
  }

  if (notebooksListView) {
    notebooksListView.hidden = !isNotebooks;
  }

  if (podcastView) {
    podcastView.hidden = isNotebooks;
  }

  NotebookToolsNotebookDetail.setListTab(screen);

  if (isNotebooks) {
    NotebookToolsPodcast.close();
    renderAll();
    updateNotebookBulkUi();
    return;
  }

  NotebookToolsPodcast.open({
    notebooks,
    authOptions: authUserOption(activeAccount),
    onOpenNotebook: (notebook) => {
      openNotebookInApp(notebook, "studio");
    }
  });
}

function bindSourcesTags() {
  mainEl.querySelectorAll("[data-sources-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const notebook = notebooks.find((item) => item.id === btn.dataset.sourcesId);

      if (notebook) {
        openNotebookInApp(notebook, "sources");
      }
    });
  });
}

function bindNotebookMenus() {
  mainEl.querySelectorAll("[data-menu-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (openMenuId === btn.dataset.menuId) {
        closeMenus();
        return;
      }

      openNotebookMenu(btn, btn.dataset.menuId);
    });
  });
}

function renderGrid(items) {
  if (!items.length) {
    mainEl.innerHTML = `<p class="notebooks-empty">${notebooks.length ? "No notebooks match your filters." : "No notebooks found."}</p>`;
    return;
  }

  mainEl.innerHTML = items
    .map((notebook) => {
      const full =
        typeof notebook.sourceCount === "number" &&
        notebook.sourceCount >= NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;

      return `
        <article class="nb-card${notebookSelectMode ? " is-selectable" : ""}${selectedNotebookIds.has(notebook.id) ? " is-selected" : ""}${full ? " is-full" : ""}${isPinnedNotebook(notebook.id) ? " is-pinned" : ""}${isFavoriteNotebook(notebook.id) ? " is-favorite" : ""}" data-notebook-id="${notebook.id}">
          ${renderSelectCheckbox(notebook.id)}
          ${renderMarkerButtons(notebook.id)}
          ${renderMenuButton(notebook.id)}
          <button type="button" class="nb-card-link" data-open-notebook="${notebook.id}">
            <span class="nb-card-title">${NotebookToolsStore.escapeHtml(notebook.title)}</span>
            ${renderTagPills(notebook.id)}
            <div class="nb-card-meta-row">
              ${renderSourcesTag(notebook)}
              ${renderStudioTag(notebook)}
            </div>
          </button>
        </article>
      `;
    })
    .join("");

  bindNotebookMenus();
  bindSourcesTags();
  bindCardOpens();
  bindMarkerButtons();
  bindNotebookSelection();
  updateNotebookBulkUi();
}

function bindMarkerButtons() {
  mainEl.querySelectorAll("[data-star-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderState = await store.toggleFavorite(btn.dataset.starId);
      renderMain();
    });
  });

  mainEl.querySelectorAll("[data-pin-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderState = await store.togglePin(btn.dataset.pinId);
      renderMain();
    });
  });
}

function bindCardOpens() {
  mainEl.querySelectorAll("[data-open-notebook]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (notebookSelectMode) {
        toggleNotebookSelected(btn.dataset.openNotebook);
        return;
      }

      const notebook = notebooks.find((item) => item.id === btn.dataset.openNotebook);

      if (notebook) {
        openNotebookInApp(notebook, "sources");
      }
    });
  });
}

function renderList(items) {
  if (!items.length) {
    mainEl.innerHTML = `<p class="notebooks-empty">${notebooks.length ? "No notebooks match your filters." : "No notebooks found."}</p>`;
    return;
  }

  const showFolderCol =
    browseMode === "all" && NotebookToolsSettings.isCardTagEnabled(appSettings, "notebookFolder");

  mainEl.innerHTML = `
    <table class="nb-table">
      <thead>
        <tr>
          ${notebookSelectMode ? '<th class="nb-table-select-col"></th>' : ""}
          <th class="nb-table-markers-col"></th>
          <th>Notebook</th>
          <th>Tags</th>
          <th>Sources</th>
          ${showFolderCol ? "<th>Folder</th>" : ""}
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map((notebook) => {
            const folder = folderForNotebook(notebook.id) || "—";
            const tags = tagsForNotebook(notebook.id).join(", ") || "—";
            return `
              <tr class="${notebookSelectMode ? "is-selectable" : ""}${selectedNotebookIds.has(notebook.id) ? " is-selected" : ""}${isPinnedNotebook(notebook.id) ? " is-pinned" : ""}${isFavoriteNotebook(notebook.id) ? " is-favorite" : ""}" data-notebook-id="${notebook.id}">
                ${notebookSelectMode ? `<td class="nb-table-select">${renderSelectCheckbox(notebook.id)}</td>` : ""}
                <td class="nb-table-markers">${renderMarkerButtons(notebook.id)}</td>
                <td>
                  <button type="button" class="nb-table-title" data-open-notebook="${notebook.id}">${NotebookToolsStore.escapeHtml(notebook.title)}</button>
                </td>
                <td class="nb-table-tags">${NotebookToolsStore.escapeHtml(tags)}</td>
                <td class="nb-table-meta">${renderSourcesTag(notebook)} ${renderStudioTag(notebook)}</td>
                ${showFolderCol ? `<td class="nb-table-folder">${NotebookToolsStore.escapeHtml(folder)}</td>` : ""}
                <td class="nb-table-actions">${renderMenuButton(notebook.id)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  bindNotebookMenus();
  bindSourcesTags();
  bindCardOpens();
  bindMarkerButtons();
  bindNotebookSelection();
  updateNotebookBulkUi();
}

function renderFolderGrid() {
  const folders = [
    { id: "unfiled", label: "Unfiled" },
    ...folderState.folders.map((folder) => ({ id: folder, label: folder }))
  ];

  if (!folders.length) {
    mainEl.innerHTML = `<p class="notebooks-empty">Create a folder to organize notebooks.</p>`;
    return;
  }

  mainEl.innerHTML = folders
    .map((folder) => {
      const count = countInFolder(folder.id);

      return `
        <button type="button" class="nb-folder-card" data-open-folder="${NotebookToolsStore.escapeHtml(folder.id)}">
          <span class="nb-folder-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </span>
          <span class="nb-folder-name">${NotebookToolsStore.escapeHtml(folder.label)}</span>
          <span class="nb-folder-count">${count} notebook${count === 1 ? "" : "s"}</span>
        </button>
      `;
    })
    .join("");

  mainEl.querySelectorAll("[data-open-folder]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openFolder = btn.dataset.openFolder;
      renderAll();
    });
  });
}

function renderNotebooks() {
  const items = getFilteredNotebooks();
  mainEl.classList.toggle("notebooks-grid", viewMode === "grid");
  mainEl.classList.toggle("notebooks-list", viewMode === "list");
  mainEl.classList.remove("notebooks-folders");

  if (viewMode === "list") {
    renderList(items);
  } else {
    renderGrid(items);
  }
}

function renderMain() {
  if (browseMode === "folders" && !openFolder) {
    mainEl.classList.remove("notebooks-grid", "notebooks-list");
    mainEl.classList.add("notebooks-folders");
    renderFolderGrid();
    return;
  }

  renderNotebooks();
}

function renderBreadcrumb() {
  const show = browseMode === "folders" && openFolder;

  if (!folderBreadcrumb) {
    return;
  }

  folderBreadcrumb.hidden = !show;

  if (show && folderCurrentName) {
    folderCurrentName.textContent = folderLabel(openFolder);
  }
}

function renderFolderBar() {
  if (!folderBar) {
    return;
  }

  if (browseMode === "folders") {
    folderBar.hidden = true;
    return;
  }

  folderBar.hidden = false;

  const pills = [
    { id: "all", label: "All" },
    ...folderState.folders.map((folder) => ({ id: folder, label: folder })),
    { id: "unfiled", label: "Unfiled" }
  ];

  folderBar.innerHTML =
    pills
      .map((pill) => {
        const active = activeFolder === pill.id ? " is-active" : "";
        return `<button type="button" class="folder-pill${active}" data-folder="${pill.id}">${NotebookToolsStore.escapeHtml(pill.label)}</button>`;
      })
      .join("") + `<button type="button" class="folder-pill folder-pill-add" id="newFolderButton">+ Folder</button>`;

  folderBar.querySelectorAll("[data-folder]").forEach((pill) => {
    pill.addEventListener("click", () => {
      activeFolder = pill.dataset.folder;
      renderFolderBar();
      renderMain();
    });
  });

  folderBar.querySelector("#newFolderButton")?.addEventListener("click", async () => {
    const name = window.prompt("Folder name");

    if (!name?.trim()) {
      return;
    }

    await store.addFolder(name.trim());
    folderState = await store.getState();
    activeFolder = name.trim();
    renderAll();
  });
}

function renderTagBar() {
  if (!tagBar) {
    return;
  }

  if (browseMode === "folders") {
    tagBar.hidden = true;
    return;
  }

  tagBar.hidden = false;

  const pills = [
    { id: "all", label: "All tags" },
    ...folderState.tags.map((tag) => ({ id: tag, label: tag }))
  ];

  tagBar.innerHTML =
    pills
      .map((pill) => {
        const active = activeTag === pill.id ? " is-active" : "";
        return `<button type="button" class="tag-pill${active}" data-tag="${NotebookToolsStore.escapeHtml(pill.id)}">${NotebookToolsStore.escapeHtml(pill.label)}</button>`;
      })
      .join("") + `<button type="button" class="tag-pill tag-pill-add" id="newTagButton">+ Tag</button>`;

  tagBar.querySelectorAll("[data-tag]").forEach((pill) => {
    pill.addEventListener("click", async () => {
      activeTag = pill.dataset.tag;
      await store.setActiveTag(activeTag);
      renderTagBar();
      renderMain();
    });
  });

  tagBar.querySelector("#newTagButton")?.addEventListener("click", async () => {
    const name = window.prompt("Tag name");

    if (!name?.trim()) {
      return;
    }

    await store.addTag(name.trim());
    folderState = await store.getState();
    activeTag = name.trim();
    await store.setActiveTag(activeTag);
    renderAll();
  });
}

function renderProfileDropdown() {
  profileDropdown.innerHTML = accounts
    .map((account) => {
      const active = activeAccount?.authUser === account.authUser ? " is-active" : "";
      return `
        <button type="button" class="profile-item${active}" data-auth-user="${account.authUser}">
          <span class="profile-item-avatar">${NotebookToolsStore.escapeHtml(account.initial)}</span>
          <span class="profile-item-label">${NotebookToolsStore.escapeHtml(account.label)}</span>
        </button>
      `;
    })
    .join("");

  profileDropdown.querySelectorAll("[data-auth-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const authUser = btn.dataset.authUser;
      activeAccount = accounts.find((item) => item.authUser === authUser) || accounts[0];
      await store.setAuthUser(authUser === "default" ? null : authUser);
      profileInitial.textContent = activeAccount.initial;
      closeMenus();
      notebooks = await cache.get(activeAccount?.authUser);
      renderAll();
      await loadNotebooks();
    });
  });
}

function renderViewToggle() {
  viewFoldersButton?.classList.toggle("is-active", browseMode === "folders");
  viewGridButton?.classList.toggle("is-active", browseMode !== "folders" && viewMode === "grid");
  viewListButton?.classList.toggle("is-active", browseMode !== "folders" && viewMode === "list");
}

function renderAll() {
  renderBreadcrumb();
  renderFolderBar();
  renderTagBar();
  renderMain();
  renderViewToggle();
}

function openDeleteModal(notebook) {
  pendingDelete = notebook;
  pendingBulkDelete = false;
  deleteModalText.textContent = `"${notebook.title}" will be permanently deleted. This cannot be undone.`;
  deleteModal.hidden = false;
  deleteModalConfirm.focus();
}

function openBulkDeleteModal() {
  const count = selectedNotebookIds.size;

  if (!count) {
    return;
  }

  pendingDelete = null;
  pendingBulkDelete = true;
  deleteModalText.textContent =
    count === 1
      ? `"${notebooks.find((item) => selectedNotebookIds.has(item.id))?.title || "This notebook"}" will be permanently deleted. This cannot be undone.`
      : `${count} notebooks will be permanently deleted. This cannot be undone.`;
  deleteModal.hidden = false;
  deleteModalConfirm.focus();
}

function closeDeleteModal() {
  pendingDelete = null;
  pendingBulkDelete = false;
  deleteModal.hidden = true;
}

function openRenameModal(notebook) {
  pendingRename = notebook;
  renameModalInput.value = notebook.title;
  renameModal.hidden = false;
  renameModalInput.focus();
  renameModalInput.select();
}

function closeRenameModal() {
  pendingRename = null;
  renameModal.hidden = true;
  renameModalInput.value = "";
}

async function confirmDeleteNotebook() {
  const targets = pendingBulkDelete
    ? notebooks.filter((item) => selectedNotebookIds.has(item.id))
    : pendingDelete
      ? [pendingDelete]
      : [];

  if (!targets.length || loading) {
    return;
  }

  closeDeleteModal();
  loading = true;
  setPageStatus(
    targets.length === 1 ? "Deleting notebook..." : `Deleting ${targets.length} notebooks...`,
    "loading"
  );

  let deleted = 0;
  let failed = 0;

  for (const notebook of targets) {
    try {
      await NotebookToolsNotebookLM.deleteNotebookLmNotebook(
        notebook.id,
        authUserOption(activeAccount)
      );
      await cache.removeNotebook(activeAccount?.authUser, notebook.id);
      folderState = await store.pruneNotebook(notebook.id);
      notebooks = notebooks.filter((item) => item.id !== notebook.id);
      selectedNotebookIds.delete(notebook.id);
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error("Delete notebook failed:", notebook.id, error);
    }
  }

  loading = false;
  renderAll();
  updateNotebookBulkUi();

  if (failed > 0) {
    setPageStatus(`Deleted ${deleted} of ${deleted + failed}. Some notebooks could not be deleted.`, "error");
  } else {
    setPageStatus(
      deleted === 1 ? "Notebook deleted." : `${deleted} notebooks deleted.`,
      ""
    );
  }
}

async function confirmRenameNotebook() {
  if (!pendingRename || loading) {
    return;
  }

  const notebook = pendingRename;
  const newTitle = renameModalInput.value.trim();

  if (!newTitle) {
    renameModalInput.focus();
    return;
  }

  if (newTitle === notebook.title) {
    closeRenameModal();
    return;
  }

  closeRenameModal();
  loading = true;
  setPageStatus("Renaming notebook...", "loading");

  try {
    await NotebookToolsNotebookLM.renameNotebookLmNotebook(
      notebook.id,
      newTitle,
      authUserOption(activeAccount)
    );
    await cache.updateNotebook(activeAccount?.authUser, notebook.id, { title: newTitle });
    notebooks = notebooks.map((item) =>
      item.id === notebook.id ? { ...item, title: newTitle } : item
    );
    renderAll();
    setPageStatus("");
  } catch (error) {
    setPageStatus(error.message || "Could not rename notebook.", "error");
  } finally {
    loading = false;
  }
}

async function loadNotebooks({ force = false } = {}) {
  if (loading) {
    return;
  }

  loading = true;
  refreshButton.disabled = true;
  refreshButton.classList.add("is-spinning");

  const hadCache = notebooks.length > 0;

  if (!hadCache) {
    const cached = await cache.get(activeAccount?.authUser);

    if (cached.length) {
      notebooks = cached;
      renderAll();
    }
  }

  if (force || (!hadCache && !notebooks.length)) {
    setPageStatus("Loading notebooks...", "loading");
  } else if (!force) {
    setPageStatus("Syncing...", "loading");
  }

  try {
    const options = { ...authUserOption(activeAccount) };
    const remote = await NotebookToolsNotebookLM.listNotebookLmNotebooks(options);
    const cached = await cache.get(activeAccount?.authUser);

    if (!remote.length && cached.length) {
      notebooks = cached;

      if (force) {
        setPageStatus("Could not refresh notebooks. Showing cached list.", "error");
      } else {
        setPageStatus("");
      }

      renderAll();
      return;
    }

    const merged = force ? remote : cache.mergeRemote(cached, remote);

    await cache.set(activeAccount?.authUser, merged);
    notebooks = merged;
    renderAll();
    setPageStatus("");
  } catch (error) {
    if (!notebooks.length) {
      mainEl.innerHTML = "";
      setPageStatus(error.message || "Could not load notebooks.", "error");
    } else {
      setPageStatus("");
    }
  } finally {
    loading = false;
    refreshButton.disabled = false;
    refreshButton.classList.remove("is-spinning");
  }
}

async function createNotebook() {
  const name = window.prompt("Notebook name");

  if (!name?.trim()) {
    return;
  }

  createButton.disabled = true;
  setPageStatus("Creating notebook...", "loading");

  try {
    const created = await NotebookToolsNotebookLM.createNotebookLmNotebook(
      name.trim(),
      authUserOption(activeAccount)
    );
    await cache.addNotebook(activeAccount?.authUser, created);
    notebooks = [created, ...notebooks.filter((item) => item.id !== created.id)];
    renderAll();
    chrome.tabs.create({ url: notebookUrl(created.id) });
  } catch (error) {
    setPageStatus(error.message || "Could not create notebook.", "error");
  } finally {
    createButton.disabled = false;
  }
}

async function initAccounts() {
  accounts = await discoverAccounts();
  const saved = await store.getAuthUser();
  activeAccount =
    accounts.find((item) => item.authUser === (saved ?? "default")) ||
    accounts.find((item) => item.authUser === "default") ||
    accounts[0];
  profileInitial.textContent = activeAccount?.initial || "A";
  renderProfileDropdown();
}

viewFoldersButton?.addEventListener("click", async () => {
  browseMode = browseMode === "folders" ? "all" : "folders";
  openFolder = null;
  await store.setBrowseMode(browseMode);
  renderAll();
});

viewGridButton?.addEventListener("click", async () => {
  viewMode = "grid";
  await store.setViewMode("grid");
  renderAll();
});

viewListButton?.addEventListener("click", async () => {
  viewMode = "list";
  await store.setViewMode("list");
  renderAll();
});

folderBackButton?.addEventListener("click", () => {
  openFolder = null;
  renderAll();
});

profileButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = profileDropdown.hidden;
  closeMenus();

  if (open) {
    profileDropdown.hidden = false;
    profileButton.setAttribute("aria-expanded", "true");
  }
});

searchInput?.addEventListener("input", () => renderMain());
refreshButton?.addEventListener("click", () => loadNotebooks({ force: true }));
createButton?.addEventListener("click", createNotebook);
deleteModalCancel?.addEventListener("click", closeDeleteModal);
deleteModalConfirm?.addEventListener("click", confirmDeleteNotebook);
deleteModal?.querySelector("[data-modal-cancel]")?.addEventListener("click", closeDeleteModal);
renameModalCancel?.addEventListener("click", closeRenameModal);
renameModalConfirm?.addEventListener("click", confirmRenameNotebook);
renameModal?.querySelector("[data-rename-cancel]")?.addEventListener("click", closeRenameModal);

renameModalInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmRenameNotebook();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!deleteModal?.hidden) {
      closeDeleteModal();
    } else if (!renameModal?.hidden) {
      closeRenameModal();
    } else {
      closeMenus();
    }
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile-wrap")) {
    profileDropdown.hidden = true;
    profileButton?.setAttribute("aria-expanded", "false");
  }

  if (
    !event.target.closest(".nb-menu-btn") &&
    !event.target.closest(".nb-dropdown-menu") &&
    !event.target.closest(".nb-move-menu") &&
    !event.target.closest(".nb-tag-menu")
  ) {
    closeMenus();
  }
});

async function init() {
  await NotebookToolsTheme.init();
  await loadAppSettings();

  if (window.NotebookToolsI18n) {
    await NotebookToolsI18n.init(appSettings.language);
    NotebookToolsI18n.apply(document);
  }

  if (window.NotebookToolsSettingsUI) {
    NotebookToolsSettingsUI.init();
  }

  NotebookToolsSourcesPanel.setAppSettings(appSettings);

  NotebookToolsSettings.onChange(async (next) => {
    appSettings = next;

    if (window.NotebookToolsI18n) {
      await NotebookToolsI18n.init(next.language);
      NotebookToolsI18n.apply(document);
    }

    NotebookToolsSourcesPanel.setAppSettings(next);
    renderMain();
  });

  NotebookToolsSourcesPanel.init();
  NotebookToolsDuplicateScan.init();
  NotebookToolsSourcesBulk.init();
  NotebookToolsNotesPanel.init();
  NotebookToolsStudio.init();
  NotebookToolsPodcast.init();
  NotebookToolsNotebookDetail.init();
  NotebookToolsNotebookDetail.setOnListTabChange(setListScreen);
  folderState = await store.getState();
  viewMode = await store.getViewMode();
  browseMode = await store.getBrowseMode();
  sortMode = await store.getSortMode();
  activeTag = await store.getActiveTag();

  if (sortSelect) {
    sortSelect.value = sortMode;
    sortSelect.addEventListener("change", async () => {
      sortMode = sortSelect.value;
      await store.setSortMode(sortMode);
      renderMain();
    });
  }

  notebooksSelectToggleEl?.addEventListener("click", () => {
    notebookSelectMode = !notebookSelectMode;

    if (!notebookSelectMode) {
      selectedNotebookIds.clear();
    }

    renderMain();
    updateNotebookBulkUi();
  });

  notebooksBulkDeleteEl?.addEventListener("click", () => {
    openBulkDeleteModal();
  });

  updateNotebookBulkUi();

  await initAccounts();
  notebooks = await cache.get(activeAccount?.authUser);

  if (notebooks.length) {
    renderAll();
  }

  await loadNotebooks();
}

init();
