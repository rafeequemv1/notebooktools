// Science figures with labels on them (NotebookLM-style diagrams)
// Each slide: html(ln) where ln(L(text, opts)) places one line of text and records it in the truth.
// opts: b bold, c colour, s serif, fig (a label on a picture), lab (bold "Label:" lead-in), size.
// Pictures carry class "pic" (their boxes are the picture truth).
const FONTS = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Inter:wght@400;700&family=Barlow:wght@400;700&family=Roboto+Condensed:wght@400;700&family=Lato:wght@400;700&display=block';
// L(text, opts): one line. opts: b (bold), c (colour), s (serif), fig (figure label), lab (bold label before colon)
const L = (t, o = {}) => ({ t, ...o });
const hexes = (cx, cy, r, cols, rows, stroke) => { let o = ''; for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) { const x = cx + i * r * 1.5, y = cy + j * r * 1.732 + (i % 2) * r * 0.866; o += `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => `${(x + r * Math.cos(k * Math.PI / 3)).toFixed(1)},${(y + r * Math.sin(k * Math.PI / 3)).toFixed(1)}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="3"/><circle cx="${x + r}" cy="${y}" r="5" fill="#8d6e63"/>`; } return o; };
const pos = (x, y, inner, extra = '') => `<div style="position:absolute;left:${x}px;top:${y}px;${extra}">${inner}</div>`;
const slides = [
  { font: 'Roboto', bg: '#ffffff', html: (ln) => `
    ${pos(60, 50, ln(L('Physics of the Cone', { b: 1, size: 48, c: '#183959' })))}
    ${pos(60, 150, `<div style="width:520px;font-size:24px;line-height:1.45">${ln(L('Electrons near the Dirac point'))}${ln(L('behave as if they had no mass.'))}</div>`)}
    <svg style="position:absolute;left:700px;top:60px" width="620" height="640"><g class="pic"><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7043"/><stop offset="1" stop-color="#ffcc80"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#90caf9"/><stop offset="1" stop-color="#1565c0"/></linearGradient></defs>
      <line x1="300" y1="600" x2="300" y2="20" stroke="#555" stroke-width="3"/><polygon points="292,30 300,10 308,30" fill="#555"/>
      <ellipse cx="300" cy="90" rx="170" ry="40" fill="#ff8a65"/><polygon points="130,90 470,90 300,320" fill="url(#g1)"/>
      <polygon points="300,320 130,550 470,550" fill="url(#g2)"/><ellipse cx="300" cy="550" rx="170" ry="40" fill="#1e88e5"/></g></svg>
    ${pos(1030, 70, ln(L('Energy (E)', { fig: 1, c: '#455a64' })), 'font-size:24px')}
    ${pos(1110, 220, ln(L('Conduction Band', { fig: 1, c: '#263238' })), 'font-size:24px')}
    ${pos(1030, 365, ln(L('Dirac Point', { fig: 1, c: '#455a64' })), 'font-size:24px')}
    ${pos(1110, 470, ln(L('Valence Band', { fig: 1, c: '#455a64' })), 'font-size:24px')}` },
  { font: 'Inter', bg: 'linear-gradient(180deg,#f5f7fa,#dfe6ee)', html: (ln) => `
    ${pos(60, 50, ln(L('Inside a Graphene Sheet', { b: 1, size: 46 })))}
    <svg style="position:absolute;left:380px;top:170px" width="640" height="460"><g class="pic">${hexes(30, 40, 42, 9, 5, '#37474f')}</g></svg>
    <svg style="position:absolute;left:0;top:0" width="1376" height="768"><line x1="300" y1="250" x2="430" y2="250" stroke="#c0794f" stroke-width="2"/><line x1="1040" y1="360" x2="920" y2="360" stroke="#c0794f" stroke-width="2"/><line x1="300" y1="560" x2="460" y2="560" stroke="#c0794f" stroke-width="2"/></svg>
    ${pos(70, 236, ln(L('Carbon atom', { fig: 1, b: 1 })), 'font-size:24px')}
    ${pos(1050, 345, ln(L('Bond length', { fig: 1, b: 1 })) + ln(L('0.142 nm', { fig: 1 })), 'font-size:24px')}
    ${pos(70, 546, ln(L('One atom thick', { fig: 1, b: 1 })), 'font-size:24px')}` },
  { font: 'Barlow', bg: '#ffffff', html: (ln) => `
    ${pos(60, 50, ln(L('From Raw Material to Product', { b: 1, size: 48, c: '#1b5e20' })))}
    ${['Mining', 'Refining', 'Assembly'].map((t, i) => `
      <svg style="position:absolute;left:${90 + i * 430}px;top:190px" width="300" height="220"><rect x="2" y="2" width="296" height="216" rx="22" fill="${['#e8f5e9', '#e3f2fd', '#fff3e0'][i]}" stroke="${['#43a047', '#1e88e5', '#fb8c00'][i]}" stroke-width="3"/>
      <g class="pic"><circle cx="150" cy="95" r="${40 + i * 6}" fill="${['#66bb6a', '#42a5f5', '#ffa726'][i]}"/><rect x="${110 - i * 5}" y="150" width="${80 + i * 10}" height="22" rx="6" fill="#455a64"/></g></svg>
      ${pos(90 + i * 430, 430, `<div style="width:300px;text-align:center;font-size:26px;line-height:1.35">${ln(L(t, { b: 1, fig: 1 }))}${ln(L(['Ore is dug out', 'Metal is purified', 'Parts are joined'][i], { c: '#424242', fig: 1 }))}</div>`)}
      ${i < 2 ? `<svg style="position:absolute;left:${400 + i * 430}px;top:285px" width="110" height="30"><line x1="5" y1="15" x2="90" y2="15" stroke="#9e9e9e" stroke-width="4"/><polygon points="88,5 108,15 88,25" fill="#9e9e9e"/></svg>` : ''}`).join('')}` },
  { font: 'Roboto Condensed', bg: 'linear-gradient(135deg,#eceff1,#cfd8dc)', html: (ln) => `
    ${pos(60, 45, ln(L('Stacking 2D Materials', { b: 1, size: 50 })))}
    ${[0, 1, 2].map((i) => `<svg style="position:absolute;left:330px;top:${170 + i * 150}px" width="560" height="160"><g class="pic"><polygon points="80,20 540,20 460,130 0,130" fill="${['#1e3a5f', '#8fa8c8', '#2c4a70'][i]}" opacity="0.92"/>${hexes(70, 45, 16, 14, 2, 'rgba(255,255,255,.35)')}</g></svg>`).join('')}
    <svg style="position:absolute;left:0;top:0" width="1376" height="768">${[0, 1, 2].map((i) => `<line x1="900" y1="${245 + i * 150}" x2="1010" y2="${245 + i * 150}" stroke="#795548" stroke-width="2"/>`).join('')}</svg>
    ${[['Top electrode', 230], ['Semiconductor', 380], ['Bottom electrode', 530]].map(([t, y]) => pos(1020, y, ln(L(t, { fig: 1, b: 1 })), 'font-size:26px')).join('')}
    ${pos(60, 200, `<div style="width:240px;font-size:24px;line-height:1.4;color:#5c1a1a">${ln(L('Layers held', { c: '#5c1a1a' }))}${ln(L('by weak forces', { c: '#5c1a1a' }))}</div>`)}` },
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    ${pos(60, 45, ln(L('Spectrum of a Single Layer', { b: 1, size: 46 })))}
    <svg style="position:absolute;left:80px;top:150px" width="900" height="520" font-family="Inter" font-size="18"><g class="pic">
      <line x1="60" y1="20" x2="60" y2="460" stroke="#333"/><line x1="60" y1="460" x2="880" y2="460" stroke="#333"/>
      ${[500, 1000, 1500, 2000, 2500, 3000].map((v, i) => `<text x="${80 + i * 150}" y="490">${v}</text>`).join('')}
      <path d="M60 440 L300 430 L340 300 L380 430 L640 425 L680 60 L720 425 L880 440" fill="none" stroke="#1565c0" stroke-width="4"/></g></svg>
    ${pos(430, 410, ln(L('G peak', { fig: 1, c: '#c62828' })), 'font-size:22px')}
    ${pos(790, 180, ln(L('2D peak', { fig: 1, c: '#c62828' })), 'font-size:22px')}
    ${pos(1020, 220, `<div style="width:300px;font-size:23px;line-height:1.45">${ln(L('A tall 2D peak'))}${ln(L('means one layer.'))}</div>`)}` },
  { font: 'Lato', bg: '#ffffff', html: (ln) => `
    ${pos(60, 45, ln(L('Under the Microscope', { b: 1, size: 48 })))}
    <div class="pic" style="position:absolute;left:80px;top:150px;width:760px;height:470px;border-radius:12px;background:repeating-radial-gradient(circle at 40% 45%,#b39ddb 0 6px,#9575cd 6px 13px)"></div>
    <div style="position:absolute;left:120px;top:190px;width:200px;height:56px;border-radius:8px;background:rgba(255,255,255,.88)"></div>
    ${pos(140, 202, ln(L('Monolayer', { fig: 1, b: 1, c: '#311b92' })), 'font-size:26px')}
    ${pos(80, 640, `<div style="font-size:22px">${ln(L('Optical image of a flake on silicon.', { c: '#5f6368' }))}</div>`)}
    ${pos(900, 200, `<div style="width:420px;font-size:24px;line-height:1.5">${ln(L('Thin flakes show up as faint'))}${ln(L('purple patches on the wafer.'))}</div>`)}` }
];

module.exports = { FONTS, slides };
