#!/usr/bin/env node
/**
 * Visual regression + rendering invariants.
 *
 * The 81 structural tests all passed while three visual bugs shipped:
 *
 *   1. Hands rendered perfectly and were invisible, because `theme.hand`
 *      matched `theme.body`.
 *   2. Exported letters sat at the top of the card, because librsvg ignores
 *      `dominant-baseline` — canvas and SVG silently disagreed.
 *   3. Letter particles spawned at the centre of the face and drew on top of
 *      the eyes and mouth for over a second.
 *
 * None of those is a crash, a NaN, or a bad return value, so nothing in a
 * conventional suite could see them. This file exists because "it renders
 * without throwing" is not the same claim as "it looks right".
 *
 *   node scripts/visual.mjs           verify against committed snapshots
 *   node scripts/visual.mjs --update  re-record them
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { Buddy, THEMES, poseSVG, toSVG } from '../src/index.js';
import { G, faceProject } from '../src/core/geometry.js';

const DIR = 'tests/snapshots';
const UPDATE = process.argv.includes('--update');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✕ ${name}${extra ? '  — ' + extra : ''}`); }
};
const section = t => console.log(`\n${t}`);
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 12);

/* ==========================================================================
   1. INVARIANTS — each one encodes a bug that actually shipped.
   ========================================================================== */

section('invariants');

/* --- bug 2: nothing in the output may depend on a host font --------------- */
{
  const samples = [
    poseSVG({ expression: 'proud', letter: 'A', hands: 'r', handLift: 0.8 }),
    poseSVG({ expression: 'happy', yaw: 40 }),
  ];
  const b = new Buddy({ seed: 3, autoLook: false });
  b.spell('CAT'); b.step(2.5);            samples.push(toSVG(b));
  b.react('sleep'); b.step(1.5);          samples.push(toSVG(b));   // zzz glyphs

  ok('no <text> anywhere in exported SVG',
     samples.every(s => !s.includes('<text')),
     'a font-dependent glyph would render differently on every host');
  ok('no font-family declarations',
     samples.every(s => !s.includes('font-family')));
  ok('no dominant-baseline (widely unsupported)',
     samples.every(s => !s.includes('dominant-baseline')));
}

/* --- bug 1: a hand painted in the body colour is invisible ---------------- */
{
  const near = (a, b) => {
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
  };
  for (const [name, t] of Object.entries(THEMES)) {
    ok(`theme "${name}": hand distinguishable from body`,
       near(t.hand, t.body) >= 18,
       `hand ${t.hand} vs body ${t.body} — delta ${near(t.hand, t.body)}`);
  }
}

/* --- bug 3: no large glyph may sit on the face ---------------------------
   Scoped deliberately. Celebration confetti and sparkles crossing the face is
   the intended effect — they're small, brief and read as motion. A letter or a
   `zzz` is a big opaque readable shape; parked over the eyes it destroys the
   character. The rule is about glyphs, not about particles. */
{
  const b = new Buddy({ seed: 4, autoLook: false });
  b.face(0, 0); b.step(0.3);
  b.spell('CAT');

  let worst = null, frames = 0;
  while ((b.busy || b.speaking || b.s.particles.count) && frames++ < 900) {
    const hole = faceProject(0, G.faceCY, b.s.yaw, b.s.pitch);
    const rx = G.faceRX * Math.max(0.04, Math.abs(hole.fx));
    const ry = G.faceRY * Math.max(0.04, Math.abs(hole.fy));
    for (const p of b.s.particles.list) {
      if (p.type !== 'letter' && p.type !== 'zzz') continue;
      // particles are drawn in world space, offset by the body's translation
      const dx = (p.x - hole.x) / rx, dy = (p.y - hole.y) / ry;
      const d = Math.hypot(dx, dy);
      if (d < 1 && (worst === null || d < worst.d)) worst = { d, t: frames / 60, type: p.type, char: p.char };
    }
    b.update(1 / 60);
  }
  ok('no letter glyph overlaps the face while spelling',
     worst === null,
     worst && `${worst.type}${worst.char ? ` "${worst.char}"` : ''} at ${worst.t.toFixed(2)}s, ${(worst.d * 100).toFixed(0)}% into the face`);
}

/* --- continuity: nothing may jump as a spark crosses the terminator ------- */
{
  // Sample the rendered SVG across the boundary; a discontinuity in the drawn
  // output shows up as a sudden change in path-data length or opacity values.
  const opacities = [];
  for (let deg = -8; deg <= 8; deg += 0.5) {
    const svg = poseSVG({ yaw: 90 + deg });
    const m = [...svg.matchAll(/fill-opacity="([\d.]+)"/g)].map(x => +x[1]);
    opacities.push(m.reduce((a, b) => a + b, 0));
  }
  let biggest = 0;
  for (let i = 1; i < opacities.length; i++)
    biggest = Math.max(biggest, Math.abs(opacities[i] - opacities[i - 1]));
  ok('spark opacity is continuous through the terminator',
     biggest < 0.20, `largest single-step jump ${biggest.toFixed(3)}`);
}

/* --- geometry sanity ------------------------------------------------------ */
{
  const bad = [];
  for (let yaw = 0; yaw < 360; yaw += 15) {
    const svg = poseSVG({ yaw, expression: 'happy' });
    if (svg.includes('NaN') || svg.includes('Infinity')) bad.push(yaw);
  }
  ok('no NaN/Infinity in path data at any angle', bad.length === 0, bad.join(', '));
}

/* ==========================================================================
   2. SNAPSHOTS — exact geometry, locked.
   Anything that changes the drawn output changes these. That is the point:
   "someone tweaked the eye radius" becomes a failing build, not a surprise
   in production.
   ========================================================================== */

const CASES = [
  ...Buddy.expressions.map(e => [`expr-${e}`, () => poseSVG({ expression: e })]),
  ...[0, 45, 90, 135, 180, 225, 270, 315].map(y => [`turn-${y}`, () => poseSVG({ yaw: y })]),
  ...Object.keys(THEMES).map(t => [`theme-${t}`, () => poseSVG({ expression: 'happy' }, { theme: t })]),
  /* Snapshot names are also filenames, so lowercase cases get an `lc-` prefix
     rather than relying on a case-sensitive filesystem to tell card-A from
     card-a. That is a real difference between CI and a Mac laptop. */
  ...[...'ABMQSWZ'].map(c => [`card-${c}`, () =>
    poseSVG({ expression: 'proud', letter: c, hands: 'r', handLift: 0.8 })]),
  ...[...'aegpy'].map(c => [`card-lc-${c}`, () =>
    poseSVG({ expression: 'proud', letter: c, hands: 'r', handLift: 0.8 })]),
  ...[...'479'].map(c => [`card-digit-${c}`, () =>
    poseSVG({ expression: 'proud', letter: c, hands: 'r', handLift: 0.8 })]),
  ['hands-both', () => poseSVG({ expression: 'excited', hands: true, handLift: 1.1 })],
  ['think-pose', () => poseSVG({ expression: 'thinking', yaw: -32, hands: 'r', handLift: -0.22, handOut: -0.5 })],
  ...Buddy.visemes.map(v => [`viseme-${v}`, () => {
    const b = new Buddy({ seed: 1, autoLook: false, expression: 'content' });
    if (v !== 'rest') b.viseme(v);
    b.s.speech.active = true; b.s.speech.cur = b.s.speech.next = v; b.s.speech.blend = 1;
    b.settle();
    return toSVG(b);
  }]),
  ...[0.2, 0.5, 0.85].map(u => [`trace-A-${String(u).replace('.', '')}`, () => {
    const b = new Buddy({ seed: 2, autoLook: false, showTrail: false });
    b.step(0.3); b.trace('A', { duration: 2.4 }); b.step(2.4 * u);
    return toSVG(b);
  }]),
  ...[['B', 'B'], ['S', 'S'], ['W', 'W'],
      ['a', 'lc-a'], ['e', 'lc-e'], ['g', 'lc-g'], ['f', 'lc-f'],
      ['2', 'digit-2']].map(([c, name]) => [`trace-${name}`, () => {
    const b = new Buddy({ seed: 2, autoLook: false, showTrail: false });
    b.step(0.3); b.trace(c, { duration: 2.4 }); b.step(1.4);
    return toSVG(b);
  }]),
  ...Buddy.actions.map(a => [`action-${a}`, () => {
    const b = new Buddy({ seed: 9, autoLook: false, showTrail: true });
    b.face(0, 0); b.step(0.3); b.react(a); b.step(0.4);
    return toSVG(b);
  }]),
];

section(`snapshots (${CASES.length})`);
await mkdir(DIR, { recursive: true });

if (UPDATE) {
  for (const [name, make] of CASES) await writeFile(join(DIR, name + '.svg'), make());
  console.log(`  recorded ${CASES.length} snapshots into ${DIR}/`);
} else {
  const missing = [];
  for (const [name, make] of CASES) {
    const file = join(DIR, name + '.svg');
    if (!existsSync(file)) { missing.push(name); continue; }
    const want = await readFile(file, 'utf8');
    const got = make();
    if (got === want) { pass++; }
    else {
      fail++;
      console.log(`  ✕ ${name}  — geometry changed (${hash(want)} → ${hash(got)}, ` +
                  `${want.length} → ${got.length} bytes)`);
    }
  }
  if (missing.length) {
    console.log(`  ! ${missing.length} snapshot(s) not recorded yet: ${missing.slice(0, 5).join(', ')}` +
                (missing.length > 5 ? ' …' : ''));
    console.log('    run: node scripts/visual.mjs --update');
  }
  const checked = CASES.length - missing.length;
  if (checked) console.log(`  ${checked - fail}/${checked} snapshots match`);
}

/* -------------------------------------------------------------------- end */
console.log(`\n${fail === 0 ? '✓' : '✕'} ${pass} passed, ${fail} failed\n`);
if (!UPDATE) process.exit(fail === 0 ? 0 : 1);
