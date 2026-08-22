/**
 * Clips — twelve items on one primitive.
 *
 * This file is the framework's argument. Every item here is the same frame as
 * the bow next door — flat art on a billboard riding the skull — with
 * different numbers, and each one is between three and twelve lines. The
 * hand-written equivalents would have been twelve copies of the projection,
 * the foreshortening floor, the depth sort and the outline handling, and
 * twelve chances to get one of them wrong.
 *
 * Three rules they all obey, and none is negotiable at 48px:
 *
 *  - **Silhouette first.** A clip is read at the size of a thumbnail on a
 *    phone. Anything that needs an interior detail to be recognisable is not a
 *    clip; it is a picture of one.
 *  - **Interior details take no contour.** They declare `outline: 'none'`, so
 *    the outline pass leaves them alone. A line around every seed of an apple
 *    is a different drawing.
 *  - **Size against the bow, not against the artboard.** The first draft of
 *    this file was drawn at two-thirds this scale and every item read as a
 *    speck stuck to the head — correct in every structural check and wrong in
 *    the only one that matters, which is looking at it. The bow is roughly
 *    50px across on a 320px character; nothing here is much smaller.
 *
 * Colour is per item rather than per character: a leaf that recolours with the
 * skin stops being a leaf. Anything whose identity is not its colour — the
 * ribbon, the pom-pom, the rosette — takes the character's accent instead.
 */

import { defineProp } from '../registry.js';
import { headBillboard } from '../frames.js';
import { group, circle, ellipse, star, heart, path, line, roundedRect, around, mirror } from '../shapes.js';

/**
 * One clip: art on the left side of the skull, at the angle a clip sits.
 *
 * `at` and `minFacing` are the two numbers worth varying — a wide flat item
 * needs a higher floor before it stops reading than a compact one.
 */
const clip = (id, art, o = {}) => defineProp({
  id,
  kind: 'wearable',
  slot: 'head.side',
  occupies: ['skull.left'],
  passes: ['headRear', 'headFront'],
  z: 40,
  gloss: o.gloss ?? false,
  defaults: o.defaults,
  overrides: o.overrides,
  checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [{
    frame: headBillboard({ at: o.at || [-0.46, -0.68, 0.52], radius: 1.02,
                           minFacing: o.minFacing ?? 0.54, roll: o.roll ?? -0.10 }),
    material: o.material,
    art,
  }],
});

/* -------------------------------------------------------------- geometric */

clip('star-clip', group([
  star({ outer: 27, inner: 12, points: 5, fill: 'accent' }),
  circle({ r: 6, fill: 'accentLight', outline: 'none' }),
]), { defaults: { accent: '#FFC94A' } });

clip('heart-clip', group([
  heart({ size: 46, fill: 'accent' }),
  /* The highlight is what makes a heart read as an object rather than as a
     symbol. Off-centre, because a centred one reads as a hole. */
  ellipse({ x: -9, y: -9, rx: 6.5, ry: 4.6, rotate: -0.5, fill: 'accentLight', outline: 'none' }),
]), { defaults: { accent: '#F26D8B' } });

/* A crescent, drawn as ONE path rather than a disc with a second disc painted
   over it in the head's colour: an overpainted bite is a hole the moment the
   clip sits over anything but the head. */
clip('moon-clip', path({
  fill: 'accent',
  cmds: [
    ['M', 3, -25],
    ['C', 21, -21, 27, 0, 15, 16],
    ['C', 6, 27, -9, 27, -18, 21],
    ['C', -3, 21, 9, 9, 9, -4],
    ['C', 9, -13, 7, -21, 3, -25],
    ['Z'],
  ],
}), { defaults: { accent: '#F2E27A' }, minFacing: 0.56 });

clip('lightning-clip', path({
  fill: 'accent',
  cmds: [['M', 5, -27], ['L', -17, 3], ['L', -3, 3], ['L', -8, 27],
         ['L', 17, -5], ['L', 2, -5], ['Z']],
}), { defaults: { accent: '#FFC94A' }, minFacing: 0.5 });

/* ----------------------------------------------------------------- rainbow */

/**
 * Five stroked arcs.
 *
 * Strokes rather than nested filled arcs because a filled rainbow needs
 * even-odd winding and six exact radii to avoid seams; five lines need five
 * numbers. It is also the one item whose colours are not a palette — a
 * rainbow that recolours is not a rainbow — so each band is its own part with
 * its own default, which is why this one is spelled out rather than going
 * through `clip()`.
 */
const RAINBOW = ['#E0574B', '#F0913F', '#F2CE4E', '#5FA85C', '#4A73C4'];

defineProp({
  id: 'rainbow-clip',
  kind: 'wearable',
  slot: 'head.side',
  occupies: ['skull.left'],
  passes: ['headRear', 'headFront'],
  z: 40,
  gloss: false,
  checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body' },
  parts: RAINBOW.map((hex, i) => ({
    frame: headBillboard({ at: [-0.46, -0.68, 0.52], radius: 1.02, minFacing: 0.58, roll: -0.10 }),
    defaults: { accent: hex },
    art: line({
      pts: Array.from({ length: 19 }, (_, k) => {
        const a = Math.PI + (k / 18) * Math.PI, r = 30 - i * 5.6;
        return [Math.cos(a) * r, Math.sin(a) * r + 13];
      }),
      width: 6, stroke: 'accent', cap: 'butt',
    }),
  })),
});

/* ------------------------------------------------------------------ school */

clip('apple-clip', group([
  /* Two lobes with a dip at the top. A single ellipse is a tomato. */
  path({
    fill: 'accent',
    cmds: [
      ['M', 0, -13],
      ['C', -8, -24, -26, -19, -24, -2],
      ['C', -23, 15, -11, 27, 0, 20],
      ['C', 11, 27, 23, 15, 24, -2],
      ['C', 26, -19, 8, -24, 0, -13],
      ['Z'],
    ],
  }),
  line({ pts: [[0, -15], [2, -30]], width: 4, stroke: 'neutralDeep' }),
  ellipse({ x: 11, y: -28, rx: 9, ry: 5, rotate: -0.4, fill: 'gem', outline: 'none' }),
]), { defaults: { accent: '#E0574B', gem: '#5FA85C' }, minFacing: 0.5 });

clip('pencil-clip', group([
  roundedRect({ x: 0, y: -3, w: 16, h: 40, r: 3, fill: 'accent' }),
  /* The tip is the whole read at small sizes: wood, then a dark point. */
  path({ fill: 'accentLight', cmds: [['M', -8, 17], ['L', 8, 17], ['L', 0, 34], ['Z']] }),
  path({ fill: 'ink', outline: 'none', cmds: [['M', -2.7, 28], ['L', 2.7, 28], ['L', 0, 34], ['Z']] }),
  roundedRect({ x: 0, y: -25, w: 16, h: 9, r: 2.5, fill: 'gem' }),
]), { defaults: { accent: '#F2B33D', accentLight: '#F3DCA8', gem: '#E888A0' },
      minFacing: 0.46, roll: 0.22 });

/* ------------------------------------------------------------------ fabric */

/* A rosette: a ring of petals with a button, then two short tails. The petals
   are one shape said eight times. */
clip('rosette', group([
  around(8, 19, () => ellipse({ rx: 11, ry: 8, fill: 'accent' })),
  circle({ r: 10, fill: 'accentDeep', outline: 'none' }),
  path({ fill: 'accent', cmds: [['M', -7, 16], ['L', -14, 37], ['L', -2, 31], ['Z']] }),
  path({ fill: 'accent', cmds: [['M', 7, 16], ['L', 14, 37], ['L', 2, 31], ['Z']] }),
]), { minFacing: 0.5 });

/* A pom-pom is a CLUSTER, not a circle.
   Drawn first as six discs round a seventh of the same radius, which produced
   a smooth blob that read as a lemon: the union of overlapping equal discs is
   very nearly a disc. The bumps have to stand proud of the middle, so the ring
   sits wider than the hub and the highlight does the rest. */
clip('pompom-clip', group([
  around(7, 14, () => circle({ r: 11, fill: 'accent' })),
  circle({ r: 13, fill: 'accent' }),
  circle({ x: -6, y: -7, r: 6, fill: 'accentLight', outline: 'none' }),
]), { minFacing: 0.5 });

/* Four wings and a body.
   Round wings — four ellipses, which is what this was — read as a bunch of
   grapes: a butterfly is recognised by the notch between its wing pairs and by
   the wings being wider at the tip than at the body. */
clip('butterfly-clip', group([
  mirror(side => path({ fill: 'accent', cmds: [
    ['M', 0, -3],
    ['C', side * 8, -27, side * 32, -28, side * 31, -9],
    ['C', side * 31, 3, side * 14, 7, 0, -3],
    ['Z'],
  ] })),
  mirror(side => path({ fill: 'accent', cmds: [
    ['M', 0, 3],
    ['C', side * 7, 16, side * 25, 23, side * 23, 9],
    ['C', side * 22, 0, side * 10, -2, 0, 3],
    ['Z'],
  ] })),
  ellipse({ rx: 4, ry: 18, fill: 'accentDeep', outline: 'none' }),
  mirror(side => line({ pts: [[0, -14], [side * 8, -27]], width: 2.5, stroke: 'accentDeep' })),
]), { defaults: { accent: '#B79BE8' }, minFacing: 0.5 });

/* Two leaves off a stem. Deliberately asymmetric — a symmetric sprig reads as
   a propeller — and the stem is short, because a long one reads as a weed. */
clip('leaf-sprig', group([
  line({ pts: [[-2, 19], [2, -15]], width: 4, stroke: 'accentDeep' }),
  ellipse({ x: -14, y: 2, rx: 15, ry: 9, rotate: -0.55, fill: 'accent' }),
  ellipse({ x: 13, y: -9, rx: 13, ry: 8, rotate: 0.5, fill: 'accent' }),
]), { defaults: { accent: '#6FB56A' }, minFacing: 0.5 });

/* A ribbon is the bow's tails without the bow: a band of colour that reads at
   any size and takes the character's own accent. */
clip('ribbon', group([
  roundedRect({ x: 0, y: -17, w: 34, h: 12, r: 4, fill: 'accent' }),
  path({ fill: 'accentDeep', cmds: [['M', -12, -11], ['L', -20, 27], ['L', -6, 19], ['Z']] }),
  path({ fill: 'accent', cmds: [['M', 12, -11], ['L', 20, 27], ['L', 6, 19], ['Z']] }),
]), { minFacing: 0.5 });
