/**
 * Ear gear — the paired slot.
 *
 * Anything paired across the head has a failure mode nothing else has: the far
 * one is behind the skull and the near one is edge-on, and a drawing that
 * treats them as two identical stickers puts one of them in the middle of the
 * face at profile. That was a shipped bug, and the fix lives in `earPair`:
 * each cup is sorted on its own depth, and its WIDTH follows how much of it
 * faces the viewer while its height does not.
 *
 * Height staying fixed is the part that is easy to get wrong. A cup that
 * shrinks in both axes reads as a button rolling away; a cup that narrows on
 * one axis reads as a disc turning, which is what it is.
 */

import { defineProp } from '../registry.js';
import { earPair, headHoop, headAnchor } from '../frames.js';
import { group, ellipse, circle, line, around } from '../shapes.js';

/** Everything here shares a slot, a footprint and a visibility policy. */
const earGear = (id, parts, o = {}) => defineProp({
  id,
  kind: 'wearable',
  slot: 'ears',
  occupies: o.occupies || ['skull.band', 'ear.left', 'ear.right'],
  passes: ['headRear', 'headFront'],
  z: o.z ?? 30,
  overrides: { accentDeep: 'pad', ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: 'paired', minReadableSize: 48, contrastAgainst: 'body' },
  parts,
});

/* The band every over-ear thing hangs from: ear, over the crown, ear. It runs
   from the top of one cup to the top of the other rather than ear to ear — a
   hoop carried down to the ear line is, at profile, a bar straight down the
   middle of the face. */
const overHead = (o = {}) => ({
  frame: headHoop({ end: o.end ?? 0.38, lean: o.lean ?? 0.30, drop: o.drop ?? -0.05,
                    radius: o.radius ?? 1.03, width: o.width ?? 9,
                    widthAcross: o.widthAcross ?? 13, segments: 48 }),
  fill: o.fill,
});

/* ---------------------------------------------------------------- earmuffs */

/* Fluffy: the cup is a cluster of discs rather than one, because a single
   ellipse in a soft colour reads as a headphone cup that has lost its pad. */
earGear('earmuffs', [
  overHead({ width: 7, widthAcross: 9, lean: 0.34 }),
  { frame: earPair({ u: -0.10, radius: 1.0, place: 'size' }),
    material: { accentLight: { from: 'accent', lighten: 0.20 } },
    art: p => {
      const rx = 12 + 18 * p.facing;
      return group([
        /* The fluff has to be the OUTER shape. Drawn the other way round — a
           big smooth hub over a ring of small discs — the cluster is hidden
           and the muff reads as a plain cup that has lost its pad. */
        around(7, rx * 0.55, () => ellipse({ rx: rx * 0.52, ry: 14, fill: 'accent' }),
               { x: p.x, y: p.y }),
        ellipse({ x: p.x, y: p.y, rx: rx * 0.72, ry: 18, fill: 'accentLight', outline: 'none' }),
      ]);
    } },
  /* Lavender rather than pink: half the skins in the set ARE pink, and an
     earmuff the colour of the head is an earmuff nobody can see. */
], { defaults: { accent: '#C5B9E8' } });

/* ------------------------------------------------------------ ear defenders */

/* The industrial kind: bigger, squarer, and with a visible pad seam. Sized
   deliberately larger than the headphones so the two are not the same prop in
   two colours — a recolour is not an asset. */
earGear('ear-defenders', [
  overHead({ width: 12, widthAcross: 16, lean: 0.26, radius: 1.05 }),
  { frame: earPair({ u: -0.08, radius: 1.02, place: 'size' }),
    material: { accentDeep: { from: 'accent', darken: 0.22 } },
    art: p => {
      const rx = 10 + 19 * p.facing;
      return group([
        ellipse({ x: p.x, y: p.y, rx, ry: 31, fill: 'accent' }),
        ellipse({ x: p.x, y: p.y, rx: rx * 0.62, ry: 21, fill: 'accentDeep', outline: 'none' }),
      ]);
    } },
], { defaults: { accent: '#F2C744' } });

/* ---------------------------------------------------------- headset and mic */

/**
 * A headset: cups, band, and a boom that swings round the face.
 *
 * The boom is the only part of the catalogue that reaches across the front of
 * the face, so it is the one thing here that must not be drawn when the face
 * has turned away — it would otherwise cross the back of the head. It hangs
 * off the NEAR cup and stops when that cup does.
 */
earGear('headset-mic', [
  overHead({ width: 9, widthAcross: 13 }),
  { frame: earPair({ u: -0.10, radius: 1.0, place: 'size' }),
    material: { accentDeep: { from: 'accent', darken: 0.20 } },
    art: p => {
      const rx = 8 + 15 * p.facing;
      return group([
        ellipse({ x: p.x, y: p.y, rx, ry: 25, fill: 'accent' }),
        ellipse({ x: p.x, y: p.y, rx: rx * 0.58, ry: 15, fill: 'accentDeep', outline: 'none' }),
        /* The boom hangs off ONE cup — the character's right — and swings in
           toward the mouth. Gating it on how much the cup faces the viewer was
           the first attempt, and it got the whole thing backwards: face-on,
           both cups are edge-on, so the boom appeared only once the head had
           turned away from it. Belonging to one cup means it goes behind the
           head exactly when that cup does, which is what the pass is for. */
        p.ear === 1 ? line({
          pts: [[p.x, p.y + 17], [p.x - 24, p.y + 33], [p.x - 42, p.y + 29]],
          width: 4, stroke: 'accentDeep',
        }) : null,
        p.ear === 1
          ? circle({ x: p.x - 46, y: p.y + 28, r: 6, fill: 'accentDeep', outline: 'none' })
          : null,
      ]);
    } },
], { defaults: { accent: '#4A73C4' } });

/* -------------------------------------------------------------- hearing aids */

/**
 * Hearing aids: no band at all.
 *
 * The only item in this slot that is not connected over the crown, which is
 * why it takes a smaller footprint — it leaves `skull.band` free, so it can be
 * worn with a cap or a crown. That is the occupancy metadata doing real work
 * rather than describing the drawing.
 */
earGear('hearing-aids', [
  { frame: earPair({ u: -0.06, radius: 1.01, place: 'size' }),
    material: { accentDeep: { from: 'accent', darken: 0.24 } },
    art: p => {
      const rx = 6 + 9 * p.facing;
      return group([
        ellipse({ x: p.x, y: p.y - 8, rx, ry: 17, fill: 'accent' }),
        ellipse({ x: p.x, y: p.y + 11, rx: rx * 0.78, ry: 9, fill: 'accentDeep', outline: 'none' }),
      ]);
    } },
], { occupies: ['ear.left', 'ear.right'], z: 34, defaults: { accent: '#B79BE8' } });

/* Also from this slot, already registered next door: `headphones`. */
