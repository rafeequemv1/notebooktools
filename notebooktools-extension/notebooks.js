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
let smartView = "all";
let sortDir = 1;
let renderLimit = 200;

async function loadAppSettings() {
  appSettings = await NotebookToolsSettings.getAppSettings();
}

function notebookUrl(id) {
  const url = new URL(`https://notebook.google.com/notebook/${encodeURIComponent(id)}`);

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

function sortName(notebook) {
  return String(notebook.title || "").replace(/^[^\p{L}\p{N}]+/u, "").toLocaleLowerCase();
}

function compareNotebooks(a, b) {
  if (sortMode === "sources") {
    const aCount = typeof a.sourceCount === "number" ? a.sourceCount : -1;
    const bCount = typeof b.sourceCount === "number" ? b.sourceCount : -1;
    return bCount - aCount || sortName(a).localeCompare(sortName(b), undefined, { numeric: true });
  }

  if (sortMode === "tags") {
    const aTags = tagsForNotebook(a.id).join(", ");
    const bTags = tagsForNotebook(b.id).join(", ");
    return aTags.localeCompare(bTags) || sortName(a).localeCompare(sortName(b), undefined, { numeric: true });
  }

  if (sortMode === "folder") {
    const aFolder = folderForNotebook(a.id) || "\uffff";
    const bFolder = folderForNotebook(b.id) || "\uffff";
    return aFolder.localeCompare(bFolder) || sortName(a).localeCompare(sortName(b), undefined, { numeric: true });
  }

  if (sortMode === "studio") {
    return (b.studioCounts?.total || 0) - (a.studioCounts?.total || 0) || sortName(a).localeCompare(sortName(b), undefined, { numeric: true });
  }

  if (sortMode === "favorites") {
    const aFavorite = isFavoriteNotebook(a.id) ? 0 : 1;
    const bFavorite = isFavoriteNotebook(b.id) ? 0 : 1;
    return aFavorite - bFavorite || sortName(a).localeCompare(sortName(b), undefined, { numeric: true });
  }

  return sortName(a).localeCompare(sortName(b), undefined, { numeric: true });
}

function sortNotebooks(items) {
  const pinnedIds = Array.isArray(folderState.pinned) ? folderState.pinned : [];
  const pinnedSet = new Set(pinnedIds);
  const pinned = pinnedIds
    .map((id) => items.find((notebook) => notebook.id === id))
    .filter(Boolean);
  const rest = [...items].filter((notebook) => !pinnedSet.has(notebook.id));
  rest.sort((a, b) => compareNotebooks(a, b) * sortDir);
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
      const url = new URL(`${NotebookToolsNotebookLM.getOrigin?.() || "https://notebook.google.com"}/`);

      if (candidate.index !== null) {
        url.searchParams.set("authuser", String(candidate.index));
      }

      const response = await fetch(url.toString(), { credentials: "include", redirect: "follow" });

      if (!response.ok || /accounts\.google\.com/.test(new URL(response.url || url.toString()).hostname)) {
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

    if (activeFolder === "unfiled" && folder) {
      return false;
    }

    if (activeFolder !== "all" && activeFolder !== "unfiled" && folder !== activeFolder) {
      return false;
    }

    if (!matchesSmartView(notebook, smartView)) {
      return false;
    }

    const tags = tagsForNotebook(notebook.id);

    if (activeTag !== "all" && !tags.includes(activeTag)) {
      return false;
    }

    if (query) {
      const haystack = `${notebook.title} ${tags.join(" ")} ${folder}`.toLowerCase();

      if (!query.split(/\s+/).every((word) => haystack.includes(word))) {
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
    renderAll();
  });

  menu.querySelector('[data-action="favorite"]')?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    folderState = await store.toggleFavorite(notebookId);
    renderAll();
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
  const bar = document.querySelector("#nbBulkBar");
  const count = selectedNotebookIds.size;
  const show = count > 0 && listScreen === "notebooks";

  if (bar) {
    bar.hidden = !show;
  }

  const label = document.querySelector("#nbBulkCount");

  if (label) {
    label.textContent = `${count} selected`;
  }

  if (notebooksBulkDeleteEl) {
    notebooksBulkDeleteEl.textContent = count > 1 ? `Delete ${count}` : "Delete";
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

  mainEl.querySelectorAll(".nbx-card, .nbx-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (
        selectedNotebookIds.size === 0 ||
        event.target.closest("button, a, input, label")
      ) {
        return;
      }

      toggleNotebookSelected(row.dataset.notebookId);
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

function bindMarkerButtons() {
  mainEl.querySelectorAll("[data-star-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderState = await store.toggleFavorite(btn.dataset.starId);
      renderAll();
    });
  });

  mainEl.querySelectorAll("[data-pin-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      folderState = await store.togglePin(btn.dataset.pinId);
      renderAll();
    });
  });
}

function bindCardOpens() {
  mainEl.querySelectorAll("[data-open-notebook]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (viewMode === "grid" && selectedNotebookIds.size > 0) {
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

/* ---------- Workspace: table + cards + sidebar (CRM-style) ---------- */
const esc = (value) => NotebookToolsStore.escapeHtml(value);
const PAGE_SIZE = 200;
const DOT_COLORS = ["#4c8df6", "#1e8e3e", "#e8a200", "#d93025", "#9334e6", "#12a4b6", "#d01884", "#80868b"];

const ICON = {
  star: (on) => `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.55 5.17 5.7.83-4.12 4.02.97 5.67L12 16.9l-5.1 2.69.97-5.67-4.12-4.02 5.7-.83L12 3.5Z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  pin: (on) => `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5h6l-1 5.5 3.5 3.5v1.5h-11V12.5L10 9 9 3.5Z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 14v6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  folder: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  inbox: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 13l2.5-7.5h11L20 13v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M4 13h4.5l1 2h5l1-2H20" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
  all: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 9h6M9 13h6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  full: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  untagged: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7-8.3-8.3Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>`,
  podcast: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><rect x="3.5" y="14" width="4" height="6" rx="1.5" stroke="currentColor" stroke-width="1.9"/><rect x="16.5" y="14" width="4" height="6" rx="1.5" stroke="currentColor" stroke-width="1.9"/></svg>`,
  open: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4.5h5.5V10M19.5 4.5 11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  more: `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/></svg>`,
  plus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  x: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`
};

/* Platforms the extension can import from (content-script Import button). */
const IMPORT_PLATFORMS = [
  { label: "ChatGPT", url: "https://chatgpt.com/", color: "#10a37f" },
  { label: "Claude", url: "https://claude.ai/", color: "#d97757" },
  { label: "Gemini", url: "https://gemini.google.com/", color: "#4c8df6" },
  { label: "Perplexity", url: "https://www.perplexity.ai/", color: "#20808d" },
  { label: "Grok", url: "https://grok.com/", color: "var(--nt-ink)" },
  { label: "Kimi", url: "https://www.kimi.com/", color: "#3b6fe0" },
  { label: "YouTube", url: "https://www.youtube.com/", color: "#ff0033" },
  { label: "X", url: "https://x.com/", color: "var(--nt-ink)" },
  { label: "Reddit", url: "https://www.reddit.com/", color: "#ff4500" },
  { label: "LinkedIn", url: "https://www.linkedin.com/", color: "#0a66c2" },
  { label: "Google Docs", url: "https://docs.google.com/document/", color: "#1a73e8" }
];

const SMART_VIEWS = [
  { id: "all", label: "All notebooks", icon: ICON.all },
  { id: "favorites", label: "Favorites", icon: ICON.star(false) },
  { id: "pinned", label: "Pinned", icon: ICON.pin(false) },
  { id: "full", label: "Full (source limit)", icon: ICON.full },
  { id: "untagged", label: "Untagged", icon: ICON.untagged }
];

function isFullNotebook(notebook) {
  return typeof notebook.sourceCount === "number" && notebook.sourceCount >= NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;
}

function matchesSmartView(notebook, view) {
  if (view === "favorites") return isFavoriteNotebook(notebook.id);
  if (view === "pinned") return isPinnedNotebook(notebook.id);
  if (view === "full") return isFullNotebook(notebook);
  if (view === "untagged") return tagsForNotebook(notebook.id).length === 0;
  return true;
}

function tagColorIndex(tag) {
  let hash = 0;
  for (const ch of String(tag)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 8;
}

function tagPill(tag) {
  return `<span class="nbx-tag nbx-c${tagColorIndex(tag)}">${esc(tag)}</span>`;
}

function splitTitle(title) {
  const text = String(title || "Untitled notebook");
  const match = text.match(/^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}|\p{Regional_Indicator})*)\s*/u);
  if (match && text.length > match[0].length) {
    return { emoji: match[1], name: text.slice(match[0].length) };
  }
  return { emoji: "", name: text };
}

function notebookIcon(notebook) {
  const { emoji, name } = splitTitle(notebook.title);
  if (emoji) return `<span class="nbx-ico" aria-hidden="true">${emoji}</span>`;
  const letter = (name.trim()[0] || "N").toUpperCase();
  return `<span class="nbx-ico is-letter nbx-c${tagColorIndex(name)}" aria-hidden="true">${esc(letter)}</span>`;
}

function sourcesCell(notebook) {
  if (typeof notebook.sourceCount !== "number") {
    return `<button type="button" class="nbx-src is-unknown" data-sources-id="${notebook.id}" title="Open sources"><span class="nbx-muted">—</span></button>`;
  }
  const limit = NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;
  const pct = Math.min(100, Math.round((notebook.sourceCount / limit) * 100));
  const full = notebook.sourceCount >= limit;
  return `<button type="button" class="nbx-src${full ? " is-full" : ""}" data-sources-id="${notebook.id}" title="${notebook.sourceCount} of ${limit} sources · open sources">
    <span class="nbx-src-num">${notebook.sourceCount}</span>
    <span class="nbx-meter" aria-hidden="true"><i style="width:${pct}%"></i></span>
    ${full ? '<span class="nbx-full">Full</span>' : ""}
  </button>`;
}

function studioCell(notebook, compact = false) {
  const counts = notebook.studioCounts;
  if (!counts?.total) return compact ? "" : `<span class="nbx-muted">—</span>`;
  const label = Object.entries(counts.byType || {}).map(([type, count]) => `${count} ${type}`).join(" · ");
  return `<span class="nbx-studio" title="Studio outputs: ${esc(label)}">${counts.total} output${counts.total === 1 ? "" : "s"}</span>`;
}

function markerIcons(notebookId) {
  const fav = isFavoriteNotebook(notebookId);
  const pin = isPinnedNotebook(notebookId);
  return `<span class="nbx-marks">
    <button type="button" class="nbx-mark is-star${fav ? " is-on" : ""}" data-star-id="${notebookId}" title="${fav ? "Remove favorite" : "Favorite"}" aria-label="${fav ? "Remove favorite" : "Favorite"}">${ICON.star(fav)}</button>
    <button type="button" class="nbx-mark is-pin${pin ? " is-on" : ""}" data-pin-id="${notebookId}" title="${pin ? "Unpin" : "Pin to top"}" aria-label="${pin ? "Unpin" : "Pin to top"}">${ICON.pin(pin)}</button>
  </span>`;
}

function checkBox(attrs, checked, label) {
  return `<label class="nbx-check"><input type="checkbox" ${attrs}${checked ? " checked" : ""} aria-label="${label}"><span aria-hidden="true"></span></label>`;
}

function tagsCell(notebookId) {
  const tags = tagsForNotebook(notebookId);
  return `<div class="nbx-tags">${tags.map(tagPill).join("")}<button type="button" class="nbx-add" data-tag-edit="${notebookId}" title="Edit tags" aria-label="Edit tags">${ICON.plus}${tags.length ? "" : "<span>Tag</span>"}</button></div>`;
}

function folderCell(notebookId) {
  const folder = folderForNotebook(notebookId);
  return folder
    ? `<button type="button" class="nbx-folder" data-folder-edit="${notebookId}" title="Move to folder">${ICON.folder}<span>${esc(folder)}</span></button>`
    : `<button type="button" class="nbx-folder is-empty" data-folder-edit="${notebookId}" title="Move to folder">${ICON.plus}<span>Folder</span></button>`;
}

function emptyState() {
  if (!notebooks.length) {
    return `<div class="nbx-empty"><strong>No notebooks yet</strong><p>Sign in to Gemini Notebook in this browser, then refresh. Or create your first notebook.</p></div>`;
  }
  return `<div class="nbx-empty"><strong>No notebooks match</strong><p>Try another search, or clear the filters.</p><button type="button" class="nbx-ghost" data-clear-filters>Clear filters</button></div>`;
}

function moreButton(total) {
  if (total <= renderLimit) return "";
  return `<div class="nbx-more"><button type="button" class="nbx-ghost" data-show-more>Show ${Math.min(PAGE_SIZE, total - renderLimit)} more · ${total - renderLimit} hidden</button></div>`;
}

function sortHeader(key, label, cls = "") {
  const active = sortMode === key;
  const arrow = active ? `<span class="nbx-caret${sortDir === -1 ? " is-up" : ""}" aria-hidden="true">▾</span>` : "";
  return `<th class="${cls}" ${active ? `aria-sort="${sortDir === 1 ? "descending" : "ascending"}"` : ""}><button type="button" class="nbx-th${active ? " is-sorted" : ""}" data-sort="${key}">${label}${arrow}</button></th>`;
}

function renderList(allItems) {
  if (!allItems.length) {
    mainEl.innerHTML = emptyState();
    bindWorkspace();
    return;
  }

  const items = allItems.slice(0, renderLimit);
  const allChecked = allItems.every((notebook) => selectedNotebookIds.has(notebook.id));
  const someChecked = !allChecked && allItems.some((notebook) => selectedNotebookIds.has(notebook.id));

  mainEl.innerHTML = `
    <div class="nbx-table-wrap">
      <table class="nbx-table">
        <thead>
          <tr>
            <th class="nbx-col-check">${checkBox(`data-select-all${someChecked ? ' data-indeterminate="1"' : ""}`, allChecked, "Select all")}</th>
            ${sortHeader("title", "Name", "nbx-col-name")}
            ${sortHeader("sources", "Sources", "nbx-col-src")}
            ${sortHeader("tags", "Tags", "nbx-col-tags")}
            ${sortHeader("folder", "Folder", "nbx-col-folder")}
            ${sortHeader("studio", "Studio", "nbx-col-studio")}
            <th class="nbx-col-act"><span class="nbx-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((notebook) => {
              const selected = selectedNotebookIds.has(notebook.id);
              const { name } = splitTitle(notebook.title);
              return `
                <tr class="nbx-row${selected ? " is-selected" : ""}${isPinnedNotebook(notebook.id) ? " is-pinned" : ""}" data-notebook-id="${notebook.id}">
                  <td class="nbx-col-check">${checkBox(`data-nb-select-id="${notebook.id}"`, selected, "Select notebook")}</td>
                  <td class="nbx-col-name">
                    <div class="nbx-name">
                      ${notebookIcon(notebook)}
                      <button type="button" class="nbx-title" data-open-notebook="${notebook.id}" title="${esc(notebook.title)}">${esc(name)}</button>
                      ${markerIcons(notebook.id)}
                    </div>
                  </td>
                  <td class="nbx-col-src">${sourcesCell(notebook)}</td>
                  <td class="nbx-col-tags">${tagsCell(notebook.id)}</td>
                  <td class="nbx-col-folder">${folderCell(notebook.id)}</td>
                  <td class="nbx-col-studio">${studioCell(notebook)}</td>
                  <td class="nbx-col-act">
                    <a class="nbx-iconbtn" href="${notebookUrl(notebook.id)}" target="_blank" rel="noopener noreferrer" title="Open in Gemini Notebook" aria-label="Open in Gemini Notebook">${ICON.open}</a>
                    <button type="button" class="nbx-iconbtn nb-menu-btn" data-menu-id="${notebook.id}" title="More actions" aria-label="More actions">${ICON.more}</button>
                  </td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    ${moreButton(allItems.length)}
  `;

  const selectAll = mainEl.querySelector("[data-select-all]");
  if (selectAll?.dataset.indeterminate) selectAll.indeterminate = true;
  bindWorkspace();
}

function renderGrid(allItems) {
  if (!allItems.length) {
    mainEl.innerHTML = emptyState();
    bindWorkspace();
    return;
  }

  const items = allItems.slice(0, renderLimit);
  const selecting = selectedNotebookIds.size > 0;

  mainEl.innerHTML = `
    <div class="nbx-cards${selecting ? " is-selecting" : ""}">
      ${items
        .map((notebook) => {
          const selected = selectedNotebookIds.has(notebook.id);
          const { name } = splitTitle(notebook.title);
          return `
            <article class="nbx-card${selected ? " is-selected" : ""}${isPinnedNotebook(notebook.id) ? " is-pinned" : ""}" data-notebook-id="${notebook.id}">
              <div class="nbx-card-top">
                ${notebookIcon(notebook)}
                ${checkBox(`data-nb-select-id="${notebook.id}"`, selected, "Select notebook")}
                <span class="nbx-card-spacer"></span>
                ${markerIcons(notebook.id)}
                <button type="button" class="nbx-iconbtn nb-menu-btn" data-menu-id="${notebook.id}" title="More actions" aria-label="More actions">${ICON.more}</button>
              </div>
              <button type="button" class="nbx-card-title" data-open-notebook="${notebook.id}" title="${esc(notebook.title)}">${esc(name)}</button>
              ${tagsCell(notebook.id)}
              <div class="nbx-card-foot">
                ${sourcesCell(notebook)}
                ${folderCell(notebook.id)}
                ${studioCell(notebook, true)}
              </div>
            </article>`;
        })
        .join("")}
    </div>
    ${moreButton(allItems.length)}
  `;

  bindWorkspace();
}

function bindWorkspace() {
  bindNotebookMenus();
  bindSourcesTags();
  bindCardOpens();
  bindMarkerButtons();
  bindNotebookSelection();

  mainEl.querySelectorAll("[data-tag-edit]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      renderTagMenu(btn, btn.dataset.tagEdit);
    });
  });

  mainEl.querySelectorAll("[data-folder-edit]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      renderMoveMenu(btn, btn.dataset.folderEdit);
    });
  });

  mainEl.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.sort;
      if (sortMode === key) {
        sortDir = -sortDir;
      } else {
        sortMode = key;
        sortDir = 1;
        await store.setSortMode(sortMode);
      }
      if (sortSelect) sortSelect.value = sortMode;
      renderMain();
    });
  });

  mainEl.querySelector("[data-select-all]")?.addEventListener("change", (event) => {
    const items = getFilteredNotebooks();
    if (event.target.checked) {
      items.forEach((notebook) => selectedNotebookIds.add(notebook.id));
    } else {
      items.forEach((notebook) => selectedNotebookIds.delete(notebook.id));
    }
    renderMain();
  });

  mainEl.querySelector("[data-show-more]")?.addEventListener("click", () => {
    renderLimit += PAGE_SIZE;
    renderMain();
  });

  mainEl.querySelector("[data-clear-filters]")?.addEventListener("click", () => clearFilters());

  updateNotebookBulkUi();
}

async function clearFilters() {
  smartView = "all";
  activeFolder = "all";
  activeTag = "all";
  if (searchInput) searchInput.value = "";
  await store.setActiveTag("all");
  renderLimit = PAGE_SIZE;
  renderAll();
}

function renderFolderGrid() {
  renderNotebooks();
}

function renderNotebooks() {
  const items = getFilteredNotebooks();
  mainEl.classList.toggle("is-cards", viewMode === "grid");
  mainEl.classList.toggle("is-table", viewMode !== "grid");

  if (viewMode === "grid") {
    renderGrid(items);
  } else {
    renderList(items);
  }

  renderHeading(items.length);
}

function renderMain() {
  renderNotebooks();
}

function currentViewTitle() {
  if (activeFolder !== "all") return activeFolder === "unfiled" ? "Unfiled" : activeFolder;
  if (activeTag !== "all") return `#${activeTag}`;
  return SMART_VIEWS.find((view) => view.id === smartView)?.label || "All notebooks";
}

function renderHeading(count) {
  const title = document.querySelector("#nbViewTitle");
  const counter = document.querySelector("#nbViewCount");
  if (title) title.textContent = currentViewTitle();
  if (counter) {
    counter.textContent = count === notebooks.length ? `${count}` : `${count} of ${notebooks.length}`;
  }
  renderFilterChips();
}

function renderFilterChips() {
  const host = document.querySelector("#nbActiveFilters");
  if (!host) return;

  const chips = [];
  if (smartView !== "all") chips.push({ key: "view", label: SMART_VIEWS.find((v) => v.id === smartView)?.label || smartView });
  if (activeFolder !== "all") chips.push({ key: "folder", label: `Folder: ${activeFolder === "unfiled" ? "Unfiled" : activeFolder}` });
  if (activeTag !== "all") chips.push({ key: "tag", label: `Tag: ${activeTag}` });
  const query = searchInput?.value?.trim();
  if (query) chips.push({ key: "search", label: `“${query}”` });

  host.innerHTML = chips.length
    ? chips.map((chip) => `<button type="button" class="nbx-chip" data-chip="${chip.key}" title="Remove filter">${esc(chip.label)}${ICON.x}</button>`).join("") +
      (chips.length > 1 ? `<button type="button" class="nbx-chip-clear" data-chip="all">Clear all</button>` : "")
    : `<span class="nbx-hint">Tip: select rows to move, tag or delete in bulk. Press <kbd>/</kbd> to search.</span>`;

  host.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.chip;
      if (key === "all") return clearFilters();
      if (key === "view") smartView = "all";
      if (key === "folder") activeFolder = "all";
      if (key === "tag") {
        activeTag = "all";
        await store.setActiveTag("all");
      }
      if (key === "search" && searchInput) searchInput.value = "";
      renderAll();
    });
  });
}

function sideItem(kind, id, icon, label, count, active, extra = "") {
  return `<button type="button" class="nbx-side-item${active ? " is-active" : ""}" data-side-${kind}="${esc(id)}" ${extra}>
    <span class="nbx-side-ico">${icon}</span>
    <span class="nbx-side-text">${esc(label)}</span>
    ${count === null ? "" : `<span class="nbx-side-count">${count}</span>`}
  </button>`;
}

function renderSidebar() {
  const side = document.querySelector("#nbSidebar");
  if (!side) return;

  const noFilters = activeFolder === "all" && activeTag === "all";
  const views = SMART_VIEWS.map((view) =>
    sideItem(
      "view",
      view.id,
      view.icon,
      view.label,
      notebooks.filter((notebook) => matchesSmartView(notebook, view.id)).length,
      smartView === view.id && (view.id !== "all" || noFilters)
    )
  ).join("");

  const folders = [
    sideItem("folder", "unfiled", ICON.inbox, "Unfiled", countInFolder("unfiled"), activeFolder === "unfiled"),
    ...folderState.folders.map((folder) =>
      sideItem("folder", folder, ICON.folder, folder, countInFolder(folder), activeFolder === folder)
    )
  ].join("");

  const tagCounts = {};
  notebooks.forEach((notebook) => tagsForNotebook(notebook.id).forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }));
  const tags = folderState.tags.length
    ? folderState.tags
        .map((tag) =>
          sideItem("tag", tag, `<i class="nbx-dot" style="background:${DOT_COLORS[tagColorIndex(tag)]}"></i>`, tag, tagCounts[tag] || 0, activeTag === tag)
        )
        .join("")
    : `<p class="nbx-side-empty">No tags yet</p>`;

  side.innerHTML = `
    <div class="nbx-side-sec">
      <p class="nbx-side-label">Views</p>
      ${views}
      <button type="button" class="nbx-side-item" data-side-podcast>
        <span class="nbx-side-ico">${ICON.podcast}</span><span class="nbx-side-text">Podcasts</span>
      </button>
    </div>
    <div class="nbx-side-sec">
      <div class="nbx-side-label-row"><p class="nbx-side-label">Folders</p><button type="button" class="nbx-side-add" data-side-new="folder" title="New folder" aria-label="New folder">${ICON.plus}</button></div>
      ${folders}
    </div>
    <div class="nbx-side-sec">
      <div class="nbx-side-label-row"><p class="nbx-side-label">Tags</p><button type="button" class="nbx-side-add" data-side-new="tag" title="New tag" aria-label="New tag">${ICON.plus}</button></div>
      ${tags}
    </div>
    <div class="nbx-side-sec nbx-side-import">
      <p class="nbx-side-label">Import from</p>
      <div class="nbx-plats">
        ${IMPORT_PLATFORMS.map((platform) => `<a class="nbx-plat" href="${platform.url}" target="_blank" rel="noopener noreferrer"><i style="background:${platform.color}"></i>${esc(platform.label)}</a>`).join("")}
      </div>
      <p class="nbx-side-hint">Open a chat, post, video or doc and click <b>Import</b> to send it to a notebook.</p>
    </div>
  `;

  side.querySelectorAll("[data-side-view]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.sideView;
      if (id === "all") {
        return clearFilters();
      }
      smartView = smartView === id ? "all" : id;
      renderLimit = PAGE_SIZE;
      renderAll();
    });
  });

  side.querySelectorAll("[data-side-folder]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.sideFolder;
      activeFolder = activeFolder === id ? "all" : id;
      renderLimit = PAGE_SIZE;
      renderAll();
    });
  });

  side.querySelectorAll("[data-side-tag]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.sideTag;
      activeTag = activeTag === id ? "all" : id;
      await store.setActiveTag(activeTag);
      renderLimit = PAGE_SIZE;
      renderAll();
    });
  });

  side.querySelector("[data-side-podcast]")?.addEventListener("click", () => {
    document.querySelector('[data-app-tab="podcast"]')?.click();
  });

  side.querySelectorAll("[data-side-new]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const kind = btn.dataset.sideNew;
      const name = window.prompt(kind === "folder" ? "New folder name" : "New tag name")?.trim();
      if (!name) return;
      if (kind === "folder") {
        await store.addFolder(name);
        folderState = await store.getState();
        activeFolder = name;
      } else {
        await store.addTag(name);
        folderState = await store.getState();
      }
      renderAll();
    });
  });
}

/* Generic picker used by the bulk bar (folder / tag). */
function openPickerMenu(anchor, { items, active = [], placeholder, onPick, onCreate }) {
  closeMenus();
  const menu = document.createElement("div");
  menu.className = "nb-move-menu nbx-picker";
  menu.innerHTML =
    (items.length
      ? items.map((item) => `<button type="button" class="nb-move-item${active.includes(item.value) ? " is-active" : ""}" data-pick="${esc(item.value)}">${esc(item.label)}</button>`).join("")
      : `<p class="nb-tag-menu-empty">Nothing here yet. Create one below.</p>`) +
    `<div class="nb-move-new"><input type="text" class="nb-move-input" placeholder="${esc(placeholder)}" maxlength="40"><button type="button" class="nb-move-create">Add</button></div>`;

  menu.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      closeMenus();
      await onPick(btn.dataset.pick);
    });
  });

  const input = menu.querySelector("input");
  const create = async (event) => {
    event?.stopPropagation();
    const name = input.value.trim();
    if (!name) return input.focus();
    closeMenus();
    await onCreate(name);
  };
  menu.querySelector(".nb-move-create").addEventListener("click", create);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") create(event);
  });

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 200))}px`;
  menu.style.top = `${rect.bottom + 4}px`;
}

async function runBulk(action, anchor) {
  const ids = [...selectedNotebookIds];
  if (action === "clear") {
    selectedNotebookIds.clear();
    renderMain();
    return;
  }
  if (!ids.length) return;

  if (action === "move") {
    const moveAll = async (folder) => {
      for (const id of ids) await store.setNotebookFolder(id, folder);
      folderState = await store.getState();
      setPageStatus(`Moved ${ids.length} notebook${ids.length === 1 ? "" : "s"} to ${folder || "Unfiled"}.`, "");
      renderAll();
    };
    openPickerMenu(anchor, {
      items: [{ value: "", label: "Unfiled" }, ...folderState.folders.map((folder) => ({ value: folder, label: folder }))],
      placeholder: "New folder",
      onPick: moveAll,
      onCreate: async (name) => {
        await store.addFolder(name);
        await moveAll(name);
      }
    });
    return;
  }

  if (action === "tag") {
    const tagAll = async (tag) => {
      for (const id of ids) {
        if (!tagsForNotebook(id).includes(tag)) folderState = await store.toggleNotebookTag(id, tag);
      }
      folderState = await store.getState();
      setPageStatus(`Tagged ${ids.length} notebook${ids.length === 1 ? "" : "s"} “${tag}”.`, "");
      renderAll();
    };
    openPickerMenu(anchor, {
      items: folderState.tags.map((tag) => ({ value: tag, label: tag })),
      placeholder: "New tag",
      onPick: tagAll,
      onCreate: async (name) => {
        await store.addTag(name);
        folderState = await store.getState();
        await tagAll(name);
      }
    });
    return;
  }

  if (action === "favorite" || action === "pin") {
    const isOn = action === "favorite" ? isFavoriteNotebook : isPinnedNotebook;
    const toggle = action === "favorite" ? store.toggleFavorite.bind(store) : store.togglePin.bind(store);
    const turnOff = ids.every((id) => isOn(id));
    for (const id of ids) {
      if (isOn(id) === turnOff) folderState = await toggle(id);
    }
    folderState = await store.getState();
    renderAll();
  }
}

function renderFolderBar() {}
function renderTagBar() {}
function renderBreadcrumb() {}

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
      selectedNotebookIds.clear();
      notebooks = await cache.get(activeAccount?.authUser);
      renderAll();
      await loadNotebooks();
    });
  });
}

function renderViewToggle() {
  viewGridButton?.classList.toggle("is-active", viewMode === "grid");
  viewListButton?.classList.toggle("is-active", viewMode !== "grid");
  viewGridButton?.setAttribute("aria-pressed", String(viewMode === "grid"));
  viewListButton?.setAttribute("aria-pressed", String(viewMode !== "grid"));
}

function renderAll() {
  renderSidebar();
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
      renderAll();
      mainEl.innerHTML = `<div class="nbx-empty"><strong>Can't load your notebooks</strong><p>${esc(error.message || "Could not load notebooks.")}</p><a class="nbx-ghost nbx-ghost-link" href="https://notebook.google.com/" target="_blank" rel="noopener noreferrer">Open Gemini Notebook</a></div>`;
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

searchInput?.addEventListener("input", () => {
  renderLimit = 200;
  renderMain();
});

document.querySelector("#nbBulkBar")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-bulk]");

  if (!btn) {
    return;
  }

  event.stopPropagation();
  runBulk(btn.dataset.bulk, btn);
});
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
  const typing = event.target.closest?.("input, textarea, select, [contenteditable]");

  if (event.key === "/" && !typing && listScreen === "notebooks" && !notebooksListView?.hidden) {
    event.preventDefault();
    searchInput?.focus();
    return;
  }

  if (event.key === "Escape" && event.target === searchInput && searchInput.value) {
    searchInput.value = "";
    renderMain();
    return;
  }

  if (event.key === "Escape" && !typing && selectedNotebookIds.size && deleteModal?.hidden && renameModal?.hidden && !document.querySelector(".nb-move-menu, .nb-dropdown-menu")) {
    selectedNotebookIds.clear();
    renderMain();
    return;
  }

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
  // The notebooks dashboard is a Pro feature (plan-gate.js). Free users see a
  // lock screen that reloads the page once Pro is active.
  if (!(await NotebookToolsPlan.lockPage("notebooks-hub"))) {
    return;
  }

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
  browseMode = "all";
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

  // Deep link from the in-notebook ribbon: notebooks.html?notebook=<id>&tab=sources
  const deepLink = new URLSearchParams(location.search);
  const deepId = deepLink.get("notebook");

  if (deepId) {
    const deepTab = ["sources", "studio", "notes"].includes(deepLink.get("tab")) ? deepLink.get("tab") : "sources";
    const deepNotebook =
      notebooks.find((item) => item.id === deepId) ||
      { id: deepId, title: deepLink.get("title") || "Notebook", sourceCount: null };
    openNotebookInApp(deepNotebook, deepTab);
  }

  await loadNotebooks();
}

init();
