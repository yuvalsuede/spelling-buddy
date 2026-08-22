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
/** Relative luminance, 0 black → 1 white. */
function lum(hex) {
  const v = hex.replace('#', '');
  const c = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * How hard the form light hits, derived from the body rather than fixed.
 *
 * A 13% white highlight is nothing on a coral body and enormous on a near-black
 * one — 13% of white over 2% grey is a sixfold jump, and it comes out as gloss.
 * Gloss on a dark sphere is a bowling ball, which is the one thing this
 * character must never be. So the highlight scales with the body's own
 * luminance and the terminator scales against it: pale skins get their form
 * from the shadow side, dark skins get almost no highlight at all.
 */
function formFor(body) {
  const L = lum(body);
  return { formLit: 0.30 + 0.85 * Math.min(1, L / 0.25), formDark: 1.05 - 0.45 * L };
}

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

/**
 * What every kawaii skin shares: the line, the soft light, and cheeks that
 * are allowed to be actual cheeks.
 */
const kawaiiBase = {
  shade:    null,
  hairline: 3,
  gloss:    '#FFFDF8',
  glossScale: 1.06,
  outlineW: 3.25,
  outlineFaceW: 2.9,
  spark:    TOKENS.blue,
  /* Softer, wider, and much shallower than the flat set's: a pastel body has
     no near-black to hide a hard terminator in. */
  formBase: 0.08, formBaseDark: 0.10, formSpread: 1.95, formMid: 0.58,
  formCX: -0.38, formCY: -0.42,
  formLit: 1, formDark: 1,
  recessBase: 0.04, recessTurn: 0.08,
  blushA: 0.46,
};

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
  /** Inverted: a pale character with ink features.

      Deepened from `#EEF1F7`. The character is a light face inside a darker
      head, and at that value the two closed up: what rendered was a blank egg
      with a pair of eyes floating on it. The face had not gone anywhere —
      there was simply nothing to say where it ended. */
  snow:   skin('snow',   '#D9E0EC', { face: '#FFFFFF', feature: TOKENS.ink,
                                      hand: '#C6D0E0', spark: TOKENS.blue,
                                      blush: 'rgba(240,150,165,0.60)' }),

  /* ------------------------------------------------------------- kawaii set

     A different reading of the same character: the darkest value in the
     drawing is the CONTOUR, not a field of near-black. Every one of them
     carries an outline, because a drawn line is what the whole cute-sticker
     idiom is built on — without it a pastel body on white canvas is a stain,
     not a character.

     Three weights of line, deliberately: the body's, the face patch's at
     ninety per cent of it, and nothing at all inside. The face's own edge at
     the body's weight turns the patch into a ring, which is the finger-hole
     the patch exists to avoid.

     The form light is softer and wider than the flat set's, and the recess is
     nearly off: this palette has no near-black to hide a hard terminator in. */
  oat: {
    ...base, ...kawaiiBase,
    name:     'oat',
    body:     '#DCC4AE',
    face:     '#FFF9F2',
    outline:  '#4B3C38',
    feature:  '#51413E',
    blush:    '#E8A7AF',
    accent:   '#78BCE6',
    bodyDeep: '#4B3C38',
    hand:     '#D3B8A0',
    shadow:   rgba('#4B3C38', 0.13),
    ghost:    rgba('#4B3C38', 0.16),
    confetti: [TOKENS.green, TOKENS.blue, '#DCC4AE', '#78BCE6'],
  },
  strawberry: {
    ...base, ...kawaiiBase,
    name:     'strawberry',
    body:     '#F0B8C5',
    face:     '#FFF8F6',
    outline:  '#563844',
    feature:  '#5F414A',
    blush:    '#E48FA3',
    accent:   '#F6C451',
    bodyDeep: '#563844',
    hand:     '#E7A9B8',
    shadow:   rgba('#563844', 0.13),
    ghost:    rgba('#563844', 0.16),
    confetti: [TOKENS.green, TOKENS.blue, '#F0B8C5', '#F6C451'],
  },
  sky: {
    ...base, ...kawaiiBase,
    name:     'sky',
    body:     '#A9D5EB',
    face:     '#FAFDFF',
    outline:  '#334A59',
    feature:  '#3C515E',
    blush:    '#E8A8B5',
    accent:   '#F2BD64',
    bodyDeep: '#334A59',
    hand:     '#9BCBE4',
    shadow:   rgba('#334A59', 0.13),
    ghost:    rgba('#334A59', 0.16),
    confetti: [TOKENS.green, TOKENS.blue, '#A9D5EB', '#F2BD64'],
  },
  lavender: {
    ...base, ...kawaiiBase,
    name:     'lavender',
    body:     '#C5B9E8',
    face:     '#FCFAFF',
    outline:  '#433B59',
    feature:  '#4B435F',
    blush:    '#E1A1BB',
    accent:   '#F3C65C',
    bodyDeep: '#433B59',
    hand:     '#B9ACE0',
    shadow:   rgba('#433B59', 0.13),
    ghost:    rgba('#433B59', 0.16),
    confetti: [TOKENS.green, TOKENS.blue, '#C5B9E8', '#F3C65C'],
  },
  apricot: {
    ...base, ...kawaiiBase,
    name:     'apricot',
    body:     '#F0C08F',
    face:     '#FFF9F0',
    outline:  '#594033',
    feature:  '#61493D',
    blush:    '#E99AA5',
    accent:   '#78BFE3',
    bodyDeep: '#594033',
    hand:     '#E6B37F',
    shadow:   rgba('#594033', 0.13),
    ghost:    rgba('#594033', 0.16),
    confetti: [TOKENS.green, TOKENS.blue, '#F0C08F', '#78BFE3'],
  },
  inkling: {
    ...base, ...kawaiiBase,
    name:     'inkling',
    body:     '#34323B',
    face:     '#FFF8F2',
    outline:  '#16161A',
    feature:  '#2B2730',
    blush:    '#DFA1AC',
    accent:   '#F1C65B',
    bodyDeep: '#5C5C6E',
    hand:     '#2A2A31',
    shadow:   rgba('#16161A', 0.13),
    ghost:    rgba('#16161A', 0.16),
    confetti: [TOKENS.green, TOKENS.blue, '#34323B', '#F1C65B'],
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
/* Derived here rather than in `skin()` so the hand-written themes and any
   custom one get it too — ink is the darkest body in the set and the one that
   most needs the highlight held back. */
const withForm = t => ('formLit' in t ? t : { ...t, ...formFor(t.body) });

export function resolveTheme(theme) {
  if (!theme) return withForm({ ...THEMES[DEFAULT_THEME] });
  if (typeof theme === 'string') {
    const t = THEMES[theme];
    if (!t) throw new Error(`Unknown theme "${theme}". Available: ${Object.keys(THEMES).join(', ')}`);
    return withForm({ ...t });
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
  /* A new body with no explicit form strength re-derives it, for the same
     reason the gradient does: the inherited numbers were tuned for a colour
     that is no longer there. */
  if (theme.body && !('formLit' in theme)) { delete merged.formLit; delete merged.formDark; }
  return withForm(merged);
}
