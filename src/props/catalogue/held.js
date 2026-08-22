/**
 * Held things — the slot that needed hands.
 *
 * Three facts shape everything here, and all three are in `handGrip`,
 * `bothHands` and the pass structure rather than in any item:
 *
 *  - **A held thing rides the live hand.** Its position comes off the same
 *    projection and the same `S.hand` state the renderer uses to place the
 *    mitten, so a pencil goes with a wave. Anything that recomputed the spot
 *    from a constant would detach the moment the character moved — the held
 *    version of the decal-on-the-lens bug.
 *  - **It needs three places, not two.** Behind the whole character when the
 *    hand holding it is the far one; behind the near hand when it is not, so
 *    the mitten closes over it and reads as a grip; and in front of that hand
 *    for anything the fingers should not cover. Two of those passes present
 *    the same "back"/"front" answer, which is why a part can name its pass.
 *  - **Two-handed props are sized by the SPAN between the hands**, not by a
 *    constant. The hands move; an open book with a fixed width would tear
 *    itself off one of them.
 *
 * On letters: two items carry one, drawn from the rig's own procedural glyph
 * set. That is not the "no text in props" trap — the trap is fonts,
 * localisation and `<text>` in exported SVG. These are the same Bézier paths
 * the character already traces, and the letter is a parameter, so
 * `alphabet-card` counts once whatever it says.
 */

import { defineProp } from '../registry.js';
import { handGrip, bothHands } from '../frames.js';
import { group, circle, ellipse, path, line, ring, roundedRect, custom } from '../shapes.js';
import { drawGlyph } from '../../core/glyphs.js';

/**
 * One held item.
 *
 * `art(p)` is authored around the origin — the compiler has already put the
 * origin in the hand and rotated it with the hand's swing. `p.hand` is ∓1, so
 * an asymmetric item can face the right way.
 */
const held = (id, art, o = {}) => {
  const hand = o.hand || 'r';
  const frame = o.frame || handGrip({ side: hand, lift: o.lift ?? 0, out: o.out ?? 0 });
  const common = { frame, art, material: o.material, gloss: o.gloss, defaults: o.defaults };
  return defineProp({
    id,
    kind: 'held',
    slot: o.slot || 'hand',
    occupies: o.occupies || [hand === 'l' ? 'hand.left' : 'hand.right'],
    passes: ['rearExternal', 'heldRear', 'heldFront'],
    z: o.z ?? 70,
    grip: o.grip || { lift: 0.55, out: 0.35 },
    defaults: o.defaults,
    overrides: o.overrides,
    checks: { visibility: 'localized', minReadableSize: 48,
              contrastAgainst: 'body', ...o.checks },
    parts: [
      { ...common, pass: 'rearExternal', side: 'far' },
      { ...common, pass: 'heldRear', side: 'near' },
      ...(o.front ? [{ ...common, art: o.front, pass: 'heldFront', side: 'near' }] : []),
    ],
  });
};

/**
 * Two hands, sized by how far apart they are — and held LOW.
 *
 * The midpoint of two resting hands is level with the eyes, so the first
 * version of every two-handed prop was a book held across the character's own
 * face. Real hands come forward and down to hold something you are looking at,
 * so the hands go out and the art drops below the anchor.
 */
const twoHanded = (id, art, o = {}) =>
  held(id, p => group([art(p)], { y: o.drop ?? 10 }),
       { ...o, frame: bothHands(), grip: o.grip || { lift: -0.42, out: 0.62 },
         occupies: ['hand.left', 'hand.right'] });

/* ===================================================== writing and drawing */

/* A pencil is read by its TIP: wood, then a dark point. Everything above the
   ferrule is just a coloured stick, and a coloured stick is a crayon. */
held('pencil', p => group([
  roundedRect({ x: 0, y: -5.7, w: 18.5, h: 76.7, r: 2.8, fill: 'accent' }),
  path({ fill: 'accentLight', cmds: [['M', -9.2, 32.7], ['L', 9.2, 32.7], ['L', 0, 56.8], ['Z']] }),
  path({ fill: 'ink', outline: 'none', cmds: [['M', -3.4, 47.7], ['L', 3.4, 47.7], ['L', 0, 56.8], ['Z']] }),
  roundedRect({ x: 0, y: -39.8, w: 18.5, h: 11.4, r: 2.1, fill: 'neutral', outline: 'none' }),
  roundedRect({ x: 0, y: -51.1, w: 17, h: 14.2, r: 4.3, fill: 'gem' }),
], { rotate: -0.5 * p.hand }),
  { defaults: { accent: '#F2B33D', accentLight: '#F3DCA8', gem: '#E888A0' } });

/* Fatter, blunter, and wrapped in a paper band — which is the whole
   difference between a crayon and a pencil at this size. */
held('crayon', p => group([
  roundedRect({ x: 0, y: 0, w: 25.6, h: 65.3, r: 4.3, fill: 'accent' }),
  path({ fill: 'accent', cmds: [['M', -12.8, 28.4], ['L', 12.8, 28.4], ['L', 0, 48.3], ['Z']] }),
  roundedRect({ x: 0, y: 2.8, w: 27, h: 28.4, r: 2.8, fill: 'accentLight', outline: 'none' }),
], { rotate: -0.45 * p.hand }),
  { defaults: { accent: '#E0574B' } });

held('marker', p => group([
  roundedRect({ x: 0, y: -2.8, w: 27, h: 56.8, r: 5.7, fill: 'accent' }),
  roundedRect({ x: 0, y: -34.1, w: 29.8, h: 25.6, r: 7.1, fill: 'accentDeep' }),
  path({ fill: 'ink', cmds: [['M', -8.5, 25.6], ['L', 8.5, 25.6], ['L', 5.7, 42.6], ['L', -5.7, 42.6], ['Z']] }),
], { rotate: -0.42 * p.hand }),
  { defaults: { accent: '#4A73C4' }, material: { accentDeep: { from: 'accent', darken: 0.24 } } });

held('paintbrush', p => group([
  roundedRect({ x: 0, y: -11.4, w: 12.8, h: 65.3, r: 4.3, fill: 'accent' }),
  roundedRect({ x: 0, y: 25.6, w: 17, h: 17, r: 2.8, fill: 'neutral' }),
  path({ fill: 'ink', cmds: [['M', -8.5, 34.1], ['L', 8.5, 34.1], ['L', 4.3, 59.6], ['L', -4.3, 59.6], ['Z']] }),
], { rotate: -0.5 * p.hand }),
  { defaults: { accent: '#C8A24A', ink: '#4A73C4' } });

/* Short, pale and square-ended. The dust at the tip is what says chalk. */
/* Not pure white: the page is white too, and on a skin with no contour a white
   stick on a white background is a stick nobody can see. Chalk is chalk-
   coloured — a warm off-white — with a dusty tip. */
held('chalk', p => group([
  roundedRect({ x: 0, y: 0, w: 25, h: 70, r: 3, fill: 'accent' }),
  roundedRect({ x: 0, y: 27, w: 25, h: 16, r: 3, fill: 'accentLight', outline: 'none' }),
], { rotate: -0.4 * p.hand }),
  { defaults: { accent: '#E6DDCB' },
    material: { accentLight: { from: 'accent', darken: 0.12 } } });

/* ==================================================== measuring and looking */

/* Ticks along one edge only, and unevenly — a ladder of identical marks reads
   as a comb. */
held('ruler', p => group([
  roundedRect({ x: 0, y: 0, w: 99.4, h: 21.3, r: 4.3, fill: 'accent' }),
  ...[-28, -20, -12, -4, 4, 12, 20, 28].map((x, i) =>
    line({ pts: [[x, 10.6], [x, i % 2.8 ? 0 : -4.3]], width: 2.8, stroke: 'accentDeep' })),
], { rotate: -0.2 * p.hand }),
  { defaults: { accent: '#F2CE4E' }, material: { accentDeep: { from: 'accent', darken: 0.34 } } });

held('pointer', p => group([
  roundedRect({ x: 0, y: 0, w: 8.5, h: 105.1, r: 4.3, fill: 'accent' }),
  circle({ x: 0, y: -54, r: 9.9, fill: 'accentDeep' }),
], { rotate: -0.62 * p.hand }),
  { defaults: { accent: '#34323B' }, material: { accentDeep: { from: 'accent', lighten: 0.55 } } });

held('magnifier', p => group([
  roundedRect({ x: 0, y: 36.9, w: 12.8, h: 48.3, r: 5.7, fill: 'accentDeep' }),
  /* Glass first, then the rim as a STROKE. Filling the rim over the glass —
     which is what this did — makes the lens an opaque disc, and a magnifier
     you cannot see through is a lollipop. */
  circle({ x: 0, y: -8.5, r: 29.8, fill: 'lens' }),
  ring({ x: 0, y: -8.5, rx: 29.8, width: 6.5, stroke: 'accent' }),
], { rotate: -0.3 * p.hand }),
  { defaults: { accent: '#4A73C4' }, gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.30 } } });

/* The lens is drawn twice on purpose: once as pale glass under the rim, once
   as the rim itself, so the glass is a tint rather than a hole. */

held('clipboard', p => group([
  roundedRect({ x: 0, y: 0, w: 65.3, h: 85.2, r: 5.7, fill: 'accent' }),
  roundedRect({ x: 0, y: 4.3, w: 54, h: 65.3, r: 2.8, fill: 'white' }),
  roundedRect({ x: 0, y: -36.9, w: 28.4, h: 14.2, r: 4.3, fill: 'neutralDeep' }),
  ...[-8, 0, 8, 16].map(y =>
    line({ pts: [[-19.9, y], [y === 22.7 ? 5.7 : 19.9, y]], width: 3.4, stroke: 'neutral' })),
], { rotate: -0.12 * p.hand }),
  { defaults: { accent: '#C8A24A' } });

/* ============================================================ books & paper */

/* Closed: cover, spine, and a visible block of page edges. Without the page
   edges it is a rectangle. */
held('closed-book', p => group([
  roundedRect({ x: 0, y: 0, w: 62.5, h: 79.5, r: 4.3, fill: 'accent' }),
  roundedRect({ x: 25.6, y: 0, w: 11.4, h: 71, r: 2.8, fill: 'white' }),
  roundedRect({ x: -24.1, y: 0, w: 9.9, h: 79.5, r: 4.3, fill: 'accentDeep', outline: 'none' }),
  line({ pts: [[-5.7, -22.7], [17, -22.7]], width: 4.3, stroke: 'accentLight' }),
  line({ pts: [[-5.7, -11.4], [8.5, -11.4]], width: 4.3, stroke: 'accentLight' }),
], { rotate: -0.1 * p.hand }),
  { defaults: { accent: '#5FA85C' },
    material: { accentDeep: { from: 'accent', darken: 0.26 },
                accentLight: { from: 'accent', lighten: 0.45 } } });

/* Open: two pages meeting in a V, spanning whatever the hands are doing. The
   spine is the low point, and the outer corners lift — a flat pair of
   rectangles reads as a folded card. */
twoHanded('open-book', p => {
  const w = Math.max(58, Math.min(120, p.span)) / 2;
  return group([
    path({ fill: 'white', cmds: [
      ['M', 0, -5.7], ['L', -w, -22.7], ['L', -w, 28.4], ['L', 0, 36.9], ['Z']] }),
    path({ fill: 'white', cmds: [
      ['M', 0, -5.7], ['L', w, -22.7], ['L', w, 28.4], ['L', 0, 36.9], ['Z']] }),
    line({ pts: [[0, -5.7], [0, 36.9]], width: 4.3, stroke: 'accent' }),
    ...[2, 9, 16].map(dy => line({
      pts: [[-w * 1.1, -8.5 + dy], [-w * 0.3, -1.4 + dy]], width: 2.8, stroke: 'neutral' })),
    ...[2, 9, 16].map(dy => line({
      pts: [[w * 0.3, -1.4 + dy], [w * 1.1, -8.5 + dy]], width: 2.8, stroke: 'neutral' })),
  ]);
}, { defaults: { accent: '#E0574B' } });

/* Three cards, fanned. Offsetting them is the whole read — stacked exactly
   they are one card. */
held('flashcards', p => group([
  roundedRect({ x: -9.9, y: 5.7, w: 54, h: 68.2, r: 5.7, fill: 'white', rotate: 0 }),
  roundedRect({ x: 0, y: 0, w: 54, h: 68.2, r: 5.7, fill: 'white' }),
  roundedRect({ x: 9.9, y: -5.7, w: 54, h: 68.2, r: 5.7, fill: 'white' }),
  roundedRect({ x: 9.9, y: -22.7, w: 54, h: 17, r: 5.7, fill: 'accent', outline: 'none' }),
], { rotate: -0.14 * p.hand }),
  { defaults: { accent: '#B79BE8' } });

/**
 * A card with a letter on it, from the rig's own glyph set.
 *
 * `letter` is an option, so this is one asset however many letters it can
 * show — the alphabet is not twenty-six props.
 */
const letterCard = (id, fallback) => held(id, (p, S, T, o) => group([
  roundedRect({ x: 0, y: 0, w: 65.3, h: 82.4, r: 7.1, fill: 'white' }),
  roundedRect({ x: 0, y: -32.7, w: 65.3, h: 17, r: 7.1, fill: 'accent', outline: 'none' }),
  custom({ draw(s, ctx) {
    s.save();
    s.translate(0, 6);
    drawGlyph(s, String(o.letter ?? fallback)[0], 57, ctx.col('ink'), 0.16, true, 'ink');
    s.restore();
  } }),
], { rotate: -0.1 * p.hand, x: -26 * p.hand, y: -20 }),
  { defaults: { accent: '#4A73C4' } });

letterCard('alphabet-card', 'A');
letterCard('number-card', '3');

/* A tile: square, chunky, letter centred, with a bevel. */
held('letter-tile', (p, S, T, o) => group([
  roundedRect({ x: 0, y: 0, w: 65.3, h: 65.3, r: 8.5, fill: 'accent' }),
  roundedRect({ x: -2.1, y: -2.1, w: 55.4, h: 55.4, r: 5.7, fill: 'accentLight', outline: 'none' }),
  custom({ draw(s, ctx) {
    s.save();
    s.translate(-1, -1);
    drawGlyph(s, String(o.letter ?? 'B')[0], 43, ctx.col('ink'), 0.17, true, 'ink');
    s.restore();
  } }),
], { rotate: -0.08 * p.hand, x: -22 * p.hand, y: -18 }),
  { defaults: { accent: '#DCC4AE' },
    material: { accentLight: { from: 'accent', lighten: 0.4 } } });

/* ========================================================== things and toys */

/* A knob on one edge and a socket on the opposite one — a square with a bump
   is a stamp, not a puzzle piece. */
held('puzzle-piece', p => group([
  path({ fill: 'accent', cmds: [
    ['M', -31.2, -31.2], ['L', -5.7, -31.2],
    ['C', -5.7, -45.4, 14.2, -45.4, 14.2, -31.2], ['L', 31.2, -31.2], ['L', 31.2, -5.7],
    ['C', 45.4, -5.7, 45.4, 14.2, 31.2, 14.2], ['L', 31.2, 31.2], ['L', -31.2, 31.2],
    ['L', -31.2, 14.2], ['C', -17, 14.2, -17, -5.7, -31.2, -5.7], ['Z']] }),
], { rotate: -0.1 * p.hand }),
  { defaults: { accent: '#F0913F' } });

held('building-block', p => group([
  roundedRect({ x: 0, y: 5.7, w: 68.2, h: 48.3, r: 5.7, fill: 'accent' }),
  roundedRect({ x: -17, y: -22.7, w: 21.3, h: 17, r: 5.7, fill: 'accent' }),
  roundedRect({ x: 17, y: -22.7, w: 21.3, h: 17, r: 5.7, fill: 'accent' }),
  line({ pts: [[-27, 17], [27, 17]], width: 3.5, stroke: 'accentDeep' }),
], { rotate: -0.06 * p.hand }),
  { defaults: { accent: '#E0574B' },
    material: { accentDeep: { from: 'accent', darken: 0.22 } } });

/* Two hands: a frame with three rows of beads. The rows are what make it an
   abacus; one row is a rattle. */
twoHanded('abacus', p => {
  const w = Math.max(64, Math.min(118, p.span)) / 2;
  return group([
    roundedRect({ x: 0, y: 0, w: w * 2 + 10, h: 71, r: 7.1, fill: 'accent' }),
    roundedRect({ x: 0, y: 0, w: w * 2 - 4, h: 54, r: 2.8, fill: 'white', outline: 'none' }),
    ...[-13, 0, 13].map((y, row) => group(
      [0, 1, 2, 3].map(i => circle({
        x: -w + 10 + i * ((w * 2 - 20) / 3.4) + (row === 1 ? 6 : 0),
        y, r: 9.2, fill: row === 1 ? 'gem' : 'accentDeep', outline: 'none' })))),
  ]);
}, { defaults: { accent: '#C8A24A', gem: '#4A73C4' },
     material: { accentDeep: { from: 'accent', darken: 0.34 } },
     });

/* A globe reads by its stand and its landmasses. A plain blue circle is a
   ball. */
twoHanded('globe', p => group([
  path({ fill: 'neutralDeep', cmds: [
    ['M', -22.7, 42.6], ['L', 22.7, 42.6], ['L', 14.2, 31.2], ['L', -14.2, 31.2], ['Z']] }),
  circle({ x: 0, y: -2.8, r: 38.3, fill: 'accent' }),
  path({ fill: 'accentDeep', outline: 'none', cmds: [
    ['M', -25.6, -14.2], ['C', -14.2, -28.4, 0, -19.9, 2.8, -5.7],
    ['C', -5.7, 0, -19.9, 0, -25.6, -14.2], ['Z']] }),
  path({ fill: 'accentDeep', outline: 'none', cmds: [
    ['M', 8.5, 8.5], ['C', 19.9, 2.8, 31.2, 11.4, 25.6, 22.7],
    ['C', 17, 28.4, 8.5, 19.9, 8.5, 8.5], ['Z']] }),
], { rotate: 0 }),
  { defaults: { accent: '#4A73C4' },
    material: { accentDeep: { from: 'accent', lighten: 0.45 } },
    });

/* A cup, two handles and a plinth. The handles are the read — without them it
   is a goblet. */
held('trophy', p => group([
  roundedRect({ x: 0, y: 42.6, w: 48.3, h: 14.2, r: 4.3, fill: 'accentDeep' }),
  roundedRect({ x: 0, y: 28.4, w: 17, h: 19.9, r: 4.3, fill: 'accent' }),
  ...[-1, 1].map(side => path({ fill: 'accent', cmds: [
    ['M', side * 21.3, -28.4], ['C', side * 45.4, -28.4, side * 45.4, 2.8, side * 19.9, 5.7],
    ['L', side * 19.9, -2.8], ['C', side * 35.5, -4.3, side * 35.5, -21.3, side * 21.3, -21.3], ['Z']] })),
  path({ fill: 'accent', cmds: [
    ['M', -24.1, -34.1], ['L', 24.1, -34.1], ['C', 24.1, 5.7, 14.2, 19.9, 0, 19.9],
    ['C', -14.2, 19.9, -24.1, 5.7, -24.1, -34.1], ['Z']] }),
  circle({ x: 0, y: -17, r: 8.5, fill: 'accentLight', outline: 'none' }),
], { rotate: -0.06 * p.hand }),
  { defaults: { accent: '#F2C744' },
    material: { accentDeep: { from: 'accent', darken: 0.26 },
                accentLight: { from: 'accent', lighten: 0.45 } } });
