// Builds one benchmark set from its slides.js: every slide is drawn in Chromium
// from HTML (so the right answer is known exactly) and saved four ways, as
// image-only PDFs like the ones NotebookLM gives you:
//   slides.pdf  the slide
//   clean.pdf   the slide with its text hidden
//   bg.pdf      the slide with its text and pictures hidden: what the editable
//               slide's background should be (boxes, tables, lines, cards stay)
//   page.pdf    the bare page (everything hidden): tells structure from page
// plus truth.json (every line of text and how it looks) and pics.json (picture boxes).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('../../website/tools/vendor/pdf-lib/pdf-lib.min.js');

const W = 1376, H = 768;

// "**bold** _italic_ {#d93025|colour} ^sup^ ~sub~" → { plain, html, styled: [{text, at, b|i|c|sup|sub}] }
function parseMarkup(t) {
  const styled = [];
  let html = '', plain = '';
  const re = /\*\*(.+?)\*\*|_(.+?)_|\{(#[0-9a-f]{6})\|(.+?)\}|\^(.+?)\^|~(.+?)~/gi;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let last = 0, m;
  while ((m = re.exec(t))) {
    html += esc(t.slice(last, m.index)); plain += t.slice(last, m.index);
    const [txt, tag, st] = m[1] ? [m[1], 'b', { b: 1 }] : m[2] ? [m[2], 'i', { i: 1 }] : m[3] ? [m[4], `span style="color:${m[3]}"`, { c: m[3] }] : m[5] ? [m[5], 'sup', { sup: 1 }] : [m[6], 'sub', { sub: 1 }];
    html += `<${tag}>${esc(txt)}</${tag.split(' ')[0]}>`;
    styled.push({ text: txt, at: plain.length, ...st });
    plain += txt;
    last = re.lastIndex;
  }
  html += esc(t.slice(last)); plain += t.slice(last);
  return { plain, html, styled };
}

async function toPdf(jpegs, file) {
  const doc = await PDFDocument.create();
  for (const bytes of jpegs) {
    const img = await doc.embedJpg(bytes);
    const page = doc.addPage([W, H]);
    page.drawImage(img, { x: 0, y: 0, width: W, height: H });
  }
  fs.writeFileSync(file, await doc.save());
}

async function buildSet(dir) {
  const spec = require(path.join(dir, 'slides.js'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const renders = { slides: [], clean: [], bg: [], page: [] };
  const truth = [], pics = [];
  for (const sl of spec.slides) {
    const lines = [];
    // Plain sets: a block per line, "Label:" lead-ins in bold. Markup sets: styled words inside lines.
    const ln = spec.markup
      ? (l) => { const q = parseMarkup(l.t); lines.push({ ...l, ...q }); return `<span class="tl" style="display:${l.badge ? 'inline' : 'block'};${l.b ? 'font-weight:700;' : ''}${l.c ? `color:${l.c};` : ''}${l.size ? `font-size:${l.size}px;` : ''}white-space:nowrap">${q.html}</span>`; }
      : (l) => { lines.push({ ...l, plain: l.t }); return `<div class="tl" style="${l.b ? 'font-weight:700;' : ''}${l.c ? `color:${l.c};` : ''}${l.size ? `font-size:${l.size}px;` : ''}white-space:nowrap">${l.lab ? l.t.replace(/^(•\s*)?([^:]+:)/, '$1<b>$2</b>') : l.t}</div>`; };
    const body = sl.html(ln);
    await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${spec.FONTS}"><style>body{margin:0;width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${sl.bg};font-family:'${sl.font}';color:#1f1f1f} sup,sub{font-size:62%}</style></head><body>${body}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const styles = await p.$$eval('.tl', (els) => els.map((e) => getComputedStyle(e).fontStyle));
    pics.push(await p.$$eval('.pic', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })));
    const shot = () => p.screenshot({ type: 'jpeg', quality: 92 });
    renders.slides.push(await shot());
    await p.addStyleTag({ content: '.tl{visibility:hidden!important}' });
    renders.clean.push(await shot());
    await p.addStyleTag({ content: '.pic{visibility:hidden!important;box-shadow:none!important}' });
    renders.bg.push(await shot());
    await p.addStyleTag({ content: 'body *{visibility:hidden!important;box-shadow:none!important}' });
    renders.page.push(await shot());
    truth.push(lines.map((l, j) => ({
      text: l.plain, bold: !!l.b, color: l.c || '#1f1f1f', serif: !!l.s, fig: !!l.fig, label: !!l.lab,
      italic: spec.markup ? false : styles[j] === 'italic',
      ...(l.badge ? { badge: true } : {}),
      ...(l.styled && l.styled.length ? { styled: l.styled } : {})
    })));
  }
  await b.close();
  for (const [name, list] of Object.entries(renders)) await toPdf(list, path.join(dir, `${name}.pdf`));
  fs.writeFileSync(path.join(dir, 'truth.json'), JSON.stringify(truth, null, 1));
  fs.writeFileSync(path.join(dir, 'pics.json'), JSON.stringify(pics));
  return { slides: spec.slides.length, lines: truth.flat().length, pictures: pics.flat().length };
}

module.exports = { buildSet, parseMarkup, W, H };
