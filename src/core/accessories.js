/**
 * Accessories — the renderer's view of the prop catalogue.
 *
 * This file used to hold six hand-written `draw()` functions of twenty to
 * sixty lines each. They are gone; every one of them is now a declaration in
 * `src/props/catalogue/`, compiled by the prop framework. What is left here is
 * the adapter: the names the renderer, the demo and every page built against
 * this rig already import, resolved out of the registry.
 *
 * Why the split: six hand-written drawings do not become seventy-five. Each of
 * the six had to learn projection, foreshortening, depth splitting, the head's
 * real outline, the form light and the outline pass for itself, and each got at
 * least one of those wrong the first time. The framework knows them once. See
 * `src/props/frames.js` for the rules that survived that, each written down
 * with the bug that produced it:
 *
 *  - **Worn things use a true rotation, not the face's wrap cheat.** The cheat
 *    pulls features inward so eyes never overhang the body edge; applied to
 *    hardware it drags an earcup into the middle of the face at profile.
 *  - **Depth sorts, it does not fade.** Fading a prop across the terminator
 *    makes it dissolve mid-turn; solid objects pass behind instead.
 *  - **Foreshorten the axis that actually foreshortens.** Scaling both axes
 *    shrinks a bow to a speck at three-quarter view.
 *
 * The port was checked drawing by drawing: every one of the six renders byte
 * for byte what the hand-written version rendered, at nine angles, two pitches
 * and two skins. A port that merely looks right is a redesign nobody asked for.
 */

import { clamp } from './math.js';
import { PROPS, PASSES as PROP_PASSES } from '../props/index.js';

export { headPoint, upVector, splitDepth, ringPoints } from '../props/frames.js';

/**
 * The passes, in the order they are drawn.
 *
 * There used to be two — `back` and `front` — which is enough for things that
 * live on the skull and nothing else. A collar is in front of the body and
 * behind the face; a held thing is in front of the hand that holds it and
 * behind the one that does not; goggles sit over the eyes but under the
 * fringe. None of those is expressible as "before the head or after it".
 */
export const PASSES = PROP_PASSES;

/** Which `where` string a pass presents to a draw function. */
const WHERE_OF = {
  rearExternal: 'back', headRear: 'back', heldRear: 'back',
  bodyFront: 'front', headFront: 'front', faceFront: 'front', heldFront: 'front',
};

/* `drawAccessories` is public, and it took `'back'` or `'front'` before there
   were passes. Both still work and mean "every rear pass" / "every front
   pass", so a caller outside this repo does not break on a refactor that was
   about making room for collars and held things. */
const LEGACY = {
  back:  ['rearExternal', 'headRear', 'heldRear'],
  front: ['bodyFront', 'headFront', 'faceFront', 'heldFront'],
};

/**
 * Every accessory, by name, as `{ draw }`.
 *
 * Compiled from the registry rather than written out, but the shape of the
 * object is exactly what it was, so a page that reaches into `ACCESSORIES.cap`
 * still finds a drawable.
 */
export const ACCESSORIES = Object.fromEntries(
  [...PROPS].map(([id, p]) => [id, { draw: p.draw }]));

/**
 * Every accessory's slot, footprint, passes and depth order.
 *
 * Kept beside the declarations rather than inside the drawings because it is
 * what the catalogue, the conflict rules and the export need to read WITHOUT
 * running a draw function. `z` orders within a pass — a crown sits over a cap
 * because the registry says so, not because of the order somebody listed them
 * in.
 */
export const ACCESSORY_META = Object.fromEntries(
  [...PROPS].map(([id, p]) => [id, { slot: p.slot, occupies: p.occupies,
                                     passes: p.passes, z: p.z }]));

export const ACCESSORY_NAMES = Object.keys(ACCESSORIES);

/** What a name conflicts with, from the footprints alone. */
export function conflictsWith(name) {
  const mine = ACCESSORY_META[name];
  if (!mine) return [];
  return ACCESSORY_NAMES.filter(other => other !== name &&
    ACCESSORY_META[other]?.occupies.some(t => mine.occupies.includes(t)));
}

/**
 * A surface that STROKES whatever it is asked to fill.
 *
 * On a themed skin with a contour, an accessory without one reads as pasted on
 * — the body has a drawn edge and the hat does not. Running the item's own
 * drawing twice gives every item an outline at once, and cannot fall out of
 * step with the shapes because it IS the shapes: the contour pass lays every
 * edge down first and the real pass covers the internal ones, exactly as the
 * body does.
 *
 * `s.contour` is how a drawing knows which pass it is in. Compiled props do
 * not read it directly — each SHAPE declares `outline: 'outer' | 'none'` and
 * the compiler skips the internal ones — which is the difference between a gem
 * with an outline round it and a gem.
 */
function contourPass(s, colour, w) {
  return new Proxy(s, {
    get(t, k) {
      if (k === 'contour') return true;
      if (k === 'fill') return () => t.stroke(colour, w, 'round', 'round');
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

export function drawAccessories(s, S, T, pass) {
  const list = S.accessories;
  if (!list || !list.length) return;
  const w = T.outline ? (T.outlineWornW ?? T.outlineW * 0.62) * 2 : 0;

  /* Depth order comes from the registry, never from the order the caller
     listed things in. `wear(['cap','crown'])` and `wear(['crown','cap'])` are
     the same character wearing the same two things, and they have to draw the
     same — otherwise the z-order of a page depends on how somebody typed an
     array. */
  const wanted = LEGACY[pass] ?? [pass];
  const items = list
    .map(item => {
      const name = typeof item === 'string' ? item : item.name;
      return { name, a: ACCESSORIES[name], m: ACCESSORY_META[name],
               o: typeof item === 'string' ? {} : item };
    })
    .filter(x => x.a && (!x.m || x.m.passes.some(p => wanted.includes(p))))
    .sort((p, q) => (p.m?.z ?? 0) - (q.m?.z ?? 0)
                 || ACCESSORY_NAMES.indexOf(p.name) - ACCESSORY_NAMES.indexOf(q.name));

  const where = WHERE_OF[pass] ?? pass;
  for (const { a, o } of items) {
    if (w > 0) {
      s.save();
      a.draw(contourPass(s, T.outline, w), S, T, o, where);
      s.restore();
    }
    s.save();
    a.draw(s, S, T, o, where);
    s.restore();
  }
}

export { clamp };
