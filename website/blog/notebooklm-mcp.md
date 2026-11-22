# NotebookLM MCP Server and API: What Works in 2026

> There is no official consumer NotebookLM API or MCP server. Google offers an API only for NotebookLM Enterprise; community MCP servers are unofficial and risky.
> Source: https://www.notebooktools.com/blog/notebooklm-mcp

![NotebookLM MCP server and API: what works in 2026](https://www.notebooktools.com/assets/blog/notebooklm-mcp.webp)

Short answer

**Consumer NotebookLM has no official public API and no official MCP server.** Google documents an API only for **NotebookLM Enterprise**, which runs in a Google Cloud project with per-user licenses. The NotebookLM MCP servers you find on GitHub are **unofficial community projects** that drive your logged-in browser or reuse your Google session cookies, so they can break without notice and may not fit Google’s terms.

post-cta

A safer way to move NotebookLM answers into Claude

Imports are free. Pro ($49 one-time, lifetime) unlocks the notebooks dashboard, source manager (duplicate scan, Drive refresh), Studio files, blog and carousel makers, snapshots, a prompt library with / commands, and chat export to PDF/Word.

[Add to Chrome, free](https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj) [Export NotebookLM chats to PDF or Word →](https://www.notebooktools.com/features/chat-export)

/post-cta

## What is MCP, in one paragraph

MCP (Model Context Protocol) is an open standard that Anthropic introduced in November 2024. It lets an AI assistant such as Claude call outside tools through small programs called *MCP servers*. A server exposes actions (“search this notebook”, “add this source”) and the assistant decides when to use them. Claude Desktop, Claude Code and a growing list of other clients can connect to MCP servers.

So a “NotebookLM MCP server” is a program that sits between Claude and NotebookLM (now Gemini Notebook). Claude sends it a request, the server talks to NotebookLM, and the answer comes back into your Claude chat. The hard part is the middle step: how the server reaches NotebookLM at all.

## Is there a NotebookLM API?

It depends on which NotebookLM you use.

|  | Consumer NotebookLM | NotebookLM Enterprise |
|---|---|---|
| Who it is for | Personal Google accounts and most Workspace accounts | Organizations on Google Cloud |
| Official API | **No** public API | **Yes**, documented by Google Cloud |
| How you sign in | Your Google account in the browser | Google Cloud credentials and IAM roles |
| What you need | A Google account | A Cloud project, NotebookLM Enterprise licenses, the right IAM role |
| Official MCP server | None | None from Google that we could confirm |

Google’s Cloud documentation has a page called [“Create and manage notebooks (API)”](https://cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks) for NotebookLM Enterprise. It covers creating and managing notebooks with REST calls authenticated through Google Cloud. If your company already pays for NotebookLM Enterprise, that API is the supported route, and anything you build on it (including your own MCP server) rests on documented ground.

The free NotebookLM at notebooklm.google.com, and the versions included with Google AI Plus, Pro and Ultra, have no public API. Everything that automates them works by imitating a person using the website.

## Community NotebookLM MCP servers

Several open-source projects on GitHub call themselves NotebookLM MCP servers. None of them are made or endorsed by Google. Two well-known examples, as of November 2026:

- **[PleasePrompto/notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp)** (TypeScript). It drives a real Chrome browser: you log in to Google once in a visible window and it reuses that browser profile to ask your notebooks questions and return cited answers. Its README now says the project is **archived and no longer maintained**, and that it may stop working when NotebookLM changes.
- **[jacob-bd/notebooklm-mcp](https://github.com/jacob-bd/notebooklm-mcp)** (Python). It ships a command-line tool and an MCP server. It signs in by extracting your Google session cookies from a browser profile and calls NotebookLM’s internal web endpoints. Its own disclaimer says those endpoints are undocumented, may change without notice, and that the tool may not be aligned with Google’s Terms of Service.

Other forks and smaller projects exist, and new ones appear often. Most follow one of the same two patterns: **browser automation** or **reused session cookies**. We do not list install commands here because they change between versions. If you decide to try one, follow the current README of the exact repository and read its open issues first.

## Risks of unofficial NotebookLM MCP servers

Before you connect Claude to your notebooks this way, weigh these points:

- **It is unofficial.** Google does not support these tools. If something goes wrong, there is no help desk.
- **It uses your Google session.** A browser profile or a cookie file that is signed in to your Google account can often reach more than NotebookLM. Anyone who gets that file may be able to act as you. Use a separate Google account if you experiment.
- **It can break at any time.** NotebookLM’s web app changes often. A redesign, a new sign-in check or a renamed button can stop a server overnight. One of the best-known projects is already archived.
- **Google’s terms.** Automated access to Google services outside official APIs may conflict with Google’s Terms of Service. Read them yourself, and do not use these tools on a work account without your IT team’s approval.
- **Usage limits still apply.** Since September 2026, NotebookLM chat and Studio use is measured with limits that refresh every few hours up to a weekly cap. An agent that fires many questions can use up your allowance quickly.
- **Data flows to two AI services.** Answers from your notebooks pass into Claude’s context. Check that you are allowed to share that material with both providers. Our [NotebookLM privacy guide](https://www.notebooktools.com/blog/notebooklm-privacy) covers the Google side.

## A safer workflow: NotebookLM and Claude without an MCP server

For most people the goal is simple: use NotebookLM’s source-grounded answers inside a Claude conversation. You can do that without handing a third-party tool your Google login.

1. **Build the notebook in NotebookLM.** Add your PDFs, Google Docs, web pages and YouTube videos. Free accounts get 50 sources per notebook; see [NotebookLM source limits](https://www.notebooktools.com/blog/notebooklm-source-limits).
2. **Ask NotebookLM the grounded questions.** Let it do what it is good at: answers with citations to your own sources. Our [NotebookLM prompts guide](https://www.notebooktools.com/blog/best-notebooklm-prompts) has starting points.
3. **Export the answers.** Copy the replies, save them as notes, or use the [NotebookTools chat export to PDF or Word](https://www.notebooktools.com/features/chat-export) to save the whole conversation with its formatting.
4. **Give the export to Claude.** Attach the PDF or Word file to a Claude chat or project. Claude can now rewrite, compare or plan from it, and you control exactly what it sees.
5. **Keep shared sources in Google Drive.** If both tools need the same raw documents, keep them in Drive. Add them to NotebookLM as Drive sources and upload the same files to Claude when needed.
6. **Use the Enterprise API if your company has it.** Teams that need real automation should ask IT about NotebookLM Enterprise and its documented API rather than cookie-based tools.

This takes a few more clicks than an MCP server, but nothing breaks when NotebookLM updates, and your Google session never leaves your browser.

## When an unofficial MCP server might still make sense

If you are a developer experimenting on a personal, throwaway Google account with non-sensitive sources, a community server can be a useful way to see how agent workflows feel. Treat it as a prototype. Pin a specific version, keep the cookie or profile files private, and expect to fix it when NotebookLM changes. For anything you depend on, use the official Enterprise API or the export workflow above.

## FAQ

### Does NotebookLM have an API?

Consumer NotebookLM (the free version and the one included with Google AI plans) has no public API. Google documents an API only for NotebookLM Enterprise, which runs in a Google Cloud project with licensed users.

### Is there an official NotebookLM MCP server?

No. We found no MCP server made by Google for NotebookLM. The NotebookLM MCP servers on GitHub are community projects that automate the website or reuse your Google session cookies.

### Can Claude use NotebookLM?

Not directly through an official connection. You can use an unofficial MCP server at your own risk, or export NotebookLM answers to PDF or Word and attach them to a Claude chat.

### Are NotebookLM MCP servers safe?

They carry real risks. They need access to your signed-in Google session, they can break whenever NotebookLM changes, and their own authors warn they may not fit Google's terms. Use a separate account and non-sensitive sources if you try one.

### Does the Gemini Notebook rename change API access?

No. Gemini Notebook is the new name for NotebookLM. The consumer product still has no public API, and the Enterprise API is still the official route for organizations.

![NotebookTools](https://www.notebooktools.com/assets/logo-wordmark-sm.png)

## Import to NotebookLM in one click

Free Chrome extension. Import YouTube, webpages, X posts, and highlights into your notebooks.

- YouTube watch-page button
- Right-click any highlight
- Works with your Google sign-in

[![Available in the Chrome Web Store](https://www.notebooktools.com/assets/chrome-web-store-badge.png)](https://chromewebstore.google.com/detail/notebooktools-%E2%80%94-import-to/fhjgbniefbimnklnnomlhkkiekcjddmj)

Free · No extra account
