const NOTEBOOKS_CACHE_KEY = "notebooktoolsNotebooksCache";

const NotebookToolsNotebooksCache = {
  cacheKey(authUser) {
    if (!authUser || authUser === "default") {
      return "default";
    }

    return String(authUser);
  },

  async get(authUser) {
    const key = this.cacheKey(authUser);
    const stored = await chrome.storage.local.get(NOTEBOOKS_CACHE_KEY);
    const all = stored[NOTEBOOKS_CACHE_KEY] || {};
    const entry = all[key];

    return Array.isArray(entry?.notebooks) ? entry.notebooks : [];
  },

  async set(authUser, notebooks) {
    const key = this.cacheKey(authUser);
    const stored = await chrome.storage.local.get(NOTEBOOKS_CACHE_KEY);
    const all = stored[NOTEBOOKS_CACHE_KEY] || {};

    all[key] = {
      notebooks: Array.isArray(notebooks) ? notebooks : [],
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ [NOTEBOOKS_CACHE_KEY]: all });
    return all[key].notebooks;
  },

  async removeNotebook(authUser, notebookId) {
    const cached = await this.get(authUser);
    const next = cached.filter((item) => item.id !== notebookId);
    await this.set(authUser, next);
    return next;
  },

  async updateNotebook(authUser, notebookId, patch) {
    const cached = await this.get(authUser);
    const next = cached.map((item) =>
      item.id === notebookId ? { ...item, ...patch } : item
    );

    await this.set(authUser, next);
    return next;
  },

  async addNotebook(authUser, notebook) {
    if (!notebook?.id) {
      return this.get(authUser);
    }

    const cached = await this.get(authUser);

    if (cached.some((item) => item.id === notebook.id)) {
      return cached;
    }

    const next = [notebook, ...cached];
    await this.set(authUser, next);
    return next;
  },

  mergeRemote(cached, remote) {
    const cachedById = new Map(cached.map((item) => [item.id, item]));

    return remote.map((remoteNotebook) => {
      const existing = cachedById.get(remoteNotebook.id);

      if (existing) {
        return {
          ...existing,
          title: remoteNotebook.title,
          sourceCount: remoteNotebook.sourceCount,
          studioCounts: existing.studioCounts
        };
      }

      return remoteNotebook;
    });
  },

  summarizeStudioArtifacts(artifacts) {
    const byType = {};

    for (const artifact of artifacts || []) {
      if (artifact?.status === "failed") {
        continue;
      }

      const label = String(artifact?.type || "Artifact").trim() || "Artifact";
      byType[label] = (byType[label] || 0) + 1;
    }

    const total = Object.values(byType).reduce((sum, count) => sum + count, 0);

    return total > 0 ? { total, byType } : null;
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsNotebooksCache = NotebookToolsNotebooksCache;
}
