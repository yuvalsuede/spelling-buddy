#!/usr/bin/env node
/**
 * Check that an app uses the character the way AGENTS.md says to.
 *
 * The point is not style. Every rule here corresponds to a way the character
 * goes wrong in production and stays wrong, because nothing fails loudly:
 * a page that choreographs by hand drifts from the other nineteen, a page that
 * passes a colour breaks the brand on a screen nobody reviews, and a letter
 * grid that mounts one rig per card quietly runs 26 animation loops.
 *
 * An agent that has just edited a page can run this and know whether it got it
 * right. That is the whole reason it exists — "read the guidance" is not a
 * verification step.
 *
 *   node scripts/check-usage.mjs src
 *   node scripts/check-usage.mjs src --wrapper src/components/buddy
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
const roots = argv.filter(a => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (!roots.length) {
  console.error('usage: check-usage.mjs <dir> [--wrapper src/components/buddy] [--phases idle,typing,...]');
  process.exit(2);
}

/* The wrapper is the one place allowed to break these rules — that is its
   job. Everything else is a page. */
const WRAPPER = flag('wrapper', 'components/buddy');
const PHASES = flag('phases', 'idle,typing,correct,wrong,stuck,teaching').split(',');

const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo']);

const RULES = [
  {
    id: 'direct-import',
    re: /\bfrom\s+['"]spelling-buddy(\/[^'"]*)?['"]/,
    msg: 'imports spelling-buddy directly — pages import from the wrapper',
  },
  {
    id: 'theme-prop',
    re: /<Buddy\b[^>]*\b(theme|color|colour|fill|palette)\s*=/s,
    msg: 'passes a colour/theme to <Buddy> — the palette is fixed on purpose',
  },
  {
    id: 'style-prop',
    re: /<Buddy\b[^>]*\bstyle\s*=/s,
    msg: 'styles <Buddy> inline — use className, or a phase',
  },
  {
    id: 'imperative',
    re: /\bbuddy\s*\.\s*(express|react|spell|trace|traceWord|hold|say|sayLetters|viseme|face)\s*\(/,
    msg: 'choreographs by hand — add a phase to the wrapper instead',
  },
  {
    id: 'reset-timer',
    re: /setTimeout\([\s\S]{0,120}?setPhase\s*\(\s*['"](idle|typing)['"]/s,
    msg: 'clears a momentary phase on a timer — correct/wrong return by themselves',
  },
];

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) yield* walk(p); }
    else if (EXT.test(e.name)) yield p;
  }
}

/** Strip comments and string bodies so a rule never fires on prose. */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '));
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

const findings = [];
let scanned = 0;

for (const root of roots) {
  for await (const file of walk(root)) {
    /* Print something a person can paste back into an editor: a path relative
       to the working directory, unless the scan is outside it. */
    const r = relative(process.cwd(), file);
    const rel = r.startsWith('..') ? file : r;
    if (rel.split(sep).join('/').includes(WRAPPER)) continue;   // the wrapper may
    const raw = await readFile(file, 'utf8');
    if (!/Buddy|spelling-buddy/.test(raw)) continue;
    scanned++;
    const src = strip(raw);

    for (const rule of RULES) {
      const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
      let m;
      while ((m = re.exec(src))) {
        findings.push({ file: rel, line: lineOf(src, m.index), id: rule.id, msg: rule.msg });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }

    /* More than one rig on a page. Counted per file rather than per render,
       which is imprecise in both directions — but a file with two <Buddy> tags
       is worth a human look either way. */
    const mounts = (src.match(/<Buddy[\s/>]/g) || []).length;
    if (mounts > 1) {
      findings.push({
        file: rel, line: lineOf(src, src.indexOf('<Buddy')), id: 'multiple-rigs',
        msg: `${mounts} <Buddy> in one file — a page gets one character, not one per card`,
      });
    }

    /* A phase name that does not exist fails silently at runtime: the rig
       no-ops and the character just sits there. */
    const lit = /<Buddy\b[^>]*\bphase\s*=\s*["']([^"']+)["']/gs;
    let p;
    while ((p = lit.exec(src))) {
      if (!PHASES.includes(p[1])) {
        findings.push({
          file: rel, line: lineOf(src, p.index), id: 'unknown-phase',
          msg: `phase="${p[1]}" is not a phase (${PHASES.join(' · ')})`,
        });
      }
    }
  }
}

if (!findings.length) {
  console.log(scanned
    ? `✓ ${scanned} file${scanned === 1 ? '' : 's'} using the character, no problems`
    : '✓ nothing uses the character in the paths given');
  process.exit(0);
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const f of findings) console.log(`${f.file}:${f.line}  ${f.id}  — ${f.msg}`);
console.log(`\n✕ ${findings.length} problem${findings.length === 1 ? '' : 's'} in ${scanned} file(s). See AGENTS.md.`);
process.exit(1);
