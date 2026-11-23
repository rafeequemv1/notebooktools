// Mixed: a bar chart, number badges, gradients, dark slides, a coloured card
// Each slide: html(ln) where ln(L(text, opts)) places one line of text and records it in the truth.
// opts: b bold, c colour, s serif, fig (a label on a picture), lab (bold "Label:" lead-in), size.
// Pictures carry class "pic" (their boxes are the picture truth).
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&family=DM+Sans:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Karla:wght@400;700&family=Rubik:wght@400;700&family=Fira+Sans:wght@400;700&family=Crimson+Text:wght@400;700&family=Barlow+Condensed:wght@400;700&display=block';
// L(text, opts): one line. opts: b (bold), c (colour), s (serif), fig (figure label), lab (bold label before colon)
const L = (t, o = {}) => ({ t, ...o });
const slides = [
  { font: 'IBM Plex Sans', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:60px;top:45px">${ln(L('Remote Work: What the Data Says', { b: 1, size: 46, c: '#1a237e' }))}${ln(L('Findings from a survey of 4,000 employees', { size: 26, c: '#5f6368' }))}</div>
    <div style="position:absolute;left:60px;top:200px;width:600px;font-size:23px;line-height:1.5">
      ${ln(L('Productivity: Output rose for most', { lab: 1 }))}
      ${ln(L('teams after the first three months.'))}
      <div style="height:16px"></div>
      ${ln(L('Wellbeing: Staff reported less stress', { lab: 1 }))}
      ${ln(L('but more feelings of isolation.'))}</div>
    <svg style="position:absolute;left:720px;top:190px" width="600" height="420" font-family="IBM Plex Sans" font-size="18"><g class="pic">
      ${[0, 25, 50, 75, 100].map((v, i) => `<text x="0" y="${365 - i * 80}">${v}</text>`).join('')}
      ${[60, 82, 45, 71].map((v, i) => `<rect x="${70 + i * 130}" y="${360 - v * 3.2}" width="80" height="${v * 3.2}" fill="#3949ab"/>`).join('')}
      ${['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => `<text x="${95 + i * 130}" y="395">${q}</text>`).join('')}</g></svg>` },
  { font: 'DM Sans', bg: '#f7f9fc', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Our Onboarding Process', { b: 1, size: 48 }))}</div>
    ${['Welcome call', 'Account setup', 'First project'].map((t, i) => `
      <div style="position:absolute;left:${70 + i * 420}px;top:190px;width:64px;height:64px;border-radius:50%;background:#e8710a;color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center">${ln(L('0' + (i + 1), { b: 1, c: '#ffffff', fig: 1 }))}</div>
      <div style="position:absolute;left:${70 + i * 420}px;top:280px;width:360px;font-size:24px;line-height:1.45">${ln(L(t, { b: 1, size: 28 }))}${ln(L(['We learn your goals', 'Logins and tools', 'A small first win'][i], { c: '#444444' }))}</div>`).join('')}` },
  { font: 'Libre Baskerville', bg: '#fbf8f1', html: (ln) => `
    <div style="position:absolute;left:90px;top:70px">${ln(L('The Origins of Coffee', { b: 1, s: 1, size: 50, c: '#4e2a14' }))}</div>
    <div style="position:absolute;left:90px;top:200px;width:1180px;font-size:25px;line-height:1.7">
      ${ln(L('Legend says a goat herder in Ethiopia noticed his', { s: 1, c: '#2d2d2d' }))}
      ${ln(L('goats dancing after eating red berries from a shrub.', { s: 1, c: '#2d2d2d' }))}
      ${ln(L('By the fifteenth century coffee was drunk in Yemen.', { s: 1, c: '#2d2d2d' }))}</div>
    <div style="position:absolute;left:90px;top:640px;font-family:Karla;font-size:20px">${ln(L('Source: National Coffee Association, 2021.', { c: '#7a7a7a' }))}</div>` },
  { font: 'Rubik', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Results at a Glance', { b: 1, size: 48 }))}</div>
    ${[['87%', 'of customers renewed'], ['3.2x', 'faster checkout'], ['12', 'new markets']].map(([n, t], i) => `
      <div style="position:absolute;left:${70 + i * 420}px;top:230px;width:380px;line-height:1.3">${ln(L(n, { b: 1, size: 72, c: '#00897b' }))}<div style="font-size:26px">${ln(L(t, { c: '#37474f' }))}</div></div>`).join('')}` },
  { font: 'Fira Sans', bg: '#0f1720', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Security Checklist', { b: 1, size: 50, c: '#ffffff' }))}</div>
    <div style="position:absolute;left:70px;top:190px;width:1230px;font-size:26px;line-height:1.7">
      ${ln(L('• Passwords: Use a password manager for every account.', { lab: 1, c: '#cfd8dc' }))}
      ${ln(L('• Updates: Install patches within a week of release.', { lab: 1, c: '#cfd8dc' }))}
      ${ln(L('• Backups: Keep one copy offline and test restores.', { lab: 1, c: '#cfd8dc' }))}</div>` },
  { font: 'Crimson Text', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:90px;top:70px;font-family:'Barlow Condensed'">${ln(L('READING LIST FOR NEW MANAGERS', { b: 1, size: 50, c: '#263238' }))}</div>
    <div style="position:absolute;left:90px;top:200px;width:1180px;font-size:28px;line-height:1.75">
      ${ln(L('Grove, A. (1983). High Output Management.', { s: 1 }))}
      ${ln(L('Scott, K. (2017). Radical Candor.', { s: 1 }))}
      ${ln(L('Lencioni, P. (2002). The Five Dysfunctions of a Team.', { s: 1 }))}</div>` },
  { font: 'Karla', bg: 'linear-gradient(120deg,#fff3e0,#ffe0b2)', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Why Small Habits Win', { b: 1, size: 52, c: '#bf360c' }))}</div>
    <div style="position:absolute;left:70px;top:190px;width:640px;font-size:27px;line-height:1.5">
      ${ln(L('Improving by one percent a day', { c: '#3e2723' }))}
      ${ln(L('adds up to a large change over', { c: '#3e2723' }))}
      ${ln(L('a year, even if no single day', { c: '#3e2723' }))}
      ${ln(L('feels like progress.', { c: '#3e2723' }))}</div>
    <div style="position:absolute;left:800px;top:190px;width:480px;height:330px;border-radius:24px;background:radial-gradient(circle at 30% 30%,#ffcc80,#e65100)"></div>` },
  { font: 'Barlow Condensed', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Project Risks and Responses', { b: 1, size: 52, c: '#b71c1c' }))}</div>
    <div style="position:absolute;left:70px;top:180px;width:580px;font-size:27px;line-height:1.4">
      ${ln(L('Budget overrun', { b: 1, c: '#b71c1c', size: 31 }))}
      ${ln(L('Review spending every two weeks', { c: '#212121' }))}
      ${ln(L('and pause optional extras early.', { c: '#212121' }))}</div>
    <div style="position:absolute;left:720px;top:180px;width:580px;font-size:27px;line-height:1.4">
      ${ln(L('Key person leaves', { b: 1, c: '#b71c1c', size: 31 }))}
      ${ln(L('Pair people on critical work so', { c: '#212121' }))}
      ${ln(L('knowledge is never held by one.', { c: '#212121' }))}</div>` }
];

module.exports = { FONTS, slides };
