// Render the homepage hero (Gemini Notebook + the NotebookTools ribbon).
//   (serve website/ on :8765 first)  node scripts/hero-shot/render.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const out = process.env.HERO_PNG || path.join(__dirname, '.hero.png');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.route('http://localhost:8765/__hero.html', (r) => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, 'hero.html'), 'utf8') }));
  await p.route('http://localhost:8765/__ribbon.css', (r) => r.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(root, 'notebooktools-extension/notebooklm-ribbon.css'), 'utf8') }));
  await p.goto('http://localhost:8765/__hero.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await p.locator('#shot').screenshot({ path: out, omitBackground: true });
  console.log('wrote', out);
  await b.close();
})();
