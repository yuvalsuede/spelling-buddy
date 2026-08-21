/**
 * The alphabet, as geometry.
 *
 * The letter card used to be `<text>`, which was the only part of the whole rig
 * that wasn't math. Two things went wrong because of it:
 *
 *   1. Vertical centring relied on `dominant-baseline: central`, which librsvg
 *      (and several other rasterisers) ignore — so every exported PNG/GIF had
 *      the letter jammed against the top of the card while canvas looked fine.
 *      The two backends disagreed, which is exactly what the Surface
 *      abstraction exists to prevent.
 *   2. The glyph came from whatever font the host resolved for `system-ui`.
 *      Open the exported SVG somewhere else and you get a different letterform
 *      with different metrics — so the determinism guarantee didn't hold for
 *      the one element carrying the product's actual content.
 *
 * Drawing the letters ourselves fixes both by construction. They're monoline
 * strokes with round caps, which matches how the eyes and mouth are drawn, and
 * they live in a unit cap-box centred on the origin — so "centre the letter in
 * the card" is `translate(0, 0)` and there is no metric to get wrong.
 *
 * Coordinate system (y is down, as everywhere else in the rig):
 *
 *      x -0.5 ........ 0 ........ +0.5
 *   y -0.5   ┌─────────────────────┐   cap top
 *        0   │          ·          │   cap middle
 *      +0.5  └─────────────────────┘   baseline
 */

const D = Math.PI / 180;

/* Emit an elliptical arc as cubic segments (≤90° each). Sweeps from a0 to a1
   in whichever direction the sign of (a1 - a0) implies, so glyph definitions
   read directionally and never depend on a backend's ccw convention. */
function arc(out, cx, cy, rx, ry, a0, a1, move = true) {
  const s0 = a0 * D, s1 = a1 * D;
  const delta = s1 - s0;
  const segs = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = t => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  const dt = t => [-rx * Math.sin(t), ry * Math.cos(t)];

  if (move) out.push(['M', ...at(s0)]);
  let t = s0;
  for (let i = 0; i < segs; i++) {
    const t0 = t, t1 = t + step;
    const p0 = at(t0), p1 = at(t1), d0 = dt(t0), d1 = dt(t1);
    out.push(['C', p0[0] + k * d0[0], p0[1] + k * d0[1],
                   p1[0] - k * d1[0], p1[1] - k * d1[1],
                   p1[0], p1[1]]);
    t = t1;
  }
}

/** Build one subpath from a compact spec. */
function sub(...cmds) { return cmds; }
/** Build a subpath that is a single arc. */
function arcPath(cx, cy, rx, ry, a0, a1) { const o = []; arc(o, cx, cy, rx, ry, a0, a1); return o; }

const T = -0.5, B = 0.5, M = 0;          // cap top, baseline, middle
const L = -0.30, R = 0.30;               // default side bearings

/* Lowercase needs real vertical metrics, not just the cap box.
   x-height is 0.62 of the cap. Bigger than a text face on purpose — round
   shapes read more easily at small sizes — but not so big that ascenders
   vanish: "tall letters and short letters" is itself something being taught,
   so b/d/h/k/l have to be visibly taller than a/c/e/o. */
export const METRICS = {
  cap: T, baseline: B, middle: M,
  xHeight: 0.62,
  xLine: B - 0.62,        // -0.12 — top of a lowercase o
  descender: B + 0.28,    //  0.78 — bottom of a g
  ascender: T,
};
const X  = METRICS.xLine;        // -0.12
const DS = METRICS.descender;    //  0.78
const XC = (X + B) / 2;          //  0.19  — centre of the x-height band
const XR = (B - X) / 2;          //  0.31  — half the x-height

/**
 * Each glyph is a list of subpaths; each subpath is a list of
 * ['M',x,y] | ['L',x,y] | ['Q',cx,cy,x,y] | ['C',c1x,c1y,c2x,c2y,x,y].
 */
export const GLYPHS = {
  A: [ sub(['M', -0.34, B], ['L', 0, T], ['L', 0.34, B]),
       sub(['M', -0.17, 0.13], ['L', 0.17, 0.13]) ],

  B: [ sub(['M', -0.30, T], ['L', -0.30, B]),
       arcPath(-0.30, -0.25, 0.34, 0.25, -90, 90),
       arcPath(-0.30,  0.25, 0.38, 0.25, -90, 90) ],

  C: arcPathWrap(0, 0, 0.32, 0.5, 55, 305),

  D: [ sub(['M', -0.30, T], ['L', -0.30, B]),
       arcPath(-0.30, 0, 0.62, 0.5, -90, 90) ],

  E: [ sub(['M', -0.26, T], ['L', -0.26, B]),
       sub(['M', -0.26, T], ['L', 0.26, T]),
       sub(['M', -0.26, M], ['L', 0.18, M]),
       sub(['M', -0.26, B], ['L', 0.26, B]) ],

  F: [ sub(['M', -0.26, T], ['L', -0.26, B]),
       sub(['M', -0.26, T], ['L', 0.26, T]),
       sub(['M', -0.26, M], ['L', 0.18, M]) ],

  G: [ arcPath(0, 0.02, 0.32, 0.48, 8, 300),
       sub(['M', 0.32, 0.02], ['L', 0.13, 0.02]) ],

  H: [ sub(['M', L, T], ['L', L, B]),
       sub(['M', R, T], ['L', R, B]),
       sub(['M', L, M], ['L', R, M]) ],

  I: [ sub(['M', 0, T], ['L', 0, B]) ],

  J: [ sub(['M', 0.22, T], ['L', 0.22, 0.26]),
       arcPath(0, 0.26, 0.22, 0.22, 0, 180) ],

  K: [ sub(['M', -0.26, T], ['L', -0.26, B]),
       sub(['M', 0.28, T], ['L', -0.26, 0.06]),
       sub(['M', -0.08, -0.10], ['L', 0.30, B]) ],

  L: [ sub(['M', -0.22, T], ['L', -0.22, B], ['L', 0.26, B]) ],

  M: [ sub(['M', -0.34, B], ['L', -0.34, T], ['L', 0, 0.10], ['L', 0.34, T], ['L', 0.34, B]) ],

  N: [ sub(['M', L, B], ['L', L, T], ['L', R, B], ['L', R, T]) ],

  O: arcPathWrap(0, 0, 0.32, 0.5, 0, 360),

  P: [ sub(['M', -0.30, T], ['L', -0.30, B]),
       arcPath(-0.30, -0.21, 0.38, 0.29, -90, 90) ],

  Q: [ ...arcPathWrap(0, 0, 0.32, 0.5, 0, 360),
       sub(['M', 0.10, 0.26], ['L', 0.34, 0.54]) ],

  R: [ sub(['M', -0.30, T], ['L', -0.30, B]),
       arcPath(-0.30, -0.21, 0.38, 0.29, -90, 90),
       sub(['M', -0.04, 0.08], ['L', 0.30, B]) ],

  S: [ sub(['M', 0.27, -0.34],
           ['C', 0.27, -0.52, -0.27, -0.54, -0.27, -0.22],
           ['C', -0.27, 0.02, 0.27, -0.02, 0.27, 0.24],
           ['C', 0.27, 0.54, -0.27, 0.52, -0.27, 0.34]) ],

  T: [ sub(['M', -0.32, T], ['L', 0.32, T]),
       sub(['M', 0, T], ['L', 0, B]) ],

  U: [ sub(['M', L, T], ['L', L, 0.16]),
       arcPath(0, 0.16, 0.30, 0.30, 180, 0),
       sub(['M', R, 0.16], ['L', R, T]) ],

  V: [ sub(['M', -0.32, T], ['L', 0, B], ['L', 0.32, T]) ],

  W: [ sub(['M', -0.38, T], ['L', -0.22, B], ['L', 0, -0.14],
           ['L', 0.22, B], ['L', 0.38, T]) ],

  X: [ sub(['M', -0.30, T], ['L', 0.30, B]),
       sub(['M', 0.30, T], ['L', -0.30, B]) ],

  Y: [ sub(['M', -0.30, T], ['L', 0, 0.02], ['L', 0.30, T]),
       sub(['M', 0, 0.02], ['L', 0, B]) ],

  Z: [ sub(['M', -0.28, T], ['L', 0.28, T], ['L', -0.28, B], ['L', 0.28, B]) ],

  "'": [ sub(['M', 0, T], ['L', 0, -0.24]) ],
  '-': [ sub(['M', -0.20, M], ['L', 0.20, M]) ],
  /* Dots stop short of the baseline on purpose: a round cap of half the stroke
     width sits below the last point, so ending at B would hang the ink under
     the line. */
  '.': [ sub(['M', 0, 0.40], ['L', 0, 0.43]) ],
  '?': [ [...arcPath(-0.02, -0.28, 0.22, 0.21, 170, 370),
           ['C', 0.20, -0.13, 0.02, -0.06, 0.02, 0.10]],
         sub(['M', 0.02, 0.40], ['L', 0.02, 0.43]) ],
  '!': [ sub(['M', 0, T], ['L', 0, 0.16]), sub(['M', 0, 0.40], ['L', 0, 0.43]) ],
};


/* ==========================================================================
   Lowercase. Built on the same monoline construction: a circle of x-height
   diameter, plus stems that reach the ascender or drop to the descender.
   ========================================================================== */
const LOWER = {
  a: [ arcPath(-0.02, XC, 0.25, XR, 0, 360),
       sub(['M', 0.23, X], ['L', 0.23, B]) ],

  b: [ sub(['M', -0.25, T], ['L', -0.25, B]),
       arcPath(0.00, XC, 0.25, XR, 0, 360) ],

  c: arcPathWrap(0, XC, 0.25, XR, 55, 305),

  d: [ arcPath(-0.02, XC, 0.25, XR, 0, 360),
       sub(['M', 0.23, T], ['L', 0.23, B]) ],

  e: [ [...arcPath(0, XC, 0.26, XR, 8, -292)],
       sub(['M', -0.26, XC], ['L', 0.26, XC]) ],

  /* The stem is on the LEFT and the hook turns RIGHT. Mirroring it — which is
     easy to do and hard to see at small sizes — produces a shape that reads as
     a reversed 7 rather than as an f. */
  f: [ [['M', -0.09, B], ['L', -0.09, -0.30],
        ['C', -0.09, -0.47, 0.02, -0.50, 0.15, -0.46]],
       sub(['M', -0.31, X], ['L', 0.17, X]) ],

  g: [ arcPath(-0.02, XC, 0.25, XR, 0, 360),
       [['M', 0.23, X], ['L', 0.23, 0.62],
        ...arcPath(0.00, 0.62, 0.23, 0.17, 0, 150).slice(1)] ],

  h: [ sub(['M', -0.25, T], ['L', -0.25, B]),
       [...arcPath(0, XC, 0.25, XR, 180, 360), ['L', 0.25, B]] ],

  i: [ sub(['M', 0, X], ['L', 0, B]),
       sub(['M', 0, -0.40], ['L', 0, -0.44]) ],

  j: [ [['M', 0.10, X], ['L', 0.10, 0.62],
        ...arcPath(-0.12, 0.62, 0.22, 0.17, 0, 150).slice(1)],
       sub(['M', 0.10, -0.40], ['L', 0.10, -0.44]) ],

  k: [ sub(['M', -0.24, T], ['L', -0.24, B]),
       sub(['M', 0.24, X], ['L', -0.24, 0.24]),
       sub(['M', -0.06, 0.10], ['L', 0.26, B]) ],

  l: [ sub(['M', 0, T], ['L', 0, B]) ],

  m: [ sub(['M', -0.34, X], ['L', -0.34, B]),
       [...arcPath(-0.17, XC, 0.17, XR, 180, 360), ['L', 0.00, B]],
       [...arcPath(0.17, XC, 0.17, XR, 180, 360), ['L', 0.34, B]] ],

  n: [ sub(['M', -0.25, X], ['L', -0.25, B]),
       [...arcPath(0, XC, 0.25, XR, 180, 360), ['L', 0.25, B]] ],

  o: arcPathWrap(0, XC, 0.26, XR, 0, 360),

  p: [ sub(['M', -0.25, X], ['L', -0.25, DS]),
       arcPath(0.00, XC, 0.25, XR, 0, 360) ],

  q: [ arcPath(-0.02, XC, 0.25, XR, 0, 360),
       sub(['M', 0.23, X], ['L', 0.23, DS]) ],

  r: [ sub(['M', -0.18, X], ['L', -0.18, B]),
       arcPath(0.04, XC, 0.22, XR, 180, 285) ],

  /* The one letter whose curve is hand-placed rather than derived, so its
     control points have to be re-fitted whenever the x-height moves. */
  s: [ sub(['M', 0.22, 0.02],
           ['C', 0.22, -0.17, -0.22, -0.19, -0.22, 0.02],
           ['C', -0.22, 0.16, 0.22, 0.14, 0.22, 0.29],
           ['C', 0.22, 0.57, -0.22, 0.55, -0.22, 0.36]) ],

  t: [ [['M', 0.00, -0.40], ['L', 0.00, 0.30],
        ...arcPath(0.16, 0.30, 0.16, 0.20, 180, 90).slice(1)],
       sub(['M', -0.20, X], ['L', 0.22, X]) ],

  u: [ [['M', -0.25, X], ['L', -0.25, 0.16],
        ...arcPath(0, 0.16, 0.25, 0.34, 180, 0).slice(1),
        ['L', 0.25, X]],
       sub(['M', 0.25, X], ['L', 0.25, B]) ],

  v: [ sub(['M', -0.25, X], ['L', 0, B], ['L', 0.25, X]) ],

  w: [ sub(['M', -0.33, X], ['L', -0.18, B], ['L', 0, 0.10],
           ['L', 0.18, B], ['L', 0.33, X]) ],

  x: [ sub(['M', -0.23, X], ['L', 0.23, B]),
       sub(['M', 0.23, X], ['L', -0.23, B]) ],

  y: [ sub(['M', -0.25, X], ['L', 0.02, 0.38]),
       sub(['M', 0.25, X], ['L', -0.08, DS]) ],

  z: [ sub(['M', -0.22, X], ['L', 0.22, X], ['L', -0.22, B], ['L', 0.22, B]) ],
};

/* ------------------------------------------------------------- digits */
const DIGITS = {
  0: arcPathWrap(0, 0, 0.28, 0.5, 0, 360),
  1: [ sub(['M', -0.14, -0.30], ['L', 0.02, T], ['L', 0.02, B]) ],
  2: [ [...arcPath(0, -0.24, 0.26, 0.26, 200, 395), ['L', -0.26, B], ['L', 0.26, B]] ],
  3: [ [...arcPath(0, -0.24, 0.24, 0.26, 195, 425)],
       [...arcPath(0, 0.22, 0.26, 0.28, -75, 160)] ],
  4: [ sub(['M', 0.14, T], ['L', -0.28, 0.20], ['L', 0.28, 0.20]),
       sub(['M', 0.14, -0.06], ['L', 0.14, B]) ],
  5: [ sub(['M', 0.22, T], ['L', -0.22, T], ['L', -0.24, -0.02]),
       arcPath(0, 0.20, 0.26, 0.30, -100, 150) ],
  6: [ [...arcPath(0, 0.18, 0.26, 0.32, 0, 360)],
       sub(['M', -0.26, 0.18], ['C', -0.26, -0.28, -0.06, T, 0.20, -0.44]) ],
  7: [ sub(['M', -0.26, T], ['L', 0.26, T], ['L', -0.06, B]) ],
  8: [ arcPath(0, -0.24, 0.22, 0.26, 0, 360),
       arcPath(0, 0.24, 0.26, 0.26, 0, 360) ],
  9: [ [...arcPath(0, -0.18, 0.26, 0.32, 0, 360)],
       sub(['M', 0.26, -0.18], ['C', 0.26, 0.28, 0.06, B, -0.20, 0.44]) ],
};

Object.assign(GLYPHS, LOWER, DIGITS);

/* `C`, `O` and `Q` are arcs at the top level; wrap them as subpath lists. */
function arcPathWrap(cx, cy, rx, ry, a0, a1) { return [arcPath(cx, cy, rx, ry, a0, a1)]; }

export const GLYPH_CHARS = Object.keys(GLYPHS);

/**
 * Look a glyph up exactly, falling back to the uppercase form.
 *
 * Exact-first matters now that lowercase exists: `glyph('a')` must not quietly
 * return an "A".
 */
export function glyph(ch) {
  const k = String(ch);
  return GLYPHS[k] || GLYPHS[k.toUpperCase()] || null;
}

/** Ink extents of a glyph, in cap-height units. */
export function glyphBounds(ch) {
  const g = glyph(ch);
  if (!g) return { min: -0.3, max: 0.3, top: -0.5, bottom: 0.5 };
  let min = Infinity, max = -Infinity, top = Infinity, bottom = -Infinity;
  for (const p of g) for (const c of p) {
    for (let i = 1; i < c.length; i += 2) {
      if (c[i] < min) min = c[i];
      if (c[i] > max) max = c[i];
      if (c[i + 1] < top) top = c[i + 1];
      if (c[i + 1] > bottom) bottom = c[i + 1];
    }
  }
  return { min, max, top, bottom };
}

/** Advance width of a glyph, in cap-height units. */
export function glyphWidth(ch) {
  const b = glyphBounds(ch);
  return (b.max - b.min) + 0.24;   // + side bearings
}

/**
 * Draw one character, centred on the current origin.
 *
 * @param s        Surface
 * @param ch       character
 * @param cap      cap height in design units
 * @param color    stroke colour
 * @param weight   stroke width as a fraction of cap height (default 0.155)
 */
export function drawGlyph(s, ch, cap, color, weight = 0.145, centred = true, align = 'baseline') {
  const g = glyph(ch);
  if (!g) return false;
  s.save();
  s.scale(cap, cap);
  /* Vertical alignment.
     'baseline' keeps every glyph on the writing line — correct for words and
     for tracing, where sitting an 'o' next to a 'b' at the right height IS
     the lesson. 'ink' centres the visible mass instead, which is what a single
     letter alone in a card wants: a lowercase 'a' baseline-aligned in a card
     looks like it has slipped to the bottom. */
  if (align === 'ink') { const b = glyphBounds(ch); s.translate(0, -(b.top + b.bottom) / 2); }
  /* Centre on the glyph's actual ink, not on its coordinate origin — several
     letters (P, R, L, J) are asymmetric, and centring on the origin makes them
     sit visibly off to one side. Vertical centring needs no such correction:
     every glyph is authored to fill the cap box, which is the point. */
  if (centred) { const b = glyphBounds(ch); s.translate(-(b.min + b.max) / 2, 0); }
  for (const path of g) {
    s.begin();
    for (const c of path) {
      if (c[0] === 'M') s.move(c[1], c[2]);
      else if (c[0] === 'L') s.line(c[1], c[2]);
      else if (c[0] === 'Q') s.quad(c[1], c[2], c[3], c[4]);
      else if (c[0] === 'C') s.cubic(c[1], c[2], c[3], c[4], c[5], c[6]);
    }
    // Stroke width is in the scaled space, so it stays proportional to cap.
    s.stroke(color, weight, 'round', 'round');
  }
  s.restore();
  return true;
}

/**
 * Draw a short string, centred as a block.
 *
 * Laid out from each glyph's ink bounds rather than from a nominal box, so
 * asymmetric letters sit at the right optical distance from their neighbours.
 */
export function drawWord(s, text, cap, color, weight, tracking = 0.18) {
  const chars = [...String(text)].filter(c => glyph(c));
  if (!chars.length) return;
  const bounds = chars.map(glyphBounds);
  const widths = bounds.map(b => b.max - b.min);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);

  let cursor = -total / 2;
  for (let i = 0; i < chars.length; i++) {
    s.save();
    s.translate((cursor - bounds[i].min) * cap, 0);
    drawGlyph(s, chars[i], cap, color, weight, false, 'baseline');
    s.restore();
    cursor += widths[i] + tracking;
  }
}
