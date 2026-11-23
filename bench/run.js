// The OCR benchmark: runs every set through the slide editor's converter and
// scores it against the known answer. Prints a score per category (0–100), one
// overall score, and the change since the saved baseline.
//
//   node bench/run.js                 all sets
//   node bench/run.js 07-structure    some sets
//   node bench/run.js --baseline      also save this run as the new baseline
//   node bench/run.js --details       also list every miss
//
// Needs Playwright with Chromium (as in this repo's other checks). Serves the
// website folder itself, so no server needs to be running.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'website');
const SETS = path.join(__dirname, 'sets');
const RESULTS = path.join(__dirname, 'results');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const only = args.filter((a) => !a.startsWith('--'));

// Category weights for the overall score (sum 100)
const WEIGHTS = {
  textFound: 15, textAccuracy: 15, textStyle: 10, labels: 10,
  pictures: 15, textRemoved: 10, picturesLifted: 10, structureKept: 10, noDamage: 5
};
const NAMES = {
  textFound: 'Text found', textAccuracy: 'Text accuracy', textStyle: 'Text style', labels: 'Labels on pictures',
  pictures: 'Pictures separated', textRemoved: 'Text removed cleanly', picturesLifted: 'Pictures lifted cleanly',
  structureKept: 'Tables, lines, boxes kept', noDamage: 'Background untouched'
};

/* ---------- a tiny static server for the website folder and the set PDFs ---------- */
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.json': 'application/json', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url.startsWith('/__bench/') ? path.join(SETS, url.slice(9)) : path.join(SITE, url.endsWith('/') ? `${url}index.html` : url);
    if (!file.startsWith(url.startsWith('/__bench/') ? SETS : SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ---------- text matching ---------- */
const lev = (a, b) => {
  const m = a.length, n = b.length; if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) { const cur = [i]; for (let j = 1; j <= n; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
};
const SCRIPT = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const norm = (s) => s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻₀₁₂₃₄₅₆₇₈₉]/g, (c) => SCRIPT[c]).replace(/^•\s*/, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const sim = (a, b) => { a = norm(a); b = norm(b); return 1 - lev(a, b) / Math.max(a.length, b.length, 1); };
const rgb = (h) => [1, 3, 5].map((k) => parseInt(String(h).slice(k, k + 2), 16) || 0);
const cdist = (a, b) => Math.hypot(...rgb(a).map((v, j) => v - rgb(b)[j]));
const inter = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

/* ---------- run one set in the browser ---------- */
async function runSet(page, base, set, picsTruth) {
  return page.evaluate(async ({ base, set, picsTruth }) => {
    const S = window.NTSlides;
    const load = async (name) => { const r = await fetch(`${base}/__bench/${set}/${name}.pdf`); return r.ok ? (await S.loadPdf(new Uint8Array(await r.arrayBuffer()))).pdf : null; };
    const deck = await load('slides');
    const truthPdfs = { clean: await load('clean'), bg: await load('bg'), page: await load('page') };
    const out = [];
    const pages = deck.numPages;
    for (let n = 1; n <= pages; n += 1) {
      const slide = S.newSlide(await S.renderOriginal(deck, n));
      const t0 = performance.now();
      await S.analyze(slide, () => {}, { objects: true });
      const ms = performance.now() - t0;
      const W = slide.w, H = slide.h;
      const draw = (src) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(src, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
      // Every pixel sorted by what it is in the original: text, picture, structure (boxes,
      // tables, lines), or bare page; then: does the converted background show what it should?
      const full = draw(slide.original);
      const clean = truthPdfs.clean ? draw(await S.renderOriginal(truthPdfs.clean, n)) : null;
      const bg = truthPdfs.bg ? draw(await S.renderOriginal(truthPdfs.bg, n)) : null;
      const bare = truthPdfs.page ? draw(await S.renderOriginal(truthPdfs.page, n)) : null;
      const ours = draw(slide.clean || slide.original);
      const px = { text: [0, 0], picture: [0, 0], structure: [0, 0], page: [0, 0] };
      if (clean && bg && bare) {
        const d = (a, b, i) => (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
        for (let i = 0; i < full.length; i += 8) { // every other pixel
          const kind = d(full, clean, i) > 24 ? 'text' : d(clean, bg, i) > 24 ? 'picture' : d(bg, bare, i) > 24 ? 'structure' : 'page';
          px[kind][1] += 1; // [matching, all]
          if (d(ours, bg, i) <= 24) px[kind][0] += 1;
        }
      }
      // The true picture boxes, tight round what is drawn (a drawing's own box can be
      // mostly empty): where the text-free slide differs from the background
      const tight = (picsTruth[n - 1] || []).map((r) => {
        const k = W / 1376;
        if (!clean || !bg) return r.map((v) => v * k);
        let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
        for (let y = Math.max(0, Math.floor(r[1] * k)); y < Math.min(H, Math.ceil((r[1] + r[3]) * k)); y += 1) for (let x = Math.max(0, Math.floor(r[0] * k)); x < Math.min(W, Math.ceil((r[0] + r[2]) * k)); x += 1) {
          const i = (y * W + x) * 4;
          if ((Math.abs(clean[i] - bg[i]) + Math.abs(clean[i + 1] - bg[i + 1]) + Math.abs(clean[i + 2] - bg[i + 2])) / 3 > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        return x1 < 0 ? r.map((v) => v * k) : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
      });
      const c2d = document.createElement('canvas').getContext('2d');
      out.push({
        ms,
        px,
        tight,
        images: slide.elements.filter((e) => e.type !== 'text').map((e) => [e.x, e.y, e.w, e.h, e.type]),
        texts: slide.elements.filter((e) => e.type === 'text').map((e) => {
          c2d.font = `${e.italic ? 'italic ' : ''}${e.bold ? 700 : 400} ${e.fontSize}px ${S.cssFamily(e.fontFamily)}`;
          return { lines: S.layoutLines(e.text, e.w, (t) => c2d.measureText(t).width).map((l) => l.text), text: e.text, runs: e.runs || [], bold: e.bold, italic: !!e.italic, color: e.color, serif: e.fontFamily === 'Georgia', label: !!e.labelColor, labelBold: e.labelBold };
        })
      });
    }
    return out;
  }, { base, set, picsTruth });
}

/* ---------- score a set against its truth ---------- */
function scoreSet(slides, truth, pics, misses) {
  const c = { lines: 0, found: 0, chars: 0, bold: [0, 0], italic: [0, 0], serif: [0, 0], colour: [0, 0], styled: [0, 0], falseStyled: 0, labels: [0, 0], badges: [0, 0], realPics: 0, wholePics: 0, falsePics: 0, px: { text: [0, 0], picture: [0, 0], structure: [0, 0], page: [0, 0] }, ms: 0, slides: slides.length };
  truth.forEach((lines, i) => {
    const s = slides[i];
    if (!s) return;
    c.ms += s.ms;
    for (const k of Object.keys(c.px)) { c.px[k][0] += s.px[k][0]; c.px[k][1] += s.px[k][1]; }
    const got = s.texts.flatMap((t) => t.lines.map((line) => ({ line, el: t })));
    for (const tl of lines.filter((l) => !l.fig)) {
      let best = null, bs = 0;
      got.forEach((g, k) => { const v = sim(tl.text, g.line); if (v > bs) { bs = v; best = k; } });
      c.lines += 1;
      c.chars += Math.max(0, bs);
      if (bs < 0.8) { misses.push(`slide ${i + 1}: text missing "${tl.text}"`); continue; }
      c.found += 1;
      const el = got[best].el;
      c.bold[1] += 1; if (el.bold === tl.bold) c.bold[0] += 1; else misses.push(`slide ${i + 1}: bold wrong on "${tl.text}"`);
      c.italic[1] += 1; if (el.italic === !!tl.italic) c.italic[0] += 1; else misses.push(`slide ${i + 1}: italic wrong on "${tl.text}"`);
      c.serif[1] += 1; if (el.serif === tl.serif) c.serif[0] += 1; else misses.push(`slide ${i + 1}: serif wrong on "${tl.text}"`);
      c.colour[1] += 1; if (cdist(el.color, tl.color) < 60 || (tl.label && el.label)) c.colour[0] += 1; else misses.push(`slide ${i + 1}: colour off on "${tl.text}" (${el.color} for ${tl.color})`);
      if (tl.badge) { c.badges[1] += 1; if (bs >= 0.99) c.badges[0] += 1; else misses.push(`slide ${i + 1}: badge "${tl.text}" misread`); }
      for (const st of tl.styled || []) {
        c.styled[1] += 1;
        const t = el;
        const head = norm(tl.text).slice(0, 14), lineAt = t.text.indexOf(head);
        const at = st.at !== undefined && lineAt >= 0 && t.text.slice(lineAt + st.at, lineAt + st.at + st.text.length) === st.text ? lineAt + st.at : t.text.indexOf(st.text);
        const cover = at < 0 ? [] : t.runs.filter((r) => r.start <= at && r.end >= at + st.text.length);
        const has = (k) => { const r = cover.find((x) => x[k] !== undefined); return r ? r[k] : undefined; };
        // a bold "Label:" lead-in is the converter's label styling
        const leadIn = st.b && st.at === 0 && /:$/.test(st.text) && t.label && t.labelBold;
        const ok = leadIn ? true : st.b ? (has('bold') ?? t.bold) === true : st.i ? (has('italic') ?? t.italic) === true : st.c ? cdist(has('color') || t.color, st.c) < 70 : st.sup ? has('sup') === true : st.sub ? has('sub') === true : false;
        if (ok) c.styled[0] += 1; else misses.push(`slide ${i + 1}: styled word wrong: "${st.text}" in "${tl.text}"`);
      }
    }
    // styling on words that have none
    const styledTruth = lines.flatMap((l) => (l.styled || []).map((st) => st.text));
    for (const t of s.texts) for (const r of t.runs) {
      const word = t.text.slice(r.start, r.end).trim();
      if (!word) continue;
      const tline = lines.find((l) => norm(l.text).includes(word));
      if ((r.color && tline && cdist(r.color, tline.color) < 60) || r.sub || r.sup) continue;
      if (!styledTruth.some((x) => x.includes(word) || word.includes(x))) { c.falseStyled += 1; misses.push(`slide ${i + 1}: styling on "${word}" that the original doesn't have`); }
    }
    for (const tl of lines.filter((l) => l.fig)) {
      c.labels[1] += 1;
      if (Math.max(0, ...got.map((g) => sim(tl.text, g.line))) >= 0.8) c.labels[0] += 1; else misses.push(`slide ${i + 1}: label on a picture not editable: "${tl.text}"`);
    }
    const real = s.tight || (pics[i] || []).map((r) => r.map((v) => (v * 1600) / 1376));
    const imgs = s.images.filter((m) => m[4] === 'image');
    for (const r of real) {
      c.realPics += 1;
      const best = Math.max(0, ...imgs.map((m) => inter(m, r) / (m[2] * m[3] + r[2] * r[3] - inter(m, r))));
      if (best >= 0.6) c.wholePics += 1; else misses.push(`slide ${i + 1}: picture not cut out whole (best overlap ${(100 * best).toFixed(0)}%)`);
    }
    for (const m of imgs) if (!real.some((r) => inter(m, r) > m[2] * m[3] * 0.3)) { c.falsePics += 1; misses.push(`slide ${i + 1}: a picture cut out where there is none (${m.slice(0, 4).map(Math.round).join(',')})`); }
  });
  return c;
}

/* ---------- combine counts into category scores ---------- */
function categories(c) {
  const pct = ([a, b]) => (b ? (100 * a) / b : null);
  const avg = (list) => { const v = list.filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const styleParts = [pct(c.bold), pct(c.italic), pct(c.serif), pct(c.colour), pct(c.styled), pct(c.badges)];
  const style = avg(styleParts);
  return {
    textFound: c.lines ? (100 * c.found) / c.lines : null,
    textAccuracy: c.lines ? (100 * c.chars) / c.lines : null,
    textStyle: style === null ? null : Math.max(0, style - c.falseStyled * 2),
    labels: pct(c.labels),
    pictures: c.realPics + c.falsePics ? (100 * c.wholePics) / (c.realPics + c.falsePics) : null,
    textRemoved: pct(c.px.text),
    picturesLifted: pct(c.px.picture),
    structureKept: pct(c.px.structure),
    noDamage: pct(c.px.page)
  };
}
function overall(cats) {
  let sum = 0, w = 0;
  for (const [k, v] of Object.entries(cats)) if (v !== null && v !== undefined) { sum += v * WEIGHTS[k]; w += WEIGHTS[k]; }
  return w ? sum / w : 0;
}
function addCounts(a, b) {
  if (!a) return JSON.parse(JSON.stringify(b));
  for (const k of Object.keys(b)) {
    if (k === 'px') for (const p of Object.keys(b.px)) { a.px[p][0] += b.px[p][0]; a.px[p][1] += b.px[p][1]; }
    else if (Array.isArray(b[k])) { a[k][0] += b[k][0]; a[k][1] += b[k][1]; }
    else a[k] += b[k];
  }
  return a;
}

(async () => {
  const sets = fs.readdirSync(SETS).filter((d) => fs.existsSync(path.join(SETS, d, 'slides.pdf'))).filter((d) => !only.length || only.includes(d)).sort();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${base}/tools/edit-notebooklm-slides.html`);
  await page.waitForFunction(() => window.NTSlides && window.NTPdf, null, { timeout: 60000 });
  const report = { date: new Date().toISOString(), commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (_e) { return ''; } })(), sets: {} };
  let total = null;
  for (const set of sets) {
    const t0 = Date.now();
    const truth = JSON.parse(fs.readFileSync(path.join(SETS, set, 'truth.json'), 'utf8'));
    const pics = JSON.parse(fs.readFileSync(path.join(SETS, set, 'pics.json'), 'utf8'));
    const slides = await runSet(page, base, set, pics);
    const misses = [];
    const counts = scoreSet(slides, truth, pics, misses);
    const cats = categories(counts);
    report.sets[set] = { score: overall(cats), categories: cats, counts, misses };
    total = addCounts(total, counts);
    console.log(`${set.padEnd(14)} ${overall(cats).toFixed(1).padStart(5)}   (${slides.length} slides, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (flags.has('--details')) misses.forEach((m) => console.log(`    ${m}`));
  }
  await browser.close();
  server.close();
  report.categories = categories(total);
  report.score = overall(report.categories);
  report.secondsPerSlide = total.ms / 1000 / total.slides;
  report.counts = total;

  const baselineFile = path.join(RESULTS, 'baseline.json');
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : null;
  const delta = (now, then) => (then === null || then === undefined || now === null ? '' : Math.abs(now - then) < 0.05 ? '   =' : `${now > then ? ' ▲' : ' ▼'}${Math.abs(now - then).toFixed(1)}`);
  console.log('\nCategory                      Score   vs baseline');
  for (const k of Object.keys(WEIGHTS)) {
    const v = report.categories[k];
    console.log(`${NAMES[k].padEnd(28)} ${v === null ? '   –' : v.toFixed(1).padStart(6)}   ${baseline ? delta(v, baseline.categories?.[k]) : ''}`);
  }
  console.log(`${'OVERALL'.padEnd(28)} ${report.score.toFixed(1).padStart(6)}   ${baseline ? delta(report.score, baseline.score) : ''}`);
  console.log(`Speed: ${report.secondsPerSlide.toFixed(1)} s per slide${baseline ? ` (baseline ${baseline.secondsPerSlide.toFixed(1)})` : ''}`);
  if (baseline && only.length) console.log('(only some sets ran: compare with a baseline of the same sets)');

  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(path.join(RESULTS, 'latest.json'), JSON.stringify(report, null, 1));
  if (!only.length) fs.appendFileSync(path.join(RESULTS, 'history.csv'), `${fs.existsSync(path.join(RESULTS, 'history.csv')) ? '' : `date,commit,overall,${Object.keys(WEIGHTS).join(',')},seconds_per_slide\n`}${report.date},${report.commit},${report.score.toFixed(2)},${Object.keys(WEIGHTS).map((k) => (report.categories[k] ?? '').toString().slice(0, 6)).join(',')},${report.secondsPerSlide.toFixed(2)}\n`);
  if (flags.has('--baseline')) { fs.writeFileSync(baselineFile, JSON.stringify(report, null, 1)); console.log('Saved as the new baseline.'); }
})();
