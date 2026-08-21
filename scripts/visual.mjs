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

import { Buddy, THEMES, poseSVG, toSVG, glyphPath } from '../src/index.js';
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

/* ------------------------------------------------------------------------
   Stroke direction and order.

   `trace()` teaches letter formation, so a stroke drawn the wrong way round
   does not look like a bug — it looks like a lesson, and the child copies it.
   Lowercase `c` shipped being written bottom-to-top, and every closed curve in
   the font started at 3 o'clock and ran clockwise, which is backwards under
   every manuscript handwriting programme there is.

   Three rules, near-universal across those programmes:
     - vertical strokes are written downwards
     - horizontal strokes are written left to right
     - closed curves run counter-clockwise, starting in the upper right
   with a short, named list of the letters that genuinely differ.
   ------------------------------------------------------------------------ */
{
  /* Bowls hung off a stem — b, p — are pushed out from the stem and over the
     top, which is clockwise. Both are written that way by hand. */
  const CLOCKWISE = new Set(['b', 'p']);
  /* Strokes whose endpoints make them *look* horizontal to a bounding box but
     which are hooks or compound diagonals. */
  const NOT_REALLY_HORIZONTAL = new Set(['J:1', 'N:1', 'r:1']);

  const problems = [];
  for (const ch of Buddy.glyphs) {
    if (!/[A-Za-z0-9]/.test(ch)) continue;
    glyphPath(ch).strokes.forEach((st, i) => {
      const key = `${ch}:${i}`;
      const a = st.pts[0], b = st.pts[st.pts.length - 1];
      const xs = st.pts.map(p => p[0]), ys = st.pts.map(p => p[1]);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      const closed = Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.06 && st.len > 0.5;

      if (closed) {
        let area = 0;
        for (let k = 1; k < st.pts.length; k++)
          area += st.pts[k - 1][0] * st.pts[k][1] - st.pts[k][0] * st.pts[k - 1][1];
        const cw = area > 0;
        if (cw !== CLOCKWISE.has(ch))
          problems.push(`${key} closed curve runs ${cw ? 'clockwise' : 'counter-clockwise'}`);
        /* and it has to start where a hand starts: the upper half. */
        const cy = ys.reduce((s2, y) => s2 + y, 0) / ys.length;
        if (a[1] > cy + 0.02) problems.push(`${key} closed curve starts below its centre`);
      } else if (spanY > spanX * 1.6) {
        if (b[1] < a[1]) problems.push(`${key} vertical stroke is written upwards`);
      } else if (spanX > spanY * 1.6 && !NOT_REALLY_HORIZONTAL.has(key)) {
        if (b[0] < a[0]) problems.push(`${key} horizontal stroke is written right to left`);
      }
    });
  }
  ok('every stroke is written the way a hand writes it', problems.length === 0,
     problems.slice(0, 8).join('; '));
}

/* ------------------------------------------------------------------------
   Accessories move with the head.

   The crown and the headphone cups shipped anchored in *head space* rather
   than on the sphere. They sat dead still while the face swung away
   underneath, which reads as the character walking out from under its own
   hat. Nothing caught it because the accessory still rendered, still had no
   NaN, and still looked correct dead-on.

   The check: render the character wearing one accessory, subtract every path
   the bare character draws at the same angle, and compare what is left at two
   different yaws. If the remainder is identical, the accessory is not on the
   head — it is in front of the picture.
   ------------------------------------------------------------------------ */
{
  const paths = svg => (svg.match(/<(?:path|ellipse|rect)[^>]*>/g) || []);
  const worn = (accessory, yaw) => {
    const dressed = new Buddy({ seed: 4, autoLook: false, accessories: accessory });
    const bare = new Buddy({ seed: 4, autoLook: false });
    dressed.face(yaw, 0); bare.face(yaw, 0);
    dressed.settle(); bare.settle();
    const common = new Set(paths(toSVG(bare)));
    return paths(toSVG(dressed)).filter(el => !common.has(el)).join('|');
  };

  /* Where the accessory's ink actually IS on screen, so "it changed" cannot be
     satisfied by a cup dropping out of view — which is how the first version of
     this check passed against the broken code.

     The SVG backend bakes the transform into a matrix and leaves the path data
     in local coordinates, so both have to be combined. */
  const centroidX = blob => {
    let sum = 0, n = 0;
    for (const el of blob.split('|')) {
      if (!el) continue;
      const m = el.match(/matrix\(([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
      const a = m ? +m[1] : 1, e = m ? +m[5] : 0;
      const d = el.match(/\sd="([^"]+)"/);
      const local = [];
      if (d) {
        const nums = d[1].match(/-?[\d.]+/g) || [];
        for (let i = 0; i < nums.length; i += 2) local.push(+nums[i]);
      } else {
        const cx = el.match(/\bcx="(-?[\d.]+)"/);
        if (cx) local.push(+cx[1]);
        const x = el.match(/\sx="(-?[\d.]+)"/);
        if (x) local.push(+x[1]);
      }
      for (const lx of local) { sum += a * lx + e; n++; }
    }
    return n ? sum / n : 0;
  };

  /* Attached to a POINT on the head, so it has to travel as the head turns.
     A cap dome and a headphone band are symmetric shells centred on the axis:
     they genuinely stay put, and only their details move. */
  const ATTACHED = ['crown', 'bow', 'flower', 'glasses'];
  const travel = a => Math.abs(centroidX(worn(a, 46)) - centroidX(worn(a, 0)));
  const stuck = ATTACHED.filter(a => travel(a) < 8);
  ok('accessories attached to the head travel with it', stuck.length === 0,
     ATTACHED.map(a => `${a} ${travel(a).toFixed(1)}`).join('  '));

  const inert = Buddy.accessories.filter(a => worn(a, 0) === worn(a, 46));
  ok('no accessory is identical at two different angles', inert.length === 0, inert.join(', '));

  /* And it has to be ON the head, not merely animated: it must move with the
     body during an action too. */
  const bounced = Buddy.accessories.filter(a => {
    const shot = at => {
      const b = new Buddy({ seed: 7, autoLook: false, accessories: a });
      b.face(0, 0); b.step(0.3); b.react('jump'); b.step(at);
      const bare = new Buddy({ seed: 7, autoLook: false });
      bare.face(0, 0); bare.step(0.3); bare.react('jump'); bare.step(at);
      const common = new Set(paths(toSVG(bare)));
      return paths(toSVG(b)).filter(el => !common.has(el)).join('|');
    };
    return shot(0.25) === shot(0.55);
  });
  ok('every accessory moves with the body', bounced.length === 0, bounced.join(', '));
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
