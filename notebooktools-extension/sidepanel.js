const params = new URLSearchParams(window.location.search);
// Shown as the toolbar dropdown (?popup=1). The background may have pointed
// the dropdown at a URL with extra options (a tab to open); reset it so the
// next click opens the default view.
const IS_POPUP = params.get("popup") === "1";
if (IS_POPUP) {
  document.documentElement.classList.add("is-popup");
  if ([...params.keys()].some((key) => key !== "popup")) {
    chrome.action?.setPopup({ popup: "sidepanel.html?popup=1" }).catch(() => {});
  }
}
const initialMode = params.get("mode") || "webpage";
const initialPanel = params.get("panel") || "import";
const initialExtract = params.get("extract") === "1";

const pageContext = document.querySelector("#pageContext");
const sourcePreview = document.querySelector("#sourcePreview");
const importButton = document.querySelector("#importButton");
const statusBox = document.querySelector("#status");
const modeButtons = [...document.querySelectorAll(".import-mode")];
const modeTextButton = document.querySelector("#modeText");
const openNotebookLink = document.querySelector("#openNotebookLink");
const importLimitNote = document.querySelector("#importLimitNote");
const autoOpenToggle = document.querySelector("#autoOpenNotebookToggle");
const youtubeBatchPanel = document.querySelector("#youtubeBatchPanel");
const youtubeBatchList = document.querySelector("#youtubeBatchList");
const youtubeBatchTitle = document.querySelector("#youtubeBatchTitle");
const youtubeBatchMeta = document.querySelector("#youtubeBatchMeta");
const youtubeBatchSelected = document.querySelector("#youtubeBatchSelected");
const openNotebooksButton = document.querySelector("#openNotebooksButton");
const studioSection = document.querySelector("#studioSection");
const studioArtifactType = document.querySelector("#studioArtifactType");
const studioOpenTabToggle = document.querySelector("#studioOpenTabToggle");
const studioButton = document.querySelector("#studioButton");

function openNotebooksPage() {
  const url = chrome.runtime.getURL("notebooks.html");

  chrome.tabs.create({ url }, () => {
    if (chrome.runtime.lastError) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });
}

openNotebooksButton?.addEventListener("click", (event) => {
  event.preventDefault();
  void NotebookToolsPlan.requirePro("notebooks-hub", openNotebooksPage);
});

// Dropdown only: open the same app in its own small window (keeps running
// when you click elsewhere, which closes a dropdown).
function popOut() {
  const query = new URLSearchParams(window.location.search);
  query.delete("popup");
  const active = document.querySelector(".sidepanel-tab.is-active")?.dataset.panel;
  if (active && active !== "import") query.set("panel", active);
  const search = query.toString();
  chrome.windows.create({
    url: chrome.runtime.getURL(`sidepanel.html${search ? `?${search}` : ""}`),
    type: "popup",
    width: 420,
    height: 720,
    focused: true
  });
  window.close();
}

document.querySelector("#popOutButton")?.addEventListener("click", popOut);

/* ---------- NotebookLM Google account switcher ---------- */
const googleAccount = (() => {
  const accountsApi = window.NotebookToolsAccounts;
  const button = document.querySelector("#googleAccountButton");
  const menu = document.querySelector("#googleAccountMenu");
  if (!accountsApi || !button || !menu) return null;

  const COLORS = ["#1a73e8", "#188038", "#c5221f", "#e37400", "#9334e6", "#007b83", "#b0006d"];
  let accounts = [];
  let active = "0";
  let loading = false;

  const escHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function color(account) {
    return COLORS[Number(account?.authUser || 0) % COLORS.length];
  }

  function avatar(account, size = "") {
    const text = accountsApi.label(account).charAt(0).toUpperCase() || "?";
    return `<span class="sp-gacct-avatar${size}" style="background:${color(account)}" aria-hidden="true">${escHtml(text)}</span>`;
  }

  function current() {
    return accounts.find((a) => a.authUser === active) || accounts[0] || null;
  }

  const CARET = `<svg class="sp-gacct-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

  function renderButton() {
    const acc = current();
    const name = acc ? accountsApi.label(acc) : loading ? "Checking…" : "Not signed in to Google";
    button.innerHTML = `${acc ? avatar(acc) : `<span class="sp-gacct-avatar is-empty" aria-hidden="true">?</span>`}<span class="sp-gacct-btn-email">${escHtml(name)}</span>${CARET}`;
    button.title = `Google account used for NotebookLM: ${name}`;
    button.setAttribute("aria-label", button.title);
  }

  function renderMenu() {
    const acc = current();
    menu.innerHTML = `
      <div class="sp-gacct-head">Google account for NotebookLM</div>
      <p class="sp-gacct-note">Which Google account's notebooks you see and add to. Separate from your NotebookTools sign-in.</p>
      ${accounts.length ? accounts.map((a) => `
        <button type="button" class="sp-gacct-item${a === acc ? " is-active" : ""}" role="menuitemradio" aria-checked="${a === acc}" data-auth-user="${escHtml(a.authUser)}">
          ${avatar(a, " is-sm")}
          <span class="sp-gacct-text"><span class="sp-gacct-email">${escHtml(accountsApi.label(a))}</span>
          ${a === acc ? `<span class="sp-gacct-sub">In use</span>` : ""}</span>
          ${a === acc ? `<svg class="sp-gacct-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>` : ""}
        </button>`).join("") : `<p class="sp-gacct-empty">${loading ? "Looking for accounts…" : "No signed-in Google account can open NotebookLM. Sign in first."}</p>`}
      <div class="sp-gacct-sep"></div>
      <button type="button" class="sp-gacct-item is-action" role="menuitem" data-add-account>
        <span class="sp-gacct-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M19 8v6M16 11h6"/></svg></span>
        <span class="sp-gacct-text">Add another Google account</span>
      </button>
      <button type="button" class="sp-gacct-item is-action" role="menuitem" data-refresh-accounts${loading ? " disabled" : ""}>
        <span class="sp-gacct-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg></span>
        <span class="sp-gacct-text">${loading ? "Checking accounts…" : "Refresh account list"}</span>
      </button>`;
  }

  function render() {
    renderButton();
    if (!menu.hidden) renderMenu();
  }

  async function load(force = false) {
    active = await accountsApi.getActive();
    const cached = await accountsApi.list({ force: false }).catch(() => ({ accounts: [] }));
    accounts = cached.accounts || [];
    render();
    if (force || !cached.fresh) {
      loading = true;
      render();
      try {
        accounts = (await accountsApi.list({ force: true })).accounts;
      } catch (_error) {
        // Keep what we had.
      }
      loading = false;
      // The saved account may have signed out: fall back to the first one.
      if (accounts.length && !accounts.some((a) => a.authUser === active)) {
        active = accounts[0].authUser;
      }
      render();
    }
  }

  async function choose(authUser) {
    if (authUser === active) return close();
    active = authUser;
    await accountsApi.setActive(authUser);
    close();
    render();
    await picker.refresh({ silent: true });
  }

  function open() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    renderMenu();
  }

  function close() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden ? open() : close();
  });
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const item = event.target.closest("[data-auth-user]");
    if (item) return void choose(item.dataset.authUser);
    if (event.target.closest("[data-add-account]")) {
      chrome.tabs.create({ url: accountsApi.addAccountUrl() });
      close();
      return;
    }
    if (event.target.closest("[data-refresh-accounts]")) void load(true);
  });
  document.addEventListener("click", () => close());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) close();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.notebooktoolsAuthUser) return;
    void accountsApi.getActive().then((value) => {
      if (value === active) return;
      active = value;
      render();
      void picker.refresh({ silent: true });
    });
  });

  return { load };
})();

if (IS_POPUP) {
  const bulkPanel = document.querySelector("#panelBulk");
  if (bulkPanel) {
    const note = document.createElement("p");
    note.className = "sp-popup-note";
    note.innerHTML = 'Clicking outside closes this dropdown and stops a running import. For big imports, <button type="button" class="sp-link-btn">pop it out</button>.';
    note.querySelector("button").addEventListener("click", popOut);
    bulkPanel.prepend(note);
  }
}

// Side panel tabs that need Pro (feature keys from plan-gate.js). Import and Bulk are free.
const PRO_PANELS = { snapshots: "snapshots" };

async function openPanel(panelName) {
  const key = PRO_PANELS[panelName];
  if (key && !(await NotebookToolsPlan.can(key))) {
    NotebookToolsPlan.showUpgrade(key);
    return false;
  }
  setActivePanel(panelName);
  return true;
}

function markProTabs() {
  panelTabs.forEach((tab) => {
    if (PRO_PANELS[tab.dataset.panel] && !tab.querySelector(".sp-pro-tag")) {
      tab.insertAdjacentHTML("beforeend", ' <span class="sp-pro-tag" title="Pro feature">Pro</span>');
    }
  });
}

const panelTabs = [...document.querySelectorAll(".sidepanel-tab")];
const panels = {
  import: document.querySelector("#panelImport"),
  bulk: document.querySelector("#panelBulk"),
  snapshots: document.querySelector("#panelSnapshots"),
};

let activeMode = initialMode;
let activeTab = null;
let pendingText = null;
let bulkMounted = false;
let snapshotsMounted = false;
let importNotebookState = { notebookId: "", isNewNotebook: false, cachedSourceCount: null };
let youtubeBatchActive = false;
let youtubeBatchLoading = false;

const MODE_LABELS = {
  webpage: "Add page to notebook",
  youtube: "Add video to notebook",
  text: "Add text to notebook"
};

const picker = NotebookToolsPicker.create({
  searchInput: document.querySelector("#notebookSearch"),
  selectEl: document.querySelector("#notebookLmSelect"),
  newNameInput: document.querySelector("#newNotebookLmName"),
  refreshButton: document.querySelector("#refreshNotebookLmButton"),
  onStatus: (message, options = {}) => {
    NotebookToolsUI.setImportStatus(statusBox, {
      message,
      type: options.type || "success",
      loading: options.loading === true,
      done: options.done === true
    });
  },
  onNotebookChange: (state) => {
    importNotebookState = state;
    refreshImportLimitNote();
  }
});

function refreshImportLimitNote() {
  const adding = youtubeBatchActive
    ? NotebookToolsYouTubeBatchPreview.selectedCount()
    : 1;

  NotebookToolsSourceLimits.updateLimitNote(importLimitNote, {
    ...importNotebookState,
    adding
  });
}

function renderYouTubeBatchPreview() {
  if (!youtubeBatchPanel || !youtubeBatchList) {
    return;
  }

  NotebookToolsYouTubeBatchPreview.updateMetaElements({
    titleEl: youtubeBatchTitle,
    countEl: youtubeBatchMeta,
    selectedEl: youtubeBatchSelected
  });
  NotebookToolsYouTubeBatchPreview.renderList(youtubeBatchList, {
    disabled: youtubeBatchLoading
  });
  NotebookToolsYouTubeBatchPreview.bindList(youtubeBatchList, {
    disabled: youtubeBatchLoading,
    onChange: () => {
      renderYouTubeBatchPreview();
      refreshImportLimitNote();
      updateYouTubeImportButton();
    }
  });
  updateYouTubeImportButton();
}

function updateYouTubeImportButton() {
  if (!youtubeBatchActive || activeMode !== "youtube") {
    return;
  }

  const selected = NotebookToolsYouTubeBatchPreview.selectedCount();
  importButton.textContent = selected
    ? `Import ${selected} selected video${selected === 1 ? "" : "s"}`
    : "Select videos to import";
  importButton.disabled = youtubeBatchLoading || !selected;
}

async function refreshYouTubeBatchPreview({ force = false } = {}) {
  if (activeMode !== "youtube") {
    youtubeBatchActive = false;
    youtubeBatchPanel?.setAttribute("hidden", "");
    NotebookToolsYouTubeBatchPreview.reset();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, windowId: await NotebookToolsStore.browserWindowId() });
  const isBatch = NotebookToolsStore.isYouTubeBatchUrl(tab?.url || "");

  if (!isBatch) {
    youtubeBatchActive = false;
    youtubeBatchPanel?.setAttribute("hidden", "");
    NotebookToolsYouTubeBatchPreview.reset();
    updateModeUi();
    return;
  }

  youtubeBatchActive = true;
  youtubeBatchPanel?.removeAttribute("hidden");
  youtubeBatchLoading = true;
  renderYouTubeBatchPreview();
  setStatus("Loading playlist videos...", { loading: true });

  try {
    const result = await NotebookToolsYouTubeBatchPreview.loadFromActiveTab({ force });
    const collection = result?.collection;

    if (collection?.notebookName) {
      document.querySelector("#newNotebookLmName").value = collection.notebookName;
      importNotebookState = {
        notebookId: "",
        isNewNotebook: true,
        cachedSourceCount: 0
      };
    }

    renderYouTubeBatchPreview();
    refreshImportLimitNote();
    setStatus(`${NotebookToolsYouTubeBatchPreview.getVideos().length} videos loaded. Uncheck any you do not want.`);
  } catch (error) {
    youtubeBatchPanel?.setAttribute("hidden", "");
    youtubeBatchActive = false;
    NotebookToolsYouTubeBatchPreview.reset();
    setStatus(error.message || "Could not load playlist videos.", { type: "error" });
    updateModeUi();
  } finally {
    youtubeBatchLoading = false;
    renderYouTubeBatchPreview();
    updateStudioSectionVisibility();
  }
}

function setStatus(message, options = {}) {
  NotebookToolsUI.setImportStatus(statusBox, {
    message,
    type: options.type || "success",
    loading: options.loading === true,
    done: options.done === true
  });
}

function showOpenNotebook(notebookId, artifactId = "", artifactLabel = "") {
  if (!openNotebookLink || !notebookId) {
    return;
  }

  openNotebookLink.hidden = false;

  if (artifactId && NotebookToolsStore.notebookArtifactUrl) {
    openNotebookLink.textContent = `Open ${(artifactLabel || "output").toLowerCase()}`;
    openNotebookLink.href = NotebookToolsStore.notebookArtifactUrl(notebookId, artifactId);
    return;
  }

  openNotebookLink.textContent = "Open notebook";
  openNotebookLink.href = `https://notebook.google.com/notebook/${encodeURIComponent(notebookId)}`;
}

function isStudioAvailable() {
  if (activeMode === "text" || youtubeBatchActive) {
    return false;
  }

  if (activeMode === "youtube") {
    return Boolean(NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || ""));
  }

  if (activeMode === "webpage") {
    return Boolean(NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || ""));
  }

  return false;
}

function shouldShowStudioSection() {
  return activeMode === "webpage" || (activeMode === "youtube" && !youtubeBatchActive);
}

function updateStudioSectionVisibility() {
  if (!studioSection) {
    return;
  }

  const visible = shouldShowStudioSection();
  const available = isStudioAvailable();
  const hintEl = studioSection.querySelector(".sp-studio-hint");

  studioSection.hidden = !visible;
  studioSection.classList.toggle("is-unavailable", visible && !available);

  if (studioButton) {
    studioButton.disabled = !available;
  }

  if (studioArtifactType) {
    studioArtifactType.disabled = !available;
  }

  if (studioOpenTabToggle) {
    studioOpenTabToggle.disabled = !available;
  }

  if (hintEl) {
    if (!visible) {
      hintEl.textContent = "Import this page and create a NotebookLM studio output.";
    } else if (available) {
      hintEl.textContent = "Import this page and create a NotebookLM studio output.";
    } else if (activeMode === "youtube") {
      hintEl.textContent = "Open a YouTube watch page to use Studio.";
    } else {
      hintEl.textContent = "Open an article, blog, or PDF page to use Studio.";
    }
  }
}

async function refreshActiveTabContext() {
  activeTab = await getActiveTab();
  updateModeUi();

  if (activeMode === "youtube") {
    await refreshYouTubeBatchPreview();
  } else {
    updateStudioSectionVisibility();
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, windowId: await NotebookToolsStore.browserWindowId() });
  return tab || null;
}

function setActivePanel(panelName) {
  panelTabs.forEach((tab) => {
    const isActive = tab.dataset.panel === panelName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  Object.entries(panels).forEach(([name, panel]) => {
    if (!panel) {
      return;
    }

    const isActive = name === panelName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });


  if (panelName === "bulk" && !bulkMounted) {
    const root = document.querySelector("#bulkImportRoot");
    if (root) {
      NotebookToolsBulkImportUI.mount(root).then(() => {
        if (initialExtract) {
          void NotebookToolsBulkImportUI.applyPendingLinkExtract?.();
        }

        if (params.get("tabs") === "1") {
          root.querySelector("#bulkAddTabsButton")?.click();
        }
      });
      bulkMounted = true;
    }
  } else if (panelName === "bulk" && bulkMounted && initialExtract) {
    void NotebookToolsBulkImportUI.applyPendingLinkExtract?.();
  }

  if (panelName === "snapshots" && !snapshotsMounted) {
    const root = document.querySelector("#snapshotsPanelRoot");

    if (root) {
      void NotebookToolsSnapshotsPanel.mount(root);
      snapshotsMounted = true;
    }
  } else if (panelName === "snapshots" && snapshotsMounted) {
    void NotebookToolsSnapshotsPanel.refreshList?.();
  }

  if (panelName === "import") {
    pageContext.textContent = activeMode === "youtube"
      ? "YouTube video"
      : activeMode === "text"
        ? "Selected text"
        : "Current webpage";
    void refreshYouTubeBatchPreview();
  } else if (panelName === "bulk") {
    pageContext.textContent = "Bulk import queue";

    if (bulkMounted && window.NotebookToolsBulkImportUI?.refreshYouTubeHint) {
      NotebookToolsBulkImportUI.refreshYouTubeHint();
    }
  } else if (panelName === "snapshots") {
    pageContext.textContent = "Capture & send screenshots";
  }
}

async function loadPendingText() {
  if (initialMode !== "text") {
    return;
  }

  const stored = await chrome.storage.session.get("pendingTextImport");
  pendingText = stored.pendingTextImport || null;

  if (!pendingText?.text) {
    pageContext.textContent = "No text selected";
    sourcePreview.textContent = "Highlight text on a page, then right-click → Add to NotebookLM.";
    return;
  }

  if (modeTextButton) {
    modeTextButton.hidden = false;
  }

  activeMode = "text";
  pageContext.textContent = "Selected text";
  sourcePreview.textContent = pendingText.text.slice(0, 140) + (pendingText.text.length > 140 ? "..." : "");
}

function updateModeUi() {
  for (const button of modeButtons) {
    button.classList.toggle("is-active", button.dataset.mode === activeMode);
    button.hidden = button.dataset.mode === "text" && !pendingText?.text;
  }

  importButton.textContent = MODE_LABELS[activeMode] || "Import";
  importButton.disabled = false;

  if (activeMode === "youtube" && youtubeBatchActive) {
    updateYouTubeImportButton();
  }

  if (activeMode === "text" && pendingText?.text) {
    sourcePreview.textContent = pendingText.text.slice(0, 140) + (pendingText.text.length > 140 ? "..." : "");
    updateStudioSectionVisibility();
    return;
  }

  const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");
  const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

  if (activeMode === "youtube") {
    sourcePreview.textContent = youtubeUrl
      ? (activeTab?.title || youtubeUrl)
      : "Open a YouTube video to import it.";
    updateStudioSectionVisibility();
    return;
  }

  sourcePreview.textContent = webpageUrl
    ? (activeTab?.title || webpageUrl)
    : "Open any webpage to import it as a NotebookLM source.";

  updateStudioSectionVisibility();
}

function setActiveMode(mode) {
  if (mode === "text" && !pendingText?.text) {
    return;
  }

  if (mode === "youtube" && !NotebookToolsStore.isYouTubeUrl(activeTab?.url || "")) {
    setStatus("Open a YouTube video first.", { type: "error" });
    return;
  }

  if (mode === "webpage" && !NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "")) {
    setStatus("This page cannot be imported as a webpage.", { type: "error" });
    return;
  }

  activeMode = mode;
  updateModeUi();
  setStatus("");

  if (mode === "youtube") {
    void refreshYouTubeBatchPreview();
  } else {
    youtubeBatchPanel?.setAttribute("hidden", "");
    youtubeBatchActive = false;
    NotebookToolsYouTubeBatchPreview.reset();
    updateStudioSectionVisibility();
  }
}

async function runStudioImport() {
  const artifactType = NotebookToolsStudioImport.getSelectedArtifactType(studioArtifactType);
  const artifactLabel = NotebookToolsStudioImport.getArtifactLabel(artifactType);
  const idleLabel = `Create ${artifactLabel.toLowerCase()}`;

  NotebookToolsUI.setImportButtonState(studioButton, true, idleLabel);
  picker.setBusy(true);
  setStatus(`Preparing ${artifactLabel.toLowerCase()}...`, { loading: true });

  try {
    if (!isStudioAvailable()) {
      throw new Error("Studio is not available for this page.");
    }

    await NotebookToolsSourceLimits.assertCanImport({
      ...importNotebookState,
      adding: 1
    });

    const targetNotebook = await picker.resolveTarget();
    const kind = activeMode === "youtube" ? "youtube" : "webpage";
    const sourceUrl =
      kind === "youtube"
        ? NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "")
        : NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

    if (!sourceUrl) {
      throw new Error(kind === "youtube" ? "Open a YouTube video first." : "This page cannot be imported.");
    }

    showOpenNotebook(targetNotebook.id);
    await NotebookToolsSettings.openYoutubeStudioTabIfEnabled(targetNotebook.id);

    const result = await NotebookToolsStudioImport.runPipeline({
      notebookId: targetNotebook.id,
      kind,
      url: sourceUrl,
      artifactType,
      onStatus: ({ message, loading, done, type }) => {
        setStatus(message, { loading, done, type });
      }
    });

    document.querySelector("#newNotebookLmName").value = "";
    await picker.refresh({ silent: true });
    document.querySelector("#notebookLmSelect").value = targetNotebook.id;
    importNotebookState = {
      notebookId: targetNotebook.id,
      isNewNotebook: false,
      cachedSourceCount: typeof importNotebookState.cachedSourceCount === "number"
        ? importNotebookState.cachedSourceCount + 1
        : 1
    };
    refreshImportLimitNote();
    showOpenNotebook(targetNotebook.id, result.artifact.id, result.artifactLabel);
    await NotebookToolsSettings.openYoutubeStudioArtifactIfEnabled(
      targetNotebook.id,
      result.artifact.id
    );
    setStatus(`${result.artifactLabel} ready.`, { done: true });
  } catch (error) {
    setStatus(error.message || "Studio import failed.", { type: "error" });
  } finally {
    NotebookToolsUI.setImportButtonState(studioButton, false, idleLabel);
    picker.setBusy(false);
  }
}

async function runImport() {
  const batchSelected = youtubeBatchActive ? NotebookToolsYouTubeBatchPreview.selectedCount() : 0;
  const idleLabel = youtubeBatchActive
    ? `Import ${batchSelected} selected video${batchSelected === 1 ? "" : "s"}`
    : MODE_LABELS[activeMode] || "Import";

  NotebookToolsUI.setImportButtonState(importButton, true, idleLabel);
  setStatus("Preparing import...", { loading: true });

  try {
    if (youtubeBatchActive) {
      const selectedCount = NotebookToolsYouTubeBatchPreview.selectedCount();

      if (!selectedCount) {
        throw new Error("Select at least one video to import.");
      }

      await NotebookToolsSourceLimits.assertCanImport({
        ...importNotebookState,
        adding: selectedCount
      });

      const result = await NotebookToolsYouTubeBatchPreview.importSelected({
        picker,
        forceNewNotebook: false,
        onStatus: setStatus
      });

      document.querySelector("#newNotebookLmName").value = "";
      await picker.refresh({ silent: true });

      if (result.lastNotebook?.id) {
        document.querySelector("#notebookLmSelect").value = result.lastNotebook.id;
        importNotebookState = {
          notebookId: result.lastNotebook.id,
          isNewNotebook: false,
          cachedSourceCount: result.totalSuccess
        };
        showOpenNotebook(result.lastNotebook.id);
      }

      refreshImportLimitNote();
      setStatus(`Imported ${result.totalSuccess} video${result.totalSuccess === 1 ? "" : "s"}.`, {
        done: result.totalFailed === 0
      });
      return;
    }

    await NotebookToolsSourceLimits.assertCanImport({
      ...importNotebookState,
      adding: 1
    });

    const targetNotebook = await picker.resolveTarget();

    setStatus("Sending to NotebookLM...", { loading: true });

    if (activeMode === "youtube") {
      const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");

      if (!youtubeUrl) {
        throw new Error("Open a YouTube video first.");
      }

      await NotebookToolsNotebookLM.addYoutubeToNotebookLm(targetNotebook.id, youtubeUrl);
    } else if (activeMode === "text") {
      if (!pendingText?.text) {
        throw new Error("No selected text found.");
      }

      await NotebookToolsNotebookLM.addTextToNotebookLm(
        targetNotebook.id,
        pendingText.title,
        pendingText.text
      );
      await chrome.storage.session.remove("pendingTextImport");
    } else {
      const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

      if (!webpageUrl) {
        throw new Error("This page cannot be imported as a webpage.");
      }

      await NotebookToolsNotebookLM.addWebpageToNotebookLm(targetNotebook.id, webpageUrl);
    }

    void NotebookToolsStats.recordImport();

    document.querySelector("#newNotebookLmName").value = "";
    await picker.refresh({ silent: true });
    document.querySelector("#notebookLmSelect").value = targetNotebook.id;
    importNotebookState = {
      notebookId: targetNotebook.id,
      isNewNotebook: false,
      cachedSourceCount: typeof importNotebookState.cachedSourceCount === "number"
        ? importNotebookState.cachedSourceCount + 1
        : 1
    };
    refreshImportLimitNote();
    showOpenNotebook(targetNotebook.id);
    await NotebookToolsSettings.openNotebookIfEnabled(targetNotebook.id);
    setStatus(`Added to "${targetNotebook.title}"`, { done: true });
  } catch (error) {
    setStatus(error.message || "Import failed.", { type: "error" });
  } finally {
    NotebookToolsUI.setImportButtonState(
      importButton,
      false,
      youtubeBatchActive ? idleLabel : MODE_LABELS[activeMode] || "Import"
    );
  }
}

/* ---------- One-time nudges: review ask and a Pro hint for Free users ---------- */

const REVIEW_URL = "https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj/reviews";
const REVIEW_DONE_KEY = "notebooktoolsReviewPromptDone";
const UPGRADE_HINT_DONE_KEY = "notebooktoolsBulkUpgradeHintDone";
const REVIEW_AFTER_IMPORTS = 5;
const UPGRADE_HINT_AFTER_BULK_RUNS = 3;
const nudgesRoot = document.querySelector("#spNudges");

function dismissNudge(card, flagKey) {
  card.remove();
  void chrome.storage.local.set({ [flagKey]: true });
}

function renderReviewNudge() {
  if (!nudgesRoot || nudgesRoot.querySelector("[data-nudge='review']")) {
    return;
  }

  const card = document.createElement("section");
  card.className = "sp-nudge";
  card.dataset.nudge = "review";
  card.innerHTML = `
    <p>Enjoying NotebookTools? A quick review helps others find it.</p>
    <div class="sp-nudge-actions">
      <a class="button" data-act="review" href="${REVIEW_URL}" target="_blank" rel="noopener noreferrer">Leave a review</a>
      <button type="button" class="text-button" data-act="later">Not now</button>
    </div>`;
  card.querySelector("[data-act='review']").addEventListener("click", () => dismissNudge(card, REVIEW_DONE_KEY));
  card.querySelector("[data-act='later']").addEventListener("click", () => dismissNudge(card, REVIEW_DONE_KEY));
  nudgesRoot.prepend(card);
}

function renderUpgradeHint() {
  if (!nudgesRoot || nudgesRoot.querySelector("[data-nudge='upgrade']")) {
    return;
  }

  const card = document.createElement("section");
  card.className = "sp-nudge sp-nudge-hint";
  card.dataset.nudge = "upgrade";
  card.innerHTML = `
    <p>Keep notebooks tidy: Pro finds duplicate sources and refreshes Drive files in bulk. <a href="#" data-act="see-pro">See Pro</a></p>
    <button type="button" class="sp-nudge-close" data-act="close" title="Dismiss" aria-label="Dismiss">&times;</button>`;
  card.querySelector("[data-act='see-pro']").addEventListener("click", (event) => {
    event.preventDefault();
    NotebookToolsPlan.showUpgrade("manage-sources");
    dismissNudge(card, UPGRADE_HINT_DONE_KEY);
  });
  card.querySelector("[data-act='close']").addEventListener("click", () => dismissNudge(card, UPGRADE_HINT_DONE_KEY));
  nudgesRoot.append(card);
}

async function refreshNudges() {
  if (!nudgesRoot) {
    return;
  }

  const keys = [NotebookToolsStats.KEYS.imports, NotebookToolsStats.KEYS.bulkRuns, REVIEW_DONE_KEY, UPGRADE_HINT_DONE_KEY];
  const items = await chrome.storage.local.get(keys);
  const imports = Number(items[NotebookToolsStats.KEYS.imports]) || 0;
  const bulkRuns = Number(items[NotebookToolsStats.KEYS.bulkRuns]) || 0;

  if (imports >= REVIEW_AFTER_IMPORTS && !items[REVIEW_DONE_KEY]) {
    renderReviewNudge();
  } else {
    nudgesRoot.querySelector("[data-nudge='review']")?.remove();
  }

  const isFree = bulkRuns >= UPGRADE_HINT_AFTER_BULK_RUNS && !items[UPGRADE_HINT_DONE_KEY]
    ? (await NotebookToolsPlan.readState()).plan !== "pro"
    : false;

  if (isFree) {
    renderUpgradeHint();
  } else {
    nudgesRoot.querySelector("[data-nudge='upgrade']")?.remove();
  }
}

function initNudges() {
  void refreshNudges().catch(() => {});
  const watched = new Set([
    NotebookToolsStats.KEYS.imports,
    NotebookToolsStats.KEYS.bulkRuns,
    REVIEW_DONE_KEY,
    UPGRADE_HINT_DONE_KEY,
    "notebooktoolsAuthProfile",
    "notebooktoolsAuthSession"
  ]);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && Object.keys(changes).some((key) => watched.has(key))) {
      void refreshNudges().catch(() => {});
    }
  });
}

async function initSidePanel() {
  await NotebookToolsTheme.init();
  const appSettings = await NotebookToolsSettings.getAppSettings();
  await NotebookToolsI18n.init(appSettings.language);
  NotebookToolsI18n.apply(document);
  NotebookToolsSettingsUI.init();
  NotebookToolsAccountUI.init();

  NotebookToolsSettings.onChange(async (next) => {
    await NotebookToolsI18n.init(next.language);
    NotebookToolsI18n.apply(document);
  });

  activeTab = await getActiveTab();
  await loadPendingText();

  const youtubeUrl = NotebookToolsStore.normalizeYouTubeVideoUrl(activeTab?.url || "");
  const webpageUrl = NotebookToolsStore.normalizeWebpageUrl(activeTab?.url || "");

  if (initialMode === "text" && pendingText?.text) {
    activeMode = "text";
  } else if (youtubeUrl) {
    activeMode = "youtube";
  } else if (webpageUrl) {
    activeMode = "webpage";
  } else {
    activeMode = "webpage";
  }

  panelTabs.forEach((tab) => {
    tab.addEventListener("click", () => void openPanel(tab.dataset.panel));
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveMode(button.dataset.mode));
  });

  importButton.addEventListener("click", runImport);
  studioButton?.addEventListener("click", () => void NotebookToolsPlan.requirePro("studio-create", runStudioImport));
  const syncProTabs = () => NotebookToolsPlan.readState().then((state) => {
    if (state.plan === "pro") document.querySelectorAll(".sp-pro-tag").forEach((tag) => tag.remove());
    else markProTabs();
  });
  void syncProTabs();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.notebooktoolsAuthProfile || changes.notebooktoolsAuthSession)) void syncProTabs();
  });
  await NotebookToolsStudioImport.initControls({
    typeSelect: studioArtifactType,
    openTabToggle: studioOpenTabToggle,
    studioButton
  });
  updateStudioSectionVisibility();
  document.querySelector("#youtubeBatchSelectAll")?.addEventListener("click", () => {
    NotebookToolsYouTubeBatchPreview.setAllSelected(true);
    renderYouTubeBatchPreview();
    refreshImportLimitNote();
  });
  document.querySelector("#youtubeBatchSelectNone")?.addEventListener("click", () => {
    NotebookToolsYouTubeBatchPreview.setAllSelected(false);
    renderYouTubeBatchPreview();
    refreshImportLimitNote();
  });
  document.querySelector("#youtubeBatchReload")?.addEventListener("click", () => {
    void refreshYouTubeBatchPreview({ force: true });
  });
  picker.bind();
  initNudges();
  updateModeUi();
  void picker.refresh({ silent: true });
  void googleAccount?.load();

  if (autoOpenToggle) {
    autoOpenToggle.checked = await NotebookToolsSettings.getAutoOpenNotebook();
    autoOpenToggle.addEventListener("change", () => {
      NotebookToolsSettings.setAutoOpenNotebook(autoOpenToggle.checked);
    });
  }

  setActivePanel("import");
  if (initialPanel === "bulk") {
    setActivePanel("bulk");
  } else if (initialPanel === "snapshots") {
    void openPanel(initialPanel);
  }

  // Opened from an upgrade dialog or a Pro shortcut: show sign-in or the upgrade dialog.
  if (params.get("account") === "1") {
    NotebookToolsAccountUI.open?.();
  }
  if (params.get("upgrade") && NotebookToolsPlan.isProFeature(params.get("upgrade"))) {
    NotebookToolsPlan.showUpgrade(params.get("upgrade"));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshActiveTabContext();
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    void refreshActiveTabContext();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
      void refreshActiveTabContext();
    }
  });

  if (activeMode === "youtube") {
    void refreshYouTubeBatchPreview();
  }
}

initSidePanel().catch((error) => {
  console.error("NotebookTools side panel init failed:", error);
  const status = document.querySelector("#status");

  if (status) {
    status.textContent = error?.message || "Side panel failed to load.";
    status.classList.add("error");
  }
});
