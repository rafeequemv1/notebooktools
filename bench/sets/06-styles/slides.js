// Styled words, superscripts/subscripts, badges, shadowed photos, labels on textures
// Each slide: html(ln) where ln(L(text, opts)) places one line of text and records it in the truth.
// opts: b bold, c colour, s serif, fig (a label on a picture), lab (bold "Label:" lead-in), size, badge.
// Pictures carry class "pic" (their boxes are the picture truth).
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Lato:ital,wght@0,400;0,700;1,400&family=Roboto:ital,wght@0,400;0,700;1,400&display=block';
const L = (t, o = {}) => ({ t, ...o });
const TEX = (seed, freq, colA, colB) => `url('data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' seed='${seed}'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.3'/></filter><rect width='600' height='400' fill='${colA}'/><rect width='600' height='400' fill='${colB}' filter='url(#n)'/></svg>`).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}')`;
const badge = (n, col) => `<div class="pic-no" style="width:56px;height:56px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;flex:none">BADGE${n}</div>`;
const slides = [
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:55px">${ln(L('Quarterly Results', { size: 50, b: 1 }))}</div>
    <div style="position:absolute;left:70px;top:180px;width:1230px;font-size:30px;line-height:1.7">
      ${ln(L('• Revenue grew **40%** in the third quarter.'))}
      ${ln(L('• Costs fell by **12 percent** after the move.'))}
      ${ln(L('• Our {#d93025|biggest risk} is the supply of chips.'))}
      ${ln(L('• The plan is _not_ final until the board agrees.'))}
      ${ln(L('• Churn stayed flat at three percent.'))}</div>` },
  { font: 'Roboto', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:55px">${ln(L('Measuring Graphene', { size: 50, b: 1 }))}</div>
    <div style="position:absolute;left:70px;top:180px;width:1230px;font-size:30px;line-height:1.8">
      ${ln(L('The G peak sits near 1580 cm^-1^ in the spectrum.'))}
      ${ln(L('A sheet of one square metre weighs 0.77 mg.'))}
      ${ln(L('Its area is about 2630 m^2^ per gram.'))}
      ${ln(L('Water (H~2~O) and CO~2~ adsorb on the surface.'))}
      ${ln(L('Electron mobility reaches 200000 cm^2^/Vs.'))}</div>` },
  { font: 'Lato', bg: '#f6f8fb', html: (ln) => `
    <div style="position:absolute;left:70px;top:55px">${ln(L('Three Steps to Launch', { size: 48, b: 1 }))}</div>
    ${[['01', '#1a73e8', 'Plan the release'], ['02', '#188038', 'Test with real users'], ['03', '#e37400', 'Ship and measure']].map(([n, c, t], k) => `
    <div style="position:absolute;left:90px;top:${190 + k * 150}px;display:flex;align-items:center;gap:26px">${badge(n, c).replace(`BADGE${n}`, ln(L(n, { size: 24, b: 1, c: '#ffffff', badge: 1 })))}
      <div style="font-size:30px">${ln(L(t))}</div></div>`).join('')}
    <div style="position:absolute;left:760px;top:190px;width:520px;font-size:26px;line-height:1.6;color:#3c4043">${ln(L('Each step has an owner and a date.', { c: '#3c4043' }))}${ln(L('Review progress every Friday.', { c: '#3c4043' }))}</div>` },
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:55px">${ln(L('Field Photos', { size: 48, b: 1 }))}</div>
    <div class="pic shadow" style="position:absolute;left:80px;top:170px;width:520px;height:330px;border-radius:14px;background:${TEX(3, 0.012, '#5d8aa8', '#2e4a2e')};background-size:cover;box-shadow:0 14px 34px rgba(0,0,0,.35)"></div>
    <div class="pic shadow" style="position:absolute;left:700px;top:190px;width:300px;height:220px;border-radius:12px;background:${TEX(11, 0.02, '#ffcc80', '#bf360c')};background-size:cover;box-shadow:8px 10px 22px rgba(0,0,0,.30)"></div>
    <div style="position:absolute;left:80px;top:540px;font-size:24px">${ln(L('The north site after the storm.', { c: '#5f6368' }))}</div>
    <div style="position:absolute;left:700px;top:450px;width:560px;font-size:26px;line-height:1.5">${ln(L('Both photos were taken in May.'))}${ln(L('Shadows should move with them.'))}</div>` },
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:55px">${ln(L('Under the Microscope', { size: 48, b: 1 }))}</div>
    <div class="pic" style="position:absolute;left:80px;top:170px;width:640px;height:420px;background:${TEX(7, 0.05, '#9e9e9e', '#212121')};background-size:cover">
      <div style="position:absolute;left:30px;top:30px;font-size:30px;color:#ffffff;font-weight:700">${ln(L('Sample A', { fig: 1, b: 1, c: '#ffffff' }))}</div>
      <div style="position:absolute;left:330px;top:350px;font-size:26px;color:#ffffff">${ln(L('Grain boundary', { fig: 1, c: '#ffffff' }))}</div></div>
    <div style="position:absolute;left:780px;top:190px;width:500px;font-size:26px;line-height:1.6">${ln(L('Grains are a few microns wide.'))}${ln(L('Boundaries scatter electrons.'))}</div>` },
  { font: 'PT Serif', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:90px;top:60px">${ln(L('References', { size: 48, b: 1, s: 1 }))}</div>
    <div style="position:absolute;left:90px;top:180px;width:1200px;font-size:26px;line-height:1.9">
      ${ln(L('Li, D. and Kaner, R. _Graphene-based materials_. Science, 2008.', { s: 1 }))}
      ${ln(L('Geim, A. K. _The rise of graphene_. Nature Materials, 2007.', { s: 1 }))}
      ${ln(L('Novoselov, K. S. _Electric field effect_. Science, 2004.', { s: 1 }))}
      ${ln(L('See **chapter 4** for the full method.', { s: 1 }))}</div>` }
];

// markup → { plain, html, styled: [{text, b, i, c, sup, sub}] }
function parse(t) {
  const styled = [];
  let html = '', plain = '';
  const re = /\*\*(.+?)\*\*|_(.+?)_|\{(#[0-9a-f]{6})\|(.+?)\}|\^(.+?)\^|~(.+?)~/gi;
  let last = 0, m;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
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

module.exports = { FONTS, slides, markup: true, parse };
