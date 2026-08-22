/**
 * The cast — one creature, many looks.
 *
 * The decision this file encodes: the silhouette stays. These are not twelve
 * species, they are twelve of the same creature, and what varies is build,
 * fringe, ears and palette. A cast built by changing the body plan is a
 * bestiary, and a bestiary needs seventy-five props drawn twelve times.
 *
 * Three rules keep them from being one drawing in twelve colours, and all
 * three are checked in `scripts/visual.mjs` rather than left as intentions:
 *
 *  - **Every pair differs on at least two non-colour axes.** One difference is
 *    a variant; two is a character.
 *  - **They survive a monochrome sheet.** Silhouette and fringe only, no fill,
 *    no palette. If two are indistinguishable there, they are the same
 *    character wearing different paint.
 *  - **Accessories are never identity.** Every one has to read bare. A
 *    character who is only recognisable in their hat is not a character, they
 *    are a hat.
 *
 * A character is data, not a subclass:
 *
 *   new Buddy({ character: 'momo' })
 *   mount('#el', { character: 'lumi', size: 240 })
 *
 * and any part of it can still be overridden — `{ character: 'nox', theme:
 * 'coral' }` is Nox in someone else's colours, which is what a "skin" for one
 * of them would be.
 */

import { BUILD_NAMES, FRINGE_NAMES, EAR_NAMES } from './geometry.js';

/**
 * Twelve.
 *
 * Enough to feel like a cast, few enough that every one can be looked at —
 * which is the actual constraint, because a cast nobody has looked at all of
 * is a cast with a broken member in it.
 */
export const CAST = {
  pip:   { build: 'classic', fringe: 'center-tuft', ears: 'round', theme: 'oat' },
  momo:  { build: 'cuddle',  fringe: 'soft-5',      ears: 'flop',  theme: 'strawberry' },
  lumi:  { build: 'sprout',  fringe: 'side-left',   ears: 'nub',   theme: 'sky' },
  vivi:  { build: 'cuddle',  fringe: 'curtain',     ears: 'point', theme: 'lavender' },
  tavi:  { build: 'classic', fringe: 'soft-3',      ears: 'none',  theme: 'apricot' },
  nox:   { build: 'sprout',  fringe: 'smooth',      ears: 'point', theme: 'inkling' },
  coco:  { build: 'cuddle',  fringe: 'center-tuft', ears: 'none',  theme: 'coral' },
  nori:  { build: 'classic', fringe: 'side-right',  ears: 'nub',   theme: 'teal' },
  bram:  { build: 'sprout',  fringe: 'curtain',     ears: 'round', theme: 'plum' },
  sunny: { build: 'cuddle',  fringe: 'soft-3',      ears: 'nub',   theme: 'amber' },
  mika:  { build: 'classic', fringe: 'side-left',   ears: 'flop',  theme: 'snow' },
  zuzu:  { build: 'sprout',  fringe: 'soft-3',      ears: 'flop',  theme: 'indigo' },
};

/* Three of these moved from the table in `docs/PLAN-assets.md`, because the
   check below found that the table broke its own rule: pip and coco differed
   only in build, momo and sunny only in ears, nox and zuzu only in fringe.
   Three pairs of variants sold as six characters — which is precisely the
   failure the two-axis rule exists to catch, and it survived being written
   down as a rule and then read several times. */

export const CAST_NAMES = Object.keys(CAST);

/** The three axes that are not palette. Two characters must differ on ≥2. */
export const AXES = ['build', 'fringe', 'ears'];

/**
 * Resolve a character name to its four parts.
 *
 * Throws on an unknown name rather than falling back to a default: a page that
 * asks for `momo` and silently gets the house character is a page that ships
 * the wrong art and never finds out.
 */
export function resolveCharacter(name) {
  if (name == null) return null;
  if (typeof name === 'object') return validate(name, '(inline)');
  const c = CAST[String(name).toLowerCase()];
  if (!c) throw new Error(`Unknown character "${name}". Available: ${CAST_NAMES.join(', ')}`);
  return c;
}

function validate(c, who) {
  if (c.build && !BUILD_NAMES.includes(c.build))
    throw new Error(`${who}: unknown build "${c.build}". Available: ${BUILD_NAMES.join(', ')}`);
  if (c.fringe && !FRINGE_NAMES.includes(c.fringe))
    throw new Error(`${who}: unknown fringe "${c.fringe}". Available: ${FRINGE_NAMES.join(', ')}`);
  if (c.ears && !EAR_NAMES.includes(c.ears))
    throw new Error(`${who}: unknown ears "${c.ears}". Available: ${EAR_NAMES.join(', ')}`);
  return c;
}

/** How many non-colour axes two characters differ on. */
export function distance(a, b) {
  const A = resolveCharacter(a), B = resolveCharacter(b);
  return AXES.filter(k => A[k] !== B[k]).length;
}

/** Every pair that is too close to be two characters. Empty is the invariant. */
export function tooClose(min = 2) {
  const out = [];
  for (let i = 0; i < CAST_NAMES.length; i++)
    for (let j = i + 1; j < CAST_NAMES.length; j++) {
      const d = distance(CAST_NAMES[i], CAST_NAMES[j]);
      if (d < min) out.push(`${CAST_NAMES[i]}/${CAST_NAMES[j]} differ on ${d}`);
    }
  return out;
}
