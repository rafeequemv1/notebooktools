/* Link list cleaner: pull every link out of pasted text or HTML, tidy it,
   remove duplicates and tracking, and count it against NotebookLM limits. */
(() => {
  const { $, esc, fmt, copy, download } = window.NTTools;
  const FREE_LIMIT = 50;
  const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|si|feature)$/i;

  const input = $("#llcInput");
  const output = $("#llcOutput");
  const stats = $("#llcStats");
  const note = $("#llcNote");

  function youtubeId(url) {
    if (/(^|\.)youtu\.be$/i.test(url.hostname)) return url.pathname.slice(1).split("/")[0];
    if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const m = url.pathname.match(/^\/(shorts|live|embed)\/([^/?#]+)/);
      if (m) return m[2];
    }
    return "";
  }

  function clean(raw, opts) {
    // Trim trailing punctuation; keep a ")" only when it closes a "(" in the
    // link itself, as in Wikipedia URLs like .../Neural_network_(machine_learning).
    let text = raw;
    for (;;) {
      const trimmed = text.replace(/[\]}>.,;:!?'"’”]+$/, "");
      if (trimmed.endsWith(")") && (trimmed.match(/\(/g) || []).length < (trimmed.match(/\)/g) || []).length) {
        text = trimmed.slice(0, -1);
        continue;
      }
      text = trimmed;
      break;
    }
    if (/^www\./i.test(text)) text = `https://${text}`;
    let url;
    try {
      url = new URL(text);
    } catch (_error) {
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) return null;
    const yt = youtubeId(url);
    if (yt) {
      const list = url.searchParams.get("list");
      return { href: `https://www.youtube.com/watch?v=${yt}`, kind: "YouTube", playlist: list || "" };
    }
    if (/(^|\.)youtube\.com$/i.test(url.hostname) && url.pathname === "/playlist" && url.searchParams.get("list")) {
      return { href: `https://www.youtube.com/playlist?list=${url.searchParams.get("list")}`, kind: "Playlist" };
    }
    if (opts.tracking) {
      [...url.searchParams.keys()].forEach((key) => TRACKING.test(key) && url.searchParams.delete(key));
    }
    url.hash = opts.anchors ? "" : url.hash;
    return { href: url.toString().replace(/\?$/, ""), kind: "Web" };
  }

  function run() {
    const opts = {
      tracking: $("#llcTracking").checked,
      anchors: $("#llcAnchors").checked,
      only: $("#llcOnly").value
    };
    const found = input.value.match(/(?:https?:\/\/|www\.)[^\s"'<>]+/gi) || [];
    const seen = new Set();
    const links = [];
    let dupes = 0;
    for (const raw of found) {
      const item = clean(raw, opts);
      if (!item) continue;
      if (opts.only === "youtube" && item.kind === "Web") continue;
      if (opts.only === "web" && item.kind !== "Web") continue;
      const key = item.href.toLowerCase().replace(/\/$/, "");
      if (seen.has(key)) {
        dupes += 1;
        continue;
      }
      seen.add(key);
      links.push(item);
    }
    output.value = links.map((l) => l.href).join("\n");
    const yt = links.filter((l) => l.kind !== "Web").length;
    stats.textContent = links.length
      ? `${fmt(links.length)} link${links.length === 1 ? "" : "s"} · ${fmt(yt)} YouTube · ${fmt(dupes)} duplicate${dupes === 1 ? "" : "s"} removed`
      : "";
    $("#llcCopy").disabled = !links.length;
    $("#llcDownload").disabled = !links.length;

    if (!links.length) {
      note.hidden = true;
    } else if (links.length > FREE_LIMIT) {
      const notebooks = Math.ceil(links.length / FREE_LIMIT);
      note.className = "tool-note is-warn";
      note.innerHTML = `That's more than the ${FREE_LIMIT} sources a notebook holds on NotebookLM's free plan. Split it across ${notebooks} notebooks, or use a Google AI plan (up to 300 sources per notebook on Pro).`;
      note.hidden = false;
    } else {
      note.className = "tool-note";
      note.innerHTML = `Fits in one notebook: ${fmt(links.length)} of ${FREE_LIMIT} sources on the free plan. Each link becomes one source.`;
      note.hidden = false;
    }
  }

  input.addEventListener("input", run);
  ["#llcTracking", "#llcAnchors", "#llcOnly"].forEach((s) => $(s).addEventListener("change", run));
  $("#llcCopy").addEventListener("click", (e) => copy(output.value, e.currentTarget));
  $("#llcDownload").addEventListener("click", () => download("links-for-notebooklm.txt", output.value + "\n"));
  $("#llcSample").addEventListener("click", () => {
    input.value = `Reading list for week 3 (from Slack)
Lecture: https://youtu.be/aircAruvnKk?si=x1y2 and the follow-up https://www.youtube.com/watch?v=aircAruvnKk
Paper summary: https://en.wikipedia.org/wiki/Neural_network_(machine_learning)?utm_source=newsletter&utm_medium=email
<a href="https://www.nature.com/articles/nature14539#Abs1">Deep learning (Nature)</a>
www.3blue1brown.com/topics/neural-networks.
Duplicate: https://en.wikipedia.org/wiki/Neural_network_(machine_learning)`;
    run();
  });
  run();
})();
