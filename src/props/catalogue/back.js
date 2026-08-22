/**
 * Worn on the back — the last slot, and the only one you mostly cannot see.
 *
 * That is the whole design problem. On a character with a torso a backpack is
 * a shape between the shoulders; on an egg it is entirely behind the
 * silhouette, and face-on the honest drawing shows almost nothing of it. So
 * every item here is TWO things:
 *
 *  - a body that lives behind the character and peeks past its edges, sorted
 *    like everything else so it swings round into view as the character turns
 *  - something on the FRONT — straps, a clasp, a strip of strap over one
 *    shoulder — which is what tells you, face-on, that anything is being worn
 *    at all
 *
 * Without the second part these read as nothing until the character turns
 * round, which is not a prop, it is a surprise.
 */

import { defineProp } from '../registry.js';
import { headAnchor } from '../frames.js';
import { group, circle, ellipse, path, line, roundedRect } from '../shapes.js';

const backwear = (id, parts, o = {}) => defineProp({
  id,
  kind: 'wearable',
  slot: 'back',
  occupies: o.occupies || ['back'],
  passes: ['rearExternal', 'faceFront'],
  z: o.z ?? 8,
  overrides: { accentDeep: 'trim', ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: 'circumferential', minReadableSize: 48,
            contrastAgainst: 'body', ...o.checks },
  parts,
});

/* Behind the character: an anchor on the far surface, never hidden, always
   sorted — so it is behind the body face-on and in front of it once the
   character has turned round. */
const behind = (u, radius = 1.0) => headAnchor({
  at: [0, u, -Math.sqrt(Math.max(0, 1 - u * u))], radius,
  hideBehind: -1.1, place: 'size',
});

/**
 * And on the front, for the straps.
 *
 * LOW. The first version ran a pair of straps across the middle of the egg,
 * which is where the face is — the same mistake the collars made, and it looks
 * the same: a harness drawn over the character's eyes. There are no shoulders
 * to hang a strap from, so what shows at the front is the bottom END of one,
 * below the chin, where a strap would come down past the body's widest point.
 */
const infront = (u, radius = 1.02) => headAnchor({
  at: [0, u, Math.sqrt(Math.max(0, 1 - u * u))], radius,
  hideBehind: -1.1, place: 'size',
});

/* The width the body actually reaches, so a pack behind it can be made wide
   enough to show at the sides. Anything narrower than the body is invisible
   face-on, and an item nobody can see until the character turns round is not a
   prop, it is a surprise. */
const WIDER = 214;

/* --------------------------------------------------------------- backpack */

backwear('backpack', [
  { frame: behind(0.30, 1.0),
    material: { accentDeep: { from: 'accent', darken: 0.20 },
                accentLight: { from: 'accent', lighten: 0.16 } },
    art: p => group([
      roundedRect({ x: p.x, y: p.y - 4, w: WIDER, h: 132, r: 30, fill: 'accent' }),
      /* The front pocket and the flap are what separate a backpack from a
         rounded rectangle, and they are the only parts of it that show when
         the character has its back to you. */
      roundedRect({ x: p.x, y: p.y - 46, w: WIDER, h: 50, r: 26, fill: 'accentDeep' }),
      roundedRect({ x: p.x, y: p.y + 30, w: 96, h: 48, r: 12, fill: 'accentLight' }),
      roundedRect({ x: p.x, y: p.y - 24, w: 30, h: 11, r: 4, fill: 'accentLight', outline: 'none' }),
    ]) },
  /* Two straps over the front. Curved, and stopping short of the middle: a
     pair of straight bars across an egg reads as a harness. */
  { frame: infront(0.82),
    gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.20 } },
    art: p => group([-1, 1].map(side => line({
      pts: [[p.x + side * 52, p.y - 16], [p.x + side * 46, p.y + 6], [p.x + side * 40, p.y + 18]],
      width: 11, stroke: 'accentDeep',
    }))) },
], { defaults: { accent: '#E0574B' } });

/* ------------------------------------------------------------ library bag */

/* A tote: soft, wider than it is tall, and carried on ONE shoulder — which is
   the difference between a bag and a pack once you cannot see a torso. */
backwear('library-bag', [
  { frame: behind(0.36, 1.0),
    material: { accentDeep: { from: 'accent', darken: 0.22 } },
    art: p => group([
      path({ x: p.x, y: p.y, fill: 'accent', cmds: [
        ['M', -104, -34], ['L', 104, -34], ['Q', 114, 34, 76, 62],
        ['L', -76, 62], ['Q', -114, 34, -104, -34], ['Z']] }),
      roundedRect({ x: p.x, y: p.y - 30, w: 208, h: 18, r: 7, fill: 'accentDeep', outline: 'none' }),
      /* A book corner poking out of the top — a library bag with nothing in it
         is a shopping bag. */
      roundedRect({ x: p.x + 44, y: p.y - 52, w: 38, h: 34, r: 3, fill: 'white' }),
    ]) },
  { frame: infront(0.82),
    gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.22 } },
    art: p => line({
      pts: [[p.x + 54, p.y - 16], [p.x + 47, p.y + 6], [p.x + 38, p.y + 20]],
      width: 12, stroke: 'accentDeep',
    }) },
], { defaults: { accent: '#5FA85C' } });

/* -------------------------------------------------------------------- cape */

/* Wider at the bottom than at the top, with a wavy hem. A rectangle is a
   towel; the flare and the hem are the entire read. */
backwear('cape', [
  { frame: behind(0.20, 1.0),
    material: { accentDeep: { from: 'accent', darken: 0.18 } },
    art: p => path({ x: p.x, y: p.y, fill: 'accent', cmds: [
      ['M', -54, -46], ['L', 54, -46],
      ['C', 76, 10, 88, 52, 92, 92],
      ['Q', 62, 76, 44, 96], ['Q', 16, 78, 0, 98], ['Q', -16, 78, -44, 96],
      ['Q', -62, 76, -92, 92],
      ['C', -88, 52, -76, 10, -54, -46], ['Z']] }) },
  /* The clasp: a cord across the throat with a disc on it. On a character
     with no shoulders this is the only thing that says the cape is fastened
     rather than balanced there. */
  { frame: infront(0.74),
    gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.18 } },
    art: p => group([
      line({ pts: [[p.x - 34, p.y - 4], [p.x + 34, p.y - 4]], width: 7, stroke: 'accentDeep' }),
      circle({ x: p.x, y: p.y - 4, r: 10, fill: 'gem' }),
    ]) },
], { defaults: { accent: '#4A73C4', gem: '#F2C744' }, z: 6 });

/* ----------------------------------------------------------- rolled poster */

/* Carried diagonally so it breaks the silhouette on both sides — straight up
   it is a chimney, straight across it is a bar. */
backwear('rolled-poster', [
  { frame: behind(0.24, 1.0),
    material: { accentDeep: { from: 'accent', darken: 0.24 } },
    art: p => group([
      roundedRect({ x: p.x, y: p.y, w: 36, h: 250, r: 17, fill: 'accent' }),
      ellipse({ x: p.x, y: p.y - 118, rx: 19, ry: 10, fill: 'accentDeep', outline: 'none' }),
    ], { x: 0, y: -18, rotate: 0.52 }) },
  { frame: infront(0.82),
    gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.24 } },
    art: p => line({
      pts: [[p.x - 52, p.y - 16], [p.x - 46, p.y + 6], [p.x - 38, p.y + 20]],
      width: 8, stroke: 'accentDeep',
    }) },
], { defaults: { accent: '#F0C08F' } });
