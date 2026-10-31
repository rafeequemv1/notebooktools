/* ==========================================================================
   Demo surfaces — Chrome window, NotebookTools side panel, notebook picker,
   Chrome context menu and the Notebooks hub header.

   Labels mirror the extension source (sidepanel.html, notebooks.html,
   youtube-import.html, notebook-picker.js). If the extension UI changes,
   update SURFACES below; every demo is rebuilt from it.

   Markup hooks (data-surface="…"):
     browser    .br-window with data-tabs='[{"title","url","icon","active"}]'.
                Children: one .br-page per tab (same order), optional
                <aside data-surface="sidepanel">.
     sidepanel  data-tab="Import|Bulk|Snapshots|Prompts", data-tagline.
                Children = that tab's content.
     picker     data-selected, data-variant="card" (side panel) or "plain".
     ctxmenu    data-kind="selection|page", data-selection="…".
     hub        data-tabs="Notebooks,Podcast", data-active. Children = page.
   ========================================================================== */
(function () {
  "use strict";

  var SURFACES = {
    extName: "NotebookTools",
    icon: "/assets/logo-mark-32.png",
    wordmark: "/assets/logo-wordmark-sm.png",
    sidepanel: {
      tabs: ["Import", "Bulk", "Snapshots", "Prompts"],
      openNotebooks: "Open notebooks",
      autoOpen: "Auto-open",
    },
    picker: {
      search: "Search notebooks",
      create: "Or create new notebook",
      title: "Notebook",
    },
    ctxmenu: {
      selection: ["Copy", "Search Google for “%s”", "Print…", "-", "@Add to NotebookLM", "-", "Inspect"],
      page: ["Back", "Reload", "Save as…", "Print…", "-", "@Extract links to Notebook", "@Capture snapshot area", "-", "View page source", "Inspect"],
    },
    hub: {
      icons: [
        { icon: "ms:settings", label: "Settings" },
        { icon: "ms:light_mode", label: "Dark mode" },
      ],
      views: [
        { icon: "ms:folder", label: "Folder view" },
        { icon: "ms:grid_view", label: "Grid view", active: true },
        { icon: "ms:view_list", label: "List view" },
      ],
    },
    tabIcons: {
      yt: '<svg viewBox="0 0 24 24"><rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff0033"/><path d="M10 9v6l5.2-3z" fill="#fff"/></svg>',
      x: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#0f1419"/><path d="M13.3 10.8 18.5 5h-1.2l-4.5 5-3.6-5H5l5.4 7.6L5 19h1.2l4.8-5.3 3.8 5.3H19z" fill="#fff"/></svg>',
      web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#5f6368"/><path d="M2.5 12h19M12 2.2c2.7 2.7 3.8 6 3.8 9.8s-1.1 7.1-3.8 9.8c-2.7-2.7-3.8-6-3.8-9.8s1.1-7.1 3.8-9.8z" fill="none" stroke="#fff" stroke-width="1.4"/></svg>',
      nlm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#fff"/><g fill="none" stroke-width="2.1" stroke-linecap="round"><path stroke="#8ab4f8" d="M4.2 18.5V13a7.8 7.8 0 0 1 15.6 0v5.5"/><path stroke="#4c8df6" d="M7.6 18.5V13a4.4 4.4 0 0 1 8.8 0v5.5"/><path stroke="#1a5ff0" d="M11 18.5V13a1 1 0 0 1 2 0v5.5"/></g></svg>',
      ext: "img",
    },
  };
  window.NT_SURFACES = SURFACES;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function ms(name, cls) {
    return '<span class="nlm-ms sf-ms' + (cls ? " " + cls : "") + '" aria-hidden="true">' + name.replace(/^ms:/, "") + "</span>";
  }

  function extIcon(size) {
    return '<img class="sf-ext-icon" src="' + SURFACES.icon + '" alt="" width="' + size + '" height="' + size + '">';
  }

  function tabIcon(kind) {
    if (kind === "ext") return extIcon(16);
    return '<span class="br-tab-ico">' + (SURFACES.tabIcons[kind] || SURFACES.tabIcons.web) + "</span>";
  }

  var build = {
    browser: function (el) {
      var tabs = [];
      try {
        tabs = JSON.parse(el.getAttribute("data-tabs") || "[]");
      } catch (e) {
        tabs = [];
      }
      if (!tabs.length) tabs = [{ title: "New Tab", url: "", icon: "web", active: true }];
      var active = Math.max(0, tabs.findIndex(function (t) { return t.active; }));
      var pages = Array.prototype.filter.call(el.children, function (n) { return n.classList.contains("br-page"); });
      var side = el.querySelector(':scope > [data-surface="sidepanel"], :scope > .br-sidepanel');

      var chrome = document.createElement("div");
      chrome.className = "br-chrome";
      chrome.innerHTML =
        '<div class="br-tabstrip">' +
        '<span class="br-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        tabs.map(function (t, i) {
          return '<span class="br-tab' + (i === active ? " is-active" : "") + '" data-br-tab="' + i + '">' + tabIcon(t.icon) +
            '<span class="br-tab-title">' + esc(t.title) + '</span>' + ms("close", "br-tab-x") + "</span>";
        }).join("") +
        ms("add", "br-newtab") +
        "</div>" +
        '<div class="br-toolbar">' +
        ms("arrow_back") + ms("arrow_forward") + ms("refresh") +
        '<div class="br-omnibox">' + ms("tune", "br-site") + '<span class="br-url">' + esc(tabs[active].url || "") + "</span>" + ms("star", "br-star") + "</div>" +
        '<span class="br-ext-btn" title="' + esc(SURFACES.extName) + '">' + extIcon(18) + "</span>" +
        ms("extension") + ms("side_navigation", "br-sp-btn") +
        '<span class="br-profile" aria-hidden="true"></span>' + ms("more_vert") +
        "</div>";

      var body = document.createElement("div");
      body.className = "br-body";
      var stage = document.createElement("div");
      stage.className = "br-stage";
      pages.forEach(function (p, i) {
        p.classList.toggle("is-active", i === active);
        stage.appendChild(p);
      });
      body.appendChild(stage);
      if (side) body.appendChild(side);
      el.innerHTML = "";
      el.appendChild(chrome);
      el.appendChild(body);
      el.setAttribute("data-br-tabs", JSON.stringify(tabs));
    },

    sidepanel: function (el) {
      var s = SURFACES.sidepanel;
      var tab = el.getAttribute("data-tab") || "Import";
      var tagline = el.getAttribute("data-tagline") || "Import to NotebookLM";
      el.classList.add("br-sidepanel", "sp");
      var content = document.createElement("div");
      content.className = "sp-content";
      while (el.firstChild) content.appendChild(el.firstChild);
      el.innerHTML =
        '<div class="sp-chrome">' + extIcon(16) + '<span>' + esc(SURFACES.extName) + "</span>" + ms("keep", "sp-chrome-pin") + ms("close") + "</div>" +
        '<div class="sp-scroll">' +
        '<div class="sp-header"><img class="sp-wordmark" src="' + SURFACES.wordmark + '" alt="' + esc(SURFACES.extName) + '">' +
        '<span class="sp-header-actions"><span class="sp-icon-btn">' + ms("settings") + '</span><span class="sp-icon-btn">' + ms("light_mode") + "</span>" +
        '<span class="sp-switch-wrap"><i class="sp-switch"></i>' + esc(s.autoOpen.toUpperCase()) + "</span></span></div>" +
        '<p class="sp-tagline">' + esc(tagline) + "</p>" +
        '<span class="sp-btn sp-open-notebooks">' + esc(s.openNotebooks) + "</span>" +
        '<div class="sp-tabs">' + s.tabs.map(function (t) {
          return '<span class="sp-tab' + (t === tab ? " is-active" : "") + '">' + esc(t) + "</span>";
        }).join("") + "</div>" +
        "</div>";
      el.querySelector(".sp-scroll").appendChild(content);
    },

    picker: function (el) {
      var p = SURFACES.picker;
      var sel = el.getAttribute("data-selected") || "Research — AI tools (12)";
      var card = el.getAttribute("data-variant") !== "plain";
      el.classList.add("sf-picker");
      if (card) el.classList.add("sp-card");
      el.innerHTML =
        (card ? '<h4 class="sp-card-title">' + esc(p.title) + "</h4>" : "") +
        '<span class="sf-input sf-ph">' + esc(p.search) + (card ? "" : "...") + "</span>" +
        '<span class="sf-select"><span class="sf-select-value">' + esc(sel) + "</span>" + ms("expand_more") + "</span>" +
        '<span class="sf-input sf-ph sf-create">' + esc(p.create) + "</span>";
    },

    ctxmenu: function (el) {
      var kind = el.getAttribute("data-kind") || "page";
      var selText = el.getAttribute("data-selection") || "";
      el.classList.add("ctx-menu");
      el.innerHTML = SURFACES.ctxmenu[kind].map(function (it) {
        if (it === "-") return '<div class="ctx-sep"></div>';
        var isExt = it.charAt(0) === "@";
        var label = (isExt ? it.slice(1) : it).replace("%s", selText.length > 22 ? selText.slice(0, 22) + "…" : selText);
        return '<div class="ctx-item' + (isExt ? " is-ext" : "") + '"' + (isExt ? ' data-ctx="' + esc(label) + '"' : "") + ">" +
          (isExt ? extIcon(16) : '<span class="ctx-spacer"></span>') + "<span>" + esc(label) + "</span></div>";
      }).join("");
    },

    hub: function (el) {
      var h = SURFACES.hub;
      var tabs = (el.getAttribute("data-tabs") || "Notebooks,Podcast").split(",");
      var active = el.getAttribute("data-active") || tabs[0];
      el.classList.add("ntb");
      var content = document.createElement("div");
      content.className = "ntb-content";
      while (el.firstChild) content.appendChild(el.firstChild);
      el.innerHTML =
        '<div class="ntb-inner">' +
        '<div class="ntb-header"><img class="ntb-wordmark" src="' + SURFACES.wordmark + '" alt="' + esc(SURFACES.extName) + '">' +
        '<span class="ntb-actions">' +
        h.icons.map(function (i) { return '<span class="ntb-icon-btn" title="' + esc(i.label) + '">' + ms(i.icon) + "</span>"; }).join("") +
        '<span class="ntb-views">' + h.views.map(function (v) {
          return '<span class="ntb-view' + (v.active ? " is-active" : "") + '" title="' + esc(v.label) + '">' + ms(v.icon) + "</span>";
        }).join("") + "</span>" +
        '<span class="ntb-icon-btn" title="Refresh notebooks">' + ms("refresh") + "</span>" +
        '<span class="ntb-avatar">A</span></span></div>' +
        '<div class="ntb-tabs">' + tabs.map(function (t) {
          return '<span class="ntb-tab' + (t === active ? " is-active" : "") + '" data-hub-tab="' + esc(t) + '">' + esc(t) + "</span>";
        }).join("") + "</div>" +
        "</div>";
      el.querySelector(".ntb-inner").appendChild(content);
    },
  };

  /* Switch a browser window to another tab (used by scenes). */
  window.NT_SURFACES.showTab = function (win, index) {
    var tabs = [];
    try {
      tabs = JSON.parse(win.getAttribute("data-br-tabs") || "[]");
    } catch (e) {
      tabs = [];
    }
    win.querySelectorAll(".br-tab").forEach(function (t, i) { t.classList.toggle("is-active", i === index); });
    win.querySelectorAll(".br-stage > .br-page").forEach(function (p, i) { p.classList.toggle("is-active", i === index); });
    var url = win.querySelector(".br-url");
    if (url && tabs[index]) url.textContent = tabs[index].url || "";
  };

  /* Activate a hub tab (labels can be changed, e.g. to the detail view tabs). */
  window.NT_SURFACES.setHubTabs = function (hub, tabs, active) {
    var bar = hub.querySelector(".ntb-tabs");
    if (!bar) return;
    bar.innerHTML = tabs.map(function (t) {
      return '<span class="ntb-tab' + (t === active ? " is-active" : "") + '" data-hub-tab="' + esc(t) + '">' + esc(t) + "</span>";
    }).join("");
  };

  // Inner surfaces first (side panels and pickers live inside browsers).
  ["picker", "ctxmenu", "sidepanel", "hub", "browser"].forEach(function (name) {
    document.querySelectorAll('[data-surface="' + name + '"]').forEach(function (el) {
      build[name](el);
      el.removeAttribute("data-surface");
    });
  });
})();
