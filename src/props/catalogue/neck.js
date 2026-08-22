/**
 * Neck and front — the first slot that is not on the head.
 *
 * Worth stating plainly, because it changes what these props can be: this
 * character has no torso. Head and body are ONE egg, and the "neck" is just a
 * height on it. So a collar is a ring at a low `u`, and everything hanging
 * from one hangs down the front of the same shape the face is on.
 *
 * Two consequences the whole slot has to respect:
 *
 *  - **Neckwear draws OVER the face, not under it.** The first version put
 *    everything here in the `bodyFront` pass, which is what the plan says a
 *    collar is for — and every item vanished. Measure it: the face patch is
 *    centred at y = 26 with a vertical radius of 67 on a body whose half-height
 *    is 104, so it reaches 89% of the way down. There is no torso under it to
 *    put a collar on. A bow tie on this creature sits across the bottom of the
 *    chin, which means it has to be drawn after the face, the way it would be
 *    on any character whose head rests straight on its collar.
 *  - **The far side still goes behind.** A collar is a ring like any other, so
 *    its back half draws in a rear pass and the body occludes it. A collar
 *    drawn as a flat band across the front is a sticker, and it shows the
 *    moment the character turns.
 *
 * No text. A name badge here is a blank badge with a header bar and two rule
 * lines — the shape of one, which is what reads at 48px anyway. Fonts,
 * localisation and `<text>` in exported SVG are all things this rig has
 * deliberately stayed out of.
 */

import { defineProp } from '../registry.js';
import { headRing, headBand, headAnchor, ringStuds } from '../frames.js';
import { group, circle, ellipse, path, line, roundedRect } from '../shapes.js';

/** Where the collar sits: low enough to be a neck, high enough to be seen. */
const NECK = 0.72;

const neckwear = (id, parts, o = {}) => defineProp({
  id,
  kind: 'wearable',
  slot: o.slot || 'neck',
  occupies: o.occupies || ['neck.ring'],
  passes: o.passes || ['rearExternal', 'faceFront'],
  z: o.z ?? 60,
  overrides: { accentDeep: 'trim', ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: 'circumferential', minReadableSize: 48,
            contrastAgainst: 'body', ...o.checks },
  parts,
});

/* A plain band round the neck, which four of these start from. */
const collar = (o = {}) => ({
  frame: headRing({ u: o.u ?? NECK, thickness: o.thickness ?? 0.10,
                    radius: o.radius ?? 1.015, segments: 28 }),
  fill: o.fill, gloss: o.gloss,
  material: o.material,
});

/**
 * A point on the front of the neck — where a knot, a badge or a medal hangs.
 *
 * Never hidden, always sorted. The first version dropped these once the anchor
 * got within a fifth of a radius of the horizon, and the suite caught what that
 * costs: the item is still fully visible at that point, so it popped out of
 * existence in plain sight — a 30px jump at 300°. Depth sorts, it does not
 * hide. Carried round the back the anchor lands in the rear pass, the body
 * draws over it, and it goes away because it is behind something, which is the
 * same rule every other prop in this catalogue follows.
 */
const frontOf = (u, z = null, radius = 1.02) => headAnchor({
  at: [0, u, z === null ? Math.sqrt(Math.max(0, 1 - u * u)) : z],
  radius, hideBehind: -1.1, place: 'size',
});

/* ------------------------------------------------------------------ ties */

neckwear('bow-tie', [
  collar({ thickness: 0.07, fill: 'accentDeep',
           material: { accentDeep: { from: 'accent', darken: 0.20 } } },),
  { frame: frontOf(NECK - 0.02),
    material: { accentDeep: { from: 'accent', darken: 0.16 } },
    art: p => group([
      /* Concave outer edges, pinched at the knot — two plain triangles read as
         a propeller and two plain ellipses read as earmuffs. */
      path({ x: p.x, y: p.y, fill: 'accent', cmds: [
        ['M', 0, 0], ['C', -9, -13, -25, -12, -25, -2],
        ['C', -25, 8, -9, 10, 0, 0], ['Z']] }),
      path({ x: p.x, y: p.y, fill: 'accent', cmds: [
        ['M', 0, 0], ['C', 9, -13, 25, -12, 25, -2],
        ['C', 25, 8, 9, 10, 0, 0], ['Z']] }),
      ellipse({ x: p.x, y: p.y, rx: 6, ry: 7.5, fill: 'accentDeep', outline: 'none' }),
    ]) },
], { defaults: { accent: '#E0574B' } });

neckwear('necktie', [
  collar({ thickness: 0.07, fill: 'accentDeep',
           material: { accentDeep: { from: 'accent', darken: 0.24 } } }),
  { frame: frontOf(NECK - 0.01),
    material: { accentDeep: { from: 'accent', darken: 0.16 } },
    art: p => group([
      /* Knot first, then the blade, so the blade's top edge is hidden under
         it — a tie whose blade starts below the knot has a gap in it. */
      path({ x: p.x, y: p.y, fill: 'accent', cmds: [
        ['M', 0, 3], ['L', -10, 14], ['L', 0, 38], ['L', 10, 14], ['Z']] }),
      path({ x: p.x, y: p.y, fill: 'accentDeep', outline: 'none', cmds: [
        ['M', -7, -5], ['L', 7, -5], ['L', 9, 6], ['L', -9, 6], ['Z']] }),
    ]) },
], { defaults: { accent: '#4A73C4' } });

/* ----------------------------------------------------------------- soft */

/* A scarf is a thick band with two tails. The tails hang from the FRONT of the
   band rather than from its centre, so they swing out of sight with it. */
neckwear('scarf', [
  collar({ u: NECK - 0.04, thickness: 0.19, radius: 1.03 }),
  { frame: frontOf(NECK + 0.04, null, 1.04),
    material: { accentDeep: { from: 'accent', darken: 0.14 } },
    art: p => group([
      path({ x: p.x, y: p.y, fill: 'accent', cmds: [
        ['M', -15, -6], ['L', -4, -6], ['L', -3, 28], ['L', -18, 28], ['Z']] }),
      path({ x: p.x, y: p.y, fill: 'accentDeep', cmds: [
        ['M', 4, -6], ['L', 15, -6], ['L', 19, 21], ['L', 6, 21], ['Z']] }),
    ]) },
], { defaults: { accent: '#E0574B' } });

/* A bandana is a triangle over the front of the band, with the knot at the
   side — centred, it reads as a bib. */
neckwear('bandana', [
  collar({ thickness: 0.06, fill: 'accentDeep',
           material: { accentDeep: { from: 'accent', darken: 0.18 } } }),
  { frame: frontOf(NECK - 0.01),
    art: p => path({ x: p.x, y: p.y, fill: 'accent', cmds: [
      ['M', -27, -2], ['L', 27, -2], ['Q', 23, 22, 0, 31], ['Q', -23, 22, -27, -2], ['Z']] }) },
  { frame: frontOf(NECK - 0.06, null, 1.03),
    material: { accentDeep: { from: 'accent', darken: 0.18 } },
    art: p => ellipse({ x: p.x - 30, y: p.y + 2, rx: 8, ry: 6,
                        rotate: -0.4, fill: 'accentDeep', outline: 'none' }) },
], { defaults: { accent: '#F2B33D' } });

/* ---------------------------------------------------------------- hanging */

/* A medal hangs on a ribbon. The ribbon is two strokes rather than one band,
   because a single band from the neck reads as a bib strap. */
neckwear('medal', [
  { frame: frontOf(NECK - 0.10, null, 1.02),
    gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.22 } },
    art: p => group([
      line({ pts: [[p.x - 12, p.y], [p.x - 3, p.y + 20]], width: 5, stroke: 'accentDeep' }),
      line({ pts: [[p.x + 12, p.y], [p.x + 3, p.y + 20]], width: 5, stroke: 'accentDeep' }),
    ]) },
  { frame: frontOf(NECK + 0.13, null, 1.03),
    material: { accentLight: { from: 'accent', lighten: 0.30 } },
    art: p => group([
      circle({ x: p.x, y: p.y, r: 14, fill: 'accent' }),
      circle({ x: p.x, y: p.y, r: 8, fill: 'accentLight', outline: 'none' }),
    ]) },
], { occupies: ['neck.ring', 'chest.front'], z: 54,
     defaults: { accent: '#F2C744' } });

/* A blank badge: header bar, two rule lines, and a pin. The shape of a name
   badge is what reads at 48px; the name on it never was. */
neckwear('name-badge', [
  { frame: frontOf(NECK + 0.10, null, 1.02),
    material: { accentDeep: { from: 'accent', darken: 0.28 } },
    art: p => group([
      roundedRect({ x: p.x, y: p.y, w: 54, h: 36, r: 5, fill: 'white' }),
      roundedRect({ x: p.x, y: p.y - 11, w: 54, h: 14, r: 5, fill: 'accent', outline: 'none' }),
      line({ pts: [[p.x - 18, p.y + 6], [p.x + 18, p.y + 6]], width: 3, stroke: 'accentDeep' }),
      line({ pts: [[p.x - 18, p.y + 13], [p.x + 6, p.y + 13]], width: 3, stroke: 'accentDeep' }),
    ]) },
], { occupies: ['chest.front'], z: 56, defaults: { accent: '#4A73C4' } });

/* A lanyard: a cord that goes round the neck and a card on the end of it. The
   cord is the ring, so it passes behind exactly like a collar does. */
neckwear('lanyard', [
  { frame: headBand({ u: NECK - 0.06, width: 6, radius: 1.02, segments: 48 }),
    fill: 'accentDeep', gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.26 } } },
  { frame: frontOf(NECK + 0.12, null, 1.02),
    material: { accentDeep: { from: 'accent', darken: 0.26 } },
    art: p => group([
      line({ pts: [[p.x, p.y - 26], [p.x, p.y - 14]], width: 5, stroke: 'accentDeep' }),
      roundedRect({ x: p.x, y: p.y + 4, w: 38, h: 50, r: 5, fill: 'white' }),
      roundedRect({ x: p.x, y: p.y - 12, w: 38, h: 14, r: 5, fill: 'accent', outline: 'none' }),
      line({ pts: [[p.x - 12, p.y + 12], [p.x + 12, p.y + 12]], width: 3, stroke: 'accentDeep' }),
      line({ pts: [[p.x - 12, p.y + 20], [p.x + 4, p.y + 20]], width: 3, stroke: 'accentDeep' }),
    ]) },
], { occupies: ['neck.ring', 'chest.front'], z: 55, defaults: { accent: '#5FA85C' } });

/* ---------------------------------------------------------------- collars */

/* A ruff is a ring of frills. Each frill rides the ring and sorts on its own
   depth, so the back of the ruff passes behind the neck instead of lying
   across it — which is the whole reason it is studs and not a drawn band. */
neckwear('ruff-collar', [
  { frame: ringStuds({ u: NECK, radius: 1.05, count: 16 }),
    art: p => ellipse({ x: p.x, y: p.y, rx: 9 + 5 * p.facing, ry: 15, fill: 'white' }) },
  collar({ thickness: 0.05, fill: 'accentDeep', gloss: false,
           material: { accentDeep: { from: 'accent', darken: 0.10 } } }),
], { z: 48, defaults: { accent: '#DCC4AE' } });

/* Six stripes, six parts, each carrying its own colour: a rainbow that
   recolours with the character is not a rainbow, so these cannot come from the
   palette the way every other prop's colours do. */
const STRIPES = ['#E0574B', '#F0913F', '#F2CE4E', '#5FA85C', '#4A73C4', '#B79BE8'];

defineProp({
  id: 'rainbow-collar',
  kind: 'wearable',
  slot: 'neck',
  occupies: ['neck.ring'],
  passes: ['rearExternal', 'faceFront'],
  z: 60,
  checks: { visibility: 'circumferential', minReadableSize: 48, contrastAgainst: 'body' },
  parts: STRIPES.map((hex, i) => ({
    frame: headRing({ u: NECK, thickness: 0.11, radius: 1.02, segments: 24,
                      arc: [i * 4, i * 4 + 4] }),
    defaults: { accent: hex },
  })),
});

/* ----------------------------------------------------------------- apron */

/* An apron is a bib and two straps. It sits low and wide, and it is the one
   item in the slot that is mostly a single flat shape — so it carries a pocket
   seam, which is what stops it reading as a paint spill. */
neckwear('apron', [
  { frame: frontOf(NECK - 0.10, null, 1.02),
    gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.18 } },
    art: p => group([
      line({ pts: [[p.x - 22, p.y - 2], [p.x - 13, p.y + 18]], width: 5, stroke: 'accentDeep' }),
      line({ pts: [[p.x + 22, p.y - 2], [p.x + 13, p.y + 18]], width: 5, stroke: 'accentDeep' }),
    ]) },
  { frame: frontOf(NECK + 0.07, null, 1.02),
    material: { accentDeep: { from: 'accent', darken: 0.18 } },
    art: p => group([
      path({ x: p.x, y: p.y, fill: 'accent', cmds: [
        ['M', -16, -22], ['L', 16, -22], ['L', 20, -6],
        ['Q', 30, 4, 28, 26], ['L', -28, 26], ['Q', -30, 4, -20, -6], ['Z']] }),
      roundedRect({ x: p.x, y: p.y + 12, w: 30, h: 16, r: 3,
                    fill: 'accentDeep', outline: 'none' }),
    ]) },
], { occupies: ['chest.front'], z: 46, defaults: { accent: '#5FA85C' } });
