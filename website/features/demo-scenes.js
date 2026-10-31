/* ==========================================================================
   Scene-based feature demos. Each demo is a .demo-shell[data-scene="key"]
   whose markup is the starting state; play() restores that state and runs
   the scene's steps (cursor moves, clicks, typing, status changes).
   Flows and strings follow the extension source (see each scene's notes).
   Requires demo.js (window.NTDemo) and the surfaces/NotebookLM shells.
   ========================================================================== */
(function () {
  "use strict";
  var D = window.NTDemo;
  if (!D) return;

  var SCENES = {};

  function makeApi(root, token) {
    function alive() {
      return root._token === token;
    }
    function el(sel) {
      if (!sel) return null;
      if (typeof sel !== "string") return sel;
      if (/^[a-z0-9-]+$/i.test(sel)) return root.querySelector('[data-s="' + sel + '"]');
      return root.querySelector(sel);
    }
    function guard(fn) {
      return function () {
        if (!alive()) return new Promise(function () {});
        return fn.apply(null, arguments);
      };
    }
    var api = {
      el: el,
      all: function (sel) {
        return Array.prototype.slice.call(root.querySelectorAll(/^[a-z0-9-]+$/i.test(sel) ? '[data-s="' + sel + '"]' : sel));
      },
      wait: function (ms) {
        return function () { return alive() ? D.wait(ms) : new Promise(function () {}); };
      },
      /* Cursor to an element; click ripple unless click === false. */
      click: function (sel, opts) {
        return guard(function () {
          var target = el(sel);
          if (!target) return Promise.resolve();
          api.reveal(target);
          return D.moveCursorTo(target, Object.assign({ shell: root }, opts || {}));
        });
      },
      move: function (sel, opts) {
        return api.click(sel, Object.assign({ click: false }, opts || {}));
      },
      run: function (fn) {
        return guard(function () { return fn(); });
      },
      show: function (sel) { return guard(function () { var e = el(sel); if (e) e.hidden = false; }); },
      hide: function (sel) { return guard(function () { var e = el(sel); if (e) e.hidden = true; }); },
      text: function (sel, value) { return guard(function () { var e = el(sel); if (e) e.textContent = value; }); },
      html: function (sel, value) { return guard(function () { var e = el(sel); if (e) e.innerHTML = value; }); },
      add: function (sel, cls) { return guard(function () { var e = el(sel); if (e) e.classList.add.apply(e.classList, cls.split(" ")); }); },
      remove: function (sel, cls) { return guard(function () { var e = el(sel); if (e) e.classList.remove.apply(e.classList, cls.split(" ")); }); },
      /* Status line with a kind: loading | success | warn | (none). */
      status: function (sel, value, kind) {
        return guard(function () {
          var e = el(sel);
          if (!e) return;
          e.hidden = !value;
          e.textContent = value || "";
          ["is-loading", "is-success", "is-warn"].forEach(function (c) { e.classList.remove(c); });
          if (kind) e.classList.add("is-" + kind);
          if (value) api.reveal(e);
        });
      },
      /* Type text into an element, character by character. */
      type: function (sel, value, speed) {
        return guard(function () {
          var e = el(sel);
          if (!e) return Promise.resolve();
          var i = 0;
          var base = e.textContent;
          speed = D.reducedMotion() ? 0 : speed || 38;
          return new Promise(function (resolve) {
            (function next() {
              if (!alive()) return;
              if (i >= value.length) return resolve();
              i += 1;
              e.textContent = base + value.slice(0, i);
              setTimeout(next, speed);
            })();
          });
        });
      },
      /* Switch the browser window to tab index i. */
      tab: function (i) {
        return guard(function () {
          var win = root.querySelector(".br-window");
          if (win && window.NT_SURFACES) window.NT_SURFACES.showTab(win, i);
        });
      },
      /* Scroll the nearest scroll container so the element is visible. */
      reveal: function (target) {
        var p = target.parentElement;
        while (p && p !== root) {
          var cs = getComputedStyle(p);
          if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4) {
            var pr = p.getBoundingClientRect();
            var tr = target.getBoundingClientRect();
            if (tr.top < pr.top + 8 || tr.bottom > pr.bottom - 8) {
              var zoom = parseFloat(getComputedStyle(p).zoom) || 1;
              p.scrollTop += (tr.top - pr.top - pr.height / 3) / (zoom || 1);
            }
            break;
          }
          p = p.parentElement;
        }
      },
    };
    return api;
  }

  function register(key, steps) {
    var root = document.querySelector('.demo-shell[data-scene="' + key + '"]');
    if (!root) return;
    var initial = root.innerHTML;
    root._token = 0;

    function play() {
      root._token += 1;
      root.innerHTML = initial;
      D.hideDemoCursor(root);
      var api = makeApi(root, root._token);
      var list = [500].concat(steps(api), [
        api.run(function () {
          D.hideDemoCursor(root);
          var replay = root.querySelector('[data-action="scene-replay"]');
          if (replay) replay.hidden = false;
        }),
      ]);
      return D.sequence(list);
    }

    SCENES[key] = { root: root, play: play };
    D.registerDemo(key, { play: play });
  }

  document.addEventListener("click", function (e) {
    var replay = e.target.closest('[data-action="scene-replay"]');
    var playBtn = e.target.closest('[data-action="play-demo"]');
    var trigger = replay || playBtn;
    if (!trigger) return;
    var panel = trigger.closest(".md-panel") || document;
    var root = replay ? replay.closest("[data-scene]") : panel.querySelector("[data-scene]");
    if (!root) return;
    var scene = SCENES[root.getAttribute("data-scene")];
    if (scene) {
      e.preventDefault();
      scene.play();
    }
  });

  /* Shared step helpers ---------------------------------------------------- */

  function importStatuses(a, statusSel, notebook, extra) {
    return [
      a.status(statusSel, "Preparing import...", "loading"),
      a.wait(650),
      a.status(statusSel, "Sending to NotebookLM...", "loading"),
      a.wait(900),
      a.run(function () {
        var s = a.el(statusSel);
        if (!s) return;
        s.hidden = false;
        s.className = s.className.replace(/\bis-\w+/g, "").trim() + " is-success";
        s.innerHTML = 'Added to "' + notebook + '"' + (extra || "");
      }),
    ];
  }

  /* ---------------------------------------------------------------- scenes */

  // YouTube: pill in the watch-page action row → picker dropdown → import.
  // youtube-inject.js, youtube-import.js, notebook-picker.js
  register("youtube", function (a) {
    return [
      a.click("nt-btn"),
      a.add("nt-btn", "is-pressed"),
      a.show("drop"),
      a.text("drop-status", "Loading notebooks..."),
      a.wait(700),
      a.text("drop-status", "12 notebooks ready."),
      a.wait(500),
      a.click(".nt-drop .sf-select"),
      a.add(".nt-drop .sf-select", "is-focus"),
      a.wait(400),
      a.remove(".nt-drop .sf-select", "is-focus"),
      a.click("drop-import"),
      a.add("drop-import", "is-busy"),
      a.text("drop-status", "Adding video..."),
      a.wait(700),
      a.text("drop-status", "Sending to NotebookLM..."),
      a.wait(900),
      a.remove("drop-import", "is-busy"),
      a.add("drop-status", "is-success"),
      a.text("drop-status", 'Added to "Research — AI tools"'),
      a.wait(500),
      a.click("drop-open"),
      a.hide("drop"),
      a.remove("nt-btn", "is-pressed"),
      a.tab(1),
      a.wait(250),
      a.show("new-src"),
      a.add("new-src", "nlm-source-new"),
      a.run(function () {
        var c = a.el(".nlm-composer-count");
        if (c) c.textContent = "4 sources";
      }),
      a.move("new-src", { duration: 600 }),
      a.wait(1400),
    ];
  });

  // Bulk: side panel Bulk tab → Open tabs → queue → Import N sources.
  // bulk-import.js (labels, statuses, progress)
  register("bulk", function (a) {
    var items = a.all("q-row");
    var titles = ["Retrieval-augmented generation", "Introducing NotebookLM Video Overviews", "Evaluating RAG pipelines", "Long-context vs RAG — talk", "Chunking strategies that work"];
    var steps = [
      a.click("open-tabs"),
      a.status("bulk-status", "Added 5 · 0 duplicates skipped · 0 invalid lines skipped.", "success"),
      a.hide("q-empty"),
      a.run(function () { items.forEach(function (r) { r.hidden = false; }); }),
      a.text("q-meta", "5 items · 5 ready · 2 YT"),
      a.text("bulk-import", "Import 5 sources"),
      a.wait(900),
      a.click(".sp-card .sf-select"),
      a.add(".sp-card .sf-select", "is-focus"),
      a.wait(350),
      a.remove(".sp-card .sf-select", "is-focus"),
      a.click("bulk-import"),
      a.add("bulk-import", "is-busy"),
      a.status("bulk-status", "Preparing bulk import...", "loading"),
      a.wait(600),
    ];
    items.forEach(function (row, i) {
      steps.push(
        a.run(function () { row.classList.add("is-active"); }),
        a.status("bulk-status", "Importing " + titles[i] + "...", "loading"),
        a.text("q-progress-text", "Importing " + (i + 1) + " of 5..."),
        a.wait(620),
        a.run(function () {
          row.classList.remove("is-active");
          row.classList.add("is-success");
          a.el("q-fill").style.width = ((i + 1) / 5) * 100 + "%";
        }),
        a.text("q-progress-text", i + 1 + " of 5 processed")
      );
    });
    steps.push(
      a.remove("bulk-import", "is-busy"),
      a.text("bulk-import", "Import queue"),
      a.status("bulk-status", "Bulk import complete: 5 added, 0 failed, 0 skipped.", "success"),
      a.show("bulk-open"),
      a.wait(1500)
    );
    return steps;
  });

  // Webpage: toolbar icon opens the side panel → Add to NotebookLM.
  // sidepanel.html Import tab, sidepanel.js statuses
  register("webpage", function (a) {
    return [
      a.click(".br-ext-btn"),
      a.add(".br-ext-btn", "is-pressed"),
      a.show(".br-sidepanel"),
      a.wait(700),
      a.click(".sp-card .sf-select"),
      a.add(".sp-card .sf-select", "is-focus"),
      a.wait(300),
      a.text(".sp-card .sf-select-value", "Research — AI tools (12)"),
      a.remove(".sp-card .sf-select", "is-focus"),
      a.wait(300),
      a.click("wp-add"),
    ].concat(importStatuses(a, "wp-status", "Research — AI tools"), [
      a.show("wp-open"),
      a.wait(1600),
    ]);
  });

  // Highlights: select text → right-click → "Add to NotebookLM" → side panel Text mode.
  // background.js context menu, sidepanel.js ?mode=text
  register("highlights", function (a) {
    return [
      a.move("hl-start", { duration: 600 }),
      a.add("hl-mark", "is-selected"),
      a.move("hl-end", { duration: 700 }),
      a.wait(300),
      a.click("hl-mark", { offsetX: 40 }),
      a.show("hl-menu"),
      a.wait(500),
      a.add('[data-ctx="Add to NotebookLM"]', "is-hot"),
      a.click('[data-ctx="Add to NotebookLM"]'),
      a.hide("hl-menu"),
      a.show(".br-sidepanel"),
      a.wait(800),
      a.click("hl-import"),
    ].concat(importStatuses(a, "hl-status", "Research — AI tools", " <u>Open notebook</u>"), [a.wait(1600)]);
  });

  // X: one "NotebookLM" pill in the column header → import panel.
  // platform-button.js, platform-import.html/js
  register("xtwitter", function (a) {
    return [
      a.click("x-btn"),
      a.add("x-btn", "is-pressed"),
      a.show("x-drop"),
      a.wait(800),
      a.click("x-import"),
      a.add("x-import", "is-busy"),
      a.text("x-status", "Sending to NotebookLM..."),
      a.wait(1000),
      a.remove("x-import", "is-busy"),
      a.add("x-status", "is-success"),
      a.text("x-status", 'Added to "Research — AI tools"'),
      a.wait(1300),
      a.hide("x-drop"),
      a.remove("x-btn", "is-pressed"),
      a.wait(900),
    ];
  });

  // Snapshots: Drag to capture → overlay → annotate → side panel → send.
  // snapshot-capture-overlay.js, snapshot-annotate.js, snapshots-panel.js, snapshot-upload.js
  register("snapshots", function (a) {
    function sel() { return a.el("snap-sel"); }
    return [
      a.click("snap-drag"),
      a.show("snap-overlay"),
      a.wait(500),
      a.move("snap-from", { duration: 600 }),
      a.run(function () {
        var from = a.el("snap-from");
        var s = sel();
        s.style.left = from.offsetLeft + "px";
        s.style.top = from.offsetTop + "px";
        s.hidden = false;
        void s.offsetWidth;
        s.style.width = "430px";
        s.style.height = "150px";
      }),
      a.move("snap-to", { duration: 700 }),
      a.remove("snap-capture", "is-disabled"),
      a.wait(250),
      a.click("snap-capture"),
      a.hide("snap-overlay"),
      a.show("snap-editor"),
      a.wait(600),
      a.click("tool-rect"),
      a.remove("tool-select", "is-active"),
      a.add("tool-rect", "is-active"),
      a.move("shape-from", { duration: 500 }),
      a.run(function () {
        var sh = a.el("snap-shape");
        sh.hidden = false;
        void sh.offsetWidth;
        sh.style.width = "150px";
        sh.style.height = "56px";
      }),
      a.move("shape-to", { duration: 600 }),
      a.wait(300),
      a.click("tool-save"),
      a.hide("snap-editor"),
      a.hide("snap-empty"),
      a.show("snap-card"),
      a.text("snap-count", "Snapshots (1)"),
      a.text("snap-send", "Send 1 snapshot to notebook"),
      a.wait(900),
      a.click("snap-send"),
      a.status("snap-status", "Uploading image 1 of 1...", "loading"),
      a.wait(1100),
      a.status("snap-status", 'Uploaded 1 images to "Acme onboarding guide". Writing article with inline images...', "success"),
      a.wait(1800),
    ];
  });

  // Prompts: type "/" in NotebookLM chat → menu → Enter inserts the full prompt.
  // notebooklm-prompt-slash.js
  register("prompts", function (a) {
    var full = "Summarize the key arguments across all sources in 5 bullets, with a citation for each.";
    return [
      a.click(".nlm-composer"),
      a.type("prompt-input", "/", 0),
      a.show("slash"),
      a.wait(700),
      a.type("prompt-input", "key", 120),
      a.run(function () {
        a.all("slash-item").forEach(function (it) {
          it.hidden = it.getAttribute("data-key") !== "key";
        });
        var first = a.el('[data-key="key"]');
        if (first) first.classList.add("is-active");
      }),
      a.wait(700),
      a.hide("slash"),
      a.text("prompt-input", full),
      a.wait(700),
      a.click(".nlm-send"),
      a.text("prompt-input", ""),
      a.show("prompt-q"),
      a.run(function () {
        var q = a.el("prompt-q");
        if (q) a.reveal(q);
      }),
      a.wait(900),
      a.show("prompt-a"),
      a.show("prompt-a-actions"),
      a.run(function () {
        var ans = a.el("prompt-a-actions");
        if (ans) a.reveal(ans);
      }),
      a.wait(1600),
    ];
  });

  // Chat export: pill above the chat box → format menu → download + toast.
  // notebooklm-chat-export-inject.js, chat-export.js
  register("chatexport", function (a) {
    return [
      a.click("ce-btn"),
      a.show("ce-menu"),
      a.wait(500),
      a.add("ce-md", "is-hot"),
      a.click("ce-md"),
      a.hide("ce-menu"),
      a.text("ce-label", "Exporting..."),
      a.add("ce-btn", "is-busy"),
      a.wait(900),
      a.text("ce-label", "Export chat"),
      a.remove("ce-btn", "is-busy"),
      a.show("ce-toast"),
      a.wait(2800),
      a.hide("ce-toast"),
    ];
  });

  // Slides → blog: "Blog workflow" pill → Auto blog → progress → download.
  // workflows/blog-creation/blog-with-deck-images (workflow-ui.js, workflow.js)
  register("slidestoblog", function (a) {
    var msgs = [
      ["Downloading slide deck PDF...", 6],
      ["Downloaded PDF (4.2 MB)", 10],
      ["Uploading slide deck PDF as a file source...", 18],
      ["Waiting for PDF source to finish processing...", 26],
      ["Sending blog prompt to NotebookLM chat...", 32],
      ["NotebookLM is writing the blog article...", 40],
      ["Writing blog article (2,840 characters)...", 52],
      ["Blog article complete (4,312 characters)", 60],
      ["Blog written. Extracting slide images one by one...", 64],
    ];
    var steps = [
      a.click("blog-btn"),
      a.show("blog-pop"),
      a.wait(700),
      a.click("blog-auto"),
      a.text("blog-label", "Building blog..."),
      a.add("blog-btn", "is-busy"),
      a.show("blog-progress"),
    ];
    msgs.forEach(function (m) {
      steps.push(
        a.text("blog-status", m[0]),
        a.run(function () { a.el("blog-fill").style.width = m[1] + "%"; }),
        a.wait(520)
      );
    });
    for (var i = 1; i <= 6; i += 1) {
      (function (n) {
        steps.push(
          a.text("blog-status", "Rendering slide " + n + " of 6..."),
          a.text("blog-count", "Slide images: " + n + " / 6"),
          a.run(function () {
            var t = a.all("blog-thumb")[n - 1];
            if (t) t.classList.add("is-on");
            a.el("blog-fill").style.width = 64 + n * 5 + "%";
          }),
          a.wait(380)
        );
      })(i);
    }
    steps.push(
      a.text("blog-status", "Combining blog text with slide images..."),
      a.wait(500),
      a.text("blog-status", "Building downloadable blog file (HTML, DOC, PDF)..."),
      a.run(function () { a.el("blog-fill").style.width = "100%"; }),
      a.wait(600),
      a.text("blog-status", "Ready to download — 6 images embedded"),
      a.add("blog-status", "is-done"),
      a.text("blog-label", "Blog workflow"),
      a.remove("blog-btn", "is-busy"),
      a.show("blog-dl"),
      a.show("blog-note"),
      a.wait(700),
      a.click("blog-doc"),
      a.show("blog-toast"),
      a.wait(2400)
    );
    return steps;
  });

  // Notebooks hub: favorite, pin, folder filter, select + bulk delete.
  // notebooks.html, notebooks.js
  register("hub", function (a) {
    return [
      a.click("star-exam"),
      a.add("star-exam", "is-on"),
      a.wait(500),
      a.click("pin-q3"),
      a.add("pin-q3", "is-on"),
      a.run(function () {
        var card = a.el("card-q3");
        card.classList.add("is-pinned");
        card.parentNode.insertBefore(card, card.parentNode.firstElementChild);
      }),
      a.wait(700),
      a.click("folder-work"),
      a.remove("folder-all", "is-active"),
      a.add("folder-work", "is-active"),
      a.run(function () {
        a.all(".ntb-card").forEach(function (c) { c.hidden = c.getAttribute("data-folder") !== "work"; });
      }),
      a.wait(1100),
      a.click("folder-all"),
      a.remove("folder-work", "is-active"),
      a.add("folder-all", "is-active"),
      a.run(function () { a.all(".ntb-card").forEach(function (c) { c.hidden = false; }); }),
      a.wait(500),
      a.click("ntb-select"),
      a.add(".ntb", "is-selecting"),
      a.text("ntb-select", "Done"),
      a.show("ntb-delete"),
      a.wait(400),
      a.click("card-old1"),
      a.add("card-old1", "is-selected"),
      a.text("ntb-delete", "Delete (1)"),
      a.click("card-old2"),
      a.add("card-old2", "is-selected"),
      a.text("ntb-delete", "Delete (2)"),
      a.wait(400),
      a.click("ntb-delete"),
      a.show("ntb-modal"),
      a.wait(700),
      a.click("ntb-modal-confirm"),
      a.hide("ntb-modal"),
      a.status("ntb-status", "Deleting 2 notebooks...", "loading"),
      a.add("card-old1", "is-removing"),
      a.add("card-old2", "is-removing"),
      a.wait(900),
      a.hide("card-old1"),
      a.hide("card-old2"),
      a.status("ntb-status", "2 notebooks deleted.", "success"),
      a.remove(".ntb", "is-selecting"),
      a.text("ntb-select", "Select"),
      a.hide("ntb-delete"),
      a.wait(1600),
    ];
  });

  // Manage sources: Manage modal → select → Organize into a folder; then duplicate scan.
  // notebooks-sources.js, notebooks-duplicate-sources.js
  register("manage", function (a) {
    return [
      a.click("mg-open"),
      a.show("mg-modal"),
      a.wait(500),
      a.click("mg-r1"),
      a.add("mg-r1", "is-on"),
      a.text("mg-count", "1 selected"),
      a.click("mg-r2"),
      a.add("mg-r2", "is-on"),
      a.text("mg-count", "2 selected"),
      a.click("mg-r3"),
      a.add("mg-r3", "is-on"),
      a.text("mg-count", "3 selected"),
      a.wait(300),
      a.click("mg-organize-btn"),
      a.show("mg-organize"),
      a.wait(500),
      a.click("mg-folder-papers"),
      a.add("mg-folder-papers", "is-active"),
      a.status("mg-status", "Moved 3 source(s) into folder.", "success"),
      a.run(function () {
        a.all("src-papers").forEach(function (chip) { chip.hidden = false; });
      }),
      a.wait(1100),
      a.click("mg-close"),
      a.hide("mg-modal"),
      a.wait(700),
      a.click("dup-open"),
      a.show("dup-modal"),
      a.wait(600),
      a.click("dup-run"),
      a.hide("dup-choose"),
      a.show("dup-scanning"),
      a.text("dup-scan-status", "Analyzing sources..."),
      a.run(function () { a.el("dup-fill").style.width = "45%"; }),
      a.wait(600),
      a.text("dup-scan-status", "Comparing sources..."),
      a.run(function () { a.el("dup-fill").style.width = "100%"; }),
      a.wait(600),
      a.hide("dup-scanning"),
      a.show("dup-review"),
      a.wait(1100),
      a.click("dup-clean"),
      a.hide("dup-review"),
      a.show("dup-confirm"),
      a.wait(700),
      a.click("dup-delete"),
      a.hide("dup-confirm"),
      a.show("dup-done"),
      a.hide("src-dup"),
      a.wait(1000),
      a.click("dup-ok"),
      a.hide("dup-modal"),
      a.wait(900),
    ];
  });

  // Drive refresh: quiet freshness check → "Update available" → Refresh stale (N).
  // notebooks-sources.js (freshness), notebooklm-client.js (refreshable types)
  register("drive", function (a) {
    var stale = ["dr-1", "dr-2"];
    var ok = ["dr-3", "dr-5"];
    return [
      a.run(function () {
        stale.concat(ok).forEach(function (k) {
          var b = a.el(k + "-badge");
          b.hidden = false;
          b.className = "ntb-src-badge is-checking";
          b.textContent = "Checking…";
        });
      }),
      a.wait(1300),
      a.run(function () {
        ok.forEach(function (k) { a.el(k + "-badge").hidden = true; });
        stale.forEach(function (k) {
          var b = a.el(k + "-badge");
          b.className = "ntb-src-badge";
          b.textContent = "Update available";
          a.el(k).classList.add("is-stale");
        });
      }),
      a.show("dr-refresh"),
      a.wait(900),
      a.click("dr-refresh"),
      a.text("dr-refresh", "Refreshing..."),
      a.status("dr-status", "Refreshing 2 sources...", "loading"),
      a.wait(600),
      a.status("dr-status", 'Refreshing "Q3 roadmap" (1/2)...', "loading"),
      a.wait(800),
      a.run(function () { a.el("dr-1").classList.remove("is-stale"); a.el("dr-1-badge").hidden = true; }),
      a.text("dr-1-time", "Google Doc · synced just now"),
      a.status("dr-status", 'Refreshing "Launch deck" (2/2)...', "loading"),
      a.wait(800),
      a.run(function () { a.el("dr-2").classList.remove("is-stale"); a.el("dr-2-badge").hidden = true; }),
      a.text("dr-2-time", "Google Slides · synced just now"),
      a.status("dr-status", "Refreshed 2 sources.", "success"),
      a.hide("dr-refresh"),
      a.wait(1700),
    ];
  });

  // Studio & podcasts: Studio tab → Generate audio → Ready; Podcast tab → Scan → play.
  // notebooks-studio.js, notebooks-podcast.js
  register("studio", function (a) {
    var hubEl = function () { return a.el(".ntb"); };
    return [
      a.click("st-instructions"),
      a.add("st-instructions", "is-focus"),
      a.run(function () { a.el("st-instructions").classList.remove("sf-ph"); a.el("st-instructions").textContent = ""; }),
      a.type("st-instructions", "Focus on how textile mills changed family life", 26),
      a.remove("st-instructions", "is-focus"),
      a.wait(300),
      a.click("st-generate"),
      a.status("st-status", "Starting...", "loading"),
      a.wait(700),
      a.status("st-status", "Generation started.", "success"),
      a.show("st-new"),
      a.wait(1600),
      a.text("st-new-state", "Ready"),
      a.add("st-new-state", "is-ready"),
      a.show("st-new-open"),
      a.wait(1000),
      a.click('[data-hub-tab="Notebooks"]'),
      a.run(function () {
        window.NT_SURFACES.setHubTabs(hubEl(), ["Notebooks", "Podcast"], "Notebooks");
      }),
      a.wait(400),
      a.click('[data-hub-tab="Podcast"]'),
      a.run(function () {
        window.NT_SURFACES.setHubTabs(hubEl(), ["Notebooks", "Podcast"], "Podcast");
        a.el("st-view").hidden = true;
        a.el("pc-view").hidden = false;
      }),
      a.wait(600),
      a.click("pc-scan"),
      a.status("pc-status", "Scanning 1/6: Competitor briefs", "loading"),
      a.wait(450),
      a.status("pc-status", "Scanning 3/6: History seminar", "loading"),
      a.wait(450),
      a.status("pc-status", "Scanning 6/6: Research — AI tools", "loading"),
      a.wait(450),
      a.status("pc-status", "Found 4 podcasts across your notebooks.", "success"),
      a.show("pc-list"),
      a.wait(800),
      a.click("pc-first"),
      a.add("pc-item-1", "is-playing"),
      a.text("pc-first", "❚❚"),
      a.show("pc-player"),
      a.run(function () {
        var t = 252;
        var bar = a.el("pc-fill");
        var time = a.el("pc-time");
        var token = a.el("pc-player");
        var tick = function () {
          if (!token.isConnected || t > 262) return;
          t += 1;
          bar.style.width = (t / 522) * 100 + "%";
          time.textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0") + " / 8:42";
          setTimeout(tick, 1000);
        };
        tick();
      }),
      a.wait(3500),
    ];
  });
})();
