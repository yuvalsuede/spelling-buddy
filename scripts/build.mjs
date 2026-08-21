#!/usr/bin/env node
/**
 * Build the distributable bundles.
 *
 *   dist/spelling-buddy.global.js   IIFE, window.SpellingBuddy — drop in a <script>
 *   dist/spelling-buddy.esm.js      ESM, for bundlers that want one file
 *
 * The source is already plain ESM with no dependencies, so `src/` is directly
 * importable too — this exists purely for the no-build-step host.
 */
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

const common = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'info',
};

await build({ ...common, format: 'iife', globalName: 'SpellingBuddy',
              outfile: 'dist/spelling-buddy.global.js' });
await build({ ...common, format: 'iife', globalName: 'SpellingBuddy', minify: true,
              outfile: 'dist/spelling-buddy.global.min.js' });
await build({ ...common, format: 'esm', outfile: 'dist/spelling-buddy.esm.js' });
await build({ ...common, format: 'esm', minify: true, outfile: 'dist/spelling-buddy.esm.min.js' });

/* The live docs page ships the rig inlined so it works from a file:// URL with
   no server and no network. Regenerating it here is the only thing that keeps
   it from drifting: a hand-pasted bundle silently documents an old version. */
{
  const { readFile, writeFile } = await import('node:fs/promises');
  const page = 'docs/index.html';
  const html = await readFile(page, 'utf8');
  const bundle = await readFile('dist/spelling-buddy.global.js', 'utf8');
  const re = /<!-- rig:begin -->[\s\S]*?<!-- rig:end -->/;
  if (!re.test(html)) throw new Error(`${page}: rig:begin/rig:end markers missing`);
  await writeFile(page, html.replace(re, `<!-- rig:begin --><script>\n${bundle}</script><!-- rig:end -->`));
  console.log(`  ${page.padEnd(38)} rig inlined`);
}

const { statSync } = await import('node:fs');
for (const f of ['global', 'global.min', 'esm', 'esm.min']) {
  const p = `dist/spelling-buddy.${f}.js`;
  console.log(`  ${p.padEnd(38)} ${(statSync(p).size / 1024).toFixed(1)} kB`);
}
