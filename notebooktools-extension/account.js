/* ==========================================================================
   NotebookTools account: Supabase email/password auth, plan (free | pro),
   Dodo Payments checkout, and the feature gate.

   - Plans live in the Supabase table public.profiles (row-level security:
     a user can only read their own row).
   - A Dodo "payment.succeeded" webhook (Supabase function dodo-webhook)
     switches the buyer to "pro" automatically, matched by user id or email.
   - Feature gating: list Pro-only feature keys in PRO_FEATURES. It is empty
     for now, so every feature works on the Free plan.
   ========================================================================== */
const NotebookToolsAccount = (() => {
  const CONFIG = {
    supabaseUrl: "https://vgqfjwwnezwhzwfhpmkz.supabase.co",
    // Publishable key: safe to ship in the extension (access is enforced by RLS).
    supabaseKey: "sb_publishable_B5AIRo0MVD0lbE4JP_GLpQ_pT5t6KKh",
    // Dodo product for NotebookTools Pro (Scidart business). Empty until it exists;
    // Upgrade then opens the pricing page instead of checkout.
    proProductId: "",
    pricingUrl: "https://www.notebooktools.com/#pricing",
    checkoutBase: "https://checkout.dodopayments.com/buy/",
    checkoutReturnUrl: "https://www.notebooktools.com/?checkout=success#pricing",
    priceLabel: "$49",
  };

  // Feature keys that require Pro. Add keys here when paid features are decided,
  // e.g. "bulk-import", "studio-generate". Empty = everything is free.
  const PRO_FEATURES = new Set([]);

  const SESSION_KEY = "notebooktoolsAuthSession";
  const PROFILE_KEY = "notebooktoolsAuthProfile";
  const listeners = new Set();

  function storageGet(key) {
    return new Promise((resolve) => chrome.storage.local.get(key, (items) => resolve(items[key] || null)));
  }

  function storageSet(values) {
    return new Promise((resolve) => chrome.storage.local.set(values, resolve));
  }

  function storageRemove(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
  }

  async function request(path, { method = "GET", body, token, headers = {} } = {}) {
    let response;
    try {
      response = await fetch(CONFIG.supabaseUrl + path, {
      method,
      headers: {
        apikey: CONFIG.supabaseKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new Error(friendlyError("Failed to fetch"));
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = { message: text };
    }
    if (!response.ok) {
      const message = data?.msg || data?.error_description || data?.message || data?.error || `Request failed (${response.status})`;
      const error = new Error(friendlyError(message));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function friendlyError(message) {
    const m = String(message || "");
    if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
    if (/email not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you, then sign in.";
    if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Sign in instead.";
    if (/password should be at least/i.test(m)) return "Use a password with at least 6 characters.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a minute and try again.";
    if (/failed to fetch|networkerror/i.test(m)) return "Can't reach the NotebookTools server. Check your connection.";
    return m;
  }

  function toSession(data) {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      user: { id: data.user?.id, email: data.user?.email },
    };
  }

  async function saveSession(session) {
    await storageSet({ [SESSION_KEY]: session });
    notify();
    return session;
  }

  /** Current session, refreshed when it is about to expire. null when signed out. */
  async function getSession() {
    const session = await storageGet(SESSION_KEY);
    if (!session) return null;
    if (session.expiresAt - Date.now() > 60 * 1000) return session;
    try {
      const data = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: { refresh_token: session.refreshToken },
      });
      return await saveSession(toSession(data));
    } catch (error) {
      if (error.status === 400 || error.status === 401) {
        await storageRemove([SESSION_KEY, PROFILE_KEY]);
        notify();
        return null;
      }
      return session;
    }
  }

  async function signIn(email, password) {
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email: String(email).trim(), password },
    });
    await saveSession(toSession(data));
    await refreshProfile();
    return getState();
  }

  /** Returns { confirmEmail: true } when the user must confirm their address first. */
  async function signUp(email, password) {
    const data = await request("/auth/v1/signup", {
      method: "POST",
      body: { email: String(email).trim(), password },
    });
    if (data?.access_token) {
      await saveSession(toSession(data));
      await refreshProfile();
      return { confirmEmail: false };
    }
    return { confirmEmail: true };
  }

  async function sendPasswordReset(email) {
    await request("/auth/v1/recover", { method: "POST", body: { email: String(email).trim() } });
  }

  async function signOut() {
    const session = await storageGet(SESSION_KEY);
    if (session?.accessToken) {
      request("/auth/v1/logout", { method: "POST", token: session.accessToken }).catch(() => {});
    }
    await storageRemove([SESSION_KEY, PROFILE_KEY]);
    notify();
  }

  /** Reads the plan from Supabase and caches it. */
  async function refreshProfile() {
    const session = await getSession();
    if (!session) return null;
    const rows = await request(
      `/rest/v1/profiles?select=plan,email,pro_since&id=eq.${encodeURIComponent(session.user.id)}`,
      { token: session.accessToken },
    );
    const profile = rows?.[0] || { plan: "free", email: session.user.email, pro_since: null };
    const cached = { ...profile, checkedAt: Date.now() };
    await storageSet({ [PROFILE_KEY]: cached });
    notify();
    return cached;
  }

  async function getState() {
    const session = await getSession();
    const profile = session ? await storageGet(PROFILE_KEY) : null;
    return {
      signedIn: Boolean(session),
      email: session?.user?.email || null,
      userId: session?.user?.id || null,
      plan: profile?.plan === "pro" ? "pro" : "free",
      proSince: profile?.pro_since || null,
    };
  }

  async function isPro() {
    return (await getState()).plan === "pro";
  }

  /** Feature gate. Every feature is allowed until it is listed in PRO_FEATURES. */
  async function can(featureKey) {
    if (!PRO_FEATURES.has(featureKey)) return true;
    return isPro();
  }

  /** Dodo checkout link for the Pro product, tied to the signed-in account. */
  function checkoutAvailable() {
    return Boolean(CONFIG.proProductId);
  }

  async function checkoutUrl() {
    if (!checkoutAvailable()) return CONFIG.pricingUrl;
    const state = await getState();
    const params = new URLSearchParams({ quantity: "1", redirect_url: CONFIG.checkoutReturnUrl });
    if (state.email) params.set("email", state.email);
    if (state.userId) {
      params.set("metadata_user_id", state.userId);
      params.set("metadata_app", "notebooktools");
    }
    return `${CONFIG.checkoutBase}${CONFIG.proProductId}?${params.toString()}`;
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify() {
    getState().then((state) => listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (error) {
        console.error(error);
      }
    }));
  }

  // Keep every open extension page in sync when another page signs in or out.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes[SESSION_KEY] || changes[PROFILE_KEY])) notify();
  });

  return {
    CONFIG,
    PRO_FEATURES,
    getState,
    getSession,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    refreshProfile,
    isPro,
    can,
    checkoutUrl,
    checkoutAvailable,
    onChange,
  };
})();

window.NotebookToolsAccount = NotebookToolsAccount;
