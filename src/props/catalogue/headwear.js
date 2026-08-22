/**
 * Headwear — the things that go round or over the whole skull.
 *
 * These are the hard ones, and they are the reason the frames in `frames.js`
 * exist at all. Each of the three below was, at some point, a drawing that
 * looked fine face-on and fell apart the moment the head turned:
 *
 *  - a crown parked in head space that sat dead still while the face swung
 *    away underneath it, then vanished entirely at three-quarter view
 *  - a headphone band borrowed from the silhouette, pixel-identical at every
 *    angle, which stopped being worn and became a decal on the lens
 *  - a cap peak drawn as a whole disc, half of it buried in the skull — until
 *    the head turned and the buried half swung up over the crown as a great
 *    plate with nothing holding it on
 *
 * All three fixes now live in the frames, where the next fifty items get them
 * for free.
 */

import { defineProp } from '../registry.js';
import {
  headRing, headSpikes, headAnchor, headHoop, headDome, headBand, earPair,
  headPoint, splitDepth, span,
} from '../frames.js';
import { group, circle, ellipse } from '../shapes.js';

/* ------------------------------------------------------------------- crown */

const CU = -0.70;

defineProp({
  id: 'crown',
  kind: 'wearable',
  slot: 'head.top',
  occupies: ['skull.top', 'skull.band'],
  passes: ['headRear', 'headFront'],
  z: 25,
  overrides: { gem: 'gem' },
  checks: { visibility: 'circumferential', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [
    /* The band, quad by quad, each sorted on its own depth. Neighbouring quads
       share exact edges, so the band has no seams and needs no winding rule. */
    { frame: headRing({ u: CU, thickness: 0.09, radius: 1.02, segments: 24 }) },
    { frame: headSpikes({ u: CU, thickness: 0.09, radius: 1.02, segments: 24,
                          every: 3, height: 42, grow: 0.38 }) },
    /* One gem, at the front of the band. A gem on every point reads as measles
       at small sizes. */
    { frame: headAnchor({ at: [0, CU - 0.045, Math.sqrt(1 - CU * CU)], radius: 1.02,
                          hideBehind: 0.25, place: 'size' }),
      art: p => circle({ x: p.x, y: p.y, r: 5.2, fill: 'gem', outline: 'none' }) },
  ],
});

/* -------------------------------------------------------------- headphones */

defineProp({
  id: 'headphones',
  kind: 'wearable',
  slot: 'ears',
  occupies: ['skull.band', 'ear.left', 'ear.right'],
  passes: ['headRear', 'headFront'],
  z: 30,
  overrides: { accentDeep: 'pad' },
  checks: { visibility: 'paired', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [
    { frame: headHoop({ end: 0.38, lean: 0.30, drop: -0.05, radius: 1.03,
                        width: 9, widthAcross: 13, segments: 48 }) },
    /* The cups sit ON the head at ear height, and their WIDTH follows how much
       of the cup faces the viewer — the one thing that actually changes. Their
       height does not: a cup that shrinks in both axes reads as a button. */
    { frame: earPair({ u: -0.10, radius: 1.0, place: 'size' }),
      material: { accentDeep: { from: 'accent', darken: 0.20 } },
      art: p => {
        const rx = 8 + 15 * p.facing;
        return group([
          ellipse({ x: p.x, y: p.y, rx, ry: 25, fill: 'accent' }),
          ellipse({ x: p.x, y: p.y, rx: rx * 0.58, ry: 15, fill: 'accentDeep', outline: 'none' }),
        ]);
      } },
  ],
});

/* --------------------------------------------------------------------- cap */

const RU = -0.40;                       // where the rim sits on the head

/**
 * The peak: a HALF disc, hinged on the rim and tilting downward as it runs
 * forward — never a whole one, for the reason in this file's header.
 *
 * The hinge runs straight back across the chord rather than following the
 * head's curve. Following the curve looks more careful and is worse: it makes
 * the peak non-planar, the horizon stops cutting it along a straight line, and
 * the near half — closed off with a chord — swells into a shelf standing
 * across the head at three-quarter-from-behind. The hinge is under the dome at
 * every angle, so nothing is lost by keeping the peak flat.
 */
const capPeak = () => ({
  kind: 'peak',
  resolve(S) {
    const rr = Math.sqrt(1 - RU * RU);
    const B = 0.82, Z0 = 0.32, A = Math.sqrt(rr * rr - Z0 * Z0), TILT = 0.40;
    const yAt = Z => RU + 0.04 + TILT * Math.max(0, Z - Z0);
    const peak = [
      ...span(40, 0, Math.PI, t => {
        const Z = Z0 + B * Math.sin(t);
        return headPoint(A * Math.cos(t), yAt(Z), Z, S, 1);
      }),
      ...span(12, 1, -1, u => headPoint(A * u, yAt(Z0), Z0, S, 1)),
    ];
    const half = splitDepth(peak);
    return [
      ...half.far .map(pts => ({ side: 'far',  kind: 'poly', pts })),
      ...half.near.map(pts => ({ side: 'near', kind: 'poly', pts })),
    ];
  },
});

defineProp({
  id: 'cap',
  kind: 'wearable',
  slot: 'head.top',
  occupies: ['skull.top', 'skull.band'],
  passes: ['headRear', 'headFront'],
  z: 20,
  overrides: { accentDeep: 'band', accentLight: 'brim' },
  checks: { visibility: 'circumferential', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [
    /* The dome is everything above the rim, clipped to what the body actually
       fills. Borrowed from the outline rather than drawn as an ellipse: the
       head is an egg, and a cap clipped to a circle overhangs it by a few
       pixels either side — small, and it reads instantly as a mistake. */
    { frame: headDome({ u: RU, radius: 1.006 }) },
    /* The band is the near half of the rim only. The far half is inside the
       head, and a line across the back of a solid object shows through
       nothing. */
    { frame: headBand({ u: RU, width: 11, radius: 1.006, segments: 64 }),
      clip: 1.006, fill: 'accentDeep', gloss: false,
      material: { accentDeep: { from: 'accent', darken: 0.18 } } },
    /* Button at the crown — a point on the head, so it rides with it. */
    { frame: headAnchor({ at: [0, -1, 0], radius: 0.90, hideBehind: -0.5,
                          sortDepth: false, place: 'size' }),
      material: { accentDeep: { from: 'accent', darken: 0.18 } },
      art: p => ellipse({ x: p.x, y: p.y, rx: 7.5, ry: 6.5, fill: 'accentDeep', outline: 'none' }) },
    /* Behind the head, the far part of the peak is drawn before the skull so
       the skull cuts it — turned away, that is what you see of a cap. */
    { frame: capPeak(), fillFar: 'accentLight', gloss: 'near',
      material: { accentLight: { from: 'accent', darken: 0.10 } } },
  ],
});
