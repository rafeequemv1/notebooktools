#!/usr/bin/env node
// Render the homepage's product shots from the extension's real UI.
//
//   node scripts/capture-app-ui.js      (first, whenever the extension's UI changes)
//   node scripts/home-shots/render.js
//
// The YouTube shot is the extension itself on a stand-in YouTube watch page
// (its own button and notebook picker). The hero, chat export, notebooks hub
// and podcast shots are the screens captured by capture-app-ui.js, placed in
// the Chrome window the feature demos use (shots.html). Writes website/assets/.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SITE = path.join(ROOT, 'website');
const EXT = path.join(ROOT, 'notebooktools-extension');
const ASSETS = path.join(SITE, 'assets');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'home-shots-'));
const NOTEBOOKS = [
  { id: 'nb1', title: 'Research — AI tools', sourceCount: 12 },
  { id: 'nb2', title: 'Thesis — chapter 3', sourceCount: 31 },
  { id: 'nb3', title: 'Product launch 2026', sourceCount: 18 },
  { id: 'nb4', title: 'Reading list', sourceCount: 7 },
];

// A fuller account for the notebooks hub shot
const HUB_NOTEBOOKS = [
  { id: 'h1', title: 'Thesis — chapter 3', sourceCount: 31 },
  { id: 'h2', title: 'Research — AI tools', sourceCount: 12 },
  { id: 'h3', title: 'Product launch 2026', sourceCount: 18 },
  { id: 'h4', title: 'Exam prep — biology', sourceCount: 24 },
  { id: 'h5', title: 'History seminar', sourceCount: 9 },
  { id: 'h6', title: 'Competitor briefs', sourceCount: 15 },
  { id: 'h7', title: 'Reading list', sourceCount: 7 },
  { id: 'h8', title: 'Podcast ideas', sourceCount: 5 },
];
const HUB_STATE = {
  folders: ['Research', 'Study', 'Work'],
  assignments: { h1: 'Research', h2: 'Research', h4: 'Study', h5: 'Study', h3: 'Work', h6: 'Work' },
  tags: ['thesis', 'exam', 'planning', 'reading'],
  tagAssignments: { h1: ['thesis'], h2: ['thesis', 'reading'], h4: ['exam'], h5: ['exam'], h3: ['planning'], h6: ['planning'], h7: ['reading'] },
  pinned: ['h1'],
  favorites: ['h3', 'h4'],
  folderColors: {},
};

const YT_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>How Gemini Notebook Video Overviews work - YouTube</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#fff;font-family:Roboto,Arial,sans-serif;color:#0f0f0f}
.top{height:56px;display:flex;align-items:center;gap:16px;padding:0 16px}
.top img{height:20px}.search{flex:0 1 560px;margin:0 auto;height:38px;border:1px solid #d3d3d3;border-radius:40px;display:flex;align-items:center;padding:0 16px;color:#888;font-size:15px}
.av{width:32px;height:32px;border-radius:50%;background:#c9d6ea}
#columns{display:flex;gap:24px;padding:16px 24px 0}#primary{flex:1;min-width:0}#secondary{width:380px}
.player{aspect-ratio:16/9;border-radius:12px;background:radial-gradient(ellipse at 30% 35%,#3a4a6b,#0f1420 70%);display:grid;place-items:center}
.player b{width:68px;height:48px;border-radius:14px;background:rgba(0,0,0,.65);display:grid;place-items:center}
.player b::after{content:"";border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent;margin-left:4px}
h1.ytd-watch-metadata{font-size:20px;font-weight:700;margin:12px 0 8px;line-height:28px}
#top-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
#owner{display:flex;align-items:center;gap:12px}#owner .ch{display:grid}#owner .ch b{font-size:16px}#owner .ch span{font-size:12px;color:#606060}
.sub{background:#0f0f0f;color:#fff;border:0;border-radius:18px;height:36px;padding:0 16px;font:500 14px Roboto,Arial}
#actions{display:flex}#top-level-buttons-computed{display:flex;gap:8px;align-items:center}
yt-button-view-model button,.pill{background:#f2f2f2;border:0;border-radius:18px;height:36px;padding:0 16px;font:500 14px Roboto,Arial;color:#0f0f0f}
#description{background:#f2f2f2;border-radius:12px;padding:12px;margin-top:12px;font-size:14px;line-height:20px}
.rel{display:flex;gap:8px;margin-bottom:10px}.rel i{width:168px;height:94px;border-radius:8px;background:linear-gradient(135deg,#c9d3e3,#e6ebf3);flex:none}
.rel b{font-size:14px;line-height:20px;display:block}.rel span{font-size:12px;color:#606060}
</style></head><body><ytd-app><div class="top"><span style="width:24px"></span><span style="display:flex;align-items:center;gap:4px;font:700 19px/1 Roboto,Arial;letter-spacing:-.04em"><img src="https://shots.local/assets/youtube-logo.svg" alt="" style="height:24px">YouTube</span><div class="search">Search</div><span class="av"></span></div>
<ytd-watch-flexy><div id="columns"><div id="primary"><div id="primary-inner"><div class="player"><b></b></div>
<ytd-watch-metadata><div id="title"><h1 class="ytd-watch-metadata">How Gemini Notebook Video Overviews work</h1></div>
<div id="top-row"><div id="owner"><span class="av" style="width:40px;height:40px"></span><span class="ch"><b>Google</b><span>12.4M subscribers</span></span><button class="sub">Subscribe</button></div>
<div id="actions"><ytd-menu-renderer><div id="top-level-buttons-computed"><yt-button-view-model><button>👍 18K</button></yt-button-view-model><yt-button-view-model><button>Share</button></yt-button-view-model></div></ytd-menu-renderer><span class="pill" style="display:grid;place-items:center;margin-left:8px">···</span></div></div>
<div id="description"><b>1.2M views · 3 months ago</b><br>Turn your sources into narrated video explainers with Video Overviews in Gemini Notebook.</div></ytd-watch-metadata>
</div></div><div id="secondary">
<div class="rel"><i></i><span><b>How Audio Overviews are made</b><span>Google · 820K views</span></span></div>
<div class="rel"><i></i><span><b>Gemini Notebook for students: full walkthrough</b><span>Study Lab · 410K views</span></span></div>
<div class="rel"><i></i><span><b>Long-context vs RAG explained</b><span>AI Explained · 1.2M views</span></span></div>
<div class="rel"><i></i><span><b>Organize 100 notebooks in 10 minutes</b><span>Notes Daily · 96K views</span></span></div>
</div></div></ytd-watch-flexy></ytd-app></body></html>`;

const type = (f) => ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' })[path.extname(f)] || 'application/octet-stream';
function serveSite(ctx) {
  return ctx.route('https://shots.local/**', (r) => {
    const p = decodeURIComponent(new URL(r.request().url()).pathname);
    if (p === '/shots.html') return r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, 'shots.html')) });
    if (p === '/__hub.png') return r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(TMP, 'hub-page.png')) });
    if (p === '/__yt.png') return r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(TMP, 'yt.png')) });
    const f = path.join(SITE, p);
    if (!f.startsWith(SITE) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: type(f), body: fs.readFileSync(f) });
  });
}

async function extensionShots() {
  const ctx = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 1240, height: 952 }, deviceScaleFactor: 2 });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  await sw.evaluate((state) => chrome.storage.local.set({ notebooktoolsAuthSession: { user: { id: 'demo', email: 'maya@example.com' }, accessToken: 'x', expiresAt: Date.now() + 3600e3 }, notebooktoolsAuthProfile: { plan: 'pro', checkedAt: Date.now() }, lastNotebookId: 'nb1', notebooktoolsNotebookFolders: state, notebooktoolsNotebooksView: 'grid' }), HUB_STATE);
  await ctx.addInitScript(([notebooks, hub]) => {
    let client;
    Object.defineProperty(window, 'NotebookToolsNotebookLM', { configurable: true, get: () => client, set: (v) => {
      client = v;
      const list = location.pathname.endsWith('/notebooks.html') ? hub : notebooks;
      client.listNotebookLmNotebooks = async () => list.map((n) => ({ ...n }));
      client.listNotebookLmSources = async () => [];
      client.listNotebookLmLabels = async () => [];
      client.listNotebookLmNotes = async () => [];
      client.listNotebookLmArtifacts = async () => [];
    } });
  }, [NOTEBOOKS, HUB_NOTEBOOKS]);
  // The notebooks hub, in card view
  const hub = await ctx.newPage();
  await hub.setViewportSize({ width: 1240, height: 668 });
  await hub.goto(`chrome-extension://${id}/notebooks.html`);
  await hub.waitForTimeout(3500);
  await hub.mouse.move(5, 5);
  await hub.screenshot({ path: path.join(TMP, 'hub-page.png') });
  await hub.close();
  await serveSite(ctx);
  await ctx.route('https://www.youtube.com/**', (r) => (r.request().url().includes('/watch') ? r.fulfill({ contentType: 'text/html', body: YT_PAGE }) : r.fulfill({ status: 204, body: '' })));
  const p = await ctx.newPage();
  await p.goto('https://www.youtube.com/watch?v=Qv3jF0sXc2Y');
  await p.waitForSelector('#notebooktools-youtube-action button', { timeout: 15000 });
  await p.waitForTimeout(800);
  await p.click('#notebooktools-youtube-action button');
  await p.waitForTimeout(1500);
  // the picker is an extension frame: give it the sample notebooks and refresh it
  const frame = p.frames().find((f) => f.url().includes('youtube-import.html'));
  if (frame) {
    await frame.evaluate((notebooks) => { NotebookToolsNotebookLM.listNotebookLmNotebooks = async () => notebooks.map((n) => ({ ...n })); }, NOTEBOOKS);
    const refresh = await frame.$('#refreshButton');
    if (refresh) await refresh.click();
    await p.waitForTimeout(1200);
    await frame.evaluate(() => { document.activeElement?.blur(); document.scrollingElement.scrollTop = 0; document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); });
    await p.mouse.move(900, 700);
    await p.waitForTimeout(300);
    console.log('picker options:', await frame.$$eval('select option', (o) => o.map((x) => x.textContent)));
  }
  await p.screenshot({ path: path.join(TMP, 'yt.png') });
  console.log('youtube buttons:', await p.$$eval('[id^="notebooktools-youtube"]', (e) => e.map((x) => x.id)));
  await ctx.close();
}

async function shots() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 });
  await serveSite(ctx);
  const p = await ctx.newPage();
  await p.goto('https://shots.local/shots.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  await p.evaluate(() => window.placeMenus());
  await p.waitForTimeout(200);
  for (const id of ['hero', 'export', 'hub', 'podcasts', 'youtube']) await p.locator(`#shot-${id}`).screenshot({ path: path.join(TMP, `${id}.png`), omitBackground: true });
  await b.close();
}

(async () => {
  await extensionShots();
  await shots();
  console.log('rendered into', TMP);
  fs.writeFileSync(path.join(__dirname, '.last-render'), TMP);
})();
