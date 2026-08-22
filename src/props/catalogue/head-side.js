/**
 * Head-side props — the things clipped to one side of the skull.
 *
 * These are the first two ported off hand-written `draw()` functions and onto
 * the framework, and they were chosen because they are the shape the rest of
 * the catalogue will mostly be: flat art on a billboard that rides the sphere.
 * If the framework cannot express these exactly, it cannot express fifty of
 * them.
 *
 * "Exactly" is meant literally — the snapshot suite compares these against the
 * drawings the hand-written versions produced, byte for byte. A port that
 * looks right is not a port; it is a redesign nobody asked for.
 */

import { defineProp } from '../registry.js';
import { headBillboard } from '../frames.js';
import { group, circle, ellipse, path, around } from '../shapes.js';

/* --------------------------------------------------------------------- bow */

const R = 26;

/* Two loops pinched at the knot, with a concave outer edge. A pair of plain
   ellipses reads as earmuffs, which is what this was for a while. */
const bowLoop = side => path({
  fill: 'accent',
  cmds: [
    ['M', 0, 0],
    ['C', side * R * 0.55, -R * 0.72, side * R * 1.30, -R * 0.60, side * R * 1.22, -R * 0.05],
    ['C', side * R * 1.16, R * 0.52, side * R * 0.50, R * 0.62, 0, 0],
    ['Z'],
  ],
});

const bowTail = side => path({
  fill: 'accent',
  cmds: [
    ['M', side * R * 0.14, R * 0.10],
    ['C', side * R * 0.44, R * 0.62, side * R * 0.52, R * 0.95, side * R * 0.30, R * 1.10],
    ['C', side * R * 0.20, R * 0.80, side * R * 0.04, R * 0.55, 0, R * 0.16],
    ['Z'],
  ],
});

defineProp({
  id: 'bow',
  kind: 'wearable',
  slot: 'head.side',
  occupies: ['skull.left'],
  passes: ['headRear', 'headFront'],
  z: 40,
  /* No form light. A bow is small and mostly edge-lit; a terminator across
     something this size reads as dirt rather than as shading. */
  gloss: false,
  overrides: { accentDeep: 'knot' },
  checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [{
    /* Slightly off the top-left of the skull, and rolled a touch out of the
       head's up axis so it sits at a jaunty angle instead of standing to
       attention. */
    frame: headBillboard({ at: [-0.44, -0.70, 0.50], radius: 1.02, minFacing: 0.52, roll: -0.24 }),
    material: { accentDeep: { from: 'accent', darken: 0.14 } },
    art: group([
      bowLoop(-1), bowLoop(1),
      bowTail(-1), bowTail(1),
      /* The knot is inside the bow, so it takes no contour: an outline around
         every internal detail is a different drawing at small sizes. */
      ellipse({ rx: R * 0.26, ry: R * 0.30, fill: 'accentDeep', outline: 'none' }),
    ]),
  }],
});

/* ------------------------------------------------------------------ flower */

const FR = 16;

defineProp({
  id: 'flower',
  kind: 'wearable',
  slot: 'head.side',
  occupies: ['skull.left'],
  passes: ['headRear', 'headFront'],
  z: 40,
  gloss: false,
  /* A flower is pink whatever the character's accent happens to be. An item
     that recolours with the skin stops being a flower and becomes a blob. */
  defaults: { accent: '#F26D8B', gem: '#FFD97A' },
  overrides: { gem: 'centre' },
  checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [{
    frame: headBillboard({ at: [-0.50, -0.64, 0.55], radius: 1.02, minFacing: 0.55 }),
    art: group([
      around(5, FR, () => circle({ r: FR * 0.72, fill: 'accent' })),
      circle({ r: FR * 0.60, fill: 'gem', outline: 'none' }),
    ]),
  }],
});
