/* ==========================================================================
   NotebookLM UI — single source of truth for every feature demo.

   When Google changes NotebookLM, update THIS file (labels, icons, tiles,
   menus) and nlm-ui.css (colours, spacing). Every demo is rebuilt from here
   by nlm-shell.js, so nothing else needs editing.

   Icons: "ms:<name>" = Google Material Symbols (the icon set NotebookLM
   uses, loaded from Google Fonts). If you add a new ms: icon, add its name to
   the icon_names list in scripts/sync-feature-pages.py too.
   "svg:<key>" = a NotebookLM-specific icon drawn below in NLM_CONFIG.svg.
   ========================================================================== */
window.NLM_CONFIG = {
  product: "Gemini Notebook",
  disclaimer: "Gemini Notebook can make mistakes, so double-check it.",
  composerPlaceholder: "Ask a question or create something",
  timestamp: "Today • 7:52 pm",

  topbar: {
    actions: [
      { label: "Create notebook", icon: "ms:add" },
      { label: "Share", icon: "ms:ios_share" },
    ],
    icons: [
      { icon: "ms:more_vert", label: "More", menu: "notebook" },
      { icon: "ms:settings", label: "Settings", menu: "settings" },
      { icon: "ms:apps", label: "Google apps" },
    ],
  },

  panels: {
    sources: { label: "Sources", toggle: "ms:dock_to_right", railIcon: "ms:dock_to_right" },
    studio: { label: "Studio", toggle: "ms:dock_to_left", railIcon: "ms:dock_to_left" },
    chat: { label: "Chat" },
  },

  sourceTools: {
    buttons: [
      { label: "Add sources", icon: "ms:add" },
      { label: "Create note", icon: "ms:add" },
    ],
    searchPlaceholder: "Search the web for new sources",
    chips: [
      { label: "Web", icon: "ms:language", menu: "source-scope" },
      { label: "Fast research", icon: "svg:fastResearch" },
    ],
    go: "ms:arrow_forward",
    filter: "ms:sort",
    selectAll: "Select all",
  },

  studio: {
    banner: "Create an Audio Overview in:",
    languages: ["हिन्दी", "বাংলা", "ગુજરાતી", "ಕನ್ನಡ", "മലയാളം", "मराठी", "ਪੰਜਾਬੀ", "தமிழ்", "తెలుగు"],
    tiles: [
      { key: "audio", label: "Audio Overview", icon: "svg:audio", color: "#3b6fe0" },
      { key: "slides", label: "Slide deck", icon: "svg:slides", color: "#c03d8f" },
      { key: "video", label: "Video Overview", icon: "ms:videocam", color: "#24a065" },
      { key: "mind", label: "Mind Map", icon: "ms:flowchart", color: "#6e63d9" },
      { key: "reports", label: "Reports", icon: "svg:reports", color: "#c03d8f", badge: "New!" },
      { key: "flash", label: "Flashcards", icon: "svg:flashcards", color: "#f08c00" },
      { key: "quiz", label: "Quiz", icon: "ms:quiz", color: "#1f8fb0" },
      { key: "info", label: "Infographic", icon: "ms:stacked_bar_chart", color: "#f08c00" },
      { key: "table", label: "Data table", icon: "ms:format_list_bulleted", color: "#3b6fe0" },
    ],
  },

  message: {
    save: { label: "Save to note", icon: "ms:keep" },
    icons: ["ms:content_copy", "ms:thumb_up", "ms:thumb_down"],
    suggestionIcon: "ms:subdirectory_arrow_right",
  },

  composer: { tune: "ms:tune", send: "ms:arrow_upward", menu: "connectors" },

  menus: {
    notebook: [
      { label: "Configure chat", icon: "ms:tune" },
      { label: "Customise notebook", icon: "ms:brush" },
      { label: "Copy notebook", icon: "ms:content_copy" },
      { label: "Analytics", icon: "ms:trending_up" },
      { label: "Delete chat history", icon: "ms:delete", hint: "Chat history is private to you." },
    ],
    settings: [
      { label: "Connected apps", icon: "ms:extension" },
      { label: "Gemini Notebook Help", icon: "ms:help" },
      { label: "Send feedback", icon: "ms:feedback" },
      { label: "Discord", icon: "ms:forum" },
      { label: "Output language", icon: "ms:language" },
      { label: "Notifications", icon: "ms:notifications" },
      { label: "Licences", icon: "ms:license" },
      { label: "Dark mode", icon: "ms:dark_mode", trailing: "ms:chevron_right" },
      { label: "Usage", icon: "ms:data_usage" },
      { divider: true },
      { label: "Upgrade Gemini Notebook", icon: "svg:logo" },
    ],
    "source-scope": [
      { label: "Web", icon: "ms:language", hint: "Best sources from the web" },
      { label: "Drive", icon: "svg:drive", hint: "Your content from Google Drive" },
    ],
    connectors: [
      { label: "Google Drive", icon: "svg:drive", toggle: true },
      { divider: true },
      { label: "Connect an app", icon: "ms:open_in_new" },
    ],
    artifact: [
      { label: "Share", icon: "ms:share" },
      { label: "Rename", icon: "ms:edit" },
      { label: "Download PDF document (.pdf)", icon: "ms:picture_as_pdf" },
      { label: "Download PowerPoint (.pptx)", icon: "svg:pptx" },
      { label: "Start slideshow", icon: "ms:play_arrow" },
      { label: "Revise", icon: "ms:auto_fix" },
      { label: "View prompt and sources", icon: "ms:info" },
      { label: "Open in new tab", icon: "ms:open_in_new" },
      { label: "Delete", icon: "ms:delete" },
    ],
  },

  /* NotebookLM-specific icons (24×24 viewBox, drawn with currentColor). */
  svg: {
    logo: '<svg viewBox="0 0 24 24"><g fill="none" stroke-width="2.1" stroke-linecap="round"><path stroke="#8ab4f8" d="M4.2 18.5V13a7.8 7.8 0 0 1 15.6 0v5.5"/><path stroke="#4c8df6" d="M7.6 18.5V13a4.4 4.4 0 0 1 8.8 0v5.5"/><path stroke="#1a5ff0" d="M11 18.5V13a1 1 0 0 1 2 0v5.5"/></g></svg>',
    audio: '<svg viewBox="0 0 24 24"><path d="M4 10h1.8v5H4zm3.6-3h1.8v11H7.6zm3.6 3h1.8v8h-1.8zm3.6-2h1.8v7h-1.8z"/><path d="M19.5 2.5l.75 1.75L22 5l-1.75.75-.75 1.75-.75-1.75L17 5l1.75-.75z"/></svg>',
    slides: '<svg viewBox="0 0 24 24"><path d="M3 5.5h18v13H3zM4.8 7.3v9.4h2.1V7.3zm4 0v9.4h6.4V7.3zm8.3 0v9.4h2.1V7.3z" fill-rule="evenodd"/></svg>',
    reports: '<svg viewBox="0 0 24 24"><path d="M7 4h7v1.8H8.8V15H18V9.5h1.8v7.3H7zM3.5 8h1.8v10.7H16v1.8H3.5z"/><path d="M18.5 1.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>',
    flashcards: '<svg viewBox="0 0 24 24"><path d="M11 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 1.8a.2.2 0 0 0-.2.2v11c0 .1.1.2.2.2h7a.2.2 0 0 0 .2-.2V5a.2.2 0 0 0-.2-.2z"/><path d="M5.6 7.2 7.4 6.6l.2 1.8-.5.2a.2.2 0 0 0-.1.25l3 9.9c.04.1.14.16.25.12l3.5-1.05h2.6l-5.6 1.7a2 2 0 0 1-2.5-1.33L5 9.7a2 2 0 0 1 .6-2.5z"/></svg>',
    fastResearch: '<svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 0 1 3 .8l-.9 1.6A4.2 4.2 0 1 0 14.2 10H16a6 6 0 0 1-1.3 3.7l5 5-1.3 1.3-5-5A6 6 0 1 1 10 4z"/><path d="M17.5 2l.85 2.15L20.5 5l-2.15.85L17.5 8l-.85-2.15L14.5 5l2.15-.85z"/></svg>',
    drive: '<svg viewBox="0 0 24 24"><path fill="#0066da" d="m3.4 18.3.9 1.6c.2.3.5.6.8.7l3.3-5.7H1.8c0 .4.1.7.3 1z"/><path fill="#00ac47" d="M12 8.9 8.7 3.2c-.3.2-.6.5-.8.8L1.9 14.4c-.2.3-.3.7-.3 1h6.6z"/><path fill="#ea4335" d="M19.2 20.6c.3-.2.6-.4.8-.7l.4-.7 1.8-3.1c.2-.3.3-.7.3-1h-6.6l1.4 2.8z"/><path fill="#00832d" d="M12 8.9l3.3-5.7c-.3-.2-.7-.3-1.1-.3H9.8c-.4 0-.8.1-1.1.3z"/><path fill="#2684fc" d="M15.9 15.1H8.1l-3.3 5.7c.3.2.7.3 1.1.3h12.2c.4 0 .8-.1 1.1-.3z"/><path fill="#ffba00" d="M19.2 9.3 16.2 4c-.2-.3-.5-.6-.8-.8l-3.3 5.7 3.9 6.2h6.6c0-.4-.1-.7-.3-1z"/></svg>',
    pptx: '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 1.8a.2.2 0 0 0-.2.2v14c0 .1.1.2.2.2h14a.2.2 0 0 0 .2-.2V5a.2.2 0 0 0-.2-.2zM9.5 7.5h3.3a3 3 0 0 1 0 6h-1.5v3H9.5zm1.8 1.7v2.6h1.5a1.3 1.3 0 0 0 0-2.6z"/></svg>',
  },

  /* Source-type icons used in the Sources list and the collapsed rail. */
  sourceIcons: {
    pdf: "nlm-src-pdf",
    doc: "nlm-src-doc",
    web: "nlm-src-web",
    yt: "nlm-src-yt",
    gdoc: "nlm-src-gdoc",
    gslides: "nlm-src-gslides",
    gsheet: "nlm-src-gsheet",
  },
};
