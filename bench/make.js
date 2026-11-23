// Rebuild the benchmark data from the slide definitions.
//   node bench/make.js            all sets
//   node bench/make.js 07-structure  one set
// The PDFs are committed, so the benchmark stays the same from run to run; only
// rebuild a set when you change its slides (and then save a new baseline).
// Needs network once for the Google Fonts the slides use.
const fs = require('fs');
const path = require('path');
const { buildSet } = require('./lib/build');

(async () => {
  const root = path.join(__dirname, 'sets');
  const only = process.argv.slice(2);
  const sets = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'slides.js'))).filter((d) => !only.length || only.includes(d)).sort();
  for (const set of sets) {
    const info = await buildSet(path.join(root, set));
    console.log(`${set}: ${info.slides} slides, ${info.lines} lines of text, ${info.pictures} pictures`);
  }
})();
