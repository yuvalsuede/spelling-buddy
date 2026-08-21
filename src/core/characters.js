/**
 * Characters.
 *
 * A theme changes colour. A character changes *proportion* — ear shape, how
 * far apart the eyes sit, how low the face is, whether there is a face patch
 * at all. Those are the things that make a bunny read as a bunny and not as
 * the same shape in a different palette.
 *
 * Each entry is a geometry override plus a theme, and both are plain data, so
 * a new character is a dozen numbers rather than new drawing code.
 *
 * The proportions that matter most, learned by getting them wrong:
 *
 *   - **Small features, low and close together.** This is the single biggest
 *     lever. Wide-set eyes read as an adult face at any size; the whole genre
 *     puts tiny eyes in the lower half of the head with a gap of roughly one
 *     eye-width between them.
 *   - **No face patch.** A light disc inside a darker ring reads as a bowling
 *     ball whatever the face inside it is doing. Light body, dark features,
 *     features drawn straight onto it.
 *   - **Blush low, large and saturated**, sitting beside the eyes rather than
 *     under them.
 */

import { shadeFor } from './theme.js';

const soft = {
  blush:   'rgba(240,150,165,0.75)',
  ghost:   'rgba(22,22,26,0.12)',
  correct: '#2CB02B',
  wrong:   '#1478C9',
  gloss:   '#FFFFFF',
  face:    null,              // features sit on the body
  hairline: 0,
  tongue:  '#E86A80',
  outline: null,
};

/* Features small, low, and close. Shared by every character so the family
   reads as one set; the ears and the palette are what tell them apart. */
const CUTE_FACE = {
  faceCY:  20,   // the face sits low on the head, but not off the bottom of it
  faceRX:  74,   // only used for the terminator fade now, not for a patch
  faceRY:  74,
  eyeDX:   25,   // roughly one eye-width of gap between them
  eyeDY:    0,
  eyeR:    12,
  eyeW:     8,
  mouthDY: 21,
};

export const CHARACTERS = {
  /** The original: a dark head with a face patch. Kept so nothing regresses. */
  pip: {
    label: 'Pip',
    geometry: {},
    theme: 'ink',
  },

  /** Long floppy ears, palest body, features tiny — the Cinnamoroll register. */
  bun: {
    label: 'Bun',
    geometry: {
      ...CUTE_FACE,
      earSX: 78, earSY: 26, earR: 25, earRY: 2.6, earTilt: 0.22,
    },
    theme: {
      ...soft,
      name: 'bun',
      body: '#FDFDFF', shade: shadeFor('#FDFDFF'),
      bodyDeep: '#C7D6E8', hand: '#F2F5FB',
      ears: '#DCE7F5',
      feature: '#3E4B63', spark: '#8FC4EE',
      shadow: 'rgba(62,75,99,0.13)',
      confetti: ['#8FC4EE', '#F0A2B4', '#FFD97A', '#2CB02B'],
    },
  },

  /** Small round ears set high, warm grey — the panda register. */
  bear: {
    label: 'Bear',
    geometry: {
      ...CUTE_FACE,
      earSX: 66, earSY: -72, earR: 28, earRY: 1, earTilt: 0,
    },
    theme: {
      ...soft,
      name: 'bear',
      body: '#F7F5F2', shade: shadeFor('#F7F5F2'),
      bodyDeep: '#C9C2BA', hand: '#E7E2DB',
      ears: '#4A4A52',
      feature: '#2E2E36', spark: '#F0A2B4',
      shadow: 'rgba(46,46,54,0.13)',
      confetti: ['#2E2E36', '#F0A2B4', '#FFD97A', '#2CB02B'],
    },
  },

  /** Pointed ears, mint body — the blob-creature register. */
  sprout: {
    label: 'Sprout',
    geometry: {
      ...CUTE_FACE,
      earSX: 60, earSY: -78, earR: 21, earRY: 1.55, earTilt: 0.5,
    },
    theme: {
      ...soft,
      name: 'sprout',
      body: '#9FD6A0', shade: shadeFor('#9FD6A0'),
      bodyDeep: '#6FAE72', hand: '#8FC993',
      ears: '#8AC98D',
      feature: '#28422C', spark: '#FFD97A',
      shadow: 'rgba(40,66,44,0.13)',
      confetti: ['#9FD6A0', '#F0A2B4', '#FFD97A', '#1478C9'],
    },
  },

  /** Wide low ears, sky body. */
  pebble: {
    label: 'Pebble',
    geometry: {
      ...CUTE_FACE,
      earSX: 88, earSY: -46, earR: 25, earRY: 1.15, earTilt: -0.2,
    },
    theme: {
      ...soft,
      name: 'pebble',
      body: '#A8D8F0', shade: shadeFor('#A8D8F0'),
      bodyDeep: '#6FAAC9', hand: '#96CBE7',
      ears: '#7CB6D8',
      feature: '#1E3A4C', spark: '#FFD97A',
      shadow: 'rgba(30,58,76,0.13)',
      confetti: ['#A8D8F0', '#F0A2B4', '#FFD97A', '#2CB02B'],
    },
  },
};

export const CHARACTER_NAMES = Object.keys(CHARACTERS);

export function resolveCharacter(name) {
  if (!name) return null;
  const c = CHARACTERS[name];
  if (!c) throw new Error(`Unknown character "${name}". Available: ${CHARACTER_NAMES.join(', ')}`);
  return c;
}
