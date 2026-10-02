(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function wait(ms) {
    if (prefersReducedMotion()) return Promise.resolve();
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function sequence(steps) {
    var chain = Promise.resolve();
    steps.forEach(function (step) {
      chain = chain.then(function () {
        if (typeof step === "function") return step();
        return wait(step);
      });
    });
    return chain;
  }


  function ensureDemoCursor(shell) {
    if (!shell) return null;
    var cursor = shell.querySelector(".demo-cursor");
    if (cursor) return cursor;
    cursor = document.createElement("div");
    cursor.className = "demo-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML =
      '<svg class="demo-cursor-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4.5 2.8v17.2c0 .4.5.6.8.4l5.1-4.4c.2-.1.4-.2.6-.2h7.1c.4 0 .6-.5.3-.8L5.3 2.4a.5.5 0 0 0-.8.4z" fill="#fff" stroke="#202124" stroke-width="1.4" stroke-linejoin="round"/>' +
      "</svg>" +
      '<span class="demo-cursor-ripple"></span>';
    shell.appendChild(cursor);
    return cursor;
  }

  function hideDemoCursor(shell) {
    if (!shell) return;
    var cursor = shell.querySelector(".demo-cursor");
    if (!cursor) return;
    cursor.classList.remove("is-visible", "is-clicking");
    cursor.style.opacity = "0";
  }

  /**
   * Animate the guided cursor to an element inside .demo-shell, play a click
   * ripple, then resolve so the caller can run the real demo step.
   * @param {Element} el
   * @param {{shell?: Element, duration?: number, click?: boolean, clickMs?: number, offsetX?: number, offsetY?: number}} opts
   */
  function moveCursorTo(el, opts) {
    opts = opts || {};
    if (!el) return Promise.resolve();
    var shell = opts.shell || el.closest(".demo-shell");
    if (!shell) return Promise.resolve();

    var cursor = ensureDemoCursor(shell);
    if (!cursor) return Promise.resolve();

    var shellRect = shell.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    var ox = opts.offsetX != null ? opts.offsetX : 0;
    var oy = opts.offsetY != null ? opts.offsetY : 0;
    var x = elRect.left - shellRect.left + shell.scrollLeft + elRect.width / 2 + ox;
    var y = elRect.top - shellRect.top + shell.scrollTop + elRect.height / 2 + oy;
    // Tip of the arrow sits near (6, 4) in the 24x24 graphic
    var tipX = 6;
    var tipY = 4;
    var target = "translate(" + (x - tipX) + "px, " + (y - tipY) + "px)";
    var duration = opts.duration != null ? opts.duration : 480;
    var doClick = opts.click !== false;
    var clickMs = opts.clickMs != null ? opts.clickMs : 280;
    var reduced = prefersReducedMotion();

    cursor.classList.add("is-visible");
    cursor.classList.remove("is-clicking");

    if (reduced) {
      cursor.style.transition = "none";
      cursor.style.opacity = "1";
      cursor.style.transform = target;
      if (!doClick) return Promise.resolve();
      cursor.classList.add("is-clicking");
      return wait(Math.min(clickMs, 80)).then(function () {
        cursor.classList.remove("is-clicking");
      });
    }

    // If cursor was hidden, seed a start position slightly above/left of target
    if (!cursor.style.transform || cursor.style.opacity === "0" || getComputedStyle(cursor).opacity === "0") {
      cursor.style.transition = "none";
      cursor.style.opacity = "0";
      cursor.style.transform =
        "translate(" + (x - tipX - 36) + "px, " + (y - tipY - 28) + "px)";
      // force reflow
      void cursor.offsetWidth;
    }

    cursor.style.opacity = "1";
    cursor.style.transition =
      "transform " +
      duration +
      "ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease";
    cursor.style.transform = target;

    return new Promise(function (resolve) {
      setTimeout(function () {
        if (!doClick) {
          resolve();
          return;
        }
        cursor.classList.add("is-clicking");
        setTimeout(function () {
          cursor.classList.remove("is-clicking");
          resolve();
        }, clickMs);
      }, duration);
    });
  }

  /* ---- YouTube demo ---- */
  function initYoutubeDemo(root) {
    var picker = $("#yt-picker", root);
    var watch = $('[data-panel="watch"]', root);
    var notebook = $('[data-panel="notebook"]', root);
    var toast = $("#yt-toast", root);
    var newSrc = $("#yt-new-source", root);
    var countEl = $("#yt-source-count", root);
    var titleEl = $("#yt-nb-title", root);
    var addBtn = $("#yt-add-btn", root);
    var selectedName = "NotebookLM notes";
    var autoRunning = false;

    function showPicker(show) {
      if (!picker) return;
      if (show) {
        picker.removeAttribute("hidden");
        picker.classList.add("is-visible");
      } else {
        picker.setAttribute("hidden", "");
        picker.classList.remove("is-visible");
      }
    }

    function reset() {
      if (notebook) {
        notebook.setAttribute("hidden", "");
        notebook.classList.remove("is-active", "is-entering");
      }
      if (watch) {
        watch.removeAttribute("hidden");
        watch.classList.add("is-active");
      }
      if (newSrc) {
        newSrc.setAttribute("hidden", "");
        newSrc.classList.remove("is-appearing");
      }
      if (countEl) countEl.textContent = "2 sources";
      if (toast) toast.setAttribute("hidden", "");
      if (addBtn) addBtn.classList.remove("is-pulse", "is-clicked");
      showPicker(false);
    }

    function confirmAdd() {
      showPicker(false);
      if (watch) {
        watch.classList.add("is-exiting");
        setTimeout(function () {
          watch.setAttribute("hidden", "");
          watch.classList.remove("is-active", "is-exiting");
        }, prefersReducedMotion() ? 0 : 280);
      }
      if (notebook) {
        notebook.removeAttribute("hidden");
        notebook.classList.add("is-active", "is-entering");
      }
      if (titleEl) titleEl.textContent = selectedName;
      return wait(prefersReducedMotion() ? 0 : 350).then(function () {
        if (newSrc) {
          newSrc.removeAttribute("hidden");
          newSrc.classList.add("is-appearing");
          if (countEl) countEl.textContent = "3 sources";
          if (toast) {
            toast.textContent = "Added to " + selectedName + " âœ“";
            toast.removeAttribute("hidden");
            setTimeout(function () {
              toast.setAttribute("hidden", "");
            }, 2200);
          }
        }
      });
    }

    function runAutoplay() {
      if (autoRunning) return;
      autoRunning = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        400,
        function () {
          if (addBtn) addBtn.classList.add("is-pulse");
          return moveCursorTo(addBtn, { shell: root });
        },
        function () {
          if (addBtn) {
            addBtn.classList.remove("is-pulse");
            addBtn.classList.add("is-clicked");
          }
          showPicker(true);
        },
        500,
        function () {
          if (addBtn) addBtn.classList.remove("is-clicked");
          var items = $all(".demo-nb-item", root);
          var sel = items[2] || items[0];
          return moveCursorTo(sel, { shell: root }).then(function () {
            items.forEach(function (el) {
              el.classList.toggle("is-selected", el === sel);
            });
            if (sel) selectedName = sel.getAttribute("data-name") || selectedName;
          });
        },
        450,
        function () {
          var confirm = $('[data-action="confirm-add"]', root);
          return moveCursorTo(confirm, { shell: root }).then(function () {
            if (confirm) confirm.classList.add("is-clicked");
            return confirmAdd().then(function () {
              var confirm2 = $('[data-action="confirm-add"]', root);
              if (confirm2) confirm2.classList.remove("is-clicked");
            });
          });
        },
        350,
        function () {
          hideDemoCursor(root);
          autoRunning = false;
        },
      ]);
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");

      if (action === "play-demo") {
        runAutoplay();
      } else if (action === "open-picker") {
        showPicker(true);
      } else if (action === "close-picker") {
        showPicker(false);
      } else if (action === "pick-nb") {
        $all(".demo-nb-item", root).forEach(function (el) {
          el.classList.toggle("is-selected", el === t);
        });
        selectedName = t.getAttribute("data-name") || selectedName;
      } else if (action === "confirm-add") {
        confirmAdd();
      } else if (action === "reset-yt") {
        reset();
      }
    });

    // Play demo button sits in section head (outside demo-shell root)
    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="play-demo"]');
      if (!t || !document.body.contains(root)) return;
      if (t.closest(".feature-demo-section") === root.closest(".feature-demo-section")) {
        runAutoplay();
      }
    });

    /* autoplay deferred to master-detail router */
  
    registerDemo("youtube", { play: runAutoplay });
  }

  /* ---- Bulk demo ---- */
  function initBulkDemo(root) {
    var fill = $("#bulk-fill", root);
    var text = $("#bulk-text", root);
    var nlm = $("#bulk-nlm-sources", root);
    var startBtn = $("#bulk-start", root);
    var resetBtn = $("#bulk-reset", root);
    var running = false;

    function reset() {
      running = false;
      if (fill) fill.style.width = "0%";
      if (text) text.textContent = "5 selected Â· ready";
      if (startBtn) startBtn.disabled = false;
      if (resetBtn) resetBtn.setAttribute("hidden", "");
      $all(".bulk-item", root).forEach(function (item) {
        item.classList.remove("is-done", "is-running");
        var st = $(".bulk-status", item);
        if (st) st.textContent = "";
        var cb = $("input[type=checkbox]", item);
        if (cb) cb.checked = true;
      });
      if (nlm) {
        $all(".bulk-added", nlm).forEach(function (el) {
          el.remove();
        });
      }
    }

    function runImport() {
      if (running) return Promise.resolve();
      running = true;
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.add("is-clicked");
      }
      var items = $all(".bulk-item", root).filter(function (item) {
        var cb = $("input[type=checkbox]", item);
        return cb && cb.checked;
      });
      var total = items.length || 1;
      var i = 0;

      return new Promise(function (resolve) {
        function step() {
          if (i >= items.length) {
            if (text) text.textContent = items.length + " imported Â· done";
            if (fill) fill.style.width = "100%";
            if (resetBtn) resetBtn.removeAttribute("hidden");
            if (startBtn) startBtn.classList.remove("is-clicked");
            running = false;
            resolve();
            return;
          }
          var item = items[i];
          item.classList.add("is-running");
          var st = $(".bulk-status", item);
          if (st) st.textContent = "Importingâ€¦";
          if (text) text.textContent = "Importing " + (i + 1) + " of " + items.length + "â€¦";
          if (fill) fill.style.width = Math.round(((i + 0.5) / total) * 100) + "%";

          setTimeout(function () {
            item.classList.remove("is-running");
            item.classList.add("is-done");
            if (st) st.textContent = "Added âœ“";
            if (nlm) {
              var label = item.querySelector("label");
              var name = label ? label.textContent.replace(/^\s*/, "").trim() : "Source";
              name = name.replace(/\s+/g, " ");
              if (name.length > 36) name = name.slice(0, 34) + "â€¦";
              var li = document.createElement("li");
              li.className = "nlm-source nlm-source-new bulk-added is-appearing";
              li.innerHTML =
                '<span class="nlm-src-icon nlm-src-web">+</span><span class="nlm-src-name"></span><span class="nlm-src-badge">New</span>';
              li.querySelector(".nlm-src-name").textContent = name;
              nlm.appendChild(li);
            }
            if (fill) fill.style.width = Math.round(((i + 1) / total) * 100) + "%";
            i += 1;
            setTimeout(step, prefersReducedMotion() ? 40 : 280);
          }, prefersReducedMotion() ? 40 : 520);
        }
        step();
      });
    }

    function runAutoplay() {
      reset();
      hideDemoCursor(root);
      return sequence([
        400,
        function () {
          return moveCursorTo(startBtn, { shell: root });
        },
        function () {
          return runImport();
        },
        200,
        function () {
          hideDemoCursor(root);
        },
      ]);
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "bulk-reset") {
        reset();
        return;
      }
      if (action === "play-demo") {
        runAutoplay();
        return;
      }
      if (action !== "bulk-start" || running) return;
      runImport();
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="play-demo"]');
      if (!t || !document.body.contains(root)) return;
      if (t.closest(".feature-demo-section") === root.closest(".feature-demo-section")) {
        runAutoplay();
      }
    });

    /* autoplay deferred to master-detail router */
  
    registerDemo("bulk", { play: runAutoplay });
  }

  /* ---- Hub demo ---- */
  function initHubDemo(root) {
    var grid = $("#hub-grid", root);
    var search = $("#hub-search", root);
    var hint = $("#hub-hint", root);
    var filter = "all";
    var folder = "all";
    var autoRunning = false;

    function apply() {
      var q = (search && search.value ? search.value : "").toLowerCase().trim();
      var visible = 0;
      $all(".nlm-nb-card", grid).forEach(function (card) {
        var title = (card.getAttribute("data-title") || "").toLowerCase();
        var f = card.getAttribute("data-folder") || "all";
        var starred = card.getAttribute("data-starred") === "1";
        var ok =
          (!q || title.indexOf(q) !== -1) &&
          (folder === "all" || f === folder) &&
          (filter !== "starred" || starred);
        card.classList.toggle("is-hidden", !ok);
        if (ok) visible += 1;
      });
      if (hint) {
        hint.textContent =
          visible === 0
            ? "No notebooks match â€” try clearing search"
            : visible + " notebook" + (visible === 1 ? "" : "s") + " Â· demo only";
      }
    }

    if (search) search.addEventListener("input", apply);

    function typeSearch(text) {
      if (!search) return Promise.resolve();
      search.value = "";
      apply();
      if (prefersReducedMotion()) {
        search.value = text;
        apply();
        return Promise.resolve();
      }
      var i = 0;
      return new Promise(function (resolve) {
        function tick() {
          if (i >= text.length) {
            resolve();
            return;
          }
          search.value = text.slice(0, i + 1);
          apply();
          i += 1;
          setTimeout(tick, 90);
        }
        tick();
      });
    }

    function setFilter(f) {
      filter = f;
      $all('[data-action="hub-filter"]', root).forEach(function (b) {
        var match = (b.getAttribute("data-filter") || "all") === f;
        b.classList.toggle("soft", !match);
        if (match) b.classList.remove("soft");
        else b.classList.add("soft");
      });
      apply();
    }

    function pulseStars() {
      $all('.nlm-nb-card[data-starred="1"]', grid).forEach(function (card) {
        card.classList.add("is-star-pulse");
        setTimeout(function () {
          card.classList.remove("is-star-pulse");
        }, 900);
      });
    }

    function runAutoplay() {
      if (autoRunning) return;
      autoRunning = true;
      filter = "all";
      folder = "all";
      setFilter("all");
      hideDemoCursor(root);
      $all('[data-action="hub-folder"]', root).forEach(function (b) {
        b.classList.toggle("is-active", (b.getAttribute("data-folder") || "all") === "all");
      });
      return sequence([
        300,
        function () {
          return moveCursorTo(search, { shell: root, click: false });
        },
        function () {
          return typeSearch("AI");
        },
        700,
        function () {
          return typeSearch("");
        },
        350,
        function () {
          var starredBtn = $('[data-action="hub-filter"][data-filter="starred"]', root);
          return moveCursorTo(starredBtn, { shell: root }).then(function () {
            setFilter("starred");
            pulseStars();
          });
        },
        1200,
        function () {
          var allBtn = $('[data-action="hub-filter"][data-filter="all"]', root);
          return moveCursorTo(allBtn, { shell: root }).then(function () {
            setFilter("all");
            hideDemoCursor(root);
            autoRunning = false;
          });
        },
      ]);
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "play-demo") {
        runAutoplay();
      } else if (action === "hub-filter") {
        setFilter(t.getAttribute("data-filter") || "all");
      } else if (action === "hub-folder") {
        folder = t.getAttribute("data-folder") || "all";
        $all('[data-action="hub-folder"]', root).forEach(function (b) {
          b.classList.toggle("is-active", b === t);
        });
        apply();
      }
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="play-demo"]');
      if (!t || !document.body.contains(root)) return;
      if (t.closest(".feature-demo-section") === root.closest(".feature-demo-section")) {
        runAutoplay();
      }
    });

    /* autoplay deferred to master-detail router */
  
    registerDemo("hub", { play: runAutoplay });
  }

  /* ---- Drive refresh ---- */
  function initDriveDemo(root) {
    var status = $("#drive-status", root);
    var autoRunning = false;

    function refreshRow(row) {
      if (!row || row.getAttribute("data-stale") !== "1") return Promise.resolve();
      row.classList.add("is-refreshing");
      var btn = $(".nlm-refresh-btn", row);
      if (btn) btn.classList.add("is-spinning");
      return new Promise(function (resolve) {
        setTimeout(function () {
          row.setAttribute("data-stale", "0");
          row.classList.remove("is-refreshing");
          if (btn) {
            btn.classList.remove("is-spinning");
            btn.style.visibility = "hidden";
          }
          var badge = $(".nlm-src-badge", row);
          if (badge) {
            badge.classList.add("is-updated");
            badge.textContent = "Updated";
            setTimeout(function () {
              badge.remove();
            }, prefersReducedMotion() ? 0 : 700);
          }
          var time = $(".drive-time", row);
          if (time) {
            time.classList.remove("stale");
            var label = time.textContent.split("Â·")[0].trim();
            time.textContent = label + " Â· Synced Â· just now";
          }
          resolve();
        }, prefersReducedMotion() ? 80 : 900);
      });
    }

    function restoreDemo() {
      var rows = $all(".drive-row", root);
      rows.forEach(function (row, idx) {
        if (idx > 1) return;
        row.setAttribute("data-stale", "1");
        row.classList.remove("is-refreshing");
        var btn = $(".nlm-refresh-btn", row);
        if (btn) {
          btn.style.visibility = "";
          btn.classList.remove("is-spinning");
        }
        var time = $(".drive-time", row);
        if (time && idx === 0) {
          time.classList.add("stale");
          time.textContent = "Google Doc Â· Updated on Drive Â· 2h ago";
        }
        if (time && idx === 1) {
          time.classList.add("stale");
          time.textContent = "Google Slides Â· Updated on Drive Â· yesterday";
        }
        if (!$(".nlm-src-badge", row)) {
          var badge = document.createElement("span");
          badge.className = "nlm-src-badge warn";
          badge.textContent = "Update available";
          var meta = $(".drive-meta", row);
          if (meta && meta.nextSibling) row.insertBefore(badge, meta.nextSibling);
          else row.appendChild(badge);
        } else {
          var b = $(".nlm-src-badge", row);
          b.className = "nlm-src-badge warn";
          b.textContent = "Update available";
        }
      });
      if (status) status.textContent = "";
    }

    function runRefreshAll() {
      var stale = $all('.drive-row[data-stale="1"]', root);
      if (!stale.length) {
        if (status) status.textContent = "All Drive sources are up to date";
        return Promise.resolve();
      }
      if (status) status.textContent = "Refreshing " + stale.length + " sourcesâ€¦";
      var chain = Promise.resolve();
      stale.forEach(function (row) {
        chain = chain.then(function () {
          return refreshRow(row);
        });
      });
      return chain.then(function () {
        if (status) status.textContent = "All Drive sources refreshed âœ“";
      });
    }

    function runAutoplay() {
      if (autoRunning) return;
      autoRunning = true;
      restoreDemo();
      hideDemoCursor(root);
      return sequence([
        500,
        function () {
          $all(".nlm-src-badge.warn", root).forEach(function (b) {
            b.classList.add("is-pulse");
          });
        },
        500,
        function () {
          var btn = $("#drive-refresh-all", root);
          return moveCursorTo(btn, { shell: root }).then(function () {
            if (btn) btn.classList.add("is-clicked");
            return runRefreshAll().then(function () {
              if (btn) btn.classList.remove("is-clicked");
              $all(".nlm-src-badge", root).forEach(function (b) {
                b.classList.remove("is-pulse");
              });
              hideDemoCursor(root);
              autoRunning = false;
            });
          });
        },
      ]);
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "play-demo") {
        runAutoplay();
      } else if (action === "drive-one") {
        var row = t.closest(".drive-row");
        if (status) status.textContent = "Refreshing sourceâ€¦";
        refreshRow(row).then(function () {
          if (status) status.textContent = "Source updated from Google Drive âœ“";
        });
      } else if (action === "drive-refresh") {
        t.disabled = true;
        runRefreshAll().then(function () {
          t.disabled = false;
        });
      }
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="play-demo"]');
      if (!t || !document.body.contains(root)) return;
      if (t.closest(".feature-demo-section") === root.closest(".feature-demo-section")) {
        runAutoplay();
      }
    });

    /* autoplay deferred to master-detail router */
  
    registerDemo("drive", { play: runAutoplay });
  }

  /* ---- Studio / podcast ---- */
  function initStudioDemo(root) {
    var progress = $("#studio-progress", root);
    var progressText = $("#studio-progress-text", root);
    var player = $("#podcast-player", root);
    var genBtn = $("#studio-gen", root);
    var resetBtn = $("#studio-reset", root);
    var playBtn = $('[data-action="podcast-toggle"]', root);
    var autoRunning = false;

    function reset() {
      if (progress) progress.setAttribute("hidden", "");
      if (player) {
        player.setAttribute("hidden", "");
        player.classList.remove("is-appearing");
      }
      if (resetBtn) resetBtn.setAttribute("hidden", "");
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.classList.remove("is-clicked");
        var cta2 = $(".studio-cta", genBtn);
        if (cta2) cta2.textContent = "Generate";
      }
      if (playBtn) {
        playBtn.classList.remove("is-playing");
        playBtn.textContent = "â–¶";
      }
      if (progress) progress.classList.remove("is-active");
    }

    function runGenerate() {
      if (genBtn) {
        genBtn.disabled = true;
        genBtn.classList.add("is-clicked");
      }
      if (progress) {
        progress.removeAttribute("hidden");
        progress.classList.add("is-active");
      }
      if (player) player.setAttribute("hidden", "");
      if (progressText) progressText.textContent = "Generating Audio Overviewâ€¦";
      return sequence([
        900,
        function () {
          if (progressText) progressText.textContent = "Mixing host dialogueâ€¦";
        },
        1100,
        function () {
          if (progress) {
            progress.setAttribute("hidden", "");
            progress.classList.remove("is-active");
          }
          if (player) {
            player.removeAttribute("hidden");
            player.classList.add("is-appearing");
          }
          if (resetBtn) resetBtn.removeAttribute("hidden");
          if (genBtn) {
            var cta = $(".studio-cta", genBtn);
            if (cta) cta.textContent = "Ready";
            genBtn.classList.remove("is-clicked");
          }
          if (playBtn) {
            playBtn.classList.add("is-playing");
            playBtn.textContent = "âšâš";
          }
        },
      ]);
    }

    function runAutoplay() {
      if (autoRunning) return;
      autoRunning = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        400,
        function () {
          return moveCursorTo(genBtn, { shell: root });
        },
        function () {
          return runGenerate();
        },
        250,
        function () {
          hideDemoCursor(root);
          autoRunning = false;
        },
      ]);
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");

      if (action === "play-demo") {
        runAutoplay();
      } else if (action === "studio-gen") {
        runGenerate();
      } else if (action === "podcast-toggle") {
        if (!playBtn) return;
        var playing = playBtn.classList.toggle("is-playing");
        playBtn.textContent = playing ? "âšâš" : "â–¶";
        playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
      } else if (action === "studio-reset") {
        reset();
      }
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="play-demo"]');
      if (!t || !document.body.contains(root)) return;
      if (t.closest(".feature-demo-section") === root.closest(".feature-demo-section")) {
        runAutoplay();
      }
    });

    /* autoplay deferred to master-detail router */
  
    registerDemo("studio", { play: runAutoplay });
  }

  /* ---- Prompts ---- */
  function initPromptsDemo(root) {
    var input = $("#prompt-input", root);
    var menu = $("#prompt-menu", root);
    var messages = $("#prompt-messages", root);
    var autoRunning = false;

    function showMenu(show) {
      if (!menu) return;
      if (show) menu.removeAttribute("hidden");
      else menu.setAttribute("hidden", "");
    }

    function insertPrompt(text) {
      if (!input) return;
      input.value = text;
      input.classList.add("has-chip");
      showMenu(false);
      input.focus();
    }

    function send() {
      if (!input || !messages) return;
      var text = input.value.trim();
      if (!text) return;
      var user = document.createElement("div");
      user.className = "nlm-msg user is-appearing";
      user.textContent = text;
      messages.appendChild(user);
      input.value = "";
      input.classList.remove("has-chip");
      showMenu(false);
      setTimeout(function () {
        var bot = document.createElement("div");
        bot.className = "nlm-msg bot is-appearing";
        bot.textContent =
          "Demo reply â€” in NotebookLM, this prompt would run against your sources with citations.";
        messages.appendChild(bot);
        messages.scrollTop = messages.scrollHeight;
      }, prefersReducedMotion() ? 40 : 450);
    }

    function clearMessagesExtra() {
      if (!messages) return;
      $all(".nlm-msg", messages).forEach(function (el, i) {
        if (i === 0) return;
        el.remove();
      });
      if (input) {
        input.value = "";
        input.classList.remove("has-chip");
      }
      showMenu(false);
    }

    function typeSlash() {
      if (!input) return Promise.resolve();
      if (prefersReducedMotion()) {
        input.value = "/";
        showMenu(true);
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        input.value = "";
        showMenu(false);
        setTimeout(function () {
          input.value = "/";
          input.classList.add("is-typing");
          showMenu(true);
          setTimeout(function () {
            input.classList.remove("is-typing");
            resolve();
          }, 400);
        }, 200);
      });
    }

    function runAutoplay() {
      if (autoRunning) return;
      autoRunning = true;
      clearMessagesExtra();
      hideDemoCursor(root);
      return sequence([
        300,
        function () {
          return moveCursorTo(input, { shell: root, click: false });
        },
        function () {
          return typeSlash();
        },
        500,
        function () {
          var item = $(".prompt-slash-item", menu);
          if (!item) return;
          return moveCursorTo(item, { shell: root }).then(function () {
            item.classList.add("is-highlight");
            insertPrompt(item.getAttribute("data-text") || "");
            setTimeout(function () {
              item.classList.remove("is-highlight");
            }, 500);
          });
        },
        500,
        function () {
          var sendBtn = $('[data-action="prompt-send"]', root);
          return moveCursorTo(sendBtn, { shell: root }).then(function () {
            send();
            hideDemoCursor(root);
            autoRunning = false;
          });
        },
      ]);
    }

    if (input) {
      input.addEventListener("input", function () {
        var v = input.value;
        showMenu(v === "/" || (v.indexOf("/") === 0 && v.length <= 12));
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          send();
        } else if (e.key === "Escape") {
          showMenu(false);
        }
      });
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      var text = t.getAttribute("data-text") || "";
      if (action === "play-demo") {
        runAutoplay();
      } else if (action === "insert-prompt" || action === "chip-prompt") {
        insertPrompt(text);
      } else if (action === "prompt-send") {
        send();
      }
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="play-demo"]');
      if (!t || !document.body.contains(root)) return;
      if (t.closest(".feature-demo-section") === root.closest(".feature-demo-section")) {
        runAutoplay();
      }
    });

    /* autoplay deferred to master-detail router */
  
    registerDemo("prompts", { play: runAutoplay });
  }

  
  /* ---- Master-detail Features router ---- */
  var FEATURE_META = {
    overview: {
      title: "Features â€“ NotebookTools for NotebookLM",
      description: "Explore NotebookTools features with interactive demos: YouTube, bulk import, notebooks hub, Drive refresh, Studio, prompts, webpage, X, highlights, chat export, slides-to-blog, and snapshots.",
      name: "Features",
      path: "/features",
      demo: null
    },
    "add-youtube": {
      title: "Add YouTube to NotebookLM â€“ NotebookTools",
      description: "Add YouTube videos to NotebookLM with one click. See the NotebookTools button on watch pages and watch the source appear in a NotebookLM-style Sources panel.",
      name: "Add YouTube",
      path: "/features/add-youtube",
      demo: "youtube"
    },
    "bulk-import": {
      title: "Bulk import queue â€“ NotebookTools",
      description: "Bulk import into NotebookLM: open tabs, YouTube playlists, paste URLs, or extract article links. Watch a progress queue fill sources into a notebook.",
      name: "Bulk import",
      path: "/features/bulk-import",
      demo: "bulk"
    },
    "notebooks-hub": {
      title: "Notebooks hub â€“ NotebookTools",
      description: "NotebookTools notebooks hub â€” a NotebookLM-style grid with folders, pin, favorites, search, and multi-select cleanup.",
      name: "Notebooks hub",
      path: "/features/notebooks-hub",
      demo: "hub"
    },
    "drive-refresh": {
      title: "Google Drive source refresh â€“ NotebookTools",
      description: "Refresh Google Drive sources in NotebookLM when Docs, Slides, Sheets, or PDFs change. NotebookTools shows Update available and re-syncs with one click.",
      name: "Drive refresh",
      path: "/features/drive-refresh",
      demo: "drive"
    },
    "studio-podcasts": {
      title: "Studio & podcasts â€“ NotebookTools",
      description: "NotebookLM Studio tools in NotebookTools â€” generate audio overviews, open artifacts, and play podcasts across notebooks in one player.",
      name: "Studio & podcasts",
      path: "/features/studio-podcasts",
      demo: "studio"
    },
    prompts: {
      title: "Prompt library â€“ NotebookTools",
      description: "NotebookLM prompt library from NotebookTools. Browse curated prompts and insert them with / slash commands in chat.",
      name: "Prompt library",
      path: "/features/prompts",
      demo: "prompts"
    },
    "add-webpage": {
      title: "Add webpage to NotebookLM — NotebookTools",
      description: "Add any webpage to NotebookLM from the NotebookTools side panel. One click imports the current tab URL as a source.",
      name: "Add webpage",
      path: "/features/add-webpage",
      demo: "webpage"
    },
    "x-twitter": {
      title: "Import X / Twitter to NotebookLM — NotebookTools",
      description: "Import X (Twitter) posts and threads into NotebookLM as clean text sources with the NotebookTools in-page button.",
      name: "X / Twitter",
      path: "/features/x-twitter",
      demo: "xtwitter"
    },
    "highlights": {
      title: "Highlight text to NotebookLM — NotebookTools",
      description: "Select text on any page, right-click, and add the highlight to NotebookLM as a text source with NotebookTools.",
      name: "Highlights",
      path: "/features/highlights",
      demo: "highlights"
    },
    "chat-export": {
      title: "Export NotebookLM chat — NotebookTools",
      description: "Export NotebookLM conversations from the page with NotebookTools. Download Markdown, plain text, or open a printable PDF view.",
      name: "Chat export",
      path: "/features/chat-export",
      demo: "chatexport"
    },
    "slides-to-blog": {
      title: "Slides / PPT deck to blog — NotebookTools",
      description: "Turn a NotebookLM Studio slide deck into a blog or guide with NotebookTools. Extract slide images, generate copy, and export Markdown, HTML, or Docs.",
      name: "Slides to blog",
      path: "/features/slides-to-blog",
      demo: "slidestoblog"
    },
    "snapshots": {
      title: "Snapshots & PDF capture — NotebookTools",
      description: "Capture webpage snapshots with NotebookTools, annotate them, and assemble PDF or guide exports for NotebookLM workflows.",
      name: "Snapshots",
      path: "/features/snapshots",
      demo: "snapshots"
    }
  };

  var demoControllers = {};
  var currentFeature = null;

  function setMeta(feature) {
    var meta = FEATURE_META[feature];
    if (!meta) return;
    document.title = meta.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", meta.description);
    var ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute("content", meta.title);
    var ogd = document.querySelector('meta[property="og:description"]');
    if (ogd) ogd.setAttribute("content", meta.description);
    var ogu = document.querySelector('meta[property="og:url"]');
    if (ogu) ogu.setAttribute("content", "https://www.notebooktools.com" + meta.path);
    var can = document.querySelector('link[rel="canonical"]');
    if (can) can.setAttribute("href", "https://www.notebooktools.com" + meta.path);
  }

  function updateBreadcrumb(feature) {
    var bc = $("#features-breadcrumb");
    if (!bc) return;
    if (feature === "overview") {
      bc.innerHTML =
        '<a href="/">Home</a>' +
        '<span class="feature-breadcrumb-sep" aria-hidden="true">/</span>' +
        '<span aria-current="page">Features</span>';
      return;
    }
    var meta = FEATURE_META[feature];
    var name = meta ? meta.name : feature;
    bc.innerHTML =
      '<a href="/">Home</a>' +
      '<span class="feature-breadcrumb-sep" aria-hidden="true">/</span>' +
      '<a href="/features">Features</a>' +
      '<span class="feature-breadcrumb-sep" aria-hidden="true">/</span>' +
      '<span aria-current="page" id="bc-current"></span>';
    var cur = $("#bc-current", bc);
    if (cur) cur.textContent = name;
  }

  function updateNav(feature) {
    $all("#features-nav .md-nav-item").forEach(function (el) {
      var slug = el.getAttribute("data-feature");
      var on = slug === feature;
      el.classList.toggle("is-active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    var sel = $("#md-feature-select");
    if (sel && sel.value !== feature) sel.value = feature;
  }

  function showPanel(feature) {
    $all(".md-panel").forEach(function (panel) {
      var match = panel.getAttribute("data-panel") === feature;
      panel.classList.toggle("is-active", match);
      if (match) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
  }

  function playActiveDemo(feature) {
    var meta = FEATURE_META[feature];
    if (!meta || !meta.demo) return;
    var ctrl = demoControllers[meta.demo];
    if (ctrl && typeof ctrl.play === "function") {
      setTimeout(function () {
        ctrl.play();
      }, 350);
    }
  }

  function selectFeature(feature, opts) {
    opts = opts || {};
    if (!FEATURE_META[feature]) feature = "overview";
    if (feature === currentFeature && !opts.force) return;
    currentFeature = feature;
    showPanel(feature);
    updateNav(feature);
    updateBreadcrumb(feature);
    setMeta(feature);
    document.body.setAttribute("data-initial-feature", feature);
    if (opts.push !== false) {
      var meta = FEATURE_META[feature];
      var url = meta.path;
      if (opts.replace) {
        history.replaceState({ feature: feature }, meta.title, url);
      } else {
        history.pushState({ feature: feature }, meta.title, url);
      }
    }
    if (opts.play !== false && feature !== "overview") {
      playActiveDemo(feature);
    }
    var detail = $("#features-detail");
    if (detail && opts.scroll !== false) {
      var top = detail.getBoundingClientRect().top + window.scrollY - 80;
      if (window.scrollY > top + 40 || opts.scroll === true) {
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    }
  }

  function pathToFeature() {
    var path = (location.pathname || "").replace(/\/+$/, "") || "/";
    if (path === "/features" || path === "/features/index" || path === "/features/index.html") {
      return "overview";
    }
    var m = path.match(/\/features\/([^/]+?)(?:\.html)?$/);
    if (m && FEATURE_META[m[1]]) return m[1];
    var initial = document.body.getAttribute("data-initial-feature");
    if (initial && FEATURE_META[initial]) return initial;
    return "overview";
  }

  function wireMasterDetail() {
    if (!$(".md-layout")) return;

    document.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-feature]");
      if (!nav) return;
      if (nav.tagName === "SELECT") return;
      var feature = nav.getAttribute("data-feature");
      if (!feature || !FEATURE_META[feature]) return;
      // Overview cards + sidebar + select-feature buttons
      if (
        nav.classList.contains("md-nav-item") ||
        nav.getAttribute("data-action") === "select-feature" ||
        nav.classList.contains("md-overview-card")
      ) {
        e.preventDefault();
        selectFeature(feature, { play: feature !== "overview" });
      }
    });

    var sel = $("#md-feature-select");
    if (sel) {
      sel.addEventListener("change", function () {
        selectFeature(sel.value, { play: sel.value !== "overview" });
      });
    }

    window.addEventListener("popstate", function (e) {
      var feature = (e.state && e.state.feature) || pathToFeature();
      selectFeature(feature, { push: false, play: true });
    });

    var initial = pathToFeature();
    selectFeature(initial, { replace: true, play: initial !== "overview", scroll: false });
  }

  function registerDemo(key, api) {
    demoControllers[key] = api;
  }



  /* ---- Webpage demo ---- */
  function initWebpageDemo(root) {
    var addBtn = $("#wp-add", root);
    var toast = $("#wp-toast", root);
    var running = false;
    function reset() {
      if (toast) toast.setAttribute("hidden", "");
      if (addBtn) addBtn.classList.remove("is-clicked");
    }
    function runAutoplay() {
      if (running) return;
      running = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        350,
        function () { return moveCursorTo(addBtn, { shell: root }); },
        function () {
          if (addBtn) addBtn.classList.add("is-clicked");
          if (toast) toast.removeAttribute("hidden");
        },
        1600,
        function () {
          hideDemoCursor(root);
          running = false;
        }
      ]);
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      if (t.getAttribute("data-action") === "wp-add") {
        if (addBtn) addBtn.classList.add("is-clicked");
        if (toast) toast.removeAttribute("hidden");
      }
    });
    registerDemo("webpage", { play: runAutoplay });
  }

  /* ---- X / Twitter demo ---- */
  function initXTwitterDemo(root) {
    var addBtn = $("#x-add-btn", root);
    var picker = $("#x-picker", root);
    var confirm = $("#x-confirm", root);
    var toast = $("#x-toast", root);
    var running = false;
    function reset() {
      if (picker) picker.setAttribute("hidden", "");
      if (toast) toast.setAttribute("hidden", "");
      if (addBtn) addBtn.classList.remove("is-clicked");
    }
    function runAutoplay() {
      if (running) return;
      running = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        350,
        function () { return moveCursorTo(addBtn, { shell: root }); },
        function () {
          if (addBtn) addBtn.classList.add("is-clicked");
          if (picker) picker.removeAttribute("hidden");
        },
        400,
        function () { return moveCursorTo(confirm, { shell: root }); },
        function () {
          if (picker) picker.setAttribute("hidden", "");
          if (toast) toast.removeAttribute("hidden");
        },
        1500,
        function () {
          hideDemoCursor(root);
          running = false;
        }
      ]);
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var a = t.getAttribute("data-action");
      if (a === "x-open") {
        if (picker) picker.removeAttribute("hidden");
      } else if (a === "x-confirm") {
        if (picker) picker.setAttribute("hidden", "");
        if (toast) toast.removeAttribute("hidden");
      }
    });
    registerDemo("xtwitter", { play: runAutoplay });
  }

  /* ---- Highlights demo ---- */
  function initHighlightsDemo(root) {
    var mark = $("#hl-mark", root);
    var menu = $("#hl-menu", root);
    var addBtn = $("#hl-add", root);
    var toast = $("#hl-toast", root);
    var running = false;
    function reset() {
      if (menu) menu.setAttribute("hidden", "");
      if (toast) toast.setAttribute("hidden", "");
      if (mark) mark.classList.add("is-selected");
    }
    function runAutoplay() {
      if (running) return;
      running = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        350,
        function () { return moveCursorTo(mark, { shell: root, click: true }); },
        function () { if (menu) menu.removeAttribute("hidden"); },
        400,
        function () { return moveCursorTo(addBtn, { shell: root }); },
        function () {
          if (menu) menu.setAttribute("hidden", "");
          if (toast) toast.removeAttribute("hidden");
        },
        1500,
        function () {
          hideDemoCursor(root);
          running = false;
        }
      ]);
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action], #hl-mark");
      if (!t) return;
      if (t.id === "hl-mark") {
        if (menu) menu.removeAttribute("hidden");
      } else if (t.getAttribute("data-action") === "hl-add") {
        if (menu) menu.setAttribute("hidden", "");
        if (toast) toast.removeAttribute("hidden");
      }
    });
    registerDemo("highlights", { play: runAutoplay });
  }

  /* ---- Chat export demo ---- */
  function initChatExportDemo(root) {
    var btn = $("#ce-btn", root);
    var menu = $("#ce-menu", root);
    var md = $("#ce-md", root);
    var toast = $("#ce-toast", root);
    var running = false;
    function reset() {
      if (menu) menu.setAttribute("hidden", "");
      if (toast) toast.setAttribute("hidden", "");
    }
    function runAutoplay() {
      if (running) return;
      running = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        350,
        function () { return moveCursorTo(btn, { shell: root }); },
        function () { if (menu) menu.removeAttribute("hidden"); },
        400,
        function () { return moveCursorTo(md, { shell: root }); },
        function () {
          if (menu) menu.setAttribute("hidden", "");
          if (toast) {
            toast.textContent = "Downloaded conversation.md ✓";
            toast.removeAttribute("hidden");
          }
        },
        1500,
        function () {
          hideDemoCursor(root);
          running = false;
        }
      ]);
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var a = t.getAttribute("data-action");
      if (a === "ce-open") {
        if (menu) menu.removeAttribute("hidden");
      } else if (a === "ce-format") {
        var fmt = t.getAttribute("data-fmt") || "md";
        if (menu) menu.setAttribute("hidden", "");
        if (toast) {
          toast.textContent =
            fmt === "pdf"
              ? "PDF view opened ✓"
              : "Downloaded conversation." + fmt + " ✓";
          toast.removeAttribute("hidden");
        }
      }
    });
    registerDemo("chatexport", { play: runAutoplay });
  }

  /* ---- Slides to blog demo ---- */
  function initSlidesToBlogDemo(root) {
    var btn = $("#sb-btn", root);
    var panel = $("#sb-panel", root);
    var build = $("#sb-build", root);
    var progress = $("#sb-progress", root);
    var fill = $("#sb-fill", root);
    var status = $("#sb-status", root);
    var dl = $("#sb-dl", root);
    var running = false;
    function reset() {
      if (panel) panel.setAttribute("hidden", "");
      if (progress) progress.setAttribute("hidden", "");
      if (status) status.setAttribute("hidden", "");
      if (dl) dl.setAttribute("hidden", "");
      if (fill) fill.style.width = "0%";
      if (build) build.disabled = false;
    }
    function runBuild() {
      if (progress) progress.removeAttribute("hidden");
      if (status) {
        status.textContent = "Extracting slide images…";
        status.removeAttribute("hidden");
      }
      if (fill) fill.style.width = "35%";
      return wait(prefersReducedMotion() ? 80 : 700).then(function () {
        if (status) status.textContent = "Assembling blog with deck images…";
        if (fill) fill.style.width = "75%";
        return wait(prefersReducedMotion() ? 80 : 700);
      }).then(function () {
        if (fill) fill.style.width = "100%";
        if (status) status.textContent = "Blog ready — download below";
        if (dl) dl.removeAttribute("hidden");
      });
    }
    function runAutoplay() {
      if (running) return;
      running = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        350,
        function () { return moveCursorTo(btn, { shell: root }); },
        function () { if (panel) panel.removeAttribute("hidden"); },
        400,
        function () { return moveCursorTo(build, { shell: root }); },
        function () {
          if (build) build.disabled = true;
          return runBuild();
        },
        800,
        function () {
          hideDemoCursor(root);
          running = false;
        }
      ]);
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var a = t.getAttribute("data-action");
      if (a === "sb-open") {
        if (panel) panel.removeAttribute("hidden");
      } else if (a === "sb-build") {
        runBuild();
      }
    });
    registerDemo("slidestoblog", { play: runAutoplay });
  }

  /* ---- Snapshots demo ---- */
  function initSnapshotsDemo(root) {
    var start = $("#snap-start", root);
    var marquee = $("#snap-marquee", root);
    var thumbs = $("#snap-thumbs", root);
    var empty = $("#snap-empty", root);
    var pdfBtn = $("#snap-pdf", root);
    var toast = $("#snap-toast", root);
    var running = false;
    var shotCount = 0;
    function reset() {
      shotCount = 0;
      if (marquee) marquee.setAttribute("hidden", "");
      if (toast) toast.setAttribute("hidden", "");
      if (pdfBtn) pdfBtn.setAttribute("hidden", "");
      if (empty) {
        empty.removeAttribute("hidden");
        empty.textContent = "No shots yet";
      }
      if (thumbs) {
        $all(".mock-snap-thumb", thumbs).forEach(function (el) { el.remove(); });
      }
    }
    function addThumb() {
      shotCount += 1;
      if (empty) empty.setAttribute("hidden", "");
      if (thumbs) {
        var t = document.createElement("div");
        t.className = "mock-snap-thumb is-appearing";
        t.textContent = "Shot " + shotCount;
        thumbs.appendChild(t);
      }
      if (pdfBtn) pdfBtn.removeAttribute("hidden");
    }
    function runAutoplay() {
      if (running) return;
      running = true;
      reset();
      hideDemoCursor(root);
      return sequence([
        350,
        function () { return moveCursorTo(start, { shell: root }); },
        function () {
          if (marquee) marquee.removeAttribute("hidden");
        },
        600,
        function () {
          if (marquee) marquee.setAttribute("hidden", "");
          addThumb();
        },
        400,
        function () { return moveCursorTo(pdfBtn, { shell: root }); },
        function () {
          if (toast) {
            toast.textContent = "PDF ready ✓";
            toast.removeAttribute("hidden");
          }
        },
        1400,
        function () {
          hideDemoCursor(root);
          running = false;
        }
      ]);
    }
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var a = t.getAttribute("data-action");
      if (a === "snap-start") {
        if (marquee) {
          marquee.removeAttribute("hidden");
          setTimeout(function () {
            marquee.setAttribute("hidden", "");
            addThumb();
          }, prefersReducedMotion() ? 40 : 500);
        } else addThumb();
      } else if (a === "snap-pdf") {
        if (toast) {
          toast.textContent = "PDF ready ✓";
          toast.removeAttribute("hidden");
        }
      }
    });
    registerDemo("snapshots", { play: runAutoplay });
  }

function boot() {
    var yt = $('[data-demo="youtube"]');
    if (yt) initYoutubeDemo(yt);
    var bulk = $('[data-demo="bulk"]');
    if (bulk) initBulkDemo(bulk);
    var hub = $('[data-demo="hub"]');
    if (hub) initHubDemo(hub);
    var drive = $('[data-demo="drive"]');
    if (drive) initDriveDemo(drive);
    var studio = $('[data-demo="studio"]');
    if (studio) initStudioDemo(studio);
    var prompts = $('[data-demo="prompts"]');
    if (prompts) initPromptsDemo(prompts);
    var webpage = $('[data-demo="webpage"]');
    if (webpage) initWebpageDemo(webpage);
    var xtwitter = $('[data-demo="xtwitter"]');
    if (xtwitter) initXTwitterDemo(xtwitter);
    var highlights = $('[data-demo="highlights"]');
    if (highlights) initHighlightsDemo(highlights);
    var chatexport = $('[data-demo="chatexport"]');
    if (chatexport) initChatExportDemo(chatexport);
    var slidestoblog = $('[data-demo="slidestoblog"]');
    if (slidestoblog) initSlidesToBlogDemo(slidestoblog);
    var snapshots = $('[data-demo="snapshots"]');
    if (snapshots) initSnapshotsDemo(snapshots);

    if ($(".md-layout")) {
      wireMasterDetail();
    } else {
      // Legacy single-feature pages: autoplay once
      Object.keys(demoControllers).forEach(function (k) {
        if (demoControllers[k] && demoControllers[k].play) {
          setTimeout(demoControllers[k].play, 800);
        }
      });
    }
  }


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

