/**
 * Hats — the twelve that finish the headwear slot.
 *
 * These are the volumes, and they are the hard half of the catalogue. A clip
 * is flat art on a billboard; a hat is a solid that has to keep being a solid
 * from behind. Three things follow, and all three are in the frames rather
 * than in any hat here:
 *
 *  - **A hat is built from rings, not from a screen shape.** Every one of
 *    these is a cone, a disc, a plate or a dome sampled in the head's own
 *    frame and sorted per segment. A hat drawn as one silhouette has no back,
 *    so nothing of it shows when the character turns away — which reads as the
 *    hat being taken off mid-turn.
 *  - **A brim is a disc that is wider than the head, and its far half goes
 *    BEHIND the skull.** Not under it, not faded — behind. That single fact is
 *    what makes a sun hat read as worn rather than as a plate stuck on.
 *  - **The crown is clipped to the head's real outline only when it sits ON
 *    the head.** A chef's hat stands proud of it, so clipping it to the skull
 *    would shave the sides off.
 *
 * Every hat here is between one and four parts. None of them knows about
 * projection, depth, foreshortening, outlines or the light.
 */

import { defineProp } from '../registry.js';
import {
  headDome, headBand, headDisc, headCone, headPlate, headAnchor, headRing,
  headSpikes, headHoop,
} from '../frames.js';
import { group, circle, ellipse, line, around } from '../shapes.js';

/**
 * One hat.
 *
 * Everything on the skull shares the same slot, footprint and passes, so the
 * only interesting field is `parts` — which is the point of the framework.
 */
const hat = (id, parts, o = {}) => defineProp({
  id,
  kind: 'wearable',
  slot: 'head.top',
  occupies: o.occupies || ['skull.top', 'skull.band'],
  passes: ['headRear', 'headFront'],
  z: o.z ?? 20,
  overrides: { accentDeep: 'band', accentLight: 'brim', ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: 'circumferential', minReadableSize: 48,
            contrastAgainst: 'body', ...o.checks },
  parts,
});

/* A turn-up: the near half of a ring, stroked thick. Every soft hat has one,
   and it is what stops a dome from reading as a bald patch in another colour. */
const turnUp = (u, width = 14, material = 0.18) => ({
  frame: headBand({ u, width, radius: 1.012, segments: 64 }),
  clip: 1.012, fill: 'accentDeep', gloss: false,
  material: { accentDeep: { from: 'accent', darken: material } },
});

/* -------------------------------------------------------------- soft hats */

hat('beanie', [
  { frame: headDome({ u: -0.44, radius: 1.012 }) },
  turnUp(-0.44, 15),
], { checks: { visibility: 'skullbound' } });

hat('pompom-hat', [
  { frame: headDome({ u: -0.44, radius: 1.012 }) },
  turnUp(-0.44, 15),
  /* The bobble stands off the crown, so it is anchored ABOVE the head's
     surface — radius 1.16 rather than 1.0 — and pinned to the near pass: what
     is behind it is the hat, not the head. */
  { frame: headAnchor({ at: [0, -1, 0], radius: 1.16, hideBehind: -0.85,
                        sortDepth: false, place: 'size' }),
    art: p => group([
      around(7, 9, () => circle({ r: 8, fill: 'accentLight' }), { x: p.x, y: p.y }),
      circle({ x: p.x, y: p.y, r: 9, fill: 'accentLight' }),
    ]) },
], { checks: { visibility: 'skullbound' } });

/* --------------------------------------------------------------- pointed */

hat('party-hat', [
  { frame: headCone({ u: -0.56, radius: 0.78, height: 1.15, segments: 30 }) },
  { frame: headAnchor({ at: [0, -1.71, 0], radius: 1, hideBehind: -0.9,
                        sortDepth: false, place: 'size' }),
    art: p => circle({ x: p.x, y: p.y, r: 9, fill: 'accentLight' }) },
], { defaults: { accent: '#F26D8B' } });

hat('wizard-hat', [
  /* Leaning back is most of what separates a wizard's hat from a cone. */
  { frame: headDisc({ u: -0.44, radius: 1.42, droop: 0.11, segments: 56 }),
    fill: 'accentDeep', material: { accentDeep: { from: 'accent', darken: 0.16 } } },
  { frame: headCone({ u: -0.50, radius: 0.82, height: 2.15, leanZ: -0.42, segments: 30 }) },
  { frame: headRing({ u: -0.56, thickness: 0.10, radius: 0.90, segments: 24 }),
    fill: 'accentDeep', gloss: false,
    material: { accentDeep: { from: 'accent', darken: 0.24 } } },
], { defaults: { accent: '#6B5BB5' } });

/* ----------------------------------------------------------------- brimmed */

hat('sun-hat', [
  { frame: headDisc({ u: -0.28, radius: 1.62, droop: 0.06 }),
    fill: 'accentLight', material: { accentLight: { from: 'accent', lighten: 0.14 } } },
  { frame: headDome({ u: -0.36, radius: 1.012 }) },
  turnUp(-0.36, 12, 0.20),
], { defaults: { accent: '#F0C08F' } });

/* A sou'wester: a brim that dips hard at the front and flares at the back,
   which is the whole silhouette of a rain hat. */
hat('rain-hat', [
  { frame: headDisc({ u: -0.24, radius: 1.44, droop: 0.16 }),
    fill: 'accentDeep', material: { accentDeep: { from: 'accent', darken: 0.12 } } },
  { frame: headDome({ u: -0.38, radius: 1.012 }) },
], { defaults: { accent: '#F2C744' } });

/* Pith helmet: a shallow dome, a wide flat brim and a seam over the crown. */
hat('explorer-hat', [
  { frame: headDisc({ u: -0.30, radius: 1.50, droop: 0.055 }),
    fill: 'accentDeep', material: { accentDeep: { from: 'accent', darken: 0.10 } } },
  { frame: headDome({ u: -0.40, radius: 1.012 }) },
  turnUp(-0.40, 10, 0.26),
  { frame: headHoop({ end: 1.15, lean: 0, drop: 0, radius: 1.03, width: 4, widthAcross: 0 }),
    fill: 'accentDeep', gloss: false, outline: 'none',
    material: { accentDeep: { from: 'accent', darken: 0.26 } } },
], { defaults: { accent: '#D8CBA6' } });

/* Tricorn: three bumps in the brim's outline and it is a pirate hat before a
   single detail is drawn. `phase` puts one point at the front. */
hat('pirate-hat', [
  { frame: headDisc({ u: -0.38, radius: 1.46, droop: -0.20, lobes: 3, lobeAmp: 0.20 }) },
  { frame: headDome({ u: -0.46, radius: 1.012 }) },
  { frame: headDisc({ u: -0.42, radius: 1.28, droop: -0.19, lobes: 3, lobeAmp: 0.20 }),
    fill: 'accentLight', gloss: false,
    material: { accentLight: { from: 'accent', lighten: 0.30 } } },
], { defaults: { accent: '#34323B' } });

/* --------------------------------------------------------------- rigid */

hat('hard-hat', [
  { frame: headDisc({ u: -0.26, radius: 1.26, droop: 0.075 }),
    fill: 'accentDeep', material: { accentDeep: { from: 'accent', darken: 0.12 } } },
  { frame: headDome({ u: -0.34, radius: 1.012 }) },
  /* The ridge over the crown is the one detail that makes it a hard hat
     rather than a bowl. It takes no contour — it is a moulding line, not an
     edge of the silhouette. */
  { frame: headHoop({ end: 1.25, lean: 0, drop: 0, radius: 1.035, width: 7, widthAcross: 0 }),
    fill: 'accentLight', gloss: false, outline: 'none',
    material: { accentLight: { from: 'accent', lighten: 0.22 } } },
], { defaults: { accent: '#F2B33D' } });

/* A chef's hat stands PROUD of the head, so its crown is a cone that flares
   outward rather than a dome clipped to the skull — clipping would shave the
   sides off exactly where the shape is doing its work. */
hat('chef-hat', [
  /* A short flared band, then the puff. The first version made the band tall
     and the puff small, which read as a paper cup. A toque is almost all
     puff. */
  { frame: headCone({ u: -0.44, radius: 0.90, topRadius: 0.72, height: 0.46, segments: 30 }),
    fill: 'white' },
  { frame: headAnchor({ at: [0, -1.06, 0], radius: 1, hideBehind: -0.9,
                        sortDepth: false, place: 'size' }),
    art: p => group([
      around(6, 21, () => ellipse({ rx: 22, ry: 17, fill: 'white' }), { x: p.x, y: p.y }),
      ellipse({ x: p.x, y: p.y, rx: 28, ry: 21, fill: 'white' }),
    ]) },
]);

/* ------------------------------------------------------------- ceremonial */

hat('graduation-cap', [
  { frame: headDome({ u: -0.56, radius: 1.012 }) },
  { frame: headPlate({ u: -0.70, halfW: 1.32, halfD: 1.32, tiltZ: 0.17 }),
    fill: 'accentDeep', material: { accentDeep: { from: 'accent', darken: 0.14 } } },
  /* The tassel hangs from the near-left corner of the board and falls under
     gravity, not along the head's up axis — it is the one thing on a hat that
     does NOT rotate with the skull. */
  { frame: headAnchor({ at: [-1.30, -0.60, 1.30], radius: 1, hideBehind: -0.5,
                        place: 'size' }),
    art: p => group([
      line({ pts: [[p.x, p.y], [p.x + 2, p.y + 26]], width: 3.5, stroke: 'gem' }),
      ellipse({ x: p.x + 2, y: p.y + 33, rx: 6, ry: 9, fill: 'gem', outline: 'none' }),
    ]) },
], { defaults: { accent: '#34323B', gem: '#F2C744' } });

/* A tiara is a crown's little sister: a thinner band, three points instead of
   eight, and the middle one carrying the stone. */
hat('tiara', [
  { frame: headRing({ u: -0.66, thickness: 0.075, radius: 1.02, segments: 24 }) },
  { frame: headSpikes({ u: -0.66, thickness: 0.075, radius: 1.02, segments: 24,
                        every: 8, height: 34, grow: 0.42 }) },
  { frame: headAnchor({ at: [0, -0.73, Math.sqrt(1 - 0.66 * 0.66)], radius: 1.02,
                        hideBehind: 0.25, place: 'size' }),
    art: p => circle({ x: p.x, y: p.y, r: 7, fill: 'gem', outline: 'none' }) },
], { occupies: ['skull.band'], z: 26,
     defaults: { accent: '#F2E27A', gem: '#8FD3E8' } });
