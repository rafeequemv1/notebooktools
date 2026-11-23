// Layouts: steps, timelines, comparisons, quotes, coloured cards
// Each slide: html(ln) where ln(L(text, opts)) places one line of text and records it in the truth.
// opts: b bold, c colour, s serif, fig (a label on a picture), lab (bold "Label:" lead-in), size.
// Pictures carry class "pic" (their boxes are the picture truth).
const FONTS = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Nunito:wght@400;700&family=Source+Serif+4:wght@400;700&family=Playfair+Display:wght@400;700&family=Work+Sans:wght@400;700&family=Raleway:wght@400;700&family=Oswald:wght@400;700&family=PT+Serif:wght@400;700&display=block';
// L(text, opts): one line. opts: b (bold), c (colour), s (serif), fig (figure label), lab (bold label before colon)
const L = (t, o = {}) => ({ t, ...o });
const slides = [
  { font: 'Montserrat', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:0;width:1376px;top:250px;text-align:center">${ln(L('The Future of Urban Transport', { b: 1, size: 56, c: '#0d47a1' }))}${ln(L('A briefing for the city council', { size: 30, c: '#546e7a' }))}</div>` },
  { font: 'Poppins', bg: '#fafafa', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Five Steps to Better Sleep', { b: 1, size: 46 }))}</div>
    <div style="position:absolute;left:70px;top:170px;font-size:25px;line-height:1.9">
      ${ln(L('1. Keep the same bedtime every night.'))}
      ${ln(L('2. Avoid screens for an hour before bed.'))}
      ${ln(L('3. Keep your bedroom cool and dark.'))}
      ${ln(L('4. Limit caffeine after lunch.'))}
      ${ln(L('5. Get some daylight every morning.'))}</div>` },
  { font: 'Nunito', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Company Timeline', { b: 1, size: 48, c: '#2e7d32' }))}</div>
    ${[['2012', 'Founded in a garage'], ['2015', 'First thousand customers'], ['2019', 'Opened offices in Europe'], ['2023', 'Launched the mobile app']].map(([y, t], i) => `
      <div style="position:absolute;left:${70 + i * 315}px;top:260px;width:290px;font-size:24px;line-height:1.4">${ln(L(y, { b: 1, c: '#2e7d32', size: 34 }))}${ln(L(t, { c: '#333333' }))}</div>`).join('')}
    <div style="position:absolute;left:70px;top:230px;width:1230px;height:4px;background:#a5d6a7"></div>` },
  { font: 'Source Serif 4', bg: '#fffdf8', html: (ln) => `
    <div style="position:absolute;left:90px;top:70px;font-family:'Playfair Display'">${ln(L('On Reading Slowly', { b: 1, s: 1, size: 56 }))}</div>
    <div style="position:absolute;left:90px;top:200px;width:1150px;font-size:27px;line-height:1.6">
      ${ln(L('A book read quickly is often forgotten just as quickly.', { s: 1, c: '#2b2b2b' }))}
      ${ln(L('Slow reading asks us to pause, reread and argue with', { s: 1, c: '#2b2b2b' }))}
      ${ln(L('the author, and that effort is what makes ideas stay.', { s: 1, c: '#2b2b2b' }))}</div>` },
  { font: 'Work Sans', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Plan Comparison', { b: 1, size: 46 }))}</div>
    <div style="position:absolute;left:70px;top:160px;width:1230px;font-size:24px">
      ${[['Feature', 'Basic', 'Premium'], ['Storage', '10 GB', '1 TB'], ['Users', 'One', 'Unlimited'], ['Support', 'Email', 'Phone and email']].map((r, i) => `<div style="display:flex;border-bottom:1px solid #ddd;padding:14px 0">${r.map((c, j) => `<div style="width:410px">${ln(L(c, { b: i === 0 ? 1 : 0, fig: 1 }))}</div>`).join('')}</div>`).join('')}</div>
    <div style="position:absolute;left:70px;top:560px;width:1230px;font-size:24px">${ln(L('Prices include tax and can be cancelled at any time.', { c: '#5f6368' }))}</div>` },
  { font: 'Raleway', bg: '#1b2430', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Lessons From the Pilot', { b: 1, size: 50, c: '#ffffff' }))}</div>
    <div style="position:absolute;left:70px;top:190px;width:1230px;font-size:26px;line-height:1.7;color:#d7dde5">
      ${ln(L('• Speed: Teams shipped features twice as fast.', { lab: 1, c: '#d7dde5' }))}
      ${ln(L('• Quality: Bug reports dropped by a third.', { lab: 1, c: '#d7dde5' }))}
      ${ln(L('• Morale: Most people asked to keep the new process.', { lab: 1, c: '#d7dde5' }))}</div>` },
  { font: 'Oswald', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:50px">${ln(L('Three Habitats Under Threat', { b: 1, size: 54, c: '#4e342e' }))}</div>
    ${['Coral reefs', 'Rainforests', 'Wetlands'].map((t, i) => `
      <div style="position:absolute;left:${70 + i * 420}px;top:190px;width:380px;height:240px;border-radius:18px;background:linear-gradient(135deg,${['#4fc3f7,#0277bd', '#81c784,#2e7d32', '#a1887f,#5d4037'][i]})"></div>
      <div style="position:absolute;left:${70 + i * 420}px;top:450px;width:380px;font-size:26px;line-height:1.35">${ln(L(t, { b: 1, c: '#4e342e' }))}${ln(L(['Warming seas bleach them', 'Logging clears vast areas', 'Drained for farmland'][i], { c: '#5d4037' }))}</div>`).join('')}` },
  { font: 'PT Serif', bg: '#f3f1ec', html: (ln) => `
    <div style="position:absolute;left:110px;top:230px;width:1150px;font-size:40px;line-height:1.45">
      ${ln(L('“We do not inherit the earth from our ancestors;', { s: 1, c: '#3e2723' }))}
      ${ln(L('we borrow it from our children.”', { s: 1, c: '#3e2723' }))}</div>
    <div style="position:absolute;left:110px;top:420px;font-family:'Work Sans';font-size:24px">${ln(L('Traditional proverb', { c: '#8d6e63' }))}</div>` }
];

module.exports = { FONTS, slides };
