#!/usr/bin/env node
/**
 * Check that the documentation is true.
 *
 * A recipe is worse than no recipe when it is out of date, because an agent
 * copying it has no way to tell. Prose does not fail a build, so this file
 * makes it fail one:
 *
 *   1. Every code block parses. A typo in a snippet nobody runs is a bug an
 *      agent inherits verbatim.
 *   2. Every name imported from `spelling-buddy` actually exists. This is the
 *      one that rots: a method gets renamed, the tests all pass, and the
 *      recipe keeps telling people to call the old one.
 *   3. Every phase name and every `<Buddy>` prop the recipes use is real. A
 *      wrong phase fails SILENTLY at runtime — the rig no-ops and the
 *      character just sits there.
 *   4. The recipes pass `check-usage.mjs`, the linter they tell readers to
 *      run. Guidance that violates its own rules teaches the violation.
 *   5. Every file `llms.txt` and `AGENTS.md` link to exists.
 *
 *   node scripts/check-recipes.mjs
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as API from '../src/index.js';
import { PHASE_NAMES } from '../src/core/phases.js';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.recipes-check');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✕ ${name}${extra ? '  — ' + extra : ''}`); }
};
const section = t => console.log(`\n${t}`);

/* ---------------------------------------------------------------- blocks */

/** Fenced code blocks, with the language and the `// path` first line. */
function blocks(md, file) {
  const out = [];
  const re = /```(\w+)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md))) {
    const [, lang, code] = m;
    const line = md.slice(0, m.index).split('\n').length;
    const path = (code.match(/^\s*\/\/\s*([\w./[\]@-]+\.\w+)\s*$/m) || [])[1] || null;
    out.push({ lang, code, line, path, file });
  }
  return out;
}

const RECIPES = await readFile(join(ROOT, 'RECIPES.md'), 'utf8');
const AGENTS = await readFile(join(ROOT, 'AGENTS.md'), 'utf8');
const LLMS = await readFile(join(ROOT, 'llms.txt'), 'utf8');

const CODE = [...blocks(RECIPES, 'RECIPES.md'), ...blocks(AGENTS, 'AGENTS.md')];
const TS = CODE.filter(b => b.lang === 'tsx' || b.lang === 'ts');

/* -------------------------------------------------------------- 1. parses */

section('every code block parses');
{
  const esbuild = await import('esbuild');
  for (const b of TS) {
    let error = null;
    try {
      esbuild.transformSync(b.code, {
        loader: b.lang === 'tsx' ? 'tsx' : 'ts',
        jsx: 'automatic',
      });
    } catch (e) { error = e.message.split('\n')[0]; }
    ok(`${b.file}:${b.line} (${b.path ?? b.lang})`, !error, error ?? '');
  }
}

/* ------------------------------------------------------- 2. names are real */

section('every imported name exists');
{
  const exported = new Set(Object.keys(API));
  const missing = [];
  for (const b of TS) {
    const re = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]spelling-buddy['"]/g;
    let m;
    while ((m = re.exec(b.code))) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        /* Types are erased at runtime and cannot be checked against the
           module's exports; `types/index.d.ts` is their source of truth. */
        if (/^[A-Z]/.test(name) && !exported.has(name) &&
            /^(Buddy|MountHandle|Theme|Phase|[A-Z]\w*(Name|Options|Props|Input))$/.test(name)) continue;
        if (!exported.has(name)) missing.push(`${b.file}:${b.line} ${name}`);
      }
    }
  }
  ok('no recipe imports a name the package does not export',
     missing.length === 0, missing.join(', '));
}

section('every method called on the rig exists');
{
  const proto = API.Buddy.prototype;
  const bad = [];
  for (const b of CODE) {
    const re = /\b(?:buddy|rig)\s*\.\s*(\w+)\s*\(/g;
    let m;
    while ((m = re.exec(b.code))) {
      if (typeof proto[m[1]] !== 'function') bad.push(`${b.file}:${b.line} .${m[1]}()`);
    }
  }
  ok('no recipe calls a method that does not exist', bad.length === 0, bad.join(', '));
}

/* --------------------------------------------------- 3. phases and props */

section('phases and props');
{
  const bad = [];
  for (const b of TS) {
    /* A phase name that does not exist fails silently at runtime — the rig
       no-ops and the character stands there. */
    const re = /\bsetPhase\(\s*['"]([^'"]+)['"]|<Buddy\b[^>]*\bphase\s*=\s*["']([^"']+)["']/gs;
    let m;
    while ((m = re.exec(b.code))) {
      const name = m[1] ?? m[2];
      if (!PHASE_NAMES.includes(name)) bad.push(`${b.file}:${b.line} phase "${name}"`);
    }
  }
  ok('every phase named in the docs is a real phase', bad.length === 0, bad.join(', '));

  /* The wrapper's props, read from the wrapper rather than restated here, so
     renaming one breaks this check instead of quietly diverging from it. */
  const wrapper = await readFile(join(ROOT, 'integrations/nextjs/Buddy.tsx'), 'utf8');
  const declared = new Set(
    (wrapper.match(/export type BuddyProps = \{([\s\S]*?)\n\};/) || ['', ''])[1]
      .split('\n')
      .map(l => (l.match(/^\s*(\w+)\??:/) || [])[1])
      .filter(Boolean)
  );
  const unknown = [];
  for (const b of TS) {
    const re = /<Buddy\b([^>]*?)\/?>/gs;
    let m;
    while ((m = re.exec(b.code))) {
      for (const p of m[1].matchAll(/(?:^|\s)([a-zA-Z]\w*)\s*=/g)) {
        if (!declared.has(p[1]) && p[1] !== 'key') unknown.push(`${b.file}:${b.line} ${p[1]}`);
      }
    }
  }
  ok('every <Buddy> prop in the docs is declared by the wrapper',
     unknown.length === 0, `${unknown.join(', ')} — declared: ${[...declared].join(' ')}`);
}

/* ------------------------------------------- 4. the recipes pass the linter */

section('the recipes obey their own rules');
{
  await rm(TMP, { recursive: true, force: true });
  let written = 0;
  for (const b of TS) {
    if (!b.path) continue;
    const rel = b.path.replace(/^src\//, '');
    const file = join(TMP, 'src', rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, b.code);
    written++;
  }
  /* Scoped to RECIPES.md: that file's whole promise is "copy one WHOLE file",
     so a block without a destination is a fragment pretending to be a recipe.
     AGENTS.md is the contract and quotes fragments on purpose. */
  const whole = TS.filter(b => b.file === 'RECIPES.md');
  ok('every recipe declares the file it belongs in',
     whole.every(b => b.path), `${written} of ${whole.length} carry a path comment`);

  let out = '', code = 0;
  try {
    const r = await run(process.execPath,
      [join(ROOT, 'scripts/check-usage.mjs'), join(TMP, 'src'), '--wrapper', 'components/buddy']);
    out = r.stdout;
  } catch (e) { out = e.stdout || e.message; code = e.code ?? 1; }
  ok('check-usage.mjs is clean on the recipes', code === 0, out.trim().split('\n').slice(0, 4).join(' · '));
  await rm(TMP, { recursive: true, force: true });
}

/* ------------------------------------------------------------- 5. links */

section('links resolve');
{
  const broken = [];
  for (const [text, target] of [...LLMS.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => [m[1], m[2]])) {
    const rel = target.replace(/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\//, '');
    if (/^https?:/.test(rel)) continue;
    if (!existsSync(join(ROOT, rel))) broken.push(`llms.txt → ${rel} (${text})`);
  }
  for (const target of [...AGENTS.matchAll(/\]\((\.\/[^)]+)\)/g)].map(m => m[1])) {
    const rel = target.replace(/^\.\//, '').split('#')[0];
    if (!existsSync(join(ROOT, rel))) broken.push(`AGENTS.md → ${rel}`);
  }
  for (const target of [...RECIPES.matchAll(/\]\((\.\/[^)]+)\)/g)].map(m => m[1])) {
    const rel = target.replace(/^\.\//, '').split('#')[0];
    if (!existsSync(join(ROOT, rel))) broken.push(`RECIPES.md → ${rel}`);
  }
  ok('every file the docs link to exists', broken.length === 0, broken.join(', '));

  /* `package.json` promises these to anyone who installs the package. A
     missing one is a 404 in someone else's node_modules. */
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const gone = pkg.files.filter(f => !existsSync(join(ROOT, f)));
  ok('every path in package.json "files" exists', gone.length === 0, gone.join(', '));
}

console.log(`\n${fail ? '✕' : '✓'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
