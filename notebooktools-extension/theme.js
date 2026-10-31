const THEME_KEY = "notebooktoolsTheme";

const NotebookToolsTheme = {
  async get() {
    const stored = await chrome.storage.local.get(THEME_KEY);
    return stored[THEME_KEY] === "dark" ? "dark" : "light";
  },

  async set(theme) {
    const value = theme === "dark" ? "dark" : "light";
    await chrome.storage.local.set({ [THEME_KEY]: value });
    this.apply(value);
  },

  apply(theme) {
    const value = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = value;
    this.updateToggles(value);
  },

  updateToggles(theme) {
    const isDark = theme === "dark";
    const label = isDark ? "Light mode" : "Dark mode";
    const button = document.querySelector("#themeToggle");

    if (!button) {
      return;
    }

    button.classList.toggle("is-dark", isDark);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  },

  async toggle() {
    const next = (await this.get()) === "dark" ? "light" : "dark";
    await this.set(next);
    return next;
  },

  bindToggles() {
    const button = document.querySelector("#themeToggle");

    if (!button || button.dataset.themeBound) {
      return;
    }

    button.dataset.themeBound = "1";
    button.addEventListener("click", () => {
      this.toggle();
    });
  },

  async init() {
    const theme = await this.get();
    this.apply(theme);
    this.bindToggles();
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsTheme = NotebookToolsTheme;

  if (chrome?.storage?.local) {
    chrome.storage.local.get(THEME_KEY, (stored) => {
      if (stored[THEME_KEY] === "dark") {
        document.documentElement.dataset.theme = "dark";
      }
    });
  }
}
