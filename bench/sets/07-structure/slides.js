// Structure: tables with coloured header rows, framed comic panels, speech bubbles,
// cards with dividers and arrows, a chart, a slide inside a frame with labels on
// its picture. Boxes, tables and lines should stay in the background; only the
// drawings (class "pic") become pictures; all text should become editable.
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@400;700&family=Lato:wght@400;700&display=block';
const L = (t, o = {}) => ({ t, ...o });
const TEX = (seed, freq, colA, colB) => `url('data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' seed='${seed}'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.3'/></filter><rect width='600' height='400' fill='${colA}'/><rect width='600' height='400' fill='${colB}' filter='url(#n)'/></svg>`).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}')`;
// small drawings (pictures)
const clock = (x, y, s, col = '#1e88e5') => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="${col}" stroke-width="7"/><path d="M50 50 L50 22 M50 50 L70 60" stroke="#263238" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="50" r="5" fill="#e53935"/></svg>`;
const rocket = (x, y, s) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 8 C68 22 70 52 62 74 L38 74 C30 52 32 22 50 8Z" fill="#90caf9" stroke="#1565c0" stroke-width="4"/><circle cx="50" cy="38" r="8" fill="#fff" stroke="#1565c0" stroke-width="3"/><path d="M38 64 L24 82 L38 78Z M62 64 L76 82 L62 78Z" fill="#ef5350"/><path d="M42 76 L50 96 L58 76Z" fill="#ffa726"/></svg>`;
const planet = (x, y, s) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><defs><radialGradient id="pg${x}" cx="0.35" cy="0.35"><stop offset="0" stop-color="#a5d6a7"/><stop offset="1" stop-color="#2e7d32"/></radialGradient></defs><circle cx="50" cy="50" r="34" fill="url(#pg${x})"/><ellipse cx="50" cy="52" rx="48" ry="12" fill="none" stroke="#8d6e63" stroke-width="4"/></svg>`;
const person = (x, y, h, shirt) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${h * 0.6}" height="${h}" viewBox="0 0 60 100"><circle cx="30" cy="14" r="10" fill="#ffccbc" stroke="#5d4037" stroke-width="2"/><path d="M14 30 Q30 22 46 30 L42 62 L18 62Z" fill="${shirt}" stroke="#37474f" stroke-width="2"/><path d="M20 62 L16 96 M40 62 L44 96" stroke="#37474f" stroke-width="6" stroke-linecap="round"/></svg>`;
const bubble = (x, y, w, h, tailX, colour = '#37474f') => `<svg style="position:absolute;left:${x}px;top:${y - 16}px;overflow:visible" width="${w}" height="${h + 16}"><path d="M10 16 H${tailX - 12} L${tailX} 0 L${tailX + 12} 16 H${w - 10} Q${w} 16 ${w} 26 V${h + 6} Q${w} ${h + 16} ${w - 10} ${h + 16} H10 Q0 ${h + 16} 0 ${h + 6} V26 Q0 16 10 16Z" fill="#fff" stroke="${colour}" stroke-width="2.5"/></svg>`;
const pos = (x, y, inner, extra = '') => `<div style="position:absolute;left:${x}px;top:${y}px;${extra}">${inner}</div>`;

const slides = [
  // 1. A table: coloured header row, grid lines, text in cells, small drawings in two cells
  { font: 'Inter', bg: '#fbf8f1', html: (ln) => `
    ${pos(60, 40, ln(L('Two Ways Clocks Slow Down', { size: 40, b: 1 })))}
    <table style="position:absolute;left:80px;top:130px;border-collapse:collapse;font-size:22px;color:#1f1f1f">
      <tr style="height:56px"><td style="width:170px;border:2px solid #263238"></td>
        <td style="width:450px;border:2px solid #263238;background:#90caf9;text-align:center">${ln(L('Speed', { b: 1 }))}</td>
        <td style="width:450px;border:2px solid #263238;background:#e6c35c;text-align:center">${ln(L('Gravity', { b: 1 }))}</td></tr>
      <tr style="height:110px"><td style="border:2px solid #263238;text-align:center">${ln(L('Cause', { b: 1 }))}</td>
        <td style="border:2px solid #263238;text-align:center">${ln(L('Moving very fast'))}</td>
        <td style="border:2px solid #263238;text-align:center">${ln(L('Being near a heavy object'))}</td></tr>
      <tr style="height:150px"><td style="border:2px solid #263238;text-align:center">${ln(L('Example', { b: 1 }))}</td>
        <td style="border:2px solid #263238;padding-left:20px">${ln(L('A clock on a rocket'))}</td>
        <td style="border:2px solid #263238;padding-left:20px">${ln(L('A clock near a planet'))}</td></tr>
    </table>
    ${rocket(560, 310, 120)}
    ${planet(1010, 310, 120)}` },
  // 2. Comic panels side by side, each framed, with a caption box below
  { font: 'Nunito Sans', bg: '#fbf8f1', html: (ln) => `
    ${pos(60, 36, ln(L('Light Always Moves at the Same Speed', { size: 38 })))}
    ${[0, 1, 2].map((k) => `<div style="position:absolute;left:${70 + k * 415}px;top:120px;width:390px;height:380px;border:3px solid #263238;background:#fff"></div>`).join('')}
    <div class="pic" style="position:absolute;left:90px;top:140px;width:350px;height:340px;background:${TEX(5, 0.012, '#cfd8dc', '#455a64')};background-size:cover"></div>
    ${person(560, 230, 220, '#5c6bc0')}${clock(700, 170, 110)}
    ${person(980, 230, 220, '#8d6e63')}${rocket(1110, 180, 150)}
    ${pos(110, 160, ln(L('At rest', { fig: 1, b: 1, c: '#ffffff' })), 'font-size:24px')}
    <div style="position:absolute;left:150px;top:540px;width:1080px;height:120px;border:2px solid #263238;border-radius:12px;background:#fff"></div>
    <div style="position:absolute;left:180px;top:562px;font-size:22px;line-height:1.6">${ln(L('**The Rule:** light speed is the same for everyone.'))}${ln(L('**The Catch:** so time itself has to change.'))}</div>` },
  // 3. Speech bubbles under two drawings, text inside the bubbles
  { font: 'Inter', bg: '#fbf8f1', html: (ln) => `
    ${pos(0, 40, ln(L('Two Ideas of Time', { size: 40 })), 'width:1376px;text-align:center')}
    <div style="position:absolute;left:688px;top:120px;width:2px;height:580px;background:#263238"></div>
    ${clock(190, 140, 260, '#c9a227')}
    ${person(890, 150, 240, '#ef5350')}${rocket(1050, 170, 200)}
    ${bubble(90, 470, 500, 150, 200)}
    ${bubble(780, 470, 500, 150, 330)}
    <div style="position:absolute;left:120px;top:490px;width:440px;font-size:21px;line-height:1.5">${ln(L('**Newton:** time is the same'))}${ln(L('for everyone, everywhere.'))}</div>
    <div style="position:absolute;left:810px;top:490px;width:440px;font-size:21px;line-height:1.5">${ln(L('**Einstein:** time depends on'))}${ln(L('how fast you move.'))}</div>` },
  // 4. Cards with a divider under each title, arrows between them, a rule under the heading
  { font: 'Lato', bg: '#ffffff', html: (ln) => `
    ${pos(70, 40, ln(L('How the Experiment Ran', { size: 40, b: 1 })))}
    <div style="position:absolute;left:70px;top:110px;width:1236px;height:3px;background:#1a73e8"></div>
    ${[['Step one', 'Sync two clocks', 'in the lab.'], ['Step two', 'Fly one clock', 'around the world.'], ['Step three', 'Compare them', 'after landing.']].map(([t, a, c], k) => `
      <div style="position:absolute;left:${80 + k * 430}px;top:190px;width:340px;height:300px;border:2px solid #5f6368;border-radius:18px;background:#fff"></div>
      <div style="position:absolute;left:${110 + k * 430}px;top:215px;font-size:28px">${ln(L(t, { b: 1, c: '#1a73e8' }))}</div>
      <div style="position:absolute;left:${110 + k * 430}px;top:262px;width:280px;height:2px;background:#dadce0"></div>
      <div style="position:absolute;left:${110 + k * 430}px;top:290px;font-size:22px;line-height:1.5">${ln(L(a))}${ln(L(c))}</div>`).join('')}
    ${clock(185, 390, 80)}${planet(615, 385, 90)}${clock(1045, 390, 80, '#e53935')}
    <svg style="position:absolute;left:0;top:0" width="1376" height="768"><path d="M425 340 H500" stroke="#5f6368" stroke-width="4"/><path d="M500 330 L515 340 L500 350Z" fill="#5f6368"/><path d="M855 340 H930" stroke="#5f6368" stroke-width="4"/><path d="M930 330 L945 340 L930 350Z" fill="#5f6368"/></svg>
    ${pos(80, 560, ln(L('Each step took about a week.', { c: '#5f6368' })), 'font-size:22px')}` },
  // 5. A chart (axes, grid, a curve, numbers on the axes) with labels on it and text beside it
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    ${pos(70, 40, ln(L('Clocks Drift With Height', { size: 40, b: 1 })))}
    <svg class="pic" style="position:absolute;left:80px;top:130px" width="720" height="520"><g stroke="#e0e0e0" stroke-width="1">${[0, 1, 2, 3, 4].map((k) => `<line x1="60" y1="${40 + k * 100}" x2="700" y2="${40 + k * 100}"/>`).join('')}</g>
      <line x1="60" y1="440" x2="700" y2="440" stroke="#424242" stroke-width="3"/><line x1="60" y1="20" x2="60" y2="440" stroke="#424242" stroke-width="3"/>
      <path d="M60 430 C200 400 330 330 450 230 S640 80 700 50" fill="none" stroke="#1e88e5" stroke-width="5"/>
      <g font-family="Inter" font-size="18" fill="#424242">${[0, 10, 20, 30, 40].map((v, k) => `<text x="22" y="${446 - k * 100}">${v}</text>`).join('')}${[0, 5, 10, 15, 20].map((v, k) => `<text x="${54 + k * 160}" y="470">${v}</text>`).join('')}</g></svg>
    ${pos(420, 230, ln(L('faster at the top', { fig: 1, c: '#1e88e5' })), 'font-size:22px')}
    ${pos(860, 160, `<div style="width:440px;font-size:24px;line-height:1.55">${ln(L('Higher clocks run a little'))}${ln(L('faster than clocks on the'))}${ln(L('ground, by a few billionths'))}${ln(L('of a second each day.'))}</div>`)}` },
  // 6. Everything inside a frame: a title, a photo with labels on it, a drawing, labels beside it
  { font: 'Inter', bg: '#f5f0e6', html: (ln) => `
    <div style="position:absolute;left:30px;top:24px;width:1310px;height:710px;border:3px solid #1a237e"></div>
    ${pos(70, 50, ln(L('TIME IS FLEXIBLE', { size: 50, b: 1, c: '#1a237e' })))}
    ${pos(70, 120, ln(L('(And why your head is older than your feet)', { c: '#1a237e' })), 'font-size:26px')}
    <div class="pic" style="position:absolute;left:80px;top:200px;width:560px;height:420px;border-radius:10px;background:${TEX(9, 0.05, '#b0bec5', '#263238')};background-size:cover">
      <div style="position:absolute;left:24px;top:22px;font-size:26px">${ln(L('Atomic clock', { fig: 1, b: 1, c: '#ffffff' }))}</div></div>
    ${planet(820, 260, 300)}
    ${pos(1150, 300, ln(L('EARTH', { fig: 1, b: 1, c: '#1a237e' })), 'font-size:24px')}
    ${pos(1150, 470, ln(L('GRAVITY', { fig: 1, b: 1, c: '#1a237e' })), 'font-size:24px')}` }
];

module.exports = { FONTS, slides, markup: true };
