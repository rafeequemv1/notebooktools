/* ==========================================================================
   NotebookTools usage counters (local only, never sent anywhere).

   notebooktoolsImportCount   sources imported successfully (any import path)
   notebooktoolsBulkRunCount  bulk import runs that added at least one source

   The background service worker is the single writer so counts from several
   pages at once do not overwrite each other. Pages and content scripts send
   "notebooktools-record-import"; if the background cannot be reached the
   page writes chrome.storage.local itself.
   ========================================================================== */
(() => {
  const root = typeof globalThis !== "undefined" ? globalThis : self;
  if (root.NotebookToolsStats) return;

  const KEYS = {
    imports: "notebooktoolsImportCount",
    bulkRuns: "notebooktoolsBulkRunCount",
  };
  const ALLOWED = new Set(Object.values(KEYS));
  const isWorker = typeof ServiceWorkerGlobalScope !== "undefined" && root instanceof ServiceWorkerGlobalScope;

  let queue = Promise.resolve();

  /** Adds `amount` to a counter in chrome.storage.local and resolves with the new value. */
  function bumpLocal(key, amount) {
    const next = queue.then(async () => {
      const items = await chrome.storage.local.get(key);
      const value = Math.max(0, Number(items[key]) || 0) + amount;
      await chrome.storage.local.set({ [key]: value });
      return value;
    });
    queue = next.catch(() => null);
    return next.catch(() => null);
  }

  function bump(key, amount = 1) {
    const count = Math.max(0, Math.floor(Number(amount) || 0));
    if (!ALLOWED.has(key) || !count) return Promise.resolve(null);
    if (isWorker) return bumpLocal(key, count);

    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "notebooktools-record-import", key, count }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            bumpLocal(key, count).then(resolve);
            return;
          }
          resolve(response.value);
        });
      } catch (_error) {
        bumpLocal(key, count).then(resolve);
      }
    });
  }

  async function getCounts() {
    try {
      const items = await chrome.storage.local.get([KEYS.imports, KEYS.bulkRuns]);
      return {
        imports: Number(items[KEYS.imports]) || 0,
        bulkRuns: Number(items[KEYS.bulkRuns]) || 0,
      };
    } catch (_error) {
      return { imports: 0, bulkRuns: 0 };
    }
  }

  root.NotebookToolsStats = {
    KEYS,
    isAllowedKey: (key) => ALLOWED.has(key),
    bumpLocal,
    /** Call once per source that was added to NotebookLM. */
    recordImport: (count = 1) => bump(KEYS.imports, count),
    /** Call once per bulk import run that added at least one source. */
    recordBulkRun: () => bump(KEYS.bulkRuns, 1),
    getCounts,
  };
})();
