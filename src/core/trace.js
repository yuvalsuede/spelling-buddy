/**
 * Letter tracing — showing a learner how a letter is *formed*.
 *
 * This is nearly free, and that is the point. The glyphs are monoline strokes,
 * so their path data is already the pen's centreline: the same coordinates that
 * draw an "A" also describe the order and direction you'd write one in. Nothing
 * new had to be authored — the alphabet just had to be sampled by arc length
 * instead of stroked all at once.
 *
 * A filled-outline font could not do this. Outlines describe the *edge* of the
 * ink, not the path through it, so recovering a stroke order from one means
 * skeletonising the shape and guessing.
 */
import { GLYPHS, glyph, glyphBounds } from './glyphs.js';

const SAMPLES_PER_CURVE = 18;
const DENSIFY = 0.02;          // max spacing between stored points, in cap units

/** Resample a polyline to even spacing — the standard walk along the path. */
function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const out = [pts[0]];
  let prev = pts[0], acc = 0;

  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    let seg = d(prev, cur);
    while (acc + seg >= step && seg > 1e-9) {
      const t = (step - acc) / seg;
      const np = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      out.push(np);
      prev = np;
      seg = d(prev, cur);
      acc = 0;
    }
    acc += seg;
    prev = cur;
  }
  /* Always keep the true endpoint. Without this the tail of a stroke shorter
     than one step is silently dropped, so a letter's last few hundredths never
     get drawn and can never be "covered" by a learner's trace. */
  const last = out[out.length - 1], end = pts[pts.length - 1];
  if (d(last, end) > 1e-9) out.push(end);
  return out;
}


function cubicAt(p0, c1, c2, p1, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
          a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]];
}
function quadAt(p0, c, p1, t) {
  const u = 1 - t, a = u * u, b = 2 * u * t, d = t * t;
  return [a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]];
}

/**
 * Flatten a glyph into arc-length-parameterised polylines.
 *
 * @returns {{strokes: {pts: number[][], cum: number[], len: number}[], len: number}}
 */
export function flattenGlyph(ch) {
  const g = glyph(ch);
  if (!g) return { strokes: [], len: 0 };

  /* Horizontally centred on the glyph's ink, exactly the way `drawGlyph` and
     `drawTrace` place it. This is not cosmetic. It used to be raw authored
     coordinates, which meant the letter a learner *saw* and the letter their
     finger was *scored against* sat in two different coordinate spaces —
     0.11 cap units apart for B, P and j, most of a stroke width. A pixel
     perfect trace of a B scored 0.37 and was told "close, try again". One
     space or the trap is unavoidable for anyone integrating this. */
  const b = glyphBounds(ch);
  const dx = (b.min + b.max) / 2;

  const strokes = [];
  for (const path of g) {
    const pts = [];
    let cur = [0, 0];
    for (const c of path) {
      if (c[0] === 'M') { cur = [c[1], c[2]]; pts.push(cur); }
      else if (c[0] === 'L') { cur = [c[1], c[2]]; pts.push(cur); }
      else if (c[0] === 'Q') {
        const p0 = cur, cp = [c[1], c[2]], p1 = [c[3], c[4]];
        for (let i = 1; i <= SAMPLES_PER_CURVE; i++) pts.push(quadAt(p0, cp, p1, i / SAMPLES_PER_CURVE));
        cur = p1;
      } else if (c[0] === 'C') {
        const p0 = cur, c1 = [c[1], c[2]], c2 = [c[3], c[4]], p1 = [c[5], c[6]];
        for (let i = 1; i <= SAMPLES_PER_CURVE; i++) pts.push(cubicAt(p0, c1, c2, p1, i / SAMPLES_PER_CURVE));
        cur = p1;
      }
    }
    if (pts.length < 2) continue;

    /* Densify. Straight strokes arrive as just their endpoints, and "distance
       to the letter" measured against two vertices is nonsense for anything in
       between — the middle of an A's diagonal reads as half a cap-height away
       from the nearest stored point. Even spacing makes distance, coverage and
       direction all mean what they say. */
    const dense = resample(pts, DENSIFY).map(p => [p[0] - dx, p[1]]);

    const cum = [0];
    for (let i = 1; i < dense.length; i++)
      cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    strokes.push({ pts: dense, cum, len: cum[cum.length - 1] });
  }

  return { strokes, len: strokes.reduce((a, s) => a + s.len, 0) };
}

const cache = new Map();
export function glyphPath(ch) {
  const k = String(ch).slice(0, 1);
  if (!cache.has(k)) cache.set(k, flattenGlyph(k));
  return cache.get(k);
}

/**
 * Where the pen is at progress `u` (0→1) across the whole letter.
 *
 * @returns {{x,y, stroke:number, into:number, penUp:boolean}|null}
 *   `penUp` is true during the gap between strokes — the moment you lift the
 *   pencil to start the crossbar of an A. Showing that gap is most of what
 *   makes a trace legible as instruction rather than as a squiggle.
 */
export function penAt(ch, u, { liftFraction = 0.10 } = {}) {
  const g = glyphPath(ch);
  if (!g.strokes.length) return null;

  const n = g.strokes.length;
  const lift = n > 1 ? liftFraction : 0;
  const drawShare = 1 - lift * (n - 1);          // fraction of time actually drawing
  const scale = g.len ? drawShare / g.len : 0;

  let t = Math.min(Math.max(u, 0), 1);
  for (let i = 0; i < n; i++) {
    const s = g.strokes[i];
    const span = s.len * scale;
    if (t <= span || i === n - 1) {
      const d = Math.min(t / (span || 1), 1) * s.len;
      // locate d in the cumulative table
      let lo = 0, hi = s.cum.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; (s.cum[mid] <= d ? lo = mid : hi = mid); }
      const seg = s.cum[hi] - s.cum[lo] || 1;
      const f = (d - s.cum[lo]) / seg;
      return {
        x: s.pts[lo][0] + (s.pts[hi][0] - s.pts[lo][0]) * f,
        y: s.pts[lo][1] + (s.pts[hi][1] - s.pts[lo][1]) * f,
        stroke: i, into: Math.min(t / (span || 1), 1), penUp: false,
      };
    }
    t -= span;
    if (t < lift) {                              // in the gap before the next stroke
      const next = g.strokes[i + 1];
      return { x: next.pts[0][0], y: next.pts[0][1], stroke: i + 1, into: 0, penUp: true };
    }
    t -= lift;
  }
  const last = g.strokes[n - 1];
  const p = last.pts[last.pts.length - 1];
  return { x: p[0], y: p[1], stroke: n - 1, into: 1, penUp: false };
}

/**
 * Draw the trace at progress `u`.
 *
 * @param s        Surface
 * @param ch       character
 * @param cap      cap height in design units
 * @param u        0→1
 * @param colors   { ghost, ink }
 * @param weight   stroke width as a fraction of cap height
 */
export function drawTrace(s, ch, cap, u, colors, weight = 0.145) {
  const g = glyphPath(ch);
  if (!g.strokes.length) return null;

  s.save();
  s.scale(cap, cap);

  // ghost of the finished letter, so the target is visible from the start
  if (colors.ghost) {
    for (const st of g.strokes) {
      s.begin();
      st.pts.forEach((p, i) => (i ? s.line(p[0], p[1]) : s.move(p[0], p[1])));
      s.stroke(colors.ghost, weight, 'round', 'round');
    }
  }

  const pen = penAt(ch, u);
  if (pen) {
    for (let i = 0; i <= pen.stroke && i < g.strokes.length; i++) {
      const st = g.strokes[i];
      const upTo = i < pen.stroke ? st.pts.length - 1
                 : Math.max(1, Math.round(pen.into * (st.pts.length - 1)));
      if (upTo < 1) continue;
      s.begin();
      for (let k = 0; k <= upTo; k++) (k ? s.line(st.pts[k][0], st.pts[k][1]) : s.move(st.pts[k][0], st.pts[k][1]));
      if (i === pen.stroke && !pen.penUp) { s.line(pen.x, pen.y); }
      s.stroke(colors.ink, weight, 'round', 'round');
    }
  }
  s.restore();

  // pen position in design units, for the hand and the character's gaze
  return pen ? { x: pen.x * cap, y: pen.y * cap, penUp: pen.penUp } : null;
}

/* ==========================================================================
   SCORING — grading a learner's traced path against the letter.

   The obvious metric, mean distance to the path, is not enough on its own: a
   child who scribbles densely over one corner of an A scores well on distance
   while having drawn nothing like an A. So three things are measured, and the
   weakest one dominates:

     accuracy   how close their marks were to the letter
     coverage   how much of the letter they actually visited
     direction  whether they moved along the strokes rather than randomly

   Coverage is what catches scribbling; direction is what catches tracing the
   letter backwards, which matters for handwriting instruction.
   ========================================================================== */

function nearestOnGlyph(g, p) {
  let best = Infinity, bestStroke = 0, bestIdx = 0;
  for (let si = 0; si < g.strokes.length; si++) {
    const pts = g.strokes[si].pts;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - p[0]) ** 2 + (pts[i][1] - p[1]) ** 2;
      if (d < best) { best = d; bestStroke = si; bestIdx = i; }
    }
  }
  return { dist: Math.sqrt(best), stroke: bestStroke, idx: bestIdx };
}

/**
 * Grade a traced path.
 *
 * @param ch      the letter that was being traced
 * @param input   the learner's path in the SAME cap-height units the glyph
 *                uses. Either one path `[[x,y], …]` or, better, one path per
 *                pen-down `[[[x,y], …], …]` — real input arrives segmented,
 *                and joining the segments draws a line through empty space
 *                that nothing on the letter matches. A two-stroke letter
 *                scored as one path can't beat about 0.72 for that reason.
 * @param opts.tolerance  how far off counts as "on the line", in cap units
 *                        (default 0.16 — roughly one stroke width)
 *
 * @returns {{score, accuracy, coverage, direction, verdict, strokesHit}}
 *          all 0→1 except `verdict`
 */
export function scoreTrace(ch, input, { tolerance = 0.16, diagnose = false, candidates } = {}) {
  const g = glyphPath(ch);
  const empty = { score: 0, accuracy: 0, coverage: 0, direction: 0,
                  verdict: 'none', hint: 'finish', strokesHit: 0,
                  strokes: g.strokes.length };
  if (!g.strokes.length || !input || !input.length) return empty;

  const pt = p => (Array.isArray(p) ? p : [p.x, p.y]);
  const nested = Array.isArray(input[0]) && Array.isArray(input[0][0]);
  const paths = (nested ? input : [input])
    .map(path => resample(path.map(pt), tolerance * 0.5))
    .filter(path => path.length >= 2);
  if (!paths.length) return empty;

  const user = paths.flat();

  /* accuracy — how close each mark landed */
  let accSum = 0;
  const hitPaths = paths.map(path => path.map(p => {
    const n = nearestOnGlyph(g, p);
    accSum += Math.max(0, 1 - n.dist / tolerance);
    return n;
  }));
  const accuracy = accSum / user.length;

  /* Coverage — how much of the letter they actually visited.
     Averaged PER STROKE, not per point. Weighted by points, an A's 106-point
     diagonals drown out its 18-point crossbar, and skipping the bar entirely
     still scored "great". Every stroke of a letter matters equally, however
     short it is. */
  /* A user mark only credits the stroke it is actually NEAREST to. Without
     that, tracing an A's two diagonals also "covers" its crossbar — the
     diagonals pass within a tolerance of it — and skipping the bar entirely
     still scored well. */
  const byStroke = g.strokes.map(() => []);
  hitPaths.forEach((hits, pi) => hits.forEach((h, i) => byStroke[h.stroke].push(paths[pi][i])));

  const strokeCoverage = g.strokes.map((st, si) => {
    const pool = byStroke[si];
    if (!pool.length) return 0;
    let hit = 0;
    for (const gp of st.pts)
      if (pool.some(up => Math.hypot(up[0] - gp[0], up[1] - gp[1]) <= tolerance)) hit++;
    return hit / st.pts.length;
  });
  const coverage = strokeCoverage.reduce((a, b) => a + b, 0) / strokeCoverage.length;
  const strokesHit = strokeCoverage.filter(c => c > 0.6).length;

  /* direction — did they travel ALONG each stroke, the way it is written?
     Deliberately not "were they consistent": tracing an A from the bottom up
     is consistent and still the wrong lesson. */
  let forward = 0, moves = 0;
  for (const hits of hitPaths) {
    for (let i = 1; i < hits.length; i++) {
      if (hits[i].stroke !== hits[i - 1].stroke) continue;   // never across strokes
      const d = hits[i].idx - hits[i - 1].idx;
      if (d === 0) continue;
      moves++; if (d > 0) forward++;
    }
  }
  const direction = moves ? forward / moves : 0.5;

  /* Combine so the weakest signal dominates. A plain average lets a child who
     scribbled over one corner pass on accuracy alone; a cube root compresses
     everything toward 1 and calls random noise "good". The exponents were
     tuned against known-bad inputs — scribble, half a letter, the right letter
     traced backwards, and a different letter entirely — until each landed
     where a teacher would put it. */
  const score = Math.pow(Math.max(0, accuracy), 1.5)
              * Math.pow(Math.max(0, coverage), 2.2)
              * (0.45 + 0.55 * direction);

  const verdict = score >= 0.68 ? 'great'
                : score >= 0.48 ? 'good'
                : score >= 0.30 ? 'close'
                : 'again';

  /* Which part let them down — so the app can say something useful rather
     than just showing a number. */
  const weakest = Math.min(coverage, accuracy, direction);
  const hint = coverage === weakest  ? 'finish'     // didn't cover the letter
             : accuracy === weakest  ? 'stay-on'    // wandered off the line
             :                         'direction'; // wrote it the wrong way

  const result = { score, accuracy, coverage, direction, verdict, hint, strokesHit,
                   strokes: g.strokes.length };
  if (!diagnose) return result;

  /* ---------------------------------------------------------- diagnosis
     "Not quite" is a grade. "That's a d — a b faces the other way" is a
     lesson. Both fall out of geometry we already have.

     `reversed` is the one that matters for a 5-year-old: mirror their marks
     and re-score against the SAME target. If the mirror image fits, they know
     the letter and wrote it backwards — which is the single most common
     early-years handwriting error, and the one a bare score cannot tell apart
     from "wrote the wrong letter". Doing it this way needs no table of
     mirror-pairs, and it also catches a backwards 3 or S, which are not
     letters at all. */
  const mirrored = (Array.isArray(input[0]) && Array.isArray(input[0][0]) ? input : [input])
    .map(path => path.map(p => (Array.isArray(p) ? [-p[0], p[1]] : [-p.x, p.y])));
  const asMirror = scoreTrace(ch, mirrored, { tolerance });
  result.reversed = asMirror.score >= 0.55 && asMirror.score > score + 0.15;
  result.mirrorScore = asMirror.score;

  /* `looksLike` — what did they actually draw? Only reported when some other
     glyph is both good in absolute terms and clearly better than the target,
     because "you drew an l" is unhelpful noise when the truth is "you drew
     half a b". */
  const pool = candidates ?? DEFAULT_CANDIDATES;
  let best = null;
  for (const c of pool) {
    if (c === ch) continue;
    const r = scoreTrace(c, input, { tolerance });
    if (!best || r.score > best.score) best = { ch: c, score: r.score };
  }
  result.looksLike = best && best.score >= 0.55 && best.score > score + 0.20 ? best.ch : null;
  result.looksLikeScore = best ? best.score : 0;
  return result;
}

const DEFAULT_CANDIDATES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'];

/**
 * What letter does this trace most look like? Ranked, best first.
 *
 * Separate from `scoreTrace` because it answers a different question: not
 * "how well did they write the A" but "what did they write". Useful for free
 * drawing, and for telling a reversal apart from a genuinely wrong letter.
 */
export function identifyTrace(input, { candidates = DEFAULT_CANDIDATES, tolerance = 0.16, top = 3 } = {}) {
  if (!input || !input.length) return [];
  return candidates
    .map(ch => ({ ch, ...scoreTrace(ch, input, { tolerance }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, top));
}
