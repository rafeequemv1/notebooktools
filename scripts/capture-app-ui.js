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
  { name: 'hub-sources', url: 'notebooks.html?notebook=nb1&tab=sources&title=Research', root: 'body', width: 1240, wait: 2500 },
  { name: 'hub-manage', url: 'notebooks.html?notebook=nb1&tab=sources&title=Research', root: 'body', width: 1240, wait: 2500,
    setup: async () => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^Manage$/.test(b.textContent.trim()) && b.offsetParent);
      btn?.click();
      await new Promise((r) => setTimeout(r, 800));
    } },
  { name: 'hub-drive', url: 'notebooks.html?notebook=nb3&tab=sources&title=Product%20launch%202026', root: 'body', width: 1240, wait: 3500 },
  { name: 'hub-podcast', url: 'notebooks.html', root: 'body', width: 1240, wait: 2500,
    setup: async () => {
      document.querySelector('[data-app-tab="podcast"]')?.click();
      await new Promise((r) => setTimeout(r, 600));
      const scan = [...document.querySelectorAll('button')].find((b) => /scan/i.test(b.textContent) && b.offsetParent);
      scan?.click();
      await new Promise((r) => setTimeout(r, 2500));
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
        const SOURCES = {
          nb1: [
            { id: 's1', title: 'RAG survey 2026', typeCode: 3, type: 'PDF', url: 'https://arxiv.org/abs/2601.04411' },
            { id: 's2', title: 'Lost in the Middle', typeCode: 3, type: 'PDF', url: 'https://arxiv.org/abs/2307.03172' },
            { id: 's3', title: 'RAGAS: automated evaluation', typeCode: 3, type: 'PDF', url: 'https://arxiv.org/abs/2309.15217' },
            { id: 's4', title: 'Long-context vs RAG — talk', typeCode: 9, type: 'YouTube', url: 'https://www.youtube.com/watch?v=8nX2kq1ZpQc' },
            { id: 's5', title: 'Evaluating retrieval systems', typeCode: 5, type: 'Web', url: 'https://blog.langchain.dev/evaluating-rag' },
            { id: 's6', title: 'Chunking strategies that work', typeCode: 5, type: 'Web', url: 'https://www.pinecone.io/learn/chunking-strategies/' },
          ],
          nb3: [
            { id: 'd1', title: 'Q3 roadmap', typeCode: 1, type: 'Doc', url: 'https://docs.google.com/document/d/q3-roadmap' },
            { id: 'd2', title: 'Launch deck', typeCode: 2, type: 'Slides', url: 'https://docs.google.com/presentation/d/launch' },
            { id: 'd3', title: 'Budget sheet', typeCode: 14, type: 'Sheets', url: 'https://docs.google.com/spreadsheets/d/budget' },
            { id: 'd4', title: 'Meeting notes — 2 Sept', typeCode: 4, type: 'Text', url: '' },
            { id: 'd5', title: 'Vendor contract', typeCode: 3, type: 'PDF', url: 'https://drive.google.com/file/d/vendor/view' },
          ],
        };
        const STALE = new Set(['d1', 'd2']);
        const PODCASTS = {
          nb1: [{ id: 'a1', title: 'Deep dive: how RAG is evaluated', duration: 1104 }],
          nb2: [{ id: 'a2', title: 'Chapter 3 in fifteen minutes', duration: 902 }],
          nb3: [{ id: 'a3', title: 'Launch plan, explained', duration: 735 }],
          nb4: [{ id: 'a4', title: 'This week in AI research', duration: 1288 }],
        };
        client.listNotebookLmNotebooks = async () => notebooks.map((n) => ({ ...n }));
        client.listNotebookLmSources = async (id) => (SOURCES[id] || []).map((x) => ({ ...x, createdAt: Date.now() - 86400e3 }));
        client.listNotebookLmLabels = async () => [];
        client.listNotebookLmNotes = async () => [];
        client.checkNotebookLmSourceFreshness = async (_nb, sourceId) => (STALE.has(sourceId) ? 'stale' : 'fresh');
        client.listNotebookLmArtifacts = async (id) => (PODCASTS[id] || []).map((a) => ({ ...a, typeCode: 1, type: 'Audio Overview', status: 'ready', mediaUrl: 'https://example.com/a.mp4', createdAt: Date.now() - 3600e3 }))
          .concat(id === 'nb2' ? [{ id: 'fc2', title: 'Cell division flashcards', typeCode: 4, type: 'Quiz', status: 'ready' }, { id: 'qz2', title: 'Chapter 3 quiz', typeCode: 4, type: 'Quiz', status: 'ready' }] : []);
        // a flashcard deck and a quiz, as NotebookLM's interactive pages carry them
        const appData = (o) => JSON.stringify(o).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        client.getNotebookLmArtifactHtml = async (_nb, aid) => `<div data-app-data="${appData(aid === 'fc2'
          ? { flashcards: Array.from({ length: 24 }, (_, i) => ({ f: `Card ${i + 1}`, b: 'Answer' })) }
          : { quiz: Array.from({ length: 12 }, (_, i) => ({ question: `Question ${i + 1}`, answerOptions: [{ text: 'A', isCorrect: true }, { text: 'B' }] })) })}"></div>`;
      },
    });
  }, NOTEBOOKS);

  const screens = {};
  for (const s of SCREENS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: s.width, height: 900 });
    await page.goto(`chrome-extension://${id}/${s.url}`);
    await page.waitForTimeout(s.wait || 1500);
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
      // the whole page (dialogs are appended to <body>), without its scripts
      const html = sel === 'body'
        ? [...root.children].filter((n) => !['SCRIPT', 'NOSCRIPT', 'TEMPLATE'].includes(n.tagName)).map((n) => n.outerHTML).join('')
        : root.outerHTML;
      return { html, bodyClass: document.body.className, theme: document.documentElement.dataset.theme || '' };
    }, s.root);
    html.html = html.html
      .replace(/src="(?:\.\/)?(logo\.png|icons\/[\w.-]+\.png)"/g, (_, f) => `src="/features/app/${path.basename(f)}"`)
      ;
    screens[s.name] = { html: html.html, bodyClass: html.bodyClass };
    console.log(s.name, html.html.length, 'chars');
    await page.close();
  }
  // The flashcards & quizzes export dialog (study-export.js), on a quiz
  {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(`chrome-extension://${id}/notebooks.html`);
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.NotebookToolsStudyExport.open({ notebookId: 'nb2', notebookTitle: 'Biology 101 — Chapter 3', select: 'qz2' }));
    await page.waitForSelector('.nse [data-format="kahoot"]', { timeout: 8000 });
    // the card count of the other set, as after reading it once
    await page.click('.nse [data-set="fc2"]'); await page.waitForSelector('.nse [data-format="anki"]');
    screens['study-export-cards'] = { html: await page.evaluate(() => `<div class="nse">${document.querySelector('.nse .nse-dialog').outerHTML}</div>`), bodyClass: '' };
    await page.click('.nse [data-set="qz2"]'); await page.waitForSelector('.nse [data-format="kahoot"]');
    screens['study-export'] = { html: await page.evaluate(() => `<div class="nse">${document.querySelector('.nse .nse-dialog').outerHTML}</div>`), bodyClass: '' };
    console.log('study export', screens['study-export'].html.length, 'chars');
    await page.close();
  }

  // The in-notebook ribbon and its menus, on a stand-in NotebookLM page
  const NLM_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Product launch 2026 - NotebookLM</title><style>body{margin:0;background:#f8fafd;font-family:Arial,sans-serif}.row{display:flex;gap:16px;padding:0 16px 16px;height:600px}.p{background:#fff;border-radius:16px;flex:1}.c{flex:2;display:flex;flex-direction:column;justify-content:flex-end;padding:16px}textarea{width:100%;height:56px}</style></head><body><header style="height:64px"></header><div class="row"><section class="p">Sources</section><section class="p c"><textarea aria-label="Query box" placeholder="Start typing..."></textarea></section><section class="p">Studio</section></div></body></html>`;
  await ctx.route('https://notebooklm.google.com/**', (r) => (r.request().url().includes('/notebook/') ? r.fulfill({ contentType: 'text/html', body: NLM_PAGE }) : r.fulfill({ status: 500, body: '' })));
  await sw.evaluate(() => chrome.storage.local.set({ notebooktoolsOrganize: undefined }));
  const nlm = await ctx.newPage();
  await nlm.setViewportSize({ width: 1240, height: 760 });
  await nlm.goto('https://notebooklm.google.com/notebook/5a17c0de-demo');
  await nlm.waitForTimeout(3500);
  console.log('ribbon present:', await nlm.evaluate(() => !!document.getElementById('notebooktools-ribbon')), nlm.url());
  await nlm.waitForTimeout(800);
  const grab = (sel) => nlm.evaluate((q) => document.querySelector(q)?.outerHTML || '', sel);
  screens['nlm-ribbon'] = { html: await grab('#notebooktools-ribbon'), bodyClass: '' };
  for (const [name, action, value] of [['nlm-menu-create', 'create'], ['nlm-menu-prompts', 'prompts'], ['nlm-menu-export', 'export'], ['nlm-menu-folder', 'folder']]) {
    await nlm.click(`#notebooktools-ribbon [data-ntr="${action}"]`);
    await nlm.waitForTimeout(400);
    screens[name] = { html: await grab('.ntr-menu'), bodyClass: '' };
    await nlm.keyboard.press('Escape');
    await nlm.mouse.click(5, 700);
    await nlm.waitForTimeout(200);
  }
  console.log('nlm ribbon', screens['nlm-ribbon'].html.length, 'chars');

  // The prompt queue panel: ready, running and finished, on a stand-in chat that answers
  const QPAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Product launch 2026 - NotebookLM</title><style>body{margin:0;background:#fff;font-family:Arial}.panel{display:flex;flex-direction:column;height:calc(100vh - 64px)}chat-panel{flex:1;overflow:auto;padding:20px}.query-box{display:flex;gap:8px;padding:12px}.query-box textarea{flex:1}</style></head><body><header style="height:64px"><h1>Product launch 2026</h1></header><div class="panel"><chat-panel><div class="chat-panel-content"></div></chat-panel><form class="query-box" onsubmit="return false"><textarea aria-label="Query box" placeholder="Start typing..."></textarea><button type="submit" aria-label="Send">Send</button></form></div>
<script>const log=document.querySelector('.chat-panel-content'),ta=document.querySelector('textarea');let busy=false;document.querySelector('form').addEventListener('submit',()=>{const q=ta.value.trim();if(!q||busy)return;busy=true;ta.value='';const u=document.createElement('div');u.className='from-user-container';u.textContent=q;log.append(u);const a=document.createElement('div');a.className='to-user-container';log.append(a);setTimeout(()=>{a.textContent='A complete answer to: '+q+' It covers the main points, with citations to the sources.';busy=false;},1200);});</script></body></html>`;
  await ctx.route('https://notebooklm.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: QPAGE }));
  await sw.evaluate(() => chrome.storage.local.remove('notebooktoolsPromptQueue:queue-demo'));
  const qp = await ctx.newPage();
  await qp.setViewportSize({ width: 1240, height: 860 });
  await qp.goto('https://notebooklm.google.com/notebook/queue-demo');
  await qp.waitForSelector('#notebooktools-ribbon [data-ntr="queue"]', { timeout: 15000 });
  await qp.click('#notebooktools-ribbon [data-ntr="queue"]');
  await qp.waitForSelector('#notebooktools-prompt-queue .ntq-input');
  await qp.fill('#notebooktools-prompt-queue .ntq-input', 'Summarize every source in five bullets, with citations.\nWhat are the three biggest risks to the launch?\nDraft a one-page FAQ for the sales team.\nTurn the timeline into a table: date, milestone, owner.');
  await qp.click('#notebooktools-prompt-queue [data-q="add-lines"]');
  await qp.selectOption('#notebooktools-prompt-queue select[data-q="delay"]', '3');
  await qp.mouse.move(5, 5);
  await qp.waitForTimeout(300);
  const qgrab = () => qp.evaluate(() => { const n = document.querySelector('#notebooktools-prompt-queue').cloneNode(true); n.removeAttribute('id'); return n.outerHTML; });
  screens['nlm-queue'] = { html: await qgrab(), bodyClass: '' };
  await qp.click('#notebooktools-prompt-queue [data-q="start"]');
  await qp.waitForFunction(() => document.querySelector('#notebooktools-prompt-queue .ntq-item.is-answering'), null, { timeout: 20000 });
  screens['nlm-queue-run'] = { html: await qgrab(), bodyClass: '' };
  await qp.waitForFunction(() => /Finished/.test(document.querySelector('#notebooktools-prompt-queue .ntq-note')?.textContent || ''), null, { timeout: 120000 });
  screens['nlm-queue-done'] = { html: await qgrab(), bodyClass: '' };
  console.log('prompt queue', screens['nlm-queue'].html.length, screens['nlm-queue-run'].html.length, screens['nlm-queue-done'].html.length, 'chars');
  await sw.evaluate(() => chrome.storage.local.remove('notebooktoolsPromptQueue:queue-demo'));
  await ctx.close();

  // The extension's CSS, scoped to the demo's shadow root
  const css = ['shared.css', 'bulk-import.css', 'snapshots.css', 'notebooks.css', 'prompt-library.css', 'notebooklm-ribbon.css', 'notebooklm-prompt-queue.css', 'study-export.css']
    .map((f) => `/* ${f} */\n` + fs.readFileSync(path.join(EXT, f), 'utf8'))
    .join('\n')
    .replace(/:root\[data-theme="dark"\]/g, ':host([data-theme="dark"])')
    .replace(/:root/g, ':host')
    .replace(/(^|[\s,}])html(\.[\w-]+)?\s+body\b/g, '$1.app-body')
    .replace(/(^|[\s,}])body\.sidepanel-body\b/g, '$1.sidepanel-body')
    .replace(/(^|[\s,}])(html|body)(?=[\s,{.:\[])/g, '$1.app-body');
  fs.writeFileSync(path.join(OUT, "app.css"), `@charset "UTF-8";\n/* Generated by scripts/capture-app-ui.js from the extension's CSS. Do not edit. */\n${css}`);
  // in-page screens point at the extension's own files: serve copies from the site
  for (const sc of Object.values(screens)) sc.html = sc.html.replace(/chrome-extension:\/\/[a-z]+\/(?:icons\/)?([\w.-]+\.png)/g, '/features/app/$1');
  fs.writeFileSync(path.join(OUT, 'screens.js'), `/* Generated by scripts/capture-app-ui.js: the extension's real screens. Do not edit. */\nwindow.NTAppScreens = ${JSON.stringify(screens, null, 1).replace(/[\u0080-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))};\n`);
  for (const f of ['logo.png', 'icons/icon16.png', 'icons/icon48.png']) if (fs.existsSync(path.join(EXT, f))) fs.copyFileSync(path.join(EXT, f), path.join(OUT, path.basename(f)));
  console.log('wrote', OUT);
})();
