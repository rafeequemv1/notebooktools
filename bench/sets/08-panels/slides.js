// Panels and boxes that touch what they hold: panels sharing a border, a 2x2
// storyboard, callouts whose tail touches the drawing, cards with an icon on
// their edge, a flowchart of boxes and arrows, a table with a picture touching
// its cell lines. Control: a box drawn with lines (a 3D cube) is one picture.
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Nunito+Sans:wght@400;700&display=block';
const L = (t, o = {}) => ({ t, ...o });
const pos = (x, y, inner, extra = '') => `<div style="position:absolute;left:${x}px;top:${y}px;${extra}">${inner}</div>`;
const clock = (x, y, s, col = '#1e88e5') => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="${col}" stroke-width="7"/><path d="M50 50 L50 22 M50 50 L70 60" stroke="#263238" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="50" r="5" fill="#e53935"/></svg>`;
const house = (x, y, s) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M10 50 L50 12 L90 50Z" fill="#ef5350" stroke="#b71c1c" stroke-width="3"/><rect x="20" y="50" width="60" height="48" fill="#ffe0b2" stroke="#8d6e63" stroke-width="3"/><rect x="42" y="68" width="16" height="30" fill="#8d6e63"/></svg>`;
const tree = (x, y, s) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s * 0.7}" height="${s}" viewBox="0 0 70 100"><circle cx="35" cy="35" r="30" fill="#66bb6a" stroke="#2e7d32" stroke-width="3"/><rect x="29" y="62" width="12" height="38" fill="#795548"/></svg>`;
const star = (x, y, s, col) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${s}" height="${s}" viewBox="0 0 100 100"><path d="M50 6 L62 38 L96 38 L68 58 L79 92 L50 72 L21 92 L32 58 L4 38 L38 38Z" fill="${col}" stroke="#5d4037" stroke-width="3"/></svg>`;
const car = (x, y, w) => `<svg class="pic" style="position:absolute;left:${x}px;top:${y}px" width="${w}" height="${w * 0.5}" viewBox="0 0 200 100"><path d="M10 70 L30 40 L80 30 L130 30 L170 50 L190 70Z" fill="#42a5f5" stroke="#0d47a1" stroke-width="4"/><circle cx="55" cy="75" r="16" fill="#263238"/><circle cx="150" cy="75" r="16" fill="#263238"/></svg>`;

const slides = [
  // 1. Two panels sharing one frame and a divider; drawings stand on each panel's floor line
  { font: 'Nunito Sans', bg: '#fbf8f1', html: (ln) => `
    ${pos(60, 36, ln(L('Home and Away', { size: 40 })))}
    <div style="position:absolute;left:70px;top:120px;width:1230px;height:520px;border:3px solid #263238;background:#fff"></div>
    <div style="position:absolute;left:684px;top:120px;width:3px;height:526px;background:#263238"></div>
    <div style="position:absolute;left:73px;top:560px;width:1224px;height:3px;background:#90a4ae"></div>
    ${house(150, 300, 260)}${tree(440, 350, 210)}
    ${car(760, 400, 320)}${clock(1110, 180, 140)}
    ${pos(100, 140, ln(L('At home', { fig: 1, b: 1 })), 'font-size:26px')}
    ${pos(714, 140, ln(L('On the road', { fig: 1, b: 1 })), 'font-size:26px')}
    ${pos(70, 670, ln(L('Each panel is its own picture.', { c: '#5f6368' })), 'font-size:22px')}` },
  // 2. A 2x2 storyboard: shared borders, a caption inside each panel
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    ${pos(60, 30, ln(L('Four Steps', { size: 38, b: 1 })))}
    <div style="position:absolute;left:180px;top:100px;width:1000px;height:620px;border:3px solid #37474f"></div>
    <div style="position:absolute;left:680px;top:100px;width:3px;height:626px;background:#37474f"></div>
    <div style="position:absolute;left:180px;top:410px;width:1006px;height:3px;background:#37474f"></div>
    ${clock(330, 130, 180)}${star(830, 125, 190, '#ffca28')}${house(330, 435, 185)}${tree(860, 435, 190)}
    ${pos(200, 360, ln(L('1. Set the time')), 'font-size:22px')}${pos(700, 360, ln(L('2. Make a wish')), 'font-size:22px')}
    ${pos(200, 670, ln(L('3. Go home')), 'font-size:22px')}${pos(700, 670, ln(L('4. Rest')), 'font-size:22px')}` },
  // 3. Callouts whose tail touches the drawing they talk about
  { font: 'Inter', bg: '#fbf8f1', html: (ln) => `
    ${pos(60, 36, ln(L('Who Said What', { size: 40 })))}
    ${clock(160, 330, 240, '#c9a227')}${star(860, 330, 240, '#ab47bc')}
    <svg style="position:absolute;left:0;top:0;overflow:visible" width="1376" height="768">
      <path d="M90 130 H520 Q540 130 540 150 V250 Q540 270 520 270 H310 L282 336 L270 270 H90 Q70 270 70 250 V150 Q70 130 90 130Z" fill="#fff" stroke="#37474f" stroke-width="3"/>
      <path d="M800 130 H1250 Q1270 130 1270 150 V250 Q1270 270 1250 270 H1000 L982 336 L960 270 H800 Q780 270 780 250 V150 Q780 130 800 130Z" fill="#fff" stroke="#37474f" stroke-width="3"/></svg>
    <div style="position:absolute;left:100px;top:160px;font-size:22px;line-height:1.5">${ln(L('**Clock:** I keep the same'))}${ln(L('time for everyone.'))}</div>
    <div style="position:absolute;left:810px;top:160px;font-size:22px;line-height:1.5">${ln(L('**Star:** my light took'))}${ln(L('years to reach you.'))}</div>` },
  // 4. Cards with an icon sitting on their top edge, joined by arrows
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    ${pos(70, 36, ln(L('Plan, Build, Ship', { size: 40, b: 1 })))}
    ${[['Plan', 'Write the brief'], ['Build', 'Make the first version'], ['Ship', 'Release and listen']].map(([t, d], k) => `
      <div style="position:absolute;left:${90 + k * 420}px;top:250px;width:330px;height:280px;border:2px solid #455a64;border-radius:20px;background:#fff"></div>
      <div style="position:absolute;left:${120 + k * 420}px;top:350px;font-size:30px">${ln(L(t, { b: 1 }))}</div>
      <div style="position:absolute;left:${120 + k * 420}px;top:400px;font-size:22px">${ln(L(d))}</div>`).join('')}
    ${clock(195, 180, 120)}${star(615, 175, 130, '#ffca28')}${clock(1035, 180, 120, '#e53935')}
    <svg style="position:absolute;left:0;top:0" width="1376" height="768"><path d="M420 390 H500" stroke="#455a64" stroke-width="4"/><path d="M500 380 L515 390 L500 400Z" fill="#455a64"/><path d="M840 390 H920" stroke="#455a64" stroke-width="4"/><path d="M920 380 L935 390 L920 400Z" fill="#455a64"/></svg>` },
  // 5. A flowchart (boxes of text and arrows: all background) and a cube drawn with lines (one picture)
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    ${pos(70, 36, ln(L('From Idea to Answer', { size: 40, b: 1 })))}
    ${[['Question', 160], ['Experiment', 330], ['Answer', 500]].map(([t, y]) => `<div style="position:absolute;left:120px;top:${y}px;width:300px;height:100px;border:2px solid #1a73e8;border-radius:8px;background:#e8f0fe"></div><div style="position:absolute;left:120px;top:${y + 34}px;width:300px;text-align:center;font-size:26px">${ln(L(t, { c: '#1a237e' }))}</div>`).join('')}
    <svg style="position:absolute;left:0;top:0" width="1376" height="768"><path d="M270 262 V318" stroke="#1a73e8" stroke-width="4"/><path d="M260 316 L270 330 L280 316Z" fill="#1a73e8"/><path d="M270 432 V488" stroke="#1a73e8" stroke-width="4"/><path d="M260 486 L270 500 L280 486Z" fill="#1a73e8"/></svg>
    <svg class="pic" style="position:absolute;left:720px;top:170px" width="460" height="460" viewBox="0 0 460 460"><g fill="none" stroke="#3949ab" stroke-width="5"><rect x="60" y="140" width="240" height="240"/><path d="M60 140 L160 60 H400 L300 140 M400 60 V300 L300 380"/></g><g stroke="#e53935" stroke-width="4" stroke-dasharray="10 8"><path d="M180 150 V370"/></g><circle cx="180" cy="260" r="12" fill="#e53935"/></svg>` },
  // 6. A table with header fills and pictures touching the cell lines
  { font: 'Inter', bg: '#fbf8f1', html: (ln) => `
    ${pos(60, 36, ln(L('What Each Clock Shows', { size: 40, b: 1 })))}
    <table style="position:absolute;left:90px;top:130px;border-collapse:collapse;font-size:22px">
      <tr style="height:54px"><td style="width:380px;border:2px solid #263238;background:#a5d6a7;text-align:center">${ln(L('Clock', { b: 1 }))}</td><td style="width:780px;border:2px solid #263238;background:#ffcc80;text-align:center">${ln(L('What it shows', { b: 1 }))}</td></tr>
      <tr style="height:220px"><td style="border:2px solid #263238"></td><td style="border:2px solid #263238;padding-left:30px">${ln(L('Time on the ground'))}</td></tr>
      <tr style="height:220px"><td style="border:2px solid #263238"></td><td style="border:2px solid #263238;padding-left:30px">${ln(L('Time on a fast plane'))}</td></tr>
    </table>
    ${clock(170, 190, 216)}${clock(170, 410, 216, '#e53935')}` }
];

module.exports = { FONTS, slides, markup: true };
