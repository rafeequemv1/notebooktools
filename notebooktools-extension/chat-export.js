const NotebookToolsChatExport = (() => {
  function safeFilename(value, extension) {
    const base = String(value || "conversation")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "conversation";

    return `${base}.${extension}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeCsv(value) {
    const text = String(value || "").replace(/"/g, '""');
    return `"${text}"`;
  }

  function getMessages(payload) {
    if (Array.isArray(payload?.messages) && payload.messages.length) {
      return payload.messages;
    }

    return String(payload?.plainText || "")
      .split(/\n\n---\n\n/)
      .map((block) => {
        const parts = block.split(/\n\n/);
        const role = parts.shift() || "Message";
        return { role, body: parts.join("\n\n") };
      })
      .filter((message) => message.body);
  }

  function roleClass(role) {
    const value = String(role || "").toLowerCase();

    if (value === "user" || value === "you" || value.includes("author")) {
      return "is-user";
    }

    if (value === "assistant" || value === "gemini" || value === "chatgpt" || value === "notebooklm") {
      return "is-assistant";
    }

    return "is-neutral";
  }

  function buildJson(payload) {
    return JSON.stringify(
      {
        title: payload.title,
        platform: payload.platform,
        url: payload.url,
        exportedAt: payload.exportedAt || new Date().toISOString(),
        messageCount: getMessages(payload).length,
        messages: getMessages(payload)
      },
      null,
      2
    );
  }

  function buildCsv(payload) {
    const rows = [["index", "role", "body"]];

    getMessages(payload).forEach((message, index) => {
      rows.push([String(index + 1), message.role, message.body]);
    });

    return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  }

  function buildHtml(payload, { printMode = false } = {}) {
    const messages = getMessages(payload);
    const exportedAt = payload.exportedAt || new Date().toISOString();
    const title = escapeHtml(payload.title || "Conversation");
    const sourceUrl = escapeHtml(payload.url || "");
    const platform = payload.platform === "notebooklm"
      ? "NotebookLM"
      : escapeHtml((payload.platform || "chat").toUpperCase());

    const messageHtml = messages
      .map((message) => {
        const role = escapeHtml(message.role || "Message");
        const body = escapeHtml(message.body || "").replace(/\n/g, "<br>");

        return `
          <article class="message ${roleClass(message.role)}">
            <header class="message-role">${role}</header>
            <div class="message-body">${body}</div>
          </article>
        `;
      })
      .join("");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root {
        --ink: #1a1a1a;
        --muted: #5f6368;
        --line: #e6e8eb;
        --paper: #ffffff;
        --user-bg: #f1f5ff;
        --user-line: #d7e3ff;
        --assistant-bg: #f7f7f8;
        --assistant-line: #e8eaed;
        --accent: #1a73e8;
      }

      * { box-sizing: border-box; }

      body {
        background: ${printMode ? "#fff" : "#f3f4f6"};
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
        line-height: 1.55;
        margin: 0;
        padding: ${printMode ? "0" : "32px 16px"};
      }

      .page {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: ${printMode ? "0" : "14px"};
        box-shadow: ${printMode ? "none" : "0 10px 30px rgba(0, 0, 0, 0.06)"};
        margin: 0 auto;
        max-width: 760px;
        padding: 40px 44px;
      }

      .brand {
        color: var(--muted);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        margin-bottom: 18px;
        text-transform: uppercase;
      }

      h1 {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.2;
        margin: 0 0 10px;
      }

      .meta {
        border-bottom: 1px solid var(--line);
        color: var(--muted);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.6;
        margin-bottom: 28px;
        padding-bottom: 18px;
      }

      .meta a {
        color: var(--accent);
        text-decoration: none;
        word-break: break-all;
      }

      .messages {
        display: grid;
        gap: 18px;
      }

      .message {
        border: 1px solid var(--line);
        border-radius: 12px;
        overflow: hidden;
        page-break-inside: avoid;
      }

      .message.is-user {
        background: var(--user-bg);
        border-color: var(--user-line);
      }

      .message.is-assistant {
        background: var(--assistant-bg);
        border-color: var(--assistant-line);
      }

      .message-role {
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        color: var(--muted);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        padding: 10px 14px;
        text-transform: uppercase;
      }

      .message-body {
        font-size: 15px;
        padding: 14px 16px 16px;
        white-space: pre-wrap;
      }

      .footer {
        color: var(--muted);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        margin-top: 28px;
        text-align: center;
      }

      @media print {
        body {
          background: #fff;
          padding: 0;
        }

        .page {
          border: 0;
          box-shadow: none;
          max-width: none;
          padding: 24px 28px;
        }

        .no-print {
          display: none !important;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="brand">NotebookTools export · ${platform}</div>
      <h1>${title}</h1>
      <div class="meta">
        <div>Source: <a href="${sourceUrl}">${sourceUrl}</a></div>
        <div>Exported: ${escapeHtml(new Date(exportedAt).toLocaleString())}</div>
        <div>Messages: ${messages.length}</div>
      </div>
      <section class="messages">
        ${messageHtml}
      </section>
      <p class="footer">Exported with NotebookTools</p>
    </main>
    ${
      printMode
        ? `<div class="no-print" style="position:fixed;inset:12px auto auto 12px;z-index:10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <button onclick="window.print()" style="background:#1a73e8;border:0;border-radius:999px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;padding:10px 16px;">Save as PDF</button>
    </div>
    <script>
      window.addEventListener("load", () => {
        window.setTimeout(() => window.print(), 500);
      });
    </script>`
        : ""
    }
  </body>
</html>`;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadText(filename, content, mimeType) {
    downloadBlob(filename, new Blob([content], { type: mimeType }));
  }

  async function openPrintTab(html) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      const tab = await chrome.tabs.create({ url, active: true });
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return tab;
    }

    const popup = window.open(url, "_blank");

    if (!popup) {
      URL.revokeObjectURL(url);
      throw new Error("Pop-up blocked. Allow pop-ups to export PDF.");
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return popup;
  }

  const FORMATS = {
    markdown: {
      label: "Markdown",
      extension: "md",
      mimeType: "text/markdown;charset=utf-8",
      build: (payload) => payload.markdown || payload.plainText || ""
    },
    text: {
      label: "Plain text",
      extension: "txt",
      mimeType: "text/plain;charset=utf-8",
      build: (payload) => payload.plainText || ""
    },
    json: {
      label: "JSON",
      extension: "json",
      mimeType: "application/json;charset=utf-8",
      build: buildJson
    },
    csv: {
      label: "CSV",
      extension: "csv",
      mimeType: "text/csv;charset=utf-8",
      build: buildCsv
    },
    html: {
      label: "HTML",
      extension: "html",
      mimeType: "text/html;charset=utf-8",
      build: (payload) => buildHtml(payload, { printMode: false })
    },
    pdf: {
      label: "PDF",
      extension: "pdf",
      mimeType: "application/pdf",
      async build(payload) {
        return buildHtml(payload, { printMode: true });
      },
      async export(payload) {
        const html = buildHtml(payload, { printMode: true });
        await openPrintTab(html);
        return { openedPrintDialog: true };
      }
    }
  };

  function listFormats() {
    return Object.entries(FORMATS).map(([id, format]) => ({
      id,
      label: format.label,
      extension: format.extension
    }));
  }

  async function exportConversation(payload, formatId) {
    if (!payload?.plainText && !payload?.messages?.length) {
      throw new Error("Nothing to export.");
    }

    const format = FORMATS[formatId];

    if (!format) {
      throw new Error("Unsupported export format.");
    }

    if (format.export) {
      return format.export(payload);
    }

    const content = await format.build(payload);
    const filename = safeFilename(payload.title, format.extension);
    downloadText(filename, content, format.mimeType);
    return { filename };
  }

  return {
    buildHtml,
    exportConversation,
    listFormats,
    safeFilename
  };
})();

if (typeof window !== "undefined") {
  window.NotebookToolsChatExport = NotebookToolsChatExport;
}
