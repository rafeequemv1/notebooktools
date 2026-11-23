// Business slides: bullets, two columns, timelines, stats, a chart
// Each slide: html(ln) where ln(L(text, opts)) places one line of text and records it in the truth.
// opts: b bold, c colour, s serif, fig (a label on a picture), lab (bold "Label:" lead-in), size.
// Pictures carry class "pic" (their boxes are the picture truth).
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Roboto+Condensed:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&display=block';
// L(text, opts): one line. opts: b (bold), c (colour), s (serif), fig (figure label), lab (bold label before colon)
const L = (t, o = {}) => ({ t, ...o });
const slides = [
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Quarterly Market Review', { b: 1, size: 54 }))}${ln(L('How demand shifted across regions in 2024', { size: 28, c: '#5f6368' }))}</div>
    <div style="position:absolute;left:70px;top:250px;width:1200px;font-size:26px;line-height:1.5">
      ${ln(L('• Growth: Revenue rose twelve percent compared with the previous year.', { lab: 1 }))}
      ${ln(L('• Margins: Operating costs fell after the new supplier contracts.', { lab: 1 }))}
      ${ln(L('• Risks: Currency swings could reduce profits in the second half.', { lab: 1 }))}
      ${ln(L('• Outlook: We expect steady demand from enterprise customers.', { lab: 1 }))}</div>` },
  { font: 'Lato', bg: '#f6f3ee', html: (ln) => `
    <div style="position:absolute;left:60px;top:50px">${ln(L('Why Bees Matter for Farming', { b: 1, size: 50, c: '#1f3b57' }))}</div>
    <div style="position:absolute;left:60px;top:170px;width:560px;font-size:25px;line-height:1.45">
      ${ln(L('The Pollination Problem', { b: 1, c: '#a61b29', size: 30 }))}
      ${ln(L('Roughly one third of the food we eat', { c: '#222222' }))}
      ${ln(L('depends on insects moving pollen', { c: '#222222' }))}
      ${ln(L('between flowers during the spring.', { c: '#222222' }))}</div>
    <div style="position:absolute;left:720px;top:170px;width:600px;font-size:25px;line-height:1.45">
      ${ln(L('What Farmers Can Do', { b: 1, c: '#a61b29', size: 30 }))}
      ${ln(L('Plant wildflower strips near fields,', { c: '#222222' }))}
      ${ln(L('reduce spraying while crops bloom,', { c: '#222222' }))}
      ${ln(L('and leave old hedges standing.', { c: '#222222' }))}</div>` },
  { font: 'Open Sans', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:80px;top:60px">${ln(L('A Short History of Printing', { b: 1, size: 50 }))}<div style="font-family:Lora">${ln(L('From movable type to the modern press', { s: 1, size: 30, c: '#444444' }))}</div></div>
    <div style="position:absolute;left:80px;top:250px;width:1200px;font-family:Merriweather;font-size:24px;line-height:1.7">
      ${ln(L('Gutenberg, J. (1455). The Forty-Two Line Bible. Mainz.', { s: 1 }))}
      ${ln(L('Eisenstein, E. (1979). The Printing Press as an Agent of Change.', { s: 1 }))}
      ${ln(L('Febvre, L., & Martin, H. (1958). The Coming of the Book.', { s: 1 }))}
      ${ln(L('Johns, A. (1998). The Nature of the Book. Chicago Press.', { s: 1 }))}</div>` },
  { font: 'Roboto', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:60px;top:40px">${ln(L('Sales Over Twelve Months', { b: 1, size: 46 }))}</div>
    <svg style="position:absolute;left:60px;top:140px" width="820" height="520" font-family="Roboto" font-size="20"><g class="pic">
      <line x1="70" y1="20" x2="70" y2="460" stroke="#444"/><line x1="70" y1="460" x2="800" y2="460" stroke="#444"/>
      ${[0, 100, 200, 300, 400].map((v, i) => `<text x="20" y="${465 - i * 105}">${v}</text>`).join('')}
      ${['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((m, i) => `<text x="${90 + i * 120}" y="490">${m}</text>`).join('')}
      <polyline fill="none" stroke="#1a73e8" stroke-width="4" points="90,400 210,350 330,300 450,210 570,240 690,120 780,90"/>
      <polyline fill="none" stroke="#e8710a" stroke-width="4" points="90,430 210,420 330,380 450,370 570,330 690,300 780,280"/>
      <text x="600" y="80" fill="#1a73e8">Online</text><text x="640" y="320" fill="#e8710a">Stores</text></g></svg>
    <div style="position:absolute;left:930px;top:180px;width:380px;font-size:24px;line-height:1.5">
      ${ln(L('Online sales doubled', { c: '#202124' }))}
      ${ln(L('after the summer launch,', { c: '#202124' }))}
      ${ln(L('while store sales grew', { c: '#202124' }))}
      ${ln(L('slowly but steadily.', { c: '#202124' }))}</div>` },
  { font: 'Inter', bg: '#111318', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Designing for Dark Mode', { b: 1, size: 52, c: '#ffffff' }))}</div>
    <div style="position:absolute;left:70px;top:190px;width:1200px;font-size:27px;line-height:1.55">
      ${ln(L('Contrast', { b: 1, c: '#8ab4f8', size: 32 }))}
      ${ln(L('Light grey text on a near black background is easier', { c: '#e8eaed' }))}
      ${ln(L('on the eyes than pure white on pure black.', { c: '#e8eaed' }))}
      <div style="height:24px"></div>
      ${ln(L('Colour', { b: 1, c: '#8ab4f8', size: 32 }))}
      ${ln(L('Desaturated accent colours stop bright buttons', { c: '#e8eaed' }))}
      ${ln(L('from glowing against the dark surface.', { c: '#e8eaed' }))}</div>` },
  { font: 'Roboto Condensed', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:60px;top:50px">${ln(L('The Water Cycle Explained', { b: 1, size: 54 }))}${ln(L('Where every raindrop comes from', { size: 30 }))}</div>
    <div style="position:absolute;left:60px;top:240px;width:600px;font-size:27px;line-height:1.35;color:#5c1a1a">
      ${ln(L('Evaporation:', { b: 1, c: '#5c1a1a', size: 30 }))}
      ${ln(L('The sun heats oceans and lakes', { c: '#5c1a1a' }))}
      ${ln(L('until water rises as vapour.', { c: '#5c1a1a' }))}
      <div style="height:18px"></div>
      ${ln(L('Condensation:', { b: 1, c: '#5c1a1a', size: 30 }))}
      ${ln(L('Cooling vapour forms the clouds', { c: '#5c1a1a' }))}
      ${ln(L('we see high in the sky.', { c: '#5c1a1a' }))}</div>
    <div style="position:absolute;left:800px;top:260px;width:420px;height:300px;border-radius:24px;background:linear-gradient(135deg,#7fb3e6,#2b5f99)"></div>
    <div style="position:absolute;left:840px;top:300px;color:#fff;font-size:24px">${ln(L('Clouds', { b: 1, c: '#ffffff', fig: 1 }))}</div>` },
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:0;width:1376px;top:50px;text-align:center;letter-spacing:0.08em">${ln(L('FROM IDEA TO LAUNCH', { b: 1, size: 50 }))}</div>
    ${['Research', 'Prototype', 'Testing', 'Launch'].map((t, i) => `<div style="position:absolute;left:${80 + i * 315}px;top:230px;width:250px;height:150px;border:3px solid #1a73e8;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px">${ln(L(t, { b: 1, fig: 1 }))}</div>`).join('')}
    <div style="position:absolute;left:80px;top:460px;width:1200px;font-size:25px;line-height:1.5">
      ${ln(L('Each stage ends with a review before the team moves on,', { c: '#3c4043' }))}
      ${ln(L('so problems are caught while they are still cheap to fix.', { c: '#3c4043' }))}</div>` },
  { font: 'Lato', bg: 'linear-gradient(160deg,#e9f1fb,#c9d9ee)', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Climate Basics', { b: 1, size: 52, c: '#0b3d6b' }))}</div>
    <div style="position:absolute;left:70px;top:190px;width:1200px;font-size:28px;line-height:1.6">
      ${ln(L('Burning fuel releases CO₂ into the air.', { c: '#1b1b1b' }))}
      ${ln(L('Plants turn CO₂ and H₂O into sugar and oxygen.', { c: '#1b1b1b' }))}
      ${ln(L('Global temperatures rose about 1.1 °C since 1900.', { c: '#1b1b1b' }))}</div>
    <div style="position:absolute;left:70px;top:520px;width:1200px;font-size:26px;font-style:italic">${ln(L('“The best time to plant a tree was twenty years ago.”', { c: '#7a1f2b' }))}</div>` }
];

module.exports = { FONTS, slides };
