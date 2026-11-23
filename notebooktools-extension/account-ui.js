/* Account card in the app (toolbar dropdown): sign in / create account, plan badge,
   Upgrade to Pro (Dodo checkout) and automatic plan refresh after paying. */
const NotebookToolsAccountUI = (() => {
  const Account = window.NotebookToolsAccount;
  const POLL_MS = 6000;
  const POLL_LIMIT_MS = 5 * 60 * 1000;

  let root = null;
  let chip = null;
  let cardOpen = false;
  let mode = "closed"; // closed | signin | signup | reset
  let message = null; // { text, kind: "error" | "success" | "info" }
  let busy = false;
  let pollTimer = null;
  let pollStarted = 0;
  let draft = { email: "", password: "" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function messageHtml() {
    if (!message) return "";
    return `<p class="acct-msg is-${message.kind}" role="status">${escapeHtml(message.text)}</p>`;
  }

  function formHtml() {
    const titles = { signin: "Sign in", signup: "Create account", reset: "Reset password" };
    const submit = { signin: "Sign in", signup: "Create account", reset: "Send reset link" };
    return `
      <form class="acct-form" data-acct-form novalidate>
        <div class="acct-form-head"><strong>${titles[mode]}</strong><button type="button" class="acct-link" data-acct="close">Cancel</button></div>
        ${mode === "reset" ? "" : `<button type="button" class="acct-google" data-acct="google" ${busy ? "disabled" : ""}><svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>Continue with Google</button><div class="acct-or"><span>or use email</span></div>`}
        <input type="email" name="email" placeholder="Email" autocomplete="email" value="${escapeHtml(draft.email)}" required>
        ${mode === "reset" ? "" : `<input type="password" name="password" placeholder="${mode === "signup" ? "Password (6+ characters)" : "Password"}" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" minlength="6" value="${escapeHtml(draft.password)}" required>`}
        <button type="submit" class="button acct-submit" ${busy ? "disabled" : ""}>${busy ? "Please wait..." : submit[mode]}</button>
        <div class="acct-form-links">
          ${mode === "signin" ? `<button type="button" class="acct-link" data-acct="signup">Create an account</button><button type="button" class="acct-link" data-acct="reset">Forgot password?</button>` : ""}
          ${mode === "signup" ? `<button type="button" class="acct-link" data-acct="signin">I already have an account</button>` : ""}
          ${mode === "reset" ? `<button type="button" class="acct-link" data-acct="signin">Back to sign in</button>` : ""}
        </div>
        ${messageHtml()}
      </form>`;
  }

  function setCardOpen(next) {
    cardOpen = next;
    if (root) root.hidden = !cardOpen;
    chip?.setAttribute("aria-expanded", String(cardOpen));
  }

  async function render() {
    if (!root) return;
    const state = await Account.getState();
    if (chip) {
      chip.dataset.plan = state.signedIn ? state.plan : "guest";
      chip.textContent = state.signedIn ? (state.plan === "pro" ? "Pro" : "Free") : "Sign in";
      chip.title = state.signedIn ? `${state.email} · ${state.plan === "pro" ? "Pro" : "Free"} plan` : "Sign in to NotebookTools";
    }
    if (state.signedIn && mode !== "closed") {
      mode = "closed";
      message = null;
      draft = { email: "", password: "" };
    }
    const badge = `<span class="acct-badge is-${state.plan}">${state.plan === "pro" ? "Pro" : "Free"}</span>`;

    if (!state.signedIn) {
      root.innerHTML = `
        <div class="acct-row">
          ${badge}
          <span class="acct-text">Sign in to keep your plan on every device.</span>
          ${mode === "closed" ? `<button type="button" class="acct-link acct-strong" data-acct="signin">Sign in</button>` : ""}
        </div>
        ${mode === "closed" ? messageHtml() : formHtml()}`;
      return;
    }

    const isPro = state.plan === "pro";
    root.innerHTML = `
      <div class="acct-row">
        ${badge}
        <span class="acct-text" title="${escapeHtml(state.email)}">${escapeHtml(state.email)}</span>
        <button type="button" class="acct-link" data-acct="signout">Sign out</button>
      </div>
      ${isPro
        ? `<p class="acct-note">NotebookTools Pro · lifetime. Thank you!</p>`
        : `<div class="acct-actions">
             <button type="button" class="button acct-upgrade" data-acct="upgrade">Upgrade to Pro — ${escapeHtml(Account.CONFIG.priceLabel)}</button>
             <button type="button" class="acct-link" data-acct="refresh" title="Check your plan again">Refresh</button>
           </div>`}
      ${messageHtml()}`;
  }

  function setMessage(text, kind = "info") {
    message = text ? { text, kind } : null;
    render();
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function startPolling() {
    stopPolling();
    pollStarted = Date.now();
    pollTimer = setInterval(async () => {
      try {
        const profile = await Account.refreshProfile();
        if (profile?.plan === "pro") {
          stopPolling();
          setMessage("Payment received. You're on Pro now.", "success");
        } else if (Date.now() - pollStarted > POLL_LIMIT_MS) {
          stopPolling();
          setMessage("Still waiting for the payment. Click Refresh once checkout is complete.", "info");
        }
      } catch (error) {
        stopPolling();
      }
    }, POLL_MS);
  }

  async function handleSubmit(form) {
    const email = form.email.value.trim();
    const password = form.password ? form.password.value : "";
    draft = { email, password };
    if (!email) return setMessage("Enter your email.", "error");
    if (mode !== "reset" && password.length < 6) return setMessage("Use a password with at least 6 characters.", "error");

    busy = true;
    message = null;
    render();
    try {
      if (mode === "signin") {
        await Account.signIn(email, password);
        mode = "closed";
        message = null;
      } else if (mode === "signup") {
        const result = await Account.signUp(email, password);
        if (result.confirmEmail) {
          mode = "signin";
          message = { text: "Check your inbox and open the confirmation link, then sign in here.", kind: "success" };
        } else {
          mode = "closed";
          message = null;
        }
      } else if (mode === "reset") {
        await Account.sendPasswordReset(email);
        mode = "signin";
        message = { text: "If that email has an account, a reset link is on its way.", kind: "success" };
      }
    } catch (error) {
      message = { text: error.message || "Something went wrong.", kind: "error" };
    } finally {
      busy = false;
      render();
    }
  }

  async function handleAction(action) {
    if (action === "google") {
      busy = true;
      message = null;
      render();
      try {
        await Account.signInWithGoogle();
        mode = "closed";
      } catch (error) {
        message = { text: error.message || "Google sign-in didn't finish.", kind: "error" };
      } finally {
        busy = false;
        render();
      }
      return;
    }
    if (action === "signin" || action === "signup" || action === "reset") {
      mode = action;
      message = null;
      return render();
    }
    if (action === "close") {
      mode = "closed";
      draft = { email: "", password: "" };
      message = null;
      return render();
    }
    if (action === "signout") {
      stopPolling();
      await Account.signOut();
      message = null;
      return render();
    }
    if (action === "refresh") {
      try {
        const profile = await Account.refreshProfile();
        setMessage(profile?.plan === "pro" ? "You're on Pro." : "You're on the Free plan.", "info");
      } catch (error) {
        setMessage(error.message, "error");
      }
      return;
    }
    if (action === "upgrade") {
      const url = await Account.checkoutUrl();
      chrome.tabs.create({ url });
      if (!Account.checkoutAvailable()) {
        setMessage("Pro checkout is opening soon. Everything works on the Free plan in the meantime.", "info");
        return;
      }
      setMessage("Complete checkout in the new tab. Your plan switches to Pro automatically.", "info");
      startPolling();
    }
  }

  function init() {
    const header = document.querySelector(".sidepanel-header");
    if (!header || !Account) return;
    root = document.createElement("section");
    root.className = "acct";
    root.id = "accountCard";
    root.setAttribute("aria-label", "Account");
    header.insertAdjacentElement("afterend", root);

    // Compact mode: a plan chip in the header opens the card as a dropdown
    const slot = document.querySelector("#accountChipSlot");
    if (slot) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sp-account-chip";
      chip.setAttribute("aria-haspopup", "dialog");
      chip.setAttribute("aria-controls", "accountCard");
      slot.appendChild(chip);
      root.classList.add("is-dropdown");
      setCardOpen(false);
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        setCardOpen(!cardOpen);
        if (cardOpen && mode === "closed") {
          Account.getState().then((state) => {
            if (!state.signedIn) {
              mode = "signin";
              render();
            }
          });
        }
      });
      document.addEventListener("mousedown", (event) => {
        if (cardOpen && !root.contains(event.target) && event.target !== chip) setCardOpen(false);
      });
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-acct]");
      if (button) handleAction(button.getAttribute("data-acct"));
    });
    root.addEventListener("submit", (event) => {
      event.preventDefault();
      handleSubmit(event.target);
    });

    Account.onChange(() => {
      if (!busy) render();
    });
    render();
    Account.getState().then((state) => {
      if (state.signedIn) Account.refreshProfile().catch(() => {});
    });
  }

  /** Opens the account card (sign-in form when signed out). */
  function open() {
    setCardOpen(true);
    Account.getState().then((state) => {
      if (!state.signedIn && mode === "closed") {
        mode = "signin";
      }
      render();
    });
  }

  return { init, render, open };
})();

window.NotebookToolsAccountUI = NotebookToolsAccountUI;
