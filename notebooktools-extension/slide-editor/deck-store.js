/* Presentations saved on this computer (IndexedDB), so a deck being edited can be
   reopened later with its edits. Nothing is uploaded.
   meta: { id, title, slideCount, createdAt, updatedAt, thumb, bytes, source }
   data: { id, slides: [{ id, w, h, status, bgMode, bgColor, notes, transition,
           elements, original: Blob, clean: Blob|null }] } */
window.NTDeckStore = (() => {
  const DB = "notebooktools-presentations";
  let dbPromise = null;

  function db() {
    dbPromise ||= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "id" });
        if (!d.objectStoreNames.contains("data")) d.createObjectStore("data", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(stores, mode, run) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(stores, mode);
      let result;
      Promise.resolve(run(t)).then((v) => { result = v; }, reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("Saving was cancelled."));
    });
  }

  const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

  return {
    async list() {
      const all = await tx(["meta"], "readonly", (t) => req(t.objectStore("meta").getAll()));
      return (all || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    async get(id) {
      return tx(["meta", "data"], "readonly", async (t) => ({ meta: await req(t.objectStore("meta").get(id)), data: await req(t.objectStore("data").get(id)) }));
    },
    async save(meta, data) {
      return tx(["meta", "data"], "readwrite", (t) => {
        t.objectStore("meta").put(meta);
        if (data) t.objectStore("data").put(data);
      });
    },
    async rename(id, title) {
      return tx(["meta"], "readwrite", async (t) => {
        const store = t.objectStore("meta");
        const meta = await req(store.get(id));
        if (meta) store.put({ ...meta, title: String(title || "").trim() || meta.title, updatedAt: Date.now() });
      });
    },
    async remove(id) {
      return tx(["meta", "data"], "readwrite", (t) => {
        t.objectStore("meta").delete(id);
        t.objectStore("data").delete(id);
      });
    },
    /** The saved deck made from this NotebookLM slide deck, if any. */
    async findBySource(notebookId, artifactId) {
      const all = await this.list();
      return all.find((m) => m.source && m.source.notebookId === notebookId && (m.source.artifactId || "") === (artifactId || "")) || null;
    }
  };
})();
