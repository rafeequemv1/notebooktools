const NotebookToolsSnapshotStore = {
  STORAGE_KEY: "notebooktoolsSnapshots",
  SESSIONS_KEY: "notebooktoolsSnapshotSessionsByNotebook",
  MAX_SNAPSHOTS: 24,

  createId() {
    return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  isCapturableUrl(url = "") {
    const value = String(url || "").trim().toLowerCase();

    if (!value) {
      return false;
    }

    if (
      value.startsWith("chrome://") ||
      value.startsWith("chrome-extension://") ||
      value.startsWith("edge://") ||
      value.startsWith("about:") ||
      value.startsWith("devtools://")
    ) {
      return false;
    }

    return value.startsWith("http://") || value.startsWith("https://");
  },

  async list() {
    const stored = await chrome.storage.local.get(this.STORAGE_KEY);
    return Array.isArray(stored[this.STORAGE_KEY]) ? stored[this.STORAGE_KEY] : [];
  },

  async saveAll(snapshots) {
    const next = (snapshots || []).slice(0, this.MAX_SNAPSHOTS);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: next });
    return next;
  },

  async add(snapshot) {
    const items = await this.list();
    const entry = {
      id: snapshot.id || this.createId(),
      dataUrl: snapshot.dataUrl || "",
      url: snapshot.url || "",
      title: snapshot.title || "Snapshot",
      action: snapshot.action || "",
      actionType: snapshot.actionType || "",
      caption: snapshot.caption || snapshot.action || "",
      timestamp: snapshot.timestamp || Date.now()
    };

    items.push(entry);
    return this.saveAll(items);
  },

  async remove(id) {
    const items = (await this.list()).filter((item) => item.id !== id);
    return this.saveAll(items);
  },

  async update(id, patch = {}) {
    const items = await this.list();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return items;
    }

    items[index] = { ...items[index], ...patch, id };
    return this.saveAll(items);
  },

  async clear() {
    await chrome.storage.local.remove(this.STORAGE_KEY);
    return [];
  },

  async reorder(ids) {
    const items = await this.list();
    const map = new Map(items.map((item) => [item.id, item]));
    const next = ids.map((id) => map.get(id)).filter(Boolean);

    for (const item of items) {
      if (!next.find((entry) => entry.id === item.id)) {
        next.push(item);
      }
    }

    return this.saveAll(next);
  },

  async getAllSessionMeta() {
    const stored = await chrome.storage.local.get(this.SESSIONS_KEY);
    const value = stored[this.SESSIONS_KEY];

    return value && typeof value === "object" ? value : {};
  },

  async hydrateSession(meta) {
    if (!meta?.notebookId) {
      return null;
    }

    const snapshots = await this.list();
    const byId = new Map(snapshots.map((item) => [item.id, item]));
    const snapshotIds = Array.isArray(meta.snapshotIds) ? meta.snapshotIds : [];
    let resolved = snapshotIds.map((id) => byId.get(id)).filter(Boolean);

    if (!resolved.length && snapshots.length) {
      resolved = snapshots;
    }

    return {
      notebookId: meta.notebookId,
      sourceIds: Array.isArray(meta.sourceIds) ? meta.sourceIds : [],
      snapshotIds: resolved.map((item) => item.id),
      snapshots: resolved,
      snapshotCount: resolved.length,
      pageTitle: meta.pageTitle || resolved[0]?.title || "Captured screens",
      guideTitle: meta.guideTitle || "",
      guideContext: meta.guideContext || "",
      outputType: meta.outputType || "blog",
      uploadedAt: meta.uploadedAt || 0,
      pendingRun: Boolean(meta.pendingRun),
      autoDownloadDoc: meta.autoDownloadDoc !== false,
      awaitingDoc: Boolean(meta.awaitingDoc),
      messageCountBefore: Number(meta.messageCountBefore) || 0,
      awaitingStartedAt: Number(meta.awaitingStartedAt) || 0,
      docReady: Boolean(meta.docReady),
      docTitle: meta.docTitle || "",
      docImageCount: Number(meta.docImageCount) || 0,
      docReadyAt: Number(meta.docReadyAt) || 0
    };
  },

  async setSession(session) {
    const notebookId = String(session?.notebookId || "").trim();

    if (!notebookId) {
      return null;
    }

    const snapshots = Array.isArray(session.snapshots) ? session.snapshots : [];
    const meta = {
      notebookId,
      snapshotIds: snapshots.map((item) => item.id).filter(Boolean),
      sourceIds: Array.isArray(session.sourceIds) ? session.sourceIds : [],
      pageTitle: session.pageTitle || snapshots[0]?.title || "Captured screens",
      guideTitle: session.guideTitle || "",
      guideContext: session.guideContext || "",
      outputType: session.outputType || "blog",
      uploadedAt: session.uploadedAt || Date.now(),
      pendingRun: Boolean(session.pendingRun),
      autoDownloadDoc: session.autoDownloadDoc !== false,
      awaitingDoc: Boolean(session.awaitingDoc),
      messageCountBefore: Number(session.messageCountBefore) || 0,
      awaitingStartedAt: Number(session.awaitingStartedAt) || 0,
      docReady: Boolean(session.docReady),
      docTitle: session.docTitle || "",
      docImageCount: Number(session.docImageCount) || 0,
      docReadyAt: Number(session.docReadyAt) || 0
    };

    const all = await this.getAllSessionMeta();
    all[notebookId] = meta;
    await chrome.storage.local.set({ [this.SESSIONS_KEY]: all });

    return this.hydrateSession(meta);
  },

  async getSession(notebookId) {
    const id = String(notebookId || "").trim();

    if (id) {
      const all = await this.getAllSessionMeta();
      return this.hydrateSession(all[id]);
    }

    const all = await this.getAllSessionMeta();
    const entries = Object.values(all).sort(
      (left, right) => Number(right.uploadedAt || 0) - Number(left.uploadedAt || 0)
    );

    for (const meta of entries) {
      const hydrated = await this.hydrateSession(meta);

      if (hydrated?.snapshots?.length) {
        return hydrated;
      }
    }

    return null;
  },

  async clearSession(notebookId) {
    if (!notebookId) {
      await chrome.storage.local.remove(this.SESSIONS_KEY);
      return;
    }

    const all = await this.getAllSessionMeta();
    delete all[String(notebookId)];
    await chrome.storage.local.set({ [this.SESSIONS_KEY]: all });
  },

  async updateSessionMeta(notebookId, patch = {}) {
    const id = String(notebookId || "").trim();

    if (!id) {
      return null;
    }

    const all = await this.getAllSessionMeta();

    if (!all[id]) {
      return null;
    }

    all[id] = { ...all[id], ...patch };
    await chrome.storage.local.set({ [this.SESSIONS_KEY]: all });
    return this.hydrateSession(all[id]);
  },

  async clearPendingRun(notebookId) {
    return this.updateSessionMeta(notebookId, { pendingRun: false });
  },

  async setAwaitingDoc(notebookId, patch = {}) {
    return this.updateSessionMeta(notebookId, {
      awaitingDoc: true,
      docReady: false,
      ...patch
    });
  },

  async clearAwaitingDoc(notebookId) {
    return this.updateSessionMeta(notebookId, {
      awaitingDoc: false,
      messageCountBefore: 0,
      awaitingStartedAt: 0
    });
  },

  async setDocReady(notebookId, patch = {}) {
    return this.updateSessionMeta(notebookId, {
      awaitingDoc: false,
      docReady: true,
      docReadyAt: Date.now(),
      ...patch
    });
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotStore = NotebookToolsSnapshotStore;
}

if (typeof self !== "undefined" && typeof importScripts === "function") {
  self.NotebookToolsSnapshotStore = NotebookToolsSnapshotStore;
}
