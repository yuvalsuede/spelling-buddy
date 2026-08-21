/**
 * Visemes — mouth shapes for speech.
 *
 * A sprite-based character needs one drawn mouth per viseme and snaps between
 * them. Here a viseme is a small **parameter set**, so any two blend
 * continuously: the mouth travels through the shapes instead of cutting.
 * That is the difference between "flapping" and "articulating", and it is the
 * whole reason this matters for a spelling app — the learner can watch the
 * mouth make the sound.
 *
 * The set is the classic Preston Blair grouping, which is the smallest set that
 * still reads as speech.
 *
 *   w       mouth width
 *   h       mouth opening height
 *   round   1 = circular corners, 0 = pointed lens
 *   teeth   0..1 upper teeth showing
 *   tongue  0..1 tongue visible (L, TH)
 *   lift    vertical offset (FV tucks the lower lip up)
 */

export const VISEMES = {
  rest: { w: 14, h:  3,   round: 1.0,  teeth: 0,    tongue: 0, lift: 0 },
  MBP:  { w: 22, h:  2.6, round: 1.0,  teeth: 0,    tongue: 0, lift: 0 },  // m b p — lips pressed wide
  AI:   { w: 29, h: 26,   round: 0.75, teeth: 0.34, tongue: 0, lift: 0 },  // ah  eye
  E:    { w: 31, h: 15,   round: 0.5,  teeth: 0.46, tongue: 0, lift: 0 },  // eh  ee
  O:    { w: 21, h: 23,   round: 1.0,  teeth: 0,    tongue: 0, lift: 0 },  // oh
  U:    { w: 15, h: 16,   round: 1.0,  teeth: 0,    tongue: 0, lift: 0 },  // oo
  WQ:   { w: 12, h: 13,   round: 1.0,  teeth: 0,    tongue: 0, lift: 0 },  // w  qu
  FV:   { w: 23, h:  8,   round: 0.35, teeth: 0.8,  tongue: 0, lift: 2 },  // f v
  L:    { w: 24, h: 19,   round: 0.6,  teeth: 0.2,  tongue: 1, lift: 0 },  // l  th
  etc:  { w: 23, h: 11,   round: 0.6,  teeth: 0.4,  tongue: 0, lift: 0 },  // c d g k n r s t z
};

export const VISEME_NAMES = Object.keys(VISEMES);

/** Blend two visemes. `t` 0→1. */
export function blendViseme(a, b, t) {
  const A = VISEMES[a] || VISEMES.rest;
  const B = VISEMES[b] || VISEMES.rest;
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    w:      A.w      + (B.w      - A.w)      * k,
    h:      A.h      + (B.h      - A.h)      * k,
    round:  A.round  + (B.round  - A.round)  * k,
    teeth:  A.teeth  + (B.teeth  - A.teeth)  * k,
    tongue: A.tongue + (B.tongue - A.tongue) * k,
    lift:   A.lift   + (B.lift   - A.lift)   * k,
  };
}

/**
 * Draw a mouth from blended parameters. Called at the mouth's projected origin
 * with foreshortening already applied by the caller.
 */
export function drawViseme(s, T, p) {
  const w = p.w, h = p.h, r = p.round;

  /* Tall mouths grow downward more than upward. Centred on the mouth anchor a
     wide-open shape would climb into the eyes; this keeps small mouths exactly
     where the expression mouths sit and pushes big ones clear. */
  const oy = p.lift + h * 0.22;

  // Lips closed: a stroke, not a fill. A degenerate fill reads as a smudge.
  if (h < 3.2) {
    s.begin();
    s.move(-w / 2, oy);
    s.quad(0, oy + 1.4, w / 2, oy);
    s.stroke(T.feature, 4.4);
    return;
  }

  const hw = w / 2, hh = h / 2;
  const cx = hw * r * 0.72;      // corner control — high r rounds it, low r points it
  const cy = hh * r * 0.72;

  const path = () => {
    s.begin();
    s.move(-hw, oy);
    s.cubic(-hw, oy - cy, -cx, oy - hh, 0, oy - hh);
    s.cubic(cx, oy - hh, hw, oy - cy, hw, oy);
    s.cubic(hw, oy + cy, cx, oy + hh, 0, oy + hh);
    s.cubic(-cx, oy + hh, -hw, oy + cy, -hw, oy);
    s.close();
  };

  path();
  s.fill(T.feature);

  // Interior details clip to the mouth so they can never spill onto the face.
  if (p.teeth > 0.02 || p.tongue > 0.02) {
    s.save();
    path();
    s.clip();

    if (p.teeth > 0.02) {
      s.begin();
      s.rect(-hw, oy - hh, w, hh * p.teeth);
      s.fill(T.face);
    }
    if (p.tongue > 0.02) {
      s.begin();
      s.ellipse(0, oy + hh * 0.5, hw * 0.6, hh * 0.55 * p.tongue);
      s.fill('#C8657C');
    }
    s.restore();
  }
}

/* ==========================================================================
   Letter names — exact.
   Spelling apps say letter NAMES ("bee", "see"), not letter sounds, and there
   are only 26 of them, so this is a lookup rather than a guess.
   Each entry is the viseme sequence for that letter's name.
   ========================================================================== */
export const LETTER_VISEMES = {
  A: ['AI', 'E'],            // /eɪ/
  B: ['MBP', 'E'],           // /biː/
  C: ['etc', 'E'],           // /siː/
  D: ['etc', 'E'],           // /diː/
  E: ['E'],                  // /iː/
  F: ['E', 'FV'],            // /ɛf/
  G: ['etc', 'E'],           // /dʒiː/
  H: ['AI', 'E', 'etc'],     // /eɪtʃ/
  I: ['AI', 'E'],            // /aɪ/
  J: ['etc', 'AI', 'E'],     // /dʒeɪ/
  K: ['etc', 'AI', 'E'],     // /keɪ/
  L: ['E', 'L'],             // /ɛl/
  M: ['E', 'MBP'],           // /ɛm/
  N: ['E', 'etc'],           // /ɛn/
  O: ['O', 'U'],             // /oʊ/
  P: ['MBP', 'E'],           // /piː/
  Q: ['etc', 'U'],           // /kjuː/
  R: ['AI', 'etc'],          // /ɑːr/
  S: ['E', 'etc'],           // /ɛs/
  T: ['etc', 'E'],           // /tiː/
  U: ['E', 'U'],             // /juː/
  V: ['FV', 'E'],            // /viː/
  W: ['etc', 'U', 'E', 'U'], // /ˈdʌbəljuː/ — compressed
  X: ['E', 'etc'],           // /ɛks/
  Y: ['WQ', 'AI', 'E'],      // /waɪ/
  Z: ['etc', 'E'],           // /ziː/ (US) — /zɛd/ users can override
};

/* ==========================================================================
   Words — approximate.

   Full grapheme-to-phoneme for English needs a dictionary. Lip-sync does not:
   it needs plausible mouth movement in the right rhythm, and nobody can tell
   a near-miss viseme from an exact one at 12fps. These rules get the vowels
   and the visually distinctive consonants (m/b/p, f/v, w, l) right, which is
   where the eye actually looks.

   Pass an explicit sequence to `sayVisemes()` when you need exactness.
   ========================================================================== */
const DIGRAPHS = [
  ['sch', ['etc', 'etc']],
  ['tch', ['etc']],
  ['igh', ['AI']],
  ['ough',['O']],
  ['ch', ['etc']], ['sh', ['etc']], ['th', ['L']],  ['ph', ['FV']],
  ['wh', ['WQ']], ['ck', ['etc']], ['ng', ['etc']], ['qu', ['etc', 'U']],
  ['oo', ['U']],  ['ee', ['E']],   ['ea', ['E']],   ['ai', ['AI']],
  ['ay', ['AI']], ['oa', ['O']],   ['oi', ['O']],   ['oy', ['O']],
  ['ou', ['O']],  ['ow', ['O']],   ['au', ['O']],   ['aw', ['O']],
  ['ie', ['AI']], ['ei', ['E']],   ['ue', ['U']],   ['ui', ['U']],
];

const SINGLES = {
  a: 'AI', e: 'E', i: 'AI', o: 'O', u: 'U', y: 'AI',
  b: 'MBP', m: 'MBP', p: 'MBP',
  f: 'FV', v: 'FV',
  w: 'WQ',
  l: 'L',
};

/** Turn a written word into an approximate viseme sequence. */
export function wordToVisemes(word) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  const out = [];
  let i = 0;
  while (i < w.length) {
    // silent final 'e' after a consonant ("make", "site")
    if (i === w.length - 1 && w[i] === 'e' && w.length > 2 && !'aeiou'.includes(w[i - 1])) break;

    let matched = false;
    for (const [g, vs] of DIGRAPHS) {
      if (w.startsWith(g, i)) { out.push(...vs); i += g.length; matched = true; break; }
    }
    if (matched) continue;

    // double consonant reads as one sound ("letter", "ball")
    if (w[i] === w[i + 1] && !'aeiou'.includes(w[i])) { i++; continue; }

    out.push(SINGLES[w[i]] || 'etc');
    i++;
  }
  return out.length ? out : ['rest'];
}

/** Viseme sequence for spelling a word out letter by letter. */
export function lettersToVisemes(word) {
  return String(word || '').toUpperCase().replace(/[^A-Z]/g, '')
    .split('').flatMap(ch => LETTER_VISEMES[ch] || ['etc']);
}
