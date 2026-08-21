/**
 * Themes.
 *
 * Nothing in the rig hard-codes a colour — every fill reads from a theme
 * object, so re-skinning is a one-line swap and brand changes never require
 * touching drawing code.
 *
 * Brand System v4.1 tokens
 *   canvas  #FFFFFF   white, the only background
 *   ink     #16161A   THE action colour
 *   green   #2CB02B   progress / feedback ONLY — never decoration
 *   blue    #1478C9   selection
 *   cream   #F6F1E7   editorial field only
 */

import { lighten, darken, mix } from './paint.js';

export const TOKENS = {
  canvas: '#FFFFFF',
  ink:    '#16161A',
  green:  '#2CB02B',
  blue:   '#1478C9',
  cream:  '#F6F1E7',
};

/**
 * A theme maps brand tokens onto the parts of the character.
 *
 *   body        the main silhouette
 *   bodyDeep    back-of-head detail (whorl, cowlick)
 *   hand        one step off `body` so hands read when they overlap it
 *   face        the negative-space hole
 *   feature     eyes, brows, mouth
 *   spark       the three marks above the head
 *   blush       cheeks (set null to disable)
 *   shadow      ground contact
 *   correct     feedback accent, success  — v4.1 says green is feedback only
 *   wrong       feedback accent, retry
 *   confetti    celebration particle palette
 */
const base = {
  /* Optional sticker treatment. `outline` draws a contour under every fill,
     `ears` puts two shapes on the silhouette, `tongue` fills an open mouth.
     All three are off unless a theme asks for them, so the flat drawing stays
     the default and nothing existing changes shape. */
  outline: null,
  outlineW: 5,
  ears: null,
  tongue: null,
  hairline: 0,     // scallops across the top of the face patch
  blush:   'rgba(255,138,168,0.50)',
  ghost:   'rgba(22,22,26,0.12)',      // the un-traced letter
  correct: TOKENS.green,
  wrong:   TOKENS.blue,
  /* What anything WORN is painted in. Warm gold reads against eleven of the
     twelve skins; on amber it is very nearly the character's own colour, and a
     cap the same colour as the head is not a cap, it is a haircut. That one is
     overridden in the skin rather than computed, because contrast is a
     judgement — and the invariant in `scripts/visual.mjs` is what keeps the
     judgement honest when a thirteenth skin arrives. */
  accent:  '#FFC94A',
};

export function shadeFor(body) {
  return {
    /* The brand colour itself is the middle stop, not merely the average of
       two approximations of it. INK is *the* action colour in v4.1, so it has
       to actually be present in the character, with the light above it and the
       shadow below. */
    body: { top: lighten(body, 0.16), mid: body, bottom: darken(body, 0.30) },
    sheen: 0.10,
    face: { top: '#FFFFFF', bottom: '#F1F1F5' },
  };
}


/**
 * A skin is a body colour and the handful of tones that follow from it.
 *
 * Written as a factory rather than a dozen literal blocks so that adding one
 * is a single line, and so that no skin can quietly drift out of the family by
 * getting a bespoke hand tone or shadow opacity.
 */
function skin(name, body, o = {}) {
  return {
    ...base,
    name,
    shade:    null,
    hairline: 3,
    gloss:    '#FFFFFF',
    body,
    bodyDeep: o.bodyDeep ?? lighten(body, 0.34),
    hand:     o.hand     ?? darken(body, 0.14),
    /* The hairline fringe. Its own slot, defaulting to the body — set it and
       the fringe becomes a separate mass instead of a silhouette detail. */
    hair:     o.hair     ?? null,
    /* The face tints with the skin. A white face under a coloured head reads
       as two unrelated things; a 6% wash of the body colour makes the whole
       character one palette while staying comfortably light behind the
       features. */
    face:     o.face     ?? mix(body, TOKENS.canvas, 0.94),
    feature:  o.feature  ?? TOKENS.ink,
    spark:    o.spark    ?? TOKENS.blue,
    accent:   o.accent   ?? base.accent,
    blush:    o.blush    ?? 'rgba(255,138,168,0.42)',
    shadow:   rgba(body, 0.15),
    ghost:    rgba(body, 0.16),
    confetti: o.confetti ?? [TOKENS.green, TOKENS.blue, body, '#FFC94A'],
  };
}

/** Hex → rgba(), so shadows tint with the body instead of being hand-written. */
function rgba(hex, a) {
  const v = hex.replace('#', '');
  const f = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
}

export const THEMES = {
  /**
   * v4.1 default. INK body on white canvas — the character is drawn in the
   * action colour, which makes it read as part of the product's voice rather
   * than as decoration. Blue is reserved for the sparks (attention/selection)
   * and green appears only on correct-answer feedback.
   */
  ink: {
    ...base,
    name:     'ink',
    /* Flat, deliberately. A smooth top-to-bottom ramp is how you paint a
       sphere, and v4.1 treats INK as a flat action colour — the gradient was
       working against both. */
    shade:    null,
    hairline: 3,
    gloss:    '#FFFFFF',
    body:     TOKENS.ink,
    /* The whorl has to read against a flat, near-black body. */
    bodyDeep: '#5C5C6E',
    hand:     '#2A2A31',
    face:     TOKENS.canvas,
    feature:  TOKENS.ink,
    spark:    TOKENS.blue,
    shadow:   'rgba(22,22,26,0.13)',
    blush:    'rgba(255,138,168,0.42)',
    ghost:    'rgba(22,22,26,0.13)',
    confetti: [TOKENS.green, TOKENS.blue, TOKENS.ink, '#FFC94A', TOKENS.cream],
  },

  /** Selection-blue body. Softer, more "assistant", still on-token. */
  blue: {
    ...base,
    name:     'blue',
    body:     TOKENS.blue,
    bodyDeep: '#0F63A8',
    hand:     '#1160A6',
    face:     TOKENS.canvas,
    feature:  TOKENS.ink,
    spark:    TOKENS.ink,
    shadow:   'rgba(20,120,201,0.16)',
    ghost:    'rgba(20,120,201,0.18)',
    confetti: [TOKENS.green, TOKENS.blue, '#FFC94A', TOKENS.ink, '#7EC4F2'],
  },

  /** Warm editorial variant — cream field, ink character. */
  cream: {
    ...base,
    name:     'cream',
    body:     TOKENS.ink,
    bodyDeep: '#33333A',
    hand:     '#2A2A31',
    face:     TOKENS.cream,
    feature:  TOKENS.ink,
    /* Not green. v4.1 reserves it for progress and correct-answer feedback,
       and sparks are decoration. */
    spark:    TOKENS.blue,
    shadow:   'rgba(22,22,26,0.12)',
    confetti: [TOKENS.green, TOKENS.blue, '#FFC94A', TOKENS.ink],
  },

  /** The original exploration colour. Kept so v1/v2 output stays reproducible. */
  indigo: skin('indigo', '#4A56D8', { spark: '#FFC94A' }),

  /* ------------------------------------------------------------------ skins
     One character, many colours. Everything below is the same silhouette,
     the same face and the same hairline — only the palette moves, which is
     what makes them read as a cast rather than as different characters.

     v4.1 position, stated plainly: `ink`, `blue` and `cream` are on-token.
     The rest are exploration colours and deliberately exclude green, which
     the brand reserves for progress and correct-answer feedback — a green
     character would spend the "you got it right" colour on decoration. */
  slate:  skin('slate',  '#3A4356'),
  plum:   skin('plum',   '#7B4B94', { spark: '#FFC94A' }),
  berry:  skin('berry',  '#B0407A', { spark: '#FFC94A' }),
  coral:  skin('coral',  '#E2664F', { face: '#FFF6F1', spark: TOKENS.blue }),
  amber:  skin('amber',  '#D9902B', { face: '#FFFBF0', feature: '#4A3312', spark: TOKENS.blue,
                                     accent: '#F6F1E7' }),
  teal:   skin('teal',   '#17808C', { face: '#F1FBFC' }),
  rose:   skin('rose',   '#E38AA6', { face: '#FFF7F9', feature: '#5A2A3A', spark: TOKENS.ink }),
  /** Inverted: a pale character with ink features. */
  snow:   skin('snow',   '#EEF1F7', { face: '#FFFFFF', feature: TOKENS.ink,
                                      hand: '#E1E6F0', spark: TOKENS.blue,
                                      blush: 'rgba(240,150,165,0.60)' }),
};

export const DEFAULT_THEME = 'ink';

/** Resolve a theme name, a partial override object, or both. */
/**
 * Shading derived from the body colour rather than hand-written.
 *
 * This is what makes `{ extends: 'ink', body: '#0B2A4A' }` still mean
 * something: the gradient is "this colour, lit", not a fixed pair of greys
 * that would survive the override and quietly ignore it.
 */
export function resolveTheme(theme) {
  if (!theme) return { ...THEMES[DEFAULT_THEME] };
  if (typeof theme === 'string') {
    const t = THEMES[theme];
    if (!t) throw new Error(`Unknown theme "${theme}". Available: ${Object.keys(THEMES).join(', ')}`);
    return { ...t };
  }
  const baseName = theme.extends || DEFAULT_THEME;
  const merged = { ...THEMES[baseName], ...theme };
  /* A new body colour with no shading of its own re-derives it. Inheriting the
     base theme's literal gradient would paint the old colour over the new one. */
  /* `'shade' in theme` rather than a truthiness check: an explicit
     `shade: null` means "flat, on purpose" and must not be helpfully
     re-derived. That distinction is the difference between a flat character
     and a bowling ball. */
  if (theme.body && !('shade' in theme) && THEMES[baseName].shade) merged.shade = shadeFor(theme.body);
  return merged;
}
