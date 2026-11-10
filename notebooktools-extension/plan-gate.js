/* ==========================================================================
   NotebookTools plan gate: which features are Free and which need Pro.

   EDIT THIS FILE to change what is free. Every feature key below maps to a
   label shown in the upgrade dialog. A key listed in PRO_FEATURES needs the
   Pro plan; anything not listed is free.

   Free: every import option (current page, YouTube, X, AI chats, highlights,
   bulk links, open tabs, playlists, link extraction).

   Works in extension pages, NotebookLM content scripts and the background
   service worker. The plan is read from the profile that account.js caches
   in chrome.storage.local; when it says Free for a signed-in user, the gate
   asks the background to re-check with the server once before blocking, so a
   fresh purchase unlocks without signing out.
   ========================================================================== */
(() => {
  const root = typeof globalThis !== "undefined" ? globalThis : self;
  if (root.NotebookToolsPlan) return;

  const PRODUCT_ID = "pdt_0NqwhiU4r4xHT1O5izA99"; // Dodo live product: NotebookTools Pro (lifetime)
  const PRICE_LABEL = "$49";
  const CHECKOUT_BASE = "https://checkout.dodopayments.com/buy/";
  const CHECKOUT_RETURN_URL = "https://www.notebooktools.com/?checkout=success#pricing";
  const PRICING_URL = "https://www.notebooktools.com/#pricing";

  const SESSION_KEY = "notebooktoolsAuthSession";
  const PROFILE_KEY = "notebooktoolsAuthProfile";
  const RECHECK_MS = 60 * 1000;

  // Pro-only features and the name shown to the user.
  const PRO_FEATURES = {
    "notebooks-hub": "Notebooks dashboard",
    "organize": "Folders, tags and favorites",
    "manage-sources": "Source manager",
    "studio-files": "Studio files",
    "studio-create": "Create Studio outputs on import",
    "blog-maker": "Blog maker",
    "carousel-maker": "Carousel maker",
    "snapshots": "Snapshots",
    "prompt-library": "Prompt library",
    "chat-export": "Chat export",
  };

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (items) => resolve(items || {}));
      } catch (_error) {
        resolve({});
      }
    });
  }

  async function readState() {
    const items = await storageGet([SESSION_KEY, PROFILE_KEY]);
    const session = items[SESSION_KEY] || null;
    const profile = session ? items[PROFILE_KEY] || null : null;
    return {
      signedIn: Boolean(session),
      email: session?.user?.email || null,
      userId: session?.user?.id || null,
      plan: profile?.plan === "pro" ? "pro" : "free",
      checkedAt: profile?.checkedAt || 0,
    };
  }

  function isProFeature(key) {
    return Object.prototype.hasOwnProperty.call(PRO_FEATURES, key);
  }

  // Ask the background (or account.js in this page) to re-read the plan from the server.
  function refreshPlan() {
    if (root.NotebookToolsAccount?.refreshProfile) {
      return root.NotebookToolsAccount.refreshProfile().catch(() => null);
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "notebooktools-refresh-plan" }, (response) => {
          void chrome.runtime.lastError;
          resolve(response || null);
        });
      } catch (_error) {
        resolve(null);
      }
      setTimeout(() => resolve(null), 5000);
    });
  }

  /** True when the feature is free or the user is on Pro. */
  async function can(key) {
    if (!isProFeature(key)) return true;
    let state = await readState();
    if (state.plan === "pro") return true;
    if (state.signedIn && Date.now() - state.checkedAt > RECHECK_MS) {
      await refreshPlan();
      state = await readState();
    }
    return state.plan === "pro";
  }

  async function checkoutUrl() {
    if (!PRODUCT_ID) return PRICING_URL;
    const state = await readState();
    const params = new URLSearchParams({ quantity: "1", redirect_url: CHECKOUT_RETURN_URL });
    if (state.email) params.set("email", state.email);
    params.set("metadata_app", "notebooktools");
    if (state.userId) params.set("metadata_user_id", state.userId);
    return `${CHECKOUT_BASE}${PRODUCT_ID}?${params.toString()}`;
  }

  function openUrl(url) {
    try {
      if (chrome.tabs?.create) {
        chrome.tabs.create({ url });
        return;
      }
    } catch (_error) {
      // Content scripts have no chrome.tabs.
    }
    root.open?.(url, "_blank", "noopener,noreferrer");
  }

  function openSignIn() {
    const isExtensionPage = typeof location !== "undefined" && location.protocol === "chrome-extension:";
    if (isExtensionPage && /sidepanel\.html/.test(location.pathname) && root.NotebookToolsAccountUI?.open) {
      root.NotebookToolsAccountUI.open();
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "notebooktools-ribbon-open-panel", query: "account=1" }, () => void chrome.runtime.lastError);
    } catch (_error) {
      // Extension was reloaded.
    }
  }

  /* ---------- Upgrade dialog (shadow DOM so page styles cannot leak in) ---------- */

  const STYLE = `
    :host { all: initial; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483646; background: rgba(15, 18, 25, .45);
      display: flex; align-items: center; justify-content: center; padding: 16px;
      font-family: "Google Sans", Roboto, Arial, sans-serif; }
    .card { background: #fff; color: #1f1f1f; width: 100%; max-width: 400px; border-radius: 18px;
      padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.25); box-sizing: border-box; }
    .card.page { box-shadow: 0 1px 3px rgba(0,0,0,.08); border: 1px solid #e3e8f0; }
    .badge { display: inline-block; background: #e8f0fe; color: #0b57d0; font-size: 12px; font-weight: 700;
      letter-spacing: .06em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; }
    h2 { font-size: 20px; line-height: 1.3; margin: 12px 0 8px; font-weight: 600; }
    p { font-size: 14px; line-height: 1.55; color: #444746; margin: 0 0 14px; }
    ul { margin: 0 0 18px; padding: 0 0 0 18px; font-size: 13px; line-height: 1.7; color: #444746; }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    button { font: inherit; cursor: pointer; border-radius: 999px; padding: 11px 18px; font-size: 14px; font-weight: 600; }
    .primary { background: #1f1f1f; color: #fff; border: 1px solid #1f1f1f; }
    .primary:hover { background: #3a3a3a; }
    .ghost { background: #fff; color: #1f1f1f; border: 1px solid #dadce0; }
    .link { background: none; border: 0; color: #5f6368; font-weight: 500; padding: 6px; }
    .note { font-size: 12px; color: #80868b; margin: 12px 0 0; text-align: center; }
  `;

  function cardHtml(label, { dismissible }) {
    const list = Object.values(PRO_FEATURES).map((name) => `<li>${name}</li>`).join("");
    return `
      <span class="badge">Pro feature</span>
      <h2>${label} is part of NotebookTools Pro</h2>
      <p>Free includes every import option. Pro unlocks everything else, for life:</p>
      <ul>${list}</ul>
      <div class="actions">
        <button type="button" class="primary" data-act="buy">Get Pro, ${PRICE_LABEL} once</button>
        <button type="button" class="ghost" data-act="signin">I already have Pro: sign in</button>
        ${dismissible ? `<button type="button" class="link" data-act="close">Not now</button>` : ""}
      </div>
      <p class="note">One-time payment, lifetime updates. Use the same email in checkout and in the extension.</p>`;
  }

  function wire(container, close) {
    container.addEventListener("click", async (event) => {
      const act = event.target.closest("[data-act]")?.getAttribute("data-act");
      if (act === "buy") openUrl(await checkoutUrl());
      if (act === "signin") openSignIn();
      if (act === "close") close?.();
    });
  }

  let open = null;

  /** Shows the upgrade dialog for a Pro feature. */
  function showUpgrade(key) {
    if (typeof document === "undefined") return;
    open?.remove();
    const host = document.createElement("div");
    host.setAttribute("data-notebooktools-upgrade", "");
    const shadow = host.attachShadow({ mode: "open" });
    const label = PRO_FEATURES[key] || "This feature";
    shadow.innerHTML = `<style>${STYLE}</style><div class="backdrop" role="dialog" aria-modal="true" aria-label="Upgrade to Pro"><div class="card">${cardHtml(label, { dismissible: true })}</div></div>`;
    const close = () => {
      host.remove();
      if (open === host) open = null;
    };
    wire(shadow, close);
    shadow.querySelector(".backdrop").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
    document.documentElement.appendChild(host);
    open = host;
    shadow.querySelector(".primary")?.focus();
  }

  /** Runs `action` when allowed, otherwise shows the upgrade dialog. Returns whether it ran. */
  async function requirePro(key, action) {
    if (await can(key)) {
      if (action) await action();
      return true;
    }
    showUpgrade(key);
    return false;
  }

  /**
   * Replaces a whole page with a lock screen until the user is on Pro.
   * Re-checks when the page regains focus, so it unlocks right after checkout.
   */
  async function lockPage(key, { onUnlock } = {}) {
    if (await can(key)) return true;
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${STYLE} .backdrop { background: #f6f8fc; }</style><div class="backdrop"><div class="card page">${cardHtml(PRO_FEATURES[key] || "This page", { dismissible: false })}</div></div>`;
    wire(shadow);
    document.documentElement.appendChild(host);
    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      await refreshPlan();
      if ((await readState()).plan === "pro") {
        document.removeEventListener("visibilitychange", recheck);
        host.remove();
        onUnlock ? onUnlock() : location.reload();
      }
    };
    document.addEventListener("visibilitychange", recheck);
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[PROFILE_KEY]?.newValue?.plan === "pro") recheck();
      });
    } catch (_error) {
      // ignore
    }
    return false;
  }

  root.NotebookToolsPlan = {
    PRODUCT_ID,
    PRICE_LABEL,
    PRO_FEATURES,
    isProFeature,
    can,
    requirePro,
    showUpgrade,
    lockPage,
    checkoutUrl,
    readState,
  };
})();
