/* ==========================================================================
   NotebookLM UI shell — builds the shared NotebookLM chrome into every demo
   from window.NLM_CONFIG (nlm-config.js). Runs before demo.js.

   Demos mark where shared parts go with data-nlm="…":
     topbar        <header class="nlm-topbar" data-nlm="topbar">  (keeps the
                   .nlm-notebook-title and any extension buttons inside it)
     panel-head    data-panel="sources|studio" (keeps extra buttons inside)
     source-tools  Add sources / Create note, web search, Select all
     studio        Studio banner + tile grid. data-actionable="audio" turns the
                   Audio Overview tile into the demo's Generate button
                   (data-action-id / data-action are copied onto it)
     artifact      data-type, data-title, data-meta: a generated Studio item
     nb-head       data-title, data-meta: the notebook header card
     msg-actions   Save to note + copy / thumbs
     suggest       wraps .nlm-suggest-card items and adds their arrow icon
     timestamp     "Today • …" divider
     composer      data-sources="3". If it already has an input inside, the
                   input is kept and only the chrome is added.
   The .nlm-app element can set data-mobile-tab="sources|chat|studio".
   ========================================================================== */
(function () {
  "use strict";
  var C = window.NLM_CONFIG;
  if (!C) return;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function icon(spec, cls) {
    var c = "nlm-i" + (cls ? " " + cls : "");
    if (!spec) return "";
    if (spec.indexOf("ms:") === 0) {
      return '<span class="' + c + ' nlm-ms" aria-hidden="true">' + spec.slice(3) + "</span>";
    }
    return '<span class="' + c + '" aria-hidden="true">' + (C.svg[spec.slice(4)] || "") + "</span>";
  }

  var menuSeq = 0;

  function menu(name, align) {
    var items = C.menus[name] || [];
    var id = "nlm-menu-" + ++menuSeq;
    var html = items
      .map(function (it) {
        if (it.divider) return '<div class="nlm-menu-divider" role="separator"></div>';
        var hint = it.hint ? '<span class="nlm-menu-hint">' + esc(it.hint) + "</span>" : "";
        var trail = it.toggle
          ? '<span class="nlm-switch is-on" aria-hidden="true"></span>'
          : it.trailing
            ? icon(it.trailing, "nlm-menu-trail")
            : "";
        return (
          '<div class="nlm-menu-item' + (it.hint ? " has-hint" : "") + '" role="menuitem">' +
          icon(it.icon) +
          '<span class="nlm-menu-text"><span>' + esc(it.label) + "</span>" + hint + "</span>" +
          trail +
          "</div>"
        );
      })
      .join("");
    return {
      id: id,
      html:
        '<div class="nlm-menu nlm-menu-' + name + (align ? " is-" + align : "") + '" id="' + id + '" role="menu" hidden>' +
        html +
        "</div>",
    };
  }

  function trigger(inner, cls, menuName, label, align) {
    if (!menuName) {
      return '<button type="button" class="' + cls + '" tabindex="-1"' + (label ? ' aria-label="' + esc(label) + '"' : "") + ">" + inner + "</button>";
    }
    var m = menu(menuName, align);
    return (
      '<span class="nlm-menu-wrap">' +
      '<button type="button" class="' + cls + ' nlm-menu-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="' + m.id + '"' +
      (label ? ' aria-label="' + esc(label) + '"' : "") + ">" + inner + "</button>" +
      m.html +
      "</span>"
    );
  }

  /* ---------------------------------------------------------------- parts */

  var build = {
    topbar: function (el) {
      var title = el.querySelector(".nlm-notebook-title");
      var extras = Array.prototype.filter.call(el.children, function (n) {
        return n !== title && !n.classList.contains("nlm-top-left") && !n.classList.contains("nlm-top-right");
      });
      if (!title) {
        title = document.createElement("span");
        title.className = "nlm-notebook-title";
        title.textContent = el.getAttribute("data-title") || "Untitled notebook";
      }
      var left = document.createElement("div");
      left.className = "nlm-top-left";
      left.innerHTML = '<span class="nlm-logo">' + C.svg.logo + "</span>";
      left.appendChild(title);

      var right = document.createElement("div");
      right.className = "nlm-top-right";
      extras.forEach(function (n) { right.appendChild(n); });
      right.insertAdjacentHTML(
        "beforeend",
        C.topbar.actions.map(function (a) {
          return trigger(icon(a.icon) + "<span>" + esc(a.label) + "</span>", "nlm-top-btn", a.menu, null, "end");
        }).join("") +
          C.topbar.icons.map(function (a) {
            return trigger(icon(a.icon), "nlm-top-icon", a.menu, a.label, "end");
          }).join("") +
          '<span class="nlm-avatar" aria-hidden="true"></span>'
      );
      el.innerHTML = "";
      el.appendChild(left);
      el.appendChild(right);
    },

    "panel-head": function (el) {
      var key = el.getAttribute("data-panel") || "sources";
      var p = C.panels[key] || { label: key };
      var extras = Array.prototype.slice.call(el.children);
      el.innerHTML = "<h4>" + esc(p.label) + "</h4>";
      if (extras.length) {
        extras.forEach(function (n) { el.appendChild(n); });
      } else {
        el.insertAdjacentHTML(
          "beforeend",
          '<button type="button" class="nlm-panel-toggle" tabindex="-1" aria-label="Collapse ' + esc(p.label) + '" data-nlm-collapse>' + icon(p.toggle) + "</button>"
        );
      }
    },

    "source-tools": function (el) {
      var t = C.sourceTools;
      el.classList.add("nlm-src-tools");
      el.innerHTML =
        '<div class="nlm-src-buttons">' +
        t.buttons.map(function (b) {
          return '<span class="nlm-soft-btn">' + icon(b.icon) + esc(b.label) + "</span>";
        }).join("") +
        "</div>" +
        '<div class="nlm-src-search"><span class="nlm-src-search-ph">' + esc(t.searchPlaceholder) + "</span>" +
        '<div class="nlm-src-search-row">' +
        t.chips.map(function (c) {
          return trigger(icon(c.icon) + "<span>" + esc(c.label) + "</span>" + icon("ms:expand_more", "nlm-chev"), "nlm-chip-btn", c.menu, null, "start");
        }).join("") +
        icon(t.go, "nlm-src-go") +
        "</div></div>" +
        '<div class="nlm-select-all">' + icon(t.filter) + "<span>" + esc(t.selectAll) + '</span><i class="nlm-check" aria-hidden="true"></i></div>';
    },

    studio: function (el) {
      var s = C.studio;
      var actionable = el.getAttribute("data-actionable");
      var tiles = s.tiles.map(function (t) {
        var style = ' style="--tile-color:' + t.color + '"';
        var badge = t.badge ? '<em class="nlm-new">' + esc(t.badge) + "</em>" : "";
        var inner = '<span class="nlm-tile-ico">' + icon(t.icon) + "</span><span class=\"nlm-tile-label\">" + esc(t.label) + "</span>" + badge;
        if (actionable === t.key) {
          var id = el.getAttribute("data-action-id");
          var act = el.getAttribute("data-action");
          return (
            '<button type="button" class="nlm-tile t-' + t.key + ' actionable"' + style +
            (id ? ' id="' + esc(id) + '"' : "") + (act ? ' data-action="' + esc(act) + '"' : "") + ">" +
            inner + '<em class="studio-cta">Generate</em></button>'
          );
        }
        return '<div class="nlm-tile t-' + t.key + '"' + style + ">" + inner + "</div>";
      });
      el.innerHTML =
        '<div class="nlm-studio-banner">' + esc(s.banner) + " <span>" + s.languages.map(esc).join(", ") + "</span></div>" +
        '<div class="nlm-studio-grid">' + tiles.join("") + "</div>";
    },

    artifact: function (el) {
      var type = el.getAttribute("data-type") || "slides";
      var tile = C.studio.tiles.filter(function (t) { return t.key === type; })[0] || C.studio.tiles[0];
      el.classList.add("nlm-artifact");
      el.style.setProperty("--tile-color", tile.color);
      el.innerHTML =
        '<span class="nlm-artifact-ico">' + icon(tile.icon) + "</span>" +
        '<span class="nlm-artifact-text"><strong>' + esc(el.getAttribute("data-title") || tile.label) + "</strong><span>" +
        esc(el.getAttribute("data-meta") || "") + "</span></span>" +
        trigger(icon("ms:more_vert"), "nlm-artifact-more", "artifact", "More options", "end");
    },

    "nb-head": function (el) {
      el.classList.add("nlm-nb-head");
      el.innerHTML =
        '<span class="nlm-nb-emoji" aria-hidden="true">' + esc(el.getAttribute("data-emoji") || "📒") + "</span>" +
        "<h5>" + esc(el.getAttribute("data-title") || "") + "</h5>" +
        "<p>" + esc(el.getAttribute("data-meta") || "") + "</p>";
    },

    "msg-actions": function (el) {
      var m = C.message;
      el.classList.add("nlm-msg-actions");
      el.innerHTML =
        '<span class="nlm-save">' + icon(m.save.icon) + esc(m.save.label) + "</span>" +
        m.icons.map(function (i) { return icon(i); }).join("");
    },

    suggest: function (el) {
      el.classList.add("nlm-suggest");
      el.querySelectorAll(".nlm-suggest-card").forEach(function (card) {
        card.insertAdjacentHTML("beforeend", icon(C.message.suggestionIcon));
      });
    },

    timestamp: function (el) {
      el.classList.add("nlm-timestamp");
      el.textContent = el.getAttribute("data-text") || C.timestamp;
    },

    composer: function (el) {
      var keep = Array.prototype.slice.call(el.childNodes).filter(function (n) {
        return n.nodeType === 1;
      });
      el.classList.add("nlm-composer");
      var count = el.getAttribute("data-sources");
      el.innerHTML = trigger(icon(C.composer.tune), "nlm-composer-tune", C.composer.menu, "Chat options", "up");
      if (keep.length) {
        keep.forEach(function (n) { el.appendChild(n); });
      } else {
        el.insertAdjacentHTML("beforeend", '<span class="nlm-composer-ph">' + esc(C.composerPlaceholder) + "</span>");
      }
      if (count) {
        var countHtml = '<span class="nlm-composer-count">' + esc(count) + " sources</span>";
        var sendBtn = el.querySelector("button.nlm-send");
        if (sendBtn) sendBtn.insertAdjacentHTML("beforebegin", countHtml);
        else el.insertAdjacentHTML("beforeend", countHtml);
      }
      keep.forEach(function (n) {
        if (n.tagName === "BUTTON" && n.classList.contains("nlm-send")) n.innerHTML = icon(C.composer.send);
      });
      if (!keep.some(function (n) { return n.tagName === "BUTTON"; })) {
        el.insertAdjacentHTML("beforeend", '<span class="nlm-send">' + icon(C.composer.send) + "</span>");
      }
      if (el.getAttribute("data-disclaimer") !== "off") {
        el.insertAdjacentHTML("afterend", '<p class="nlm-disclaimer">' + esc(C.disclaimer) + "</p>");
      }
    },
  };

  /* ------------------------------------------------------ collapsed rails */

  function buildRail(panel) {
    var rail = panel.querySelector(":scope > .nlm-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.className = "nlm-rail";
      panel.appendChild(rail);
    }
    var isStudio = panel.classList.contains("nlm-studio");
    var p = C.panels[isStudio ? "studio" : "sources"];
    var html = '<button type="button" class="nlm-rail-btn" tabindex="-1" data-nlm-collapse aria-label="Expand ' + esc(p.label) + '">' + icon(p.railIcon) + "</button>";
    if (isStudio) {
      panel.querySelectorAll(".nlm-tile, .nlm-artifact").forEach(function (t) {
        var ico = t.querySelector(".nlm-tile-ico, .nlm-artifact-ico");
        if (ico) html += '<span class="nlm-rail-btn" style="--tile-color:' + (t.style.getPropertyValue("--tile-color") || "") + '">' + ico.innerHTML + "</span>";
      });
    } else {
      html += '<span class="nlm-rail-btn">' + icon("ms:add") + "</span>";
      panel.querySelectorAll(".nlm-source .nlm-src-icon").forEach(function (s) {
        html += '<span class="nlm-rail-btn"><span class="' + s.className + '"></span></span>';
      });
    }
    rail.innerHTML = html;
  }

  /* ---------------------------------------------------------- mobile tabs */

  function addTabs(app) {
    var body = app.querySelector(".nlm-body");
    if (!body || app.querySelector(".nlm-tabs")) return;
    var tabs = [];
    if (body.querySelector(":scope > .nlm-sources")) tabs.push("sources");
    if (body.querySelector(":scope > .nlm-chat")) tabs.push("chat");
    if (body.querySelector(":scope > .nlm-studio")) tabs.push("studio");
    if (tabs.length < 2) return;
    var start = app.getAttribute("data-mobile-tab") || (tabs.indexOf("chat") >= 0 ? "chat" : tabs[0]);
    app.setAttribute("data-tab", start);
    var bar = document.createElement("div");
    bar.className = "nlm-tabs";
    bar.setAttribute("role", "tablist");
    bar.innerHTML = tabs.map(function (t) {
      var label = (C.panels[t] || { label: t }).label;
      return '<button type="button" role="tab" data-nlm-tab="' + t + '" aria-selected="' + (t === start) + '">' + esc(label) + "</button>";
    }).join("");
    body.parentNode.insertBefore(bar, body);
  }

  /* ----------------------------------------------------------- behaviour */

  function closeMenus(except) {
    document.querySelectorAll(".nlm-app .nlm-menu-trigger[aria-expanded='true']").forEach(function (b) {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false");
      var m = document.getElementById(b.getAttribute("aria-controls"));
      if (m) m.hidden = true;
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest(".nlm-app .nlm-menu-trigger");
    if (t) {
      e.preventDefault();
      var open = t.getAttribute("aria-expanded") === "true";
      closeMenus(t);
      t.setAttribute("aria-expanded", String(!open));
      var m = document.getElementById(t.getAttribute("aria-controls"));
      if (m) m.hidden = open;
      return;
    }
    if (!e.target.closest(".nlm-menu")) closeMenus();

    var c = e.target.closest(".nlm-app [data-nlm-collapse]");
    if (c) {
      var panel = c.closest(".nlm-sources, .nlm-studio");
      if (panel) {
        if (!panel.classList.contains("is-collapsed")) buildRail(panel);
        panel.classList.toggle("is-collapsed");
      }
      return;
    }

    var tab = e.target.closest(".nlm-app [data-nlm-tab]");
    if (tab) {
      var app = tab.closest(".nlm-app");
      app.setAttribute("data-tab", tab.getAttribute("data-nlm-tab"));
      tab.parentNode.querySelectorAll("[data-nlm-tab]").forEach(function (b) {
        b.setAttribute("aria-selected", String(b === tab));
      });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenus();
  });

  /* --------------------------------------------------------------- render */

  var order = ["topbar", "panel-head", "source-tools", "studio", "artifact", "nb-head", "msg-actions", "suggest", "timestamp", "composer"];
  order.forEach(function (name) {
    document.querySelectorAll('.nlm-app [data-nlm="' + name + '"]').forEach(function (el) {
      build[name](el);
      el.removeAttribute("data-nlm");
    });
  });
  document.querySelectorAll(".nlm-app").forEach(addTabs);
})();
