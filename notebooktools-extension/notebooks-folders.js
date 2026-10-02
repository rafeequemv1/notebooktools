const NOTEBOOK_FOLDERS_KEY = "notebooktoolsNotebookFolders";
const AUTH_USER_KEY = "notebooktoolsAuthUser";
const VIEW_MODE_KEY = "notebooktoolsNotebooksView";
const BROWSE_MODE_KEY = "notebooktoolsBrowseMode";

const NotebookToolsNotebookFolders = {
  async getState() {
    const stored = await chrome.storage.local.get(NOTEBOOK_FOLDERS_KEY);
    const state = stored[NOTEBOOK_FOLDERS_KEY] || {};
    return {
      assignments: state.assignments || {},
      folders: Array.isArray(state.folders) ? state.folders : [],
      tags: Array.isArray(state.tags) ? state.tags : [],
      tagAssignments: state.tagAssignments || {},
      pinned: Array.isArray(state.pinned) ? state.pinned : [],
      favorites: Array.isArray(state.favorites) ? state.favorites : []
    };
  },

  async saveState(state) {
    await chrome.storage.local.set({
      [NOTEBOOK_FOLDERS_KEY]: {
        assignments: state.assignments || {},
        folders: Array.isArray(state.folders) ? state.folders : [],
        tags: Array.isArray(state.tags) ? state.tags : [],
        tagAssignments: state.tagAssignments || {},
        pinned: Array.isArray(state.pinned) ? state.pinned : [],
        favorites: Array.isArray(state.favorites) ? state.favorites : []
      }
    });
  },

  async addFolder(name) {
    const cleaned = String(name || "").trim();

    if (!cleaned) {
      return null;
    }

    const state = await this.getState();

    if (!state.folders.includes(cleaned)) {
      state.folders.push(cleaned);
      state.folders.sort((a, b) => a.localeCompare(b));
      await this.saveState(state);
    }

    return cleaned;
  },

  async setNotebookFolder(notebookId, folderName) {
    if (!notebookId) {
      return this.getState();
    }

    const state = await this.getState();
    const cleaned = String(folderName || "").trim();

    if (!cleaned || cleaned === "Unfiled") {
      delete state.assignments[notebookId];
    } else {
      state.assignments[notebookId] = cleaned;

      if (!state.folders.includes(cleaned)) {
        state.folders.push(cleaned);
        state.folders.sort((a, b) => a.localeCompare(b));
      }
    }

    await this.saveState(state);
    return state;
  },

  async addTag(name) {
    const cleaned = String(name || "").trim();

    if (!cleaned) {
      return null;
    }

    const state = await this.getState();

    if (!state.tags.includes(cleaned)) {
      state.tags.push(cleaned);
      state.tags.sort((a, b) => a.localeCompare(b));
      await this.saveState(state);
    }

    return cleaned;
  },

  async toggleNotebookTag(notebookId, tagName) {
    if (!notebookId) {
      return this.getState();
    }

    const state = await this.getState();
    const cleaned = String(tagName || "").trim();

    if (!cleaned) {
      return state;
    }

    const current = Array.isArray(state.tagAssignments[notebookId]) ? state.tagAssignments[notebookId] : [];

    if (current.includes(cleaned)) {
      const next = current.filter((tag) => tag !== cleaned);

      if (next.length) {
        state.tagAssignments[notebookId] = next;
      } else {
        delete state.tagAssignments[notebookId];
      }
    } else {
      state.tagAssignments[notebookId] = [...current, cleaned].sort((a, b) => a.localeCompare(b));

      if (!state.tags.includes(cleaned)) {
        state.tags.push(cleaned);
        state.tags.sort((a, b) => a.localeCompare(b));
      }
    }

    await this.saveState(state);
    return state;
  },

  isPinned(state, notebookId) {
    return Array.isArray(state.pinned) && state.pinned.includes(notebookId);
  },

  isFavorite(state, notebookId) {
    return Array.isArray(state.favorites) && state.favorites.includes(notebookId);
  },

  async togglePin(notebookId) {
    if (!notebookId) {
      return this.getState();
    }

    const state = await this.getState();
    const pinned = Array.isArray(state.pinned) ? [...state.pinned] : [];
    const index = pinned.indexOf(notebookId);

    if (index >= 0) {
      pinned.splice(index, 1);
    } else {
      pinned.unshift(notebookId);
    }

    state.pinned = pinned;
    await this.saveState(state);
    return state;
  },

  async toggleFavorite(notebookId) {
    if (!notebookId) {
      return this.getState();
    }

    const state = await this.getState();
    const favorites = Array.isArray(state.favorites) ? [...state.favorites] : [];
    const index = favorites.indexOf(notebookId);

    if (index >= 0) {
      favorites.splice(index, 1);
    } else {
      favorites.push(notebookId);
    }

    state.favorites = favorites;
    await this.saveState(state);
    return state;
  },

  async pruneNotebook(notebookId) {
    if (!notebookId) {
      return this.getState();
    }

    const state = await this.getState();

    state.pinned = (state.pinned || []).filter((id) => id !== notebookId);
    state.favorites = (state.favorites || []).filter((id) => id !== notebookId);
    delete state.assignments[notebookId];
    delete state.tagAssignments[notebookId];

    await this.saveState(state);
    return state;
  },

  async getSortMode() {
    const stored = await chrome.storage.local.get("notebooktoolsSortMode");
    const mode = stored.notebooktoolsSortMode;
    return mode === "sources" || mode === "tags" || mode === "favorites" ? mode : "title";
  },

  async setSortMode(mode) {
    const value =
      mode === "sources" || mode === "tags" || mode === "favorites" ? mode : "title";
    await chrome.storage.local.set({ notebooktoolsSortMode: value });
  },

  async getActiveTag() {
    const stored = await chrome.storage.local.get("notebooktoolsActiveTag");
    return stored.notebooktoolsActiveTag || "all";
  },

  async setActiveTag(tag) {
    if (!tag || tag === "all") {
      await chrome.storage.local.remove("notebooktoolsActiveTag");
      return;
    }

    await chrome.storage.local.set({ notebooktoolsActiveTag: String(tag) });
  },

  async getAuthUser() {
    const stored = await chrome.storage.local.get(AUTH_USER_KEY);

    if (stored[AUTH_USER_KEY] === undefined || stored[AUTH_USER_KEY] === null) {
      return null;
    }

    return String(stored[AUTH_USER_KEY]);
  },

  async setAuthUser(authUser) {
    if (authUser === null || authUser === "default") {
      await chrome.storage.local.remove(AUTH_USER_KEY);
      return;
    }

    await chrome.storage.local.set({ [AUTH_USER_KEY]: String(authUser) });
  },

  async getViewMode() {
    const stored = await chrome.storage.local.get(VIEW_MODE_KEY);
    return stored[VIEW_MODE_KEY] === "list" ? "list" : "grid";
  },

  async setViewMode(mode) {
    await chrome.storage.local.set({ [VIEW_MODE_KEY]: mode === "list" ? "list" : "grid" });
  },

  async getBrowseMode() {
    const stored = await chrome.storage.local.get(BROWSE_MODE_KEY);
    return stored[BROWSE_MODE_KEY] === "folders" ? "folders" : "all";
  },

  async setBrowseMode(mode) {
    await chrome.storage.local.set({
      [BROWSE_MODE_KEY]: mode === "folders" ? "folders" : "all"
    });
  },

  // --- Studio artifact folders (local to extension) ---
  async getStudioState(notebookId) {
    const key = "notebooktoolsStudioFolders";
    const stored = await chrome.storage.local.get(key);
    const all = stored[key] || {};
    const nb = all[notebookId] || {};
    return {
      folders: Array.isArray(nb.folders) ? nb.folders : [],
      assignments: nb.assignments || {}
    };
  },

  async saveStudioState(notebookId, state) {
    const key = "notebooktoolsStudioFolders";
    const stored = await chrome.storage.local.get(key);
    const all = stored[key] || {};
    all[notebookId] = {
      folders: Array.isArray(state.folders) ? state.folders : [],
      assignments: state.assignments || {}
    };
    await chrome.storage.local.set({ [key]: all });
    return all[notebookId];
  },

  async addStudioFolder(notebookId, name) {
    const cleaned = String(name || "").trim();
    if (!cleaned || !notebookId) return null;
    const state = await this.getStudioState(notebookId);
    if (!state.folders.includes(cleaned)) {
      state.folders.push(cleaned);
      state.folders.sort((a, b) => a.localeCompare(b));
      await this.saveStudioState(notebookId, state);
    }
    return cleaned;
  },

  async setStudioArtifactFolder(notebookId, artifactId, folderName) {
    if (!notebookId || !artifactId) return this.getStudioState(notebookId);
    const state = await this.getStudioState(notebookId);
    const cleaned = String(folderName || "").trim();
    if (!cleaned || cleaned === "Unfiled") {
      delete state.assignments[artifactId];
    } else {
      state.assignments[artifactId] = cleaned;
      if (!state.folders.includes(cleaned)) {
        state.folders.push(cleaned);
        state.folders.sort((a, b) => a.localeCompare(b));
      }
    }
    await this.saveStudioState(notebookId, state);
    return state;
  },

  async assignStudioArtifactsFolder(notebookId, artifactIds, folderName) {
    if (!notebookId || !artifactIds?.length) return this.getStudioState(notebookId);
    const state = await this.getStudioState(notebookId);
    const cleaned = String(folderName || "").trim();
    for (const id of artifactIds) {
      if (!cleaned || cleaned === "Unfiled") {
        delete state.assignments[id];
      } else {
        state.assignments[id] = cleaned;
      }
    }
    if (cleaned && cleaned !== "Unfiled" && !state.folders.includes(cleaned)) {
      state.folders.push(cleaned);
      state.folders.sort((a, b) => a.localeCompare(b));
    }
    await this.saveStudioState(notebookId, state);
    return state;
  },

};

if (typeof window !== "undefined") {
  window.NotebookToolsNotebookFolders = NotebookToolsNotebookFolders;
}
