/* ==========================================================================
   NotebookLM Google accounts: find the Google accounts signed in to this
   browser that can open NotebookLM, remember which one NotebookTools uses
   (chrome.storage.local "notebooktoolsAuthUser", read by notebooklm-client),
   and switch between them. The list is cached so the popup opens instantly.
   ========================================================================== */
(function () {
  "use strict";

  const AUTH_USER_KEY = "notebooktoolsAuthUser";
  const CACHE_KEY = "notebooktoolsAccountsCache";
  const CACHE_MS = 10 * 60 * 1000;
  const SLOTS = 5; // authuser=0..4

  function origin() {
    return window.NotebookToolsNotebookLM?.getOrigin?.() || "https://notebook.google.com";
  }

  function extractEmail(html) {
    const matches = String(html || "").match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    return [...new Set(matches)].find(
      (email) => !/\.(png|jpe?g|gif|svg|webp)$/i.test(email) && !email.includes("googleusercontent")
    ) || "";
  }

  async function probe(index) {
    const url = new URL(`${origin()}/`);
    url.searchParams.set("authuser", String(index));
    const response = await fetch(url.toString(), { credentials: "include", redirect: "follow" });
    if (!response.ok || /accounts\.google\.com$/.test(new URL(response.url || url.toString()).hostname)) return null;
    const html = await response.text();
    if (!html.includes("SNlM0e")) return null;
    return { authUser: String(index), email: extractEmail(html) };
  }

  // Probe every slot in parallel; Google serves the default account for
  // slots that don't exist, so stop at the first repeat.
  async function discover() {
    const results = await Promise.all(Array.from({ length: SLOTS }, (_, i) => probe(i).catch(() => null)));
    const found = [];
    for (const item of results) {
      if (!item) continue;
      const key = item.email || `slot-${item.authUser}`;
      if (found.some((a) => (a.email || `slot-${a.authUser}`) === key)) continue;
      found.push(item);
    }
    await chrome.storage.local.set({ [CACHE_KEY]: { at: Date.now(), accounts: found } });
    return found;
  }

  async function cached() {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    return stored[CACHE_KEY] || null;
  }

  // Returns { accounts, fresh }. Uses the cache unless it's stale or force.
  async function list({ force = false } = {}) {
    const cache = await cached();
    if (!force && cache && Date.now() - cache.at < CACHE_MS) return { accounts: cache.accounts, fresh: false };
    return { accounts: await discover(), fresh: true };
  }

  async function getActive() {
    const stored = await chrome.storage.local.get(AUTH_USER_KEY);
    const value = stored[AUTH_USER_KEY];
    if (value !== undefined && value !== null) return String(value);
    // Not chosen yet: follow the open NotebookLM tab, like the client does.
    const detected = typeof detectNotebookLmAuthUser === "function" ? await detectNotebookLmAuthUser().catch(() => null) : null;
    return detected === null || detected === undefined ? "0" : String(detected);
  }

  async function setActive(authUser) {
    if (authUser === null || authUser === undefined || authUser === "default") {
      await chrome.storage.local.remove(AUTH_USER_KEY);
    } else {
      await chrome.storage.local.set({ [AUTH_USER_KEY]: String(authUser) });
    }
  }

  function label(account) {
    return account?.email || `Account ${Number(account?.authUser || 0) + 1}`;
  }

  function addAccountUrl() {
    return `https://accounts.google.com/AddSession?continue=${encodeURIComponent(`${origin()}/`)}`;
  }

  function notebookUrl(authUser) {
    return `${origin()}/?authuser=${encodeURIComponent(authUser)}`;
  }

  window.NotebookToolsAccounts = { list, discover, getActive, setActive, label, addAccountUrl, notebookUrl, extractEmail };
})();
