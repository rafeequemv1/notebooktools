// Render every blog thumbnail (1200x630) from template.html.
//   node scripts/blog-thumbs/render.js [id ...]
// Writes PNGs to a temp folder; to-webp.py turns them into
// website/assets/blog/<id>.webp (used for the blog cards and og:image).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const template = 'file://' + path.join(__dirname, 'template.html');
const out = process.env.THUMBS_PNG_DIR || path.join(__dirname, '.png');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(template + '?id=_');
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => window.POST_IDS);
  for (const id of ids) {
    await page.goto(`${template}?id=${id}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.locator('#frame').screenshot({ path: path.join(out, `${id}.png`) });
    console.log('rendered', id);
  }
  await browser.close();
})();
