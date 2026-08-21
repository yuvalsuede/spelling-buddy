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

import { lighten, darken } from './paint.js';

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
    /* Shading, not a colour change. v4.1 keeps green for feedback and INK as
       the action colour, so the character gains depth from a gradient within
       its own colour rather than by becoming a decorative hue. */
    shade:    shadeFor(TOKENS.ink),
    gloss:    '#FFFFFF',
    body:     TOKENS.ink,
    /* The whorl has to read against the *top* of the body gradient, which is
       lighter than the flat colour it used to sit on. */
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
    spark:    TOKENS.green,
    shadow:   'rgba(22,22,26,0.12)',
    confetti: [TOKENS.green, TOKENS.blue, '#FFC94A', TOKENS.ink],
  },

  /** The original exploration colour. Kept so v1/v2 output stays reproducible. */
  indigo: {
    ...base,
    name:     'indigo',
    body:     '#4A56D8',
    bodyDeep: '#3B47C0',
    hand:     '#3945BC',
    face:     '#F5F6FA',
    feature:  '#16161A',
    spark:    '#4A56D8',
    shadow:   'rgba(74,86,216,0.16)',
    ghost:    'rgba(74,86,216,0.18)',
    confetti: ['#4A56D8', '#FF8AA8', '#FFC94A', '#3ECF8E', '#8B7BF7'],
  },

  /* ---------------------------------------------------------------- soft set
     Ears, hairline and shading, and no contour anywhere. Separation comes from
     tone rather than from a line: the ears sit a step darker than the body, so
     they read as behind it the way a shadow does, not because something was
     drawn around them. A hard outline gives a sticker; tone gives an object. */
  soft: {
    ...base,
    name:     'soft',
    ears:     'darker',
    hairline: 3,
    tongue:   '#E0607A',
    body:     '#2E2E38',
    shade:    shadeFor('#2E2E38'),
    bodyDeep: '#6C6C80',
    hand:     '#20202A',
    face:     TOKENS.canvas,
    feature:  TOKENS.ink,
    spark:    TOKENS.blue,
    shadow:   'rgba(22,22,26,0.13)',
    confetti: ['#2CB02B', '#1478C9', '#16161A', '#FFC94A'],
  },

  /* Warm and outlined. Yellow is not a v4.1 token, so this one is an
     exploration rather than a brand-safe default — it exists to be looked at
     next to `sticker`, not to be shipped without a ruling. */
  sunny: {
    ...base,
    name:     'sunny',
    ears:     'darker',
    hairline: 3,
    tongue:   '#E0607A',
    body:     '#F6D65B',
    shade:    shadeFor('#F6D65B'),
    bodyDeep: '#C9A233',
    hand:     '#E9C247',
    face:     '#FFF6DC',
    feature:  '#3A2E1F',
    blush:    'rgba(235,140,150,0.55)',
    spark:    TOKENS.blue,
    shadow:   'rgba(58,46,31,0.14)',
    ghost:    'rgba(58,46,31,0.16)',
    confetti: ['#F6D65B', '#E0607A', '#1478C9', '#2CB02B'],
  },

  /* Selection blue, outlined. Blue is in v4.1 and means selection rather than
     feedback, so it never collides with correct-answer green. */
  sky: {
    ...base,
    name:     'sky',
    ears:     'darker',
    hairline: 3,
    tongue:   '#E0607A',
    body:     '#3A9BE6',
    shade:    shadeFor('#3A9BE6'),
    bodyDeep: '#1B6BA8',
    hand:     '#2C86CD',
    face:     '#F2FAFF',
    feature:  '#0A2F4E',
    spark:    TOKENS.ink,
    shadow:   'rgba(10,47,78,0.14)',
    ghost:    'rgba(10,47,78,0.16)',
    confetti: ['#3A9BE6', '#E0607A', '#16161A', '#2CB02B'],
  },
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
  if (theme.body && !theme.shade && THEMES[baseName].shade) merged.shade = shadeFor(theme.body);
  return merged;
}
