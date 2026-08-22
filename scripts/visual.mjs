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

import { Buddy, THEMES, poseSVG, toSVG, glyphPath,
         SVGSurface, drawAccessories } from '../src/index.js';
import { G, faceProject, capPoint, faceYaw, faceWrapShift, facePatchSurface,
         halfWidthAt, profileOffset, profileAmount, applyShape } from '../src/core/geometry.js';
import { faceFrame } from '../src/core/expressions.js';

const DIR = 'tests/snapshots';
const UPDATE = process.argv.includes('--update');
/* Record only what has never been recorded. `--update` rewrites everything,
   which quietly re-bakes whatever the current machine happens to print — and
   the one snapshot that differs between hosts is a float digit, exactly the
   kind of thing a blanket re-record hides. */
const FILL = process.argv.includes('--fill');

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

  /* The same failure, one part over. The character is a light face inside a
     darker head; on a pale skin the two closed up and `snow` rendered as a
     blank egg with two eyes floating on it — the face was there, and there was
     nothing to tell you where it ended. A drawn contour solves it too, which
     is why an outlined skin is exempt rather than forced to be darker. */
  for (const [name, t] of Object.entries(THEMES)) {
    ok(`theme "${name}": face reads against the body`,
       t.outline != null || near(t.face, t.body) >= 40,
       `face ${t.face} vs body ${t.body} — delta ${near(t.face, t.body)}, no contour`);
  }
}

/* --- the face never leaves the head --------------------------------------
   A hole cannot extend past the thing it is a hole in. Nothing enforced that,
   and between about 30° and 50° of turn the fringe at the top of the patch
   reached a few pixels past the outline: a scalloped white band hanging off
   the silhouette. In a drawing with no contour lines that is the loudest
   possible way to say "sticker".

   Measured against the silhouette's own cubics rather than an ellipse, because
   the head is an egg and it is the narrowing toward the crown that the patch
   kept walking into. */
{
  const bez = (p0, p1, p2, p3, u) => {
    const m = 1 - u;
    return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
  };
  /* The right half of the outline, as a y → max-x lookup. */
  const halfWidth = (y) => {
    const t = G.blob, top = 1 - 0.30 * t, low = G.blobLow * t, base = 1 - 0.18 * t;
    const rx = G.R, ry = G.RY, yw = ry * low;
    let best = 0;
    for (let i = 0; i <= 600; i++) {
      const u = i / 600;
      const yA = bez(-ry, -ry, -ry * 0.42, yw, u), xA = bez(0, rx * 0.62 * top, rx, rx, u);
      if (Math.abs(yA - y) < 1) best = Math.max(best, xA);
      const yB = bez(yw, ry * 0.70, ry, ry, u), xB = bez(rx, rx, rx * base * 0.66, 0, u);
      if (Math.abs(yB - y) < 1) best = Math.max(best, xB);
    }
    return best;
  };

  /* What matters is not whether the geometry overshoots — the clip in
     `drawFace` guarantees the drawing stays inside either way — but how much
     the clip has to REMOVE. A patch trimmed by a sliver reads as a hole in a
     head. A patch with a third of it sliced off reads as a hole in a wall. */
  let worst = 0, at = null;
  for (let yaw = 0; yaw < 360; yaw += 3) {
    for (const pitch of [-24, -12, 0, 12, 24]) {
      const b = new Buddy({ seed: 5, autoLook: false });
      b.face(yaw, pitch); b.settle();
      const F = faceFrame(b.s);
      if (F.vis <= 0.02) continue;
      /* Up to the point where the profile takes over. Past it the face is
         SUPPOSED to be cut by the outline — that is what a cheek wrapping
         past the limb looks like — and the rule that replaces this one is
         two checks below. */
      if (profileAmount(b.s) > 0.02) continue;
      const h = F.hole;
      let inside = 0, cut = 0;
      for (let i = -20; i <= 20; i++) {
        for (let j = -22; j <= 20; j++) {
          const px = h.x + (i / 20) * h.rx, py = h.y + (j / 20) * h.ry;
          const u = (px - h.x) / h.rx, v = (py - h.y) / h.ry;
          /* the ellipse, plus the band the fringe adds above it */
          const inPatch = u * u + v * v <= 1 || (v < 0 && v > -1.14 && Math.abs(u) < 0.94);
          if (!inPatch) continue;
          inside++;
          if (Math.abs(px) > halfWidth(py)) cut++;
        }
      }
      const frac = inside ? cut / inside : 0;
      if (frac > worst) { worst = frac; at = `${yaw}°/${pitch}°`; }
    }
  }
  /* And separately, the geometry itself, in the range the character actually
     spends its time: the patch must FIT, not merely be trimmed to fit. This is
     the check that fails on the bug as reported — at the old travel the fringe
     cleared the outline by 4px around 35° of turn with no pitch at all, which
     is the pose on the demo page. The clip hides it; that does not make it
     right, and a clip working hard is a clip that will show one day. */
  let over = 0, overAt = null;
  for (let yaw = 0; yaw < 360; yaw += 2) {
    /* Level only. Nodding lifts the face toward the crown, where the egg is
       genuinely narrower than the patch is wide, and no amount of pull-in
       changes that — the clip covers it and the check above bounds how much it
       has to remove. The turn is the motion the character lives in, and at
       level pitch the patch is required to fit outright. */
    for (const pitch of [0]) {
      const b = new Buddy({ seed: 5, autoLook: false });
      b.face(yaw, pitch); b.settle();
      const F = faceFrame(b.s);
      if (F.vis <= 0.02) continue;
      if (profileAmount(b.s) > 0.02) continue;
      const h = F.hole;
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push([h.x + h.rx * Math.cos(a), h.y + h.ry * Math.sin(a)]);
      }
      for (const k of [-0.94, -0.5, 0, 0.5, 0.94]) pts.push([h.x + h.rx * k, h.y - h.ry * 1.14]);
      for (const [px, py] of pts) {
        const d = Math.abs(px) - halfWidth(py);
        if (d > over) { over = d; overAt = `${yaw}°/${pitch}°`; }
      }
    }
  }
  ok('the face patch fits inside the head at working angles', over <= 2,
     `it clears the outline by ${over.toFixed(1)}px at ${overAt}`);

  ok('the face patch is never badly cut by the silhouette', worst <= 0.12,
     `${(worst * 100).toFixed(0)}% of it falls outside the head at ${at}`);
}

/* --- and the same thing again, in pixels ---------------------------------
   The geometry checks above reason about the shapes. This one rasterises the
   character, paints the face a colour nothing else uses, and looks for a face
   pixel touching the outside — which is the bug exactly as it was reported:
   "the band of the face is outside instead of completing the oval."

   Measured on the old code: 57 of 360 poses, worst 33px at 35°/24°. On this
   one: none, anywhere. `sharp` is optional, so this skips rather than fails
   when it is absent — the geometry checks still run. */
{
  let sharpMod = null;
  try { sharpMod = (await import('sharp')).default; } catch { /* optional */ }
  if (!sharpMod) {
    console.log('  · face-outside pixel check skipped (no sharp)');
  } else {
    let worst = 0, at = null, poses = 0;
    for (let yaw = 0; yaw < 360; yaw += 15) {
      for (const pitch of [-24, 0, 24]) {
        const b = new Buddy({
          theme: { extends: 'ink', face: '#FF00FF', hairline: 3 },
          seed: 4, autoLook: false,
        });
        b.face(yaw, pitch); b.settle();
        /* Not where the profile has taken over: there the face IS the leading
           edge, and touching the outside is the drawing, not the bug. */
        if (profileAmount(b.s) > 0.02) continue;
        const { data, info } = await sharpMod(
          Buffer.from(toSVG(b, { width: 420, height: 420, padding: 0.04 })), { density: 72 })
          .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const W = info.width, H = info.height, C = info.channels;
        const face = i => data[i] > 200 && data[i + 1] < 80 && data[i + 2] > 200 && data[i + 3] > 200;
        const out = i => data[i + 3] < 24;
        let touch = 0;
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const i = (y * W + x) * C;
            if (!face(i)) continue;
            if (out((y * W + x + 1) * C) || out((y * W + x - 1) * C) ||
                out(((y + 1) * W + x) * C) || out(((y - 1) * W + x) * C)) touch++;
          }
        }
        if (touch) poses++;
        if (touch > worst) { worst = touch; at = `${yaw}°/${pitch}°`; }
      }
    }
    ok('no face pixel touches the outside of the head', worst === 0,
       `${worst}px at ${at}, in ${poses} poses`);

    /* Touching is not the bar. The bar is that a rim of body stays visible all
       the way round the face at every angle, because a hole flush with the
       edge of a shape does not read as a hole in it — it reads as a piece cut
       out of the side. Measured as the thinnest gap in design units. */
    let thin = 1e9, thinAt = null;
    const SZ = 360, PAD = 0.04, k = (SZ * (1 - PAD)) / 320;
    for (let yaw = 0; yaw < 360; yaw += 15) {
      for (const pitch of [-24, 0, 24]) {
        const b = new Buddy({
          theme: { extends: 'ink', face: '#FF00FF', hairline: 3 },
          seed: 4, autoLook: false,
        });
        b.face(yaw, pitch); b.settle();
        if (profileAmount(b.s) > 0.02) continue;
        const { data, info } = await sharpMod(
          Buffer.from(toSVG(b, { width: SZ, height: SZ, padding: PAD })), { density: 72 })
          .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const W = info.width, H = info.height, C = info.channels;
        const outAt = new Set();
        const face = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * C;
          if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] > 200 && data[i + 3] > 200) face.push([x, y]);
          else if (data[i + 3] < 24) outAt.add(y * W + x);
        }
        if (!face.length) continue;
        let best = 1e9;
        for (const [x, y] of face) {
          for (let r = 1; r <= 20 && r < best; r++) {
            let hit = false;
            for (let d = -r; d <= r && !hit; d++) {
              if (outAt.has((y - r) * W + x + d) || outAt.has((y + r) * W + x + d) ||
                  outAt.has((y + d) * W + x - r) || outAt.has((y + d) * W + x + r)) hit = true;
            }
            if (hit) { best = r; break; }
          }
        }
        const design = best / k;
        if (design < thin) { thin = design; thinAt = `${yaw}°/${pitch}°`; }
      }
    }
    ok('a rim of body stays visible all the way round the face', thin >= 4,
       `thinnest rim ${thin.toFixed(1)} design units at ${thinAt}`);
  }
}

/* --- the face never renders as a sliver ----------------------------------
   Between roughly 78° and 90° the face patch used to be a few pixels wide and
   still a third opaque: a pale vertical scratch down the middle of a dark
   head, with a blush dot floating beside it. Nothing was broken — the patch
   was exactly as wide as the projection said — which is why only looking at
   the whole turn found it. */
{
  const thin = [];
  for (let yaw = 0; yaw < 360; yaw += 1) {
    const b = new Buddy({ seed: 2, autoLook: false });
    b.face(yaw, 0); b.settle();
    const F = faceFrame(b.s);
    if (F.vis > 0.02 && F.hole.rx < 14) thin.push(`${yaw}° (${F.hole.rx.toFixed(1)}px @ ${F.vis.toFixed(2)})`);
  }
  ok('the face is never a visible sliver', thin.length === 0, thin.slice(0, 4).join(', '));
}

/* --- an accessory the colour of the head is not an accessory -------------
   The same failure as the invisible hand, one layer out: a gold cap on the
   amber skin rendered perfectly and read as a haircut. Twelve skins is more
   than anyone re-checks by eye after adding a thirteenth. */
{
  const delta = (a, b) => {
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
  };
  for (const [name, t] of Object.entries(THEMES)) {
    ok(`theme "${name}": worn things read against the body`,
       delta(t.accent, t.body) >= 120,
       `accent ${t.accent} vs body ${t.body} — delta ${delta(t.accent, t.body)}`);
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
  /* Scoped to the SPARKS, by their colour. This started as "sum every opacity
     in the file", which worked while the sparks were the only faded thing near
     the terminator — and then the face was allowed to stay alive to the limb
     and leave in one piece, and the sum started measuring that instead. A
     proxy that quietly changes what it measures is worse than no proxy. */
  const SPARK = THEMES.ink.spark;
  const opacities = [];
  for (let deg = -8; deg <= 8; deg += 0.5) {
    const svg = poseSVG({ yaw: 90 + deg });
    const m = [...svg.matchAll(/<[^>]*fill="([^"]+)"[^>]*fill-opacity="([\d.]+)"[^>]*>/g)]
      .filter(x => x[1].toLowerCase() === SPARK.toLowerCase())
      .map(x => +x[2]);
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
  /* Gradient ids are handed out in the order the paints first appear, so
     putting a hat on the character renumbers the body's gradients — and a body
     path that is geometrically identical stops matching, leaks into the diff,
     and drags the accessory's centroid with it. The comparison is about
     geometry, so the ids come out of it. */
  const paths = svg => (svg.match(/<(?:path|ellipse|rect)[^>]*>/g) || [])
    .map(el => el.replace(/url\(#[a-z]+\d+\)/g, 'url(#x)'));
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
     Not the crown, the cap or the band: those are rings and shells centred on
     the turn axis, so their centroid genuinely stays put while their shape
     changes. They are covered by the two checks below instead. */
  const ATTACHED = ['bow', 'flower', 'glasses'];
  const travel = a => Math.abs(centroidX(worn(a, 46)) - centroidX(worn(a, 0)));
  const stuck = ATTACHED.filter(a => travel(a) < 8);
  ok('accessories attached to the head travel with it', stuck.length === 0,
     ATTACHED.map(a => `${a} ${travel(a).toFixed(1)}`).join('  '));

  /* --- worn things do not blink out, and do not jump -------------------
     Two failures the travel check above cannot see, both of which shipped:

       · The cap and the crown were drawn only while their anchor was on the
         near side, so from behind the character was bare-headed — wearing
         nothing but the button off the top of its own hat.
       · Accessories faded out across the terminator instead of passing behind
         the head, so mid-turn they dissolved.

     Anything worn on the SKULL is still there when the skull turns away; what
     hides it is the head, not a missing draw call. So: ink at every angle, and
     a centroid that moves continuously — no pop. Glasses are exempt: they
     belong to the face, and the face genuinely goes away. */
  const SKULL = Buddy.accessories.filter(a => a !== 'glasses');
  const centroidXY = blob => {
    let sx = 0, sy = 0, n = 0;
    for (const el of blob.split('|')) {
      if (!el) continue;
      const m = el.match(/matrix\(([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
      const [a, b, c, d, e, f] = m ? m.slice(1).map(Number) : [1, 0, 0, 1, 0, 0];
      const dd = el.match(/\sd="([^"]+)"/);
      if (!dd) continue;
      const nums = dd[1].match(/-?[\d.]+/g) || [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = +nums[i], y = +nums[i + 1];
        sx += a * x + c * y + e; sy += b * x + d * y + f; n++;
      }
    }
    return { x: n ? sx / n : 0, y: n ? sy / n : 0, n };
  };

  const STEP = 10;                       // a point on the head moves ≤17px per step
  const POP = 22;                        // measured worst case is 13.2
  for (const a of SKULL) {
    let gone = [], jump = 0, jumpAt = 0, prev = null;
    for (let yaw = 0; yaw <= 360; yaw += STEP) {
      const c = centroidXY(worn(a, yaw));
      if (!c.n) gone.push(yaw);
      if (prev && prev.n && c.n) {
        const j = Math.hypot(c.x - prev.x, c.y - prev.y);
        if (j > jump) { jump = j; jumpAt = yaw; }
      }
      prev = c;
    }
    ok(`"${a}" is worn at every angle`, gone.length === 0,
       gone.length ? `nothing drawn at ${gone.join('°, ')}°` : '');
    ok(`"${a}" turns continuously — no pop`, jump <= POP,
       `${jump.toFixed(1)}px jump at ${jumpAt}° (limit ${POP})`);
  }

  /* --- each pass, on its own ---------------------------------------------
     The checks above look at the finished picture, and the finished picture
     hides the two failures that matter most: an accessory drawn only in the
     front pass still appears (its near half does), and a part pinned to the
     picture still moves (the parts around it do). So render the passes
     separately.

     `drawAccessories` is the same entry point the renderer uses, given the
     same state, so this is the shipping code path and not a re-implementation
     of it. */
  const pass = (accessory, yaw, where) => {
    const b = new Buddy({ seed: 4, autoLook: false, accessories: accessory });
    b.face(yaw, 0);
    b.settle();
    b.render(new SVGSurface({ width: 320, height: 320 }));   // populates S._face
    const s = new SVGSurface({ width: 320, height: 320 });
    drawAccessories(s, b.s, b.theme, where);
    return s.toString();
  };
  /* Screen-space x of every point drawn, so "it is over there" is measurable
     rather than inferred from the path data alone. */
  const xs = svg => {
    const out = [];
    for (const el of svg.match(/<(?:path|ellipse|rect)[^>]*>/g) || []) {
      const m = el.match(/matrix\(([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
      const [a, , c, , e] = m ? m.slice(1).map(Number) : [1, 0, 0, 1, 0, 0];
      const d = el.match(/\sd="([^"]+)"/);
      if (!d) continue;
      const nums = d[1].match(/-?[\d.]+/g) || [];
      for (let i = 0; i + 1 < nums.length; i += 2) out.push(a * +nums[i] + c * +nums[i + 1] + e - 160);
    }
    return out;
  };

  /* Worn things pass BEHIND the head. An accessory that never draws into the
     back pass is a decal on the lens: it can only ever be in front of the
     character, so the character can never turn away from it. The cap shipped
     exactly this way — from behind you saw the button and nothing else. */
  for (const a of SKULL) {
    const behind = [0, 45, 90, 135, 180, 225, 270, 315]
      .filter(y => /<(path|ellipse|rect)/.test(pass(a, y, 'back')));
    ok(`"${a}" goes behind the head as it turns`, behind.length > 0,
       'never drawn in the back pass — it is in front of the picture, not on the head');
  }

  /* At profile the far one of a mirrored pair is BEHIND the head, so both of
     them cannot be at the edges of the picture at once. This is the earcup
     bug, stated as a measurement: pinned in head space, the cups sat at ±R at
     every angle, and one of them floated over the middle of the face.

     Only headphones have a mirrored pair of solid parts today. Anything added
     with two sides — earrings, a pair of clips — belongs in this list. */
  for (const a of ['headphones']) {
    const x = xs(pass(a, 90, 'front'));
    const wide = x.filter(v => Math.abs(v) > G.R * 0.62);
    ok(`"${a}": at profile the far side is behind the head`,
       !(wide.some(v => v > 0) && wide.some(v => v < 0)),
       `ink at both ${Math.min(...x).toFixed(0)} and ${Math.max(...x).toFixed(0)}`);
  }

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

/* --- and the rule that replaces the rim, once the profile arrives --------- */
{
  /* Head-on the face must keep a rim of body all the way round it. At the limb
     the opposite is true: the face IS the leading edge, and a rim there is a
     hairline of head trapped between the face's contour and the head's. So the
     two edges have to AGREE — the face reaches the outline, and never crosses
     it. Measured per row of pixels: the rightmost face pixel is never right of
     the rightmost body pixel, and over the middle of the face the two are the
     same pixel.

     Mutation-tested: put the old constant clip back (`headRegion(s, S, 0.985)`)
     and the rows stop agreeing. */
  let sharpMod = null;
  try { sharpMod = (await import('sharp')).default; } catch { /* optional */ }
  if (!sharpMod) {
    console.log('  · profile-edge pixel check skipped (no sharp)');
  } else {
    let over = 0, gap = 0, at = null;
    for (const yaw of [80, 85, 90]) {
      const b = new Buddy({ theme: { extends: 'ink', face: '#FF00FF', hairline: 3 },
                            seed: 4, autoLook: false });
      b.face(yaw, 0); b.settle();
      const { data, info } = await sharpMod(
        Buffer.from(toSVG(b, { width: 420, height: 420, padding: 0.04 })), { density: 72 })
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height, C = info.channels;
      const rows = [];
      for (let y = 0; y < H; y++) {
        let bodyMax = -1, faceMax = -1;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * C;
          if (data[i + 3] > 200) bodyMax = x;
          if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] > 200 && data[i + 3] > 200) faceMax = x;
        }
        if (faceMax >= 0) rows.push([faceMax, bodyMax]);
      }
      if (!rows.length) continue;
      for (const [f, bd] of rows) if (f - bd > over) { over = f - bd; at = `${yaw}°`; }
      /* The middle half of the rows the face occupies — the ends taper past
         the nose and the brow, where the head is legitimately wider. */
      const mid = rows.slice(Math.floor(rows.length * 0.25), Math.ceil(rows.length * 0.75));
      const best = Math.min(...mid.map(([f, bd]) => bd - f));
      if (best > gap) { gap = best; at = at || `${yaw}°`; }
    }
    ok('at profile the face reaches the leading edge and never crosses it',
       over <= 1 && gap <= 0, `overshoot ${over}px, best gap ${gap}px at ${at}`);
  }
}

/* --- a character's proportions are its own -------------------------------- */
{
  /* `applyShape` mutated a module-level `G`, so two characters could not exist
     at once: whichever build was applied last drew both of them. A cast is not
     expressible while proportions are global.

     Mutation-tested: drop `g: this.g` from the state in `buddy.js` and both
     of these render identically, because both fall back to the global. */
  const pose = shape => {
    const b = new Buddy({ shape, theme: 'ink', seed: 1, autoLook: false, showTrail: false });
    b.face(35, 0); b.settle();
    return toSVG(b);
  };
  const v1 = pose('v1'), kawaii = pose('kawaii');
  ok('two builds are two different drawings', v1 !== kawaii,
     `${v1.length} vs ${kawaii.length} bytes`);

  /* And they do not disturb each other. This is the failure that matters on a
     page: a cast rendering in one frame, each with the last one's numbers. */
  const a = new Buddy({ shape: 'v1', theme: 'ink', seed: 1, autoLook: false, showTrail: false });
  a.face(35, 0); a.settle();
  const before = toSVG(a);
  const k = new Buddy({ shape: 'kawaii', theme: 'ink', seed: 1, autoLook: false, showTrail: false });
  k.face(35, 0); k.settle(); toSVG(k);
  ok('rendering one character does not change another', toSVG(a) === before);

  /* The old global still works for callers written against it, and a character
     built with its own geometry is immune to it. */
  applyShape('kawaii');
  const after = toSVG(a);
  applyShape('v1');
  ok('a built character ignores the global applyShape', after === before);
}

/* --- the turn: the face is a surface, not a card -------------------------- */
{
  /* An affine squash compresses both halves of the face equally. A projection
     does not: the half swinging toward the limb compresses hard while the half
     coming round to face you barely moves. That asymmetry IS the wrap — it is
     why the fringe scallops crowd on the leading side — and it is exactly what
     the old screen-space patch could not express.

     Mutation-tested: `faceLean: 1` (the affine leaning ellipse) makes the two
     halves equal and this fails. */
  const yaw = faceYaw(0.8);
  const C = capPoint(0, 0, yaw, 0).x;
  const leading = Math.abs(capPoint(G.faceRX, 0, yaw, 0).x - C);
  const trailing = Math.abs(C - capPoint(-G.faceRX, 0, yaw, 0).x);
  ok('the leading half of the face compresses, the trailing half does not',
     leading < trailing * 0.72,
     `leading ${leading.toFixed(1)}, trailing ${trailing.toFixed(1)} design units`);
}

{
  /* A 43° cap is still half visible at ninety degrees. Fading it to nothing
     leaves a plain egg with a hair whorl on it, which is a back view arriving
     early — the "looking at it from the side is stupid" bug. */
  const vis = d => faceFrame({ yaw: d * Math.PI / 180, pitch: 0, look: { x: 0, y: 0 },
                               faceLean: 2, profile: true }).vis;
  const worst = [60, 70, 80, 85, 90].map(vis).reduce((a, b) => Math.min(a, b));
  ok('the face never fades to a blank egg while the profile is on', worst > 0.5,
     `worst visibility ${worst.toFixed(2)} across 60–90°`);

  /* And it never gets LESS legible on the way round. It used to: the patch
     thinned to a sliver at 75° and widened again at 90° when the profile
     arrived, and a turn that dips in legibility reads as a glitch. */
  let dip = 0;
  for (let d = 45; d <= 90; d += 2.5) {
    const F = faceFrame({ yaw: d * Math.PI / 180, pitch: 0, look: { x: 0, y: 0 },
                          faceLean: 2, profile: true });
    const w = F.hole.rx * 2;
    const prev = faceFrame({ yaw: (d - 2.5) * Math.PI / 180, pitch: 0, look: { x: 0, y: 0 },
                             faceLean: 2, profile: true }).hole.rx * 2;
    dip = Math.max(dip, prev - w);
  }
  ok('the face never narrows by a jump on the way to profile', dip < 3,
     `largest single step ${dip.toFixed(2)} design units per 2.5°`);
}

{
  /* At profile the nose is FACE. Left in the body colour it is a lump growing
     out of a scalp, and the whole reason it reads as a nose is that the face
     fills it. Measured in pixels rather than in paths, because what is drawn
     there is the union of two subpaths and the union is the claim.

     Mutation-tested: drop the profile band from `facePatchPath` and the pixel
     at the nose comes back as body colour. */
  let sharpMod = null;
  try { sharpMod = (await import('sharp')).default; } catch { /* optional */ }
  if (!sharpMod) {
    console.log('  · profile-nose pixel check skipped (no sharp)');
  } else {
    const SZ = 420, PAD = 0.04, k = (SZ * (1 - PAD)) / 320;
    const b = new Buddy({ theme: { extends: 'ink', face: '#FF00FF', hairline: 3 },
                          seed: 4, autoLook: false,
                          faceLean: 2, faceForm: 0, profile: true });
    b.face(85, 0); b.settle();
    const S = b.s;
    const faceY = faceProject(0, G.faceCY, faceYaw(S.yaw), 0).y;
    const noseY = faceY + 22;
    const tip = halfWidthAt(noseY) + profileOffset(noseY, faceY) * profileAmount(S) * 0.5;
    const { data, info } = await sharpMod(
      Buffer.from(toSVG(b, { width: SZ, height: SZ, padding: PAD })), { density: 72 })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = Math.round(SZ / 2 + tip * k), py = Math.round(SZ / 2 + noseY * k);
    const i = (py * info.width + px) * info.channels;
    const isFace = data[i] > 200 && data[i + 1] < 80 && data[i + 2] > 200;
    ok('at profile the nose is face-coloured, not scalp',
       isFace, `pixel at the nose is rgb(${data[i]},${data[i + 1]},${data[i + 2]})`);
  }
}

{
  /* The whorl is the symbol for "this is the back of its head". While a face
     is still on screen it contradicts the face, and the pair reads as a back
     view with a face stuck to the edge of it. */
  const shot = d => {
    const b = new Buddy({ theme: 'ink', seed: 1, autoLook: false,
                          faceLean: 2, faceForm: 1, profile: true });
    b.face(d, 0); b.settle();
    return toSVG(b);
  };
  const deep = THEMES.ink.bodyDeep.toLowerCase();
  const both = [60, 75, 85, 90].filter(d => shot(d).toLowerCase().includes(deep));
  ok('the whorl and the face are never on screen together', both.length === 0,
     both.length ? `both at ${both.join('°, ')}°` : '');
}

/* --- the kawaii build ----------------------------------------------------- */
{
  const lum = hex => {
    const v = hex.replace('#', '');
    const c = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255)
      .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const outlined = Object.values(THEMES).filter(t => t.outline);
  const wrong = outlined.filter(t => lum(t.outline) > lum(t.body) || lum(t.outline) > lum(t.face));
  ok('on an outlined skin the contour is the darkest thing in the drawing',
     outlined.length > 0 && wrong.length === 0,
     wrong.map(t => t.name).join(', '));

  /* An accessory with no contour on a body that has one reads as pasted on.
     Mutation-tested: remove the contour pass in `drawAccessories` and the two
     counts come out equal. */
  const strokes = svg => (svg.match(/stroke="#4B3C38"/gi) || []).length;
  const bare = new Buddy({ theme: 'oat', seed: 1, autoLook: false });
  bare.settle();
  const worn = new Buddy({ theme: 'oat', seed: 1, autoLook: false });
  worn.wear(['cap']); worn.settle();
  ok('a worn thing on an outlined skin carries the contour too',
     strokes(toSVG(worn)) > strokes(toSVG(bare)),
     `${strokes(toSVG(bare))} → ${strokes(toSVG(worn))} contour strokes`);
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
  /* The second build, locked at the angles where the face model does the most
     work. One build passing proves nothing about the other. */
  ...[0, 45, 90].map(y => [`kawaii-${y}`, () =>
    poseSVG({ expression: 'happy', yaw: y }, { theme: 'oat', shape: 'kawaii' })]),
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

if (UPDATE || FILL) {
  let n = 0;
  for (const [name, make] of CASES) {
    const file = join(DIR, name + '.svg');
    if (FILL && existsSync(file)) continue;
    await writeFile(file, make());
    n++;
  }
  console.log(`  recorded ${n} snapshot(s) into ${DIR}/`);
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
if (!UPDATE && !FILL) process.exit(fail === 0 ? 0 : 1);
