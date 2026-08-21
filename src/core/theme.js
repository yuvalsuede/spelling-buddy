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
  blush:   'rgba(255,138,168,0.50)',
  ghost:   'rgba(22,22,26,0.12)',      // the un-traced letter
  correct: TOKENS.green,
  wrong:   TOKENS.blue,
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
    body:     TOKENS.ink,
    bodyDeep: '#3D3D49',
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
};

export const DEFAULT_THEME = 'ink';

/** Resolve a theme name, a partial override object, or both. */
export function resolveTheme(theme) {
  if (!theme) return { ...THEMES[DEFAULT_THEME] };
  if (typeof theme === 'string') {
    const t = THEMES[theme];
    if (!t) throw new Error(`Unknown theme "${theme}". Available: ${Object.keys(THEMES).join(', ')}`);
    return { ...t };
  }
  const baseName = theme.extends || DEFAULT_THEME;
  return { ...THEMES[baseName], ...theme };
}
