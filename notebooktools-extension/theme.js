const THEME_KEY = "notebooktoolsTheme";
// light = white, dark = premium black, midnight = deep blue (dark family).
const THEMES = ["light", "dark", "midnight"];
const THEME_LABELS = { light: "White", dark: "Dark", midnight: "Midnight blue" };

const NotebookToolsTheme = {
  // Until a theme is chosen in Settings, follow the system's light/dark setting
  // (as NotebookLM does)
  systemTheme() {
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  },

  async get() {
    const stored = await chrome.storage.local.get(THEME_KEY);
    return THEMES.includes(stored[THEME_KEY]) ? stored[THEME_KEY] : this.systemTheme();
  },

  async set(theme) {
    const value = THEMES.includes(theme) ? theme : "light";
    await chrome.storage.local.set({ [THEME_KEY]: value });
    this.apply(value);
  },

  apply(theme) {
    const value = THEMES.includes(theme) ? theme : "light";
    document.documentElement.dataset.theme = value === "light" ? "light" : "dark";
    document.documentElement.dataset.tone = value;
    this.updateToggles(value);
  },

  updateToggles(theme) {
    const isDark = theme !== "light";
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    const label = `Theme: ${THEME_LABELS[theme] || "White"} (switch to ${THEME_LABELS[next]})`;
    const button = document.querySelector("#themeToggle");

    if (!button) {
      return;
    }

    button.classList.toggle("is-dark", isDark);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  },

  async toggle() {
    const current = await this.get();
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
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
      const chosen = THEMES.includes(stored[THEME_KEY]) ? stored[THEME_KEY] : null;
      const value = chosen || NotebookToolsTheme.systemTheme();
      if (value !== "light") {
        document.documentElement.dataset.theme = "dark";
        document.documentElement.dataset.tone = value;
      }
      if (!chosen && typeof matchMedia === "function") {
        matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => NotebookToolsTheme.apply(NotebookToolsTheme.systemTheme()));
      }
    });
  }
}
