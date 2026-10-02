(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
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
    var selectedName = "NotebookLM notes";

    function showPicker(show) {
      if (!picker) return;
      if (show) picker.removeAttribute("hidden");
      else picker.setAttribute("hidden", "");
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");

      if (action === "open-picker") {
        showPicker(true);
      } else if (action === "close-picker") {
        showPicker(false);
      } else if (action === "pick-nb") {
        $all(".demo-nb-item", root).forEach(function (el) {
          el.classList.toggle("is-selected", el === t);
        });
        selectedName = t.getAttribute("data-name") || selectedName;
      } else if (action === "confirm-add") {
        showPicker(false);
        if (watch) watch.setAttribute("hidden", "");
        if (notebook) {
          notebook.removeAttribute("hidden");
          notebook.classList.add("is-active");
        }
        if (titleEl) titleEl.textContent = selectedName;
        if (newSrc) {
          newSrc.setAttribute("hidden", "");
          setTimeout(function () {
            newSrc.removeAttribute("hidden");
            if (countEl) countEl.textContent = "3 sources";
            if (toast) {
              toast.textContent = "Added to " + selectedName + " ✓";
              toast.removeAttribute("hidden");
              setTimeout(function () {
                toast.setAttribute("hidden", "");
              }, 2200);
            }
          }, 350);
        }
      } else if (action === "reset-yt") {
        if (notebook) {
          notebook.setAttribute("hidden", "");
          notebook.classList.remove("is-active");
        }
        if (watch) {
          watch.removeAttribute("hidden");
          watch.classList.add("is-active");
        }
        if (newSrc) newSrc.setAttribute("hidden", "");
        if (countEl) countEl.textContent = "2 sources";
        if (toast) toast.setAttribute("hidden", "");
        showPicker(false);
      }
    });
  }

  /* ---- Bulk demo ---- */
  function initBulkDemo(root) {
    var fill = $("#bulk-fill", root);
    var text = $("#bulk-text", root);
    var list = $("#bulk-list", root);
    var nlm = $("#bulk-nlm-sources", root);
    var startBtn = $("#bulk-start", root);
    var resetBtn = $("#bulk-reset", root);
    var running = false;

    function reset() {
      running = false;
      if (fill) fill.style.width = "0%";
      if (text) text.textContent = "5 selected · ready";
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

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "bulk-reset") {
        reset();
        return;
      }
      if (action !== "bulk-start" || running) return;
      running = true;
      if (startBtn) startBtn.disabled = true;
      var items = $all(".bulk-item", root).filter(function (item) {
        var cb = $("input[type=checkbox]", item);
        return cb && cb.checked;
      });
      var total = items.length || 1;
      var i = 0;

      function step() {
        if (i >= items.length) {
          if (text) text.textContent = items.length + " imported · done";
          if (fill) fill.style.width = "100%";
          if (resetBtn) resetBtn.removeAttribute("hidden");
          running = false;
          return;
        }
        var item = items[i];
        item.classList.add("is-running");
        var st = $(".bulk-status", item);
        if (st) st.textContent = "Importing…";
        if (text) text.textContent = "Importing " + (i + 1) + " of " + items.length + "…";
        if (fill) fill.style.width = Math.round(((i + 0.5) / total) * 100) + "%";

        setTimeout(function () {
          item.classList.remove("is-running");
          item.classList.add("is-done");
          if (st) st.textContent = "Added ✓";
          if (nlm) {
            var label = item.querySelector("label");
            var name = label ? label.textContent.replace(/^\s*/, "").trim() : "Source";
            name = name.replace(/\s+/g, " ");
            if (name.length > 36) name = name.slice(0, 34) + "…";
            var li = document.createElement("li");
            li.className = "nlm-source nlm-source-new bulk-added";
            li.innerHTML =
              '<span class="nlm-src-icon nlm-src-web">+</span><span class="nlm-src-name"></span><span class="nlm-src-badge">New</span>';
            li.querySelector(".nlm-src-name").textContent = name;
            nlm.appendChild(li);
          }
          if (fill) fill.style.width = Math.round(((i + 1) / total) * 100) + "%";
          i += 1;
          setTimeout(step, 280);
        }, 520);
      }
      step();
    });
  }

  /* ---- Hub demo ---- */
  function initHubDemo(root) {
    var grid = $("#hub-grid", root);
    var search = $("#hub-search", root);
    var hint = $("#hub-hint", root);
    var filter = "all";
    var folder = "all";

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
            ? "No notebooks match — try clearing search"
            : visible + " notebook" + (visible === 1 ? "" : "s") + " · demo only";
      }
    }

    if (search) search.addEventListener("input", apply);

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "hub-filter") {
        filter = t.getAttribute("data-filter") || "all";
        $all('[data-action="hub-filter"]', root).forEach(function (b) {
          b.classList.toggle("soft", b !== t);
          if (b === t) b.classList.remove("soft");
          else b.classList.add("soft");
        });
        // Ensure clicked is "active" style: remove soft from selected
        t.classList.remove("soft");
        apply();
      } else if (action === "hub-folder") {
        folder = t.getAttribute("data-folder") || "all";
        $all('[data-action="hub-folder"]', root).forEach(function (b) {
          b.classList.toggle("is-active", b === t);
        });
        apply();
      }
    });
  }

  /* ---- Drive refresh ---- */
  function initDriveDemo(root) {
    var status = $("#drive-status", root);

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
          if (badge) badge.remove();
          var time = $(".drive-time", row);
          if (time) {
            time.classList.remove("stale");
            var label = time.textContent.split("·")[0].trim();
            time.textContent = label + " · Synced · just now";
          }
          resolve();
        }, 900);
      });
    }

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");
      if (action === "drive-one") {
        var row = t.closest(".drive-row");
        if (status) status.textContent = "Refreshing source…";
        refreshRow(row).then(function () {
          if (status) status.textContent = "Source updated from Google Drive ✓";
        });
      } else if (action === "drive-refresh") {
        var stale = $all('.drive-row[data-stale="1"]', root);
        if (!stale.length) {
          if (status) status.textContent = "All Drive sources are up to date";
          return;
        }
        if (status) status.textContent = "Refreshing " + stale.length + " sources…";
        t.disabled = true;
        var chain = Promise.resolve();
        stale.forEach(function (row) {
          chain = chain.then(function () {
            return refreshRow(row);
          });
        });
        chain.then(function () {
          t.disabled = false;
          if (status) status.textContent = "All Drive sources refreshed ✓";
        });
      }
    });
  }

  /* ---- Studio / podcast ---- */
  function initStudioDemo(root) {
    var progress = $("#studio-progress", root);
    var progressText = $("#studio-progress-text", root);
    var player = $("#podcast-player", root);
    var genBtn = $("#studio-gen", root);
    var resetBtn = $("#studio-reset", root);
    var playBtn = $('[data-action="podcast-toggle"]', root);

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      var action = t.getAttribute("data-action");

      if (action === "studio-gen") {
        if (genBtn) genBtn.disabled = true;
        if (progress) progress.removeAttribute("hidden");
        if (player) player.setAttribute("hidden", "");
        if (progressText) progressText.textContent = "Generating Audio Overview…";
        setTimeout(function () {
          if (progressText) progressText.textContent = "Mixing host dialogue…";
        }, 900);
        setTimeout(function () {
          if (progress) progress.setAttribute("hidden", "");
          if (player) player.removeAttribute("hidden");
          if (resetBtn) resetBtn.removeAttribute("hidden");
          if (genBtn) {
            var cta = $(".studio-cta", genBtn);
            if (cta) cta.textContent = "Ready";
          }
        }, 2200);
      } else if (action === "podcast-toggle") {
        if (!playBtn) return;
        var playing = playBtn.classList.toggle("is-playing");
        playBtn.textContent = playing ? "❚❚" : "▶";
        playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
      } else if (action === "studio-reset") {
        if (progress) progress.setAttribute("hidden", "");
        if (player) player.setAttribute("hidden", "");
        if (resetBtn) resetBtn.setAttribute("hidden", "");
        if (genBtn) {
          genBtn.disabled = false;
          var cta2 = $(".studio-cta", genBtn);
          if (cta2) cta2.textContent = "Generate";
        }
        if (playBtn) {
          playBtn.classList.remove("is-playing");
          playBtn.textContent = "▶";
        }
      }
    });
  }

  /* ---- Prompts ---- */
  function initPromptsDemo(root) {
    var input = $("#prompt-input", root);
    var menu = $("#prompt-menu", root);
    var messages = $("#prompt-messages", root);

    function showMenu(show) {
      if (!menu) return;
      if (show) menu.removeAttribute("hidden");
      else menu.setAttribute("hidden", "");
    }

    function insertPrompt(text) {
      if (!input) return;
      input.value = text;
      showMenu(false);
      input.focus();
    }

    function send() {
      if (!input || !messages) return;
      var text = input.value.trim();
      if (!text) return;
      var user = document.createElement("div");
      user.className = "nlm-msg user";
      user.textContent = text;
      messages.appendChild(user);
      input.value = "";
      showMenu(false);
      setTimeout(function () {
        var bot = document.createElement("div");
        bot.className = "nlm-msg bot";
        bot.textContent =
          "Demo reply — in NotebookLM, this prompt would run against your sources with citations.";
        messages.appendChild(bot);
        messages.scrollTop = messages.scrollHeight;
      }, 450);
    }

    if (input) {
      input.addEventListener("input", function () {
        var v = input.value;
        showMenu(v === "/" || v.indexOf("/") === 0 && v.length <= 12);
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
      if (action === "insert-prompt" || action === "chip-prompt") {
        insertPrompt(text);
      } else if (action === "prompt-send") {
        send();
      }
    });
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
