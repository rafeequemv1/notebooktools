#!/usr/bin/env node
// Capture the extension's real screens for the website's feature demos, so the
// demos show exactly the app's UI (same markup, same CSS), not a redrawing.
//
//   node scripts/capture-app-ui.js
//
// Opens the extension in Chromium with sample notebooks, renders each screen,
// and writes website/features/app/: app.css (the extension's CSS, scoped to a
// shadow root), screens.js (each screen's markup) and the images they use.
// Run it again whenever the extension's UI changes.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXT = path.join(__dirname, '..', 'notebooktools-extension');
const OUT = path.join(__dirname, '..', 'website', 'features', 'app');
const NOTEBOOKS = [
  { id: 'nb1', title: 'Research — AI tools', sourceCount: 12 },
  { id: 'nb2', title: 'Thesis — chapter 3', sourceCount: 31 },
  { id: 'nb3', title: 'Product launch 2026', sourceCount: 18 },
  { id: 'nb4', title: 'Reading list', sourceCount: 7 },
];
const LINKS = [
  'https://en.wikipedia.org/wiki/Retrieval-augmented_generation',
  'https://www.youtube.com/watch?v=Qv3jF0sXc2Y',
  'https://blog.langchain.dev/evaluating-rag-pipelines/',
  'https://www.youtube.com/watch?v=8nX2kq1ZpQc',
  'https://www.pinecone.io/learn/chunking-strategies/',
];

// Each screen: page, optional setup in the page, and the root to keep
const SCREENS = [
  { name: 'popup-web', url: 'sidepanel.html?popup=1', root: '.sidepanel-app', width: 380,
    setup: () => { document.querySelector('#sourcePreview').textContent = 'The state of AI research assistants'; } },
  { name: 'popup-text', url: 'sidepanel.html?popup=1&mode=text', root: '.sidepanel-app', width: 380 },
  { name: 'popup-bulk', url: 'sidepanel.html?popup=1&panel=bulk', root: '.sidepanel-app', width: 380,
    setup: async (links) => {
      const area = document.querySelector('#bulkImportRoot textarea');
      area.value = links.join('\n');
      area.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.bulk-paste-add')?.click();
      await new Promise((r) => setTimeout(r, 400));
      area.value = '';
    } },
  { name: 'panel-chat', url: 'platform-import.html?platform=chatgpt', root: '.nt-panel', width: 300,
    setup: () => {
      document.querySelector('#sourceTitle').textContent = '[CHATGPT] RAG evaluation methods';
      document.querySelector('#sourcePreview').textContent = '6 segments · chatgpt.com/c/6a1f2b9e';
    } },
  { name: 'panel-x', url: 'platform-import.html?platform=x', root: '.nt-panel', width: 300,
    setup: () => {
      document.querySelector('#sourceTitle').textContent = '[X] Thread: five papers that changed RAG';
      document.querySelector('#sourcePreview').textContent = '4 segments · x.com/mayabuilds/status/1834201977';
    } },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  await sw.evaluate(() => Promise.all([
    chrome.storage.local.set({ notebooktoolsAuthSession: { user: { id: 'demo', email: 'maya@example.com' }, accessToken: 'x', expiresAt: Date.now() + 3600e3 }, notebooktoolsAuthProfile: { plan: 'pro', checkedAt: Date.now() }, lastNotebookId: 'nb1' }),
    chrome.storage.session.set({ pendingTextImport: { text: 'Retrieval-augmented generation lets a model look things up before it answers, so replies stay grounded in your own sources.', title: 'Retrieval-augmented generation — Wikipedia', url: 'https://en.wikipedia.org/wiki/Retrieval-augmented_generation' } }),
  ]));
  // Sample notebooks instead of the real NotebookLM account
  await ctx.addInitScript((notebooks) => {
    let client;
    Object.defineProperty(window, 'NotebookToolsNotebookLM', {
      configurable: true,
      get: () => client,
      set: (value) => {
        client = value;
        client.listNotebookLmNotebooks = async () => notebooks.map((n) => ({ ...n }));
      },
    });
  }, NOTEBOOKS);

  const screens = {};
  for (const s of SCREENS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: s.width, height: 900 });
    await page.goto(`chrome-extension://${id}/${s.url}`);
    await page.waitForTimeout(1500);
    if (s.setup) await page.evaluate(s.setup, LINKS);
    await page.evaluate((notebooks) => {
      // a signed-in sample account, and the sample notebooks in every picker
      const email = document.querySelector('.sp-gacct-btn-email');
      if (email) email.textContent = 'maya@example.com';
      const avatar = document.querySelector('.sp-gacct-avatar');
      if (avatar) { avatar.textContent = 'M'; avatar.classList.remove('is-empty'); }
      document.querySelectorAll('select#notebookLmSelect').forEach((select) => {
        if (select.options.length > 2) return;
        select.innerHTML = notebooks.map((n) => `<option value="${n.id}">${n.title} (${n.sourceCount})</option>`).join('');
        select.value = notebooks[0].id;
      });
      const titles = ['Retrieval-augmented generation', 'Introducing NotebookLM Video Overviews', 'Evaluating RAG pipelines', 'Long-context vs RAG — talk', 'Chunking strategies that work'];
      document.querySelectorAll('.bulk-queue-name').forEach((n, i) => { if (titles[i]) n.textContent = titles[i]; });
    }, NOTEBOOKS);
    await page.waitForTimeout(500);
    const html = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      // the demo shows the result of one action: no live status, nothing focused
      root.querySelectorAll('.status').forEach((e) => { e.className = 'status'; e.textContent = ''; });
      return { html: root.outerHTML, bodyClass: document.body.className, theme: document.documentElement.dataset.theme || '' };
    }, s.root);
    html.html = html.html
      .replace(/src="(?:\.\/)?(logo\.png|icons\/[\w.-]+\.png)"/g, (_, f) => `src="/features/app/${path.basename(f)}"`)
      ;
    screens[s.name] = { html: html.html, bodyClass: html.bodyClass };
    console.log(s.name, html.html.length, 'chars');
    await page.close();
  }
  await ctx.close();

  // The extension's CSS, scoped to the demo's shadow root
  const css = ['shared.css', 'bulk-import.css', 'snapshots.css']
    .map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(EXT, f), 'utf8'))
    .join('\n')
    .replace(/:root\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
    .replace(/:root/g, ':host')
    .replace(/(^|[\s,}])html(\.[\w-]+)?\s+body\b/g, '$1.app-body')
    .replace(/(^|[\s,}])body\.sidepanel-body\b/g, '$1.sidepanel-body')
    .replace(/(^|[\s,}])(html|body)(?=[\s,{.:\[])/g, '$1.app-body');
  fs.writeFileSync(path.join(OUT, "app.css"), `@charset "UTF-8";\n/* Generated by scripts/capture-app-ui.js from the extension's CSS. Do not edit. */\n${css}`);
  fs.writeFileSync(path.join(OUT, 'screens.js'), `/* Generated by scripts/capture-app-ui.js: the extension's real screens. Do not edit. */\nwindow.NTAppScreens = ${JSON.stringify(screens, null, 1).replace(/[\u0080-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))};\n`);
  for (const f of ['logo.png', 'icons/icon16.png', 'icons/icon48.png']) if (fs.existsSync(path.join(EXT, f))) fs.copyFileSync(path.join(EXT, f), path.join(OUT, path.basename(f)));
  console.log('wrote', OUT);
})();
