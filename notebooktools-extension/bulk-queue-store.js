const BULK_QUEUE_SESSION_KEY = "bulkImportQueue";
const BULK_IMPORT_DELAY_MS = 600;

const NotebookToolsBulkQueue = (() => {
  let items = [];
  let listeners = [];

  function notify() {
    for (const listener of listeners) {
      listener(items);
    }
  }

  function createItem({ url, title, type }) {
    return {
      id: crypto.randomUUID(),
      url,
      title: NotebookToolsStore.cleanNotebookName(title) || url,
      type,
      status: "pending",
      error: "",
      selected: true,
      addedAt: Date.now()
    };
  }

  function getItems() {
    return items;
  }

  function getSelectedPending() {
    return items.filter((item) => item.selected && item.status === "pending");
  }

  function existingKeys() {
    return new Set(items.map((item) => NotebookToolsStore.queueItemKey(item)));
  }

  function addMany(candidates, options = {}) {
    const keys = existingKeys();
    let added = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const key = NotebookToolsStore.queueItemKey(candidate);

      if (keys.has(key)) {
        skipped += 1;
        continue;
      }

      keys.add(key);
      items.push(
        createItem({
          url: candidate.url,
          title: candidate.title || candidate.url,
          type: candidate.type
        })
      );
      added += 1;
    }

    notify();
    return { added, skipped };
  }

  function removeSelected() {
    items = items.filter((item) => !item.selected);
    notify();
  }

  function clearQueue() {
    items = [];
    notify();
  }

  function toggleAll(selected) {
    items = items.map((item) => ({ ...item, selected }));
    notify();
  }

  function toggleItem(id, selected) {
    items = items.map((item) => (item.id === id ? { ...item, selected } : item));
    notify();
  }

  function updateItem(id, patch) {
    items = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    notify();
  }

  function resetFailedToPending() {
    items = items.map((item) =>
      item.status === "failed"
        ? { ...item, status: "pending", error: "", selected: true }
        : item
    );
    notify();
  }

  async function persist() {
    await chrome.storage.session.set({ [BULK_QUEUE_SESSION_KEY]: items });
  }

  async function restore() {
    const stored = await chrome.storage.session.get(BULK_QUEUE_SESSION_KEY);
    items = Array.isArray(stored[BULK_QUEUE_SESSION_KEY]) ? stored[BULK_QUEUE_SESSION_KEY] : [];
    notify();
    return items;
  }

  function subscribe(listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((entry) => entry !== listener);
    };
  }

  return {
    get NOTEBOOK_SOURCE_LIMIT() {
      return NotebookToolsNotebookLM.NOTEBOOK_SOURCE_LIMIT;
    },
    addMany,
    clearQueue,
    getItems,
    getSelectedPending,
    persist,
    removeSelected,
    resetFailedToPending,
    restore,
    subscribe,
    toggleAll,
    toggleItem,
    updateItem
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsBulkQueue = NotebookToolsBulkQueue;
}
