// Italic quotes, captions and titles
// Each slide: html(ln) where ln(L(text, opts)) places one line of text and records it in the truth.
// opts: b bold, c colour, s serif, fig (a label on a picture), lab (bold "Label:" lead-in), size.
// Pictures carry class "pic" (their boxes are the picture truth).
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Lato:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Open+Sans:wght@400;700&display=block';
// L(text, opts): one line. opts: b (bold), c (colour), s (serif), fig (figure label), lab (bold label before colon)
const L = (t, o = {}) => ({ t, ...o });
const slides = [
  { font: 'Inter', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('What Customers Told Us', { b: 1, size: 48 }))}</div>
    <div style="position:absolute;left:70px;top:200px;width:1200px;font-size:30px;line-height:1.5;font-style:italic">${ln(L('“The new dashboard saves me an hour every week.”', { c: '#333333' }))}</div>
    <div style="position:absolute;left:70px;top:270px;font-size:24px">${ln(L('Operations manager, retail', { c: '#5f6368' }))}</div>
    <div style="position:absolute;left:70px;top:380px;width:1200px;font-size:30px;line-height:1.5;font-style:italic">${ln(L('“Setup took ten minutes, not ten days.”', { c: '#333333' }))}</div>
    <div style="position:absolute;left:70px;top:450px;font-size:24px">${ln(L('Head of IT, logistics', { c: '#5f6368' }))}</div>` },
  { font: 'PT Serif', bg: '#faf7f0', html: (ln) => `
    <div style="position:absolute;left:90px;top:70px">${ln(L('A Note on Method', { b: 1, s: 1, size: 50 }))}</div>
    <div style="position:absolute;left:90px;top:200px;width:1150px;font-size:28px;line-height:1.6">
      ${ln(L('We interviewed forty teachers across six schools.', { s: 1 }))}
      ${ln(L('Each interview lasted about an hour.', { s: 1 }))}</div>
    <div style="position:absolute;left:90px;top:360px;width:1150px;font-size:28px;line-height:1.6;font-style:italic">
      ${ln(L('All names have been changed to protect privacy.', { s: 1 }))}</div>` },
  { font: 'Lato', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:70px;top:60px">${ln(L('Coastal Erosion', { b: 1, size: 50 }))}<div style="font-style:italic">${ln(L('How the shoreline moved in thirty years', { size: 30, c: '#546e7a' }))}</div></div>
    <div style="position:absolute;left:70px;top:230px;width:640px;height:330px;border-radius:16px;background:linear-gradient(160deg,#81d4fa,#0277bd)"></div>
    <div style="position:absolute;left:70px;top:580px;font-size:22px;font-style:italic">${ln(L('Satellite view of the bay, 2023.', { c: '#5f6368' }))}</div>
    <div style="position:absolute;left:780px;top:240px;width:520px;font-size:26px;line-height:1.5">${ln(L('The cliffs lost about'))}${ln(L('two metres every year.'))}</div>` },
  { font: 'Merriweather', bg: '#ffffff', html: (ln) => `
    <div style="position:absolute;left:90px;top:70px;font-family:'Open Sans'">${ln(L('Further Reading', { b: 1, size: 48 }))}</div>
    <div style="position:absolute;left:90px;top:200px;width:1180px;font-size:26px;line-height:1.8;font-style:italic">
      ${ln(L('The Structure of Scientific Revolutions', { s: 1 }))}
      ${ln(L('The Double Helix', { s: 1 }))}
      ${ln(L('Silent Spring', { s: 1 }))}</div>
    <div style="position:absolute;left:90px;top:470px;width:1180px;font-size:26px;line-height:1.8">
      ${ln(L('Available from the school library.', { s: 1 }))}</div>` }
];

module.exports = { FONTS, slides };
