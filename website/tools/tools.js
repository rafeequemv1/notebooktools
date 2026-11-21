/* Shared helpers for the free tools. Everything runs in the browser. */
window.NTTools = (() => {
  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function words(text) {
    const m = String(text || "").trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (button) {
      const label = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = label), 1400);
    }
  }

  function download(filename, text, type = "text/plain") {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  return { $, esc, words, fmt, copy, download, readFile };
})();
