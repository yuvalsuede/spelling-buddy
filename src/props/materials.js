/**
 * Material roles.
 *
 * A prop never names a colour. It names a ROLE, and the role is resolved
 * against the character's theme and whatever the caller passed in. Three
 * reasons, each of which is a bug that already happened once at six items and
 * would happen seventy-five times at seventy-five:
 *
 *  - **Green is a message.** `#2CB02B` means "you got that right". A green hat
 *    spends the only colour in the product that carries meaning, and after
 *    that a correct answer is just another green thing on the screen. The
 *    resolver refuses to hand back the feedback colours, whatever a caller
 *    asks for.
 *  - **Contrast is not the item author's job.** The head is usually the
 *    darkest thing on screen and every skin is a different lightness. An item
 *    that hard-codes a pastel disappears on three of the six kawaii skins.
 *  - **Recolours are free, and only if nothing hard-codes.** Half of the
 *    catalogue's variety is one prop in six palettes. That is only true while
 *    every fill goes through here.
 */

import { darken, lighten, mix } from '../core/paint.js';

/** Every role a prop may name. Anything else is a registry error. */
export const ROLES = [
  'accent',       // the item's own colour — what a recolour changes
  'accentDeep',   // its shadow side: bands, brims, the underside of a petal
  'accentLight',  // its lit side: highlights, rims
  'neutral',      // straps, stems, string — not the item's identity colour
  'neutralDeep',
  'ink',          // the character's feature colour: rims, outlines-as-drawing
  'lens',         // glass — carries its own alpha
  'gem',          // the one contrasting spot: a gem, a berry, a button
  'white',
];

/** The default accent when a theme has none: warm, and legible on every skin. */
const FALLBACK = '#FFC94A';

/**
 * Build the resolver for one item on one character.
 *
 * `o` is the caller's options object, so `{ accent: '#F26D8B' }` recolours an
 * item without the item knowing anything about it. Legacy per-prop option
 * names (`band`, `brim`, `knot`, `centre`, `pad`) are mapped onto roles by the
 * prop definition's `overrides`, so the six accessories that shipped with
 * hand-named options keep their public API.
 */
export function palette(T = {}, o = {}, overrides = {}, defaults = {}) {
  const askedFor = role => {
    const key = overrides[role];
    return (key && o[key]) || o[role] || null;
  };

  /* An item may carry its own default — a flower is pink whatever the
     character's accent is, because a flower that changes colour with the skin
     stops being a flower and becomes a blob. `defaults` sits between the
     caller (who always wins) and the theme (which is only a fallback). */
  const accent = askedFor('accent') || o.color || defaults.accent || T.accent || FALLBACK;
  const base = {
    accent,
    accentDeep:  darken(accent, 0.18),
    accentLight: lighten(accent, 0.22),
    neutral:     T.feature ? mix(T.feature, '#FFFFFF', 0.45) : '#8A8794',
    neutralDeep: T.feature || '#4A4750',
    ink:         T.feature || '#3A3742',
    lens:        '#FFFFFF',
    gem:         '#E2664F',
    white:       '#FFFFFF',
  };

  /* The feedback colours are reserved. A caller can ask; they do not get it. */
  const reserved = [T.correct, T.wrong].filter(Boolean).map(c => c.toLowerCase());

  return function colourFor(role) {
    /* A tone: "this role, but a shade darker than that one". The exact amount
       matters — a brim is a tenth darker than the cap and a band is a fifth,
       and those two numbers are the difference between a hat and a hat with a
       stripe painted on it. */
    if (role && typeof role === 'object') {
      const from = colourFor(role.from || 'accent');
      if (role.darken)  return darken(from, role.darken);
      if (role.lighten) return lighten(from, role.lighten);
      return from;
    }
    if (!ROLES.includes(role)) throw new Error(`unknown material role: ${role}`);
    const want = askedFor(role) || defaults[role] || base[role];
    if (typeof want === 'string' && reserved.includes(want.toLowerCase())) {
      /* Nudged rather than thrown, because a recolour arriving from data
         should not crash a page — but it must not come out green either. */
      return mix(want, FALLBACK, 0.62);
    }
    return want;
  };
}

/** Whether a colour is one of the two the feedback system owns. */
export function isReserved(hex, T = {}) {
  const c = String(hex).toLowerCase();
  return [T.correct, T.wrong].filter(Boolean).some(r => r.toLowerCase() === c);
}
