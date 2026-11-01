// Bundles the Stageshow demos into one static script + stylesheet for the
// plain-HTML website: website/features/stage/stage.js and stage.css.
import * as esbuild from 'esbuild'

const options = {
  entryPoints: { stage: 'src/entry.tsx' },
  outdir: '../website/features/stage',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
  define: {
    'process.env.NODE_ENV': '"production"',
    // The kit's brand registry builds asset URLs from import.meta.url; an IIFE
    // bundle has none, so give it the folder the bundle is served from.
    'import.meta.url': '"https://www.notebooktools.com/features/stage/stage.js"',
  },
  legalComments: 'eof',
  logLevel: 'info',
}

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
} else {
  await esbuild.build(options)
}
