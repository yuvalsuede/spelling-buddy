/**
 * The egg.
 *
 * The shell is the CHARACTER'S OWN SILHOUETTE, scaled up. That is the whole
 * idea and everything else follows from it: when it opens, what comes out
 * matches the hole it came from, and the hatch reads as "it was in there all
 * along" rather than as two unrelated drawings swapped at a cut. Draw the
 * shell as a generic ovoid and you get the second one.
 *
 * The state is deliberately split in two, because the two halves behave
 * differently:
 *
 *  - **`crack` is the caller's.** How far the fissure has spread, 0 to 1, set
 *    directly. It is not spring-driven, because a crack does not settle — it
 *    is exactly as far along as whatever is driving it says, whether that is a
 *    tap, a progress bar or a timeline.
 *  - **`open` is the rig's.** Once the shell starts opening it is a physical
 *    object with weight, so it is a spring, and the top hinges before it
 *    detaches. A free spring from frame one looks like the lid teleports.
 *
 * The crack's randomness runs on its own stateless substream. An egg must not
 * draw from the same generator as the blink and the particles, or the fissure
 * changes shape when the character blinks — which is the sort of bug that
 * takes a day to believe.
 */

import { G, halfWidthAt, silhouetteSub } from './geometry.js';
import { clamp, lerp, smooth, makeRandom } from './math.js';
import { darken, lighten, mix } from './paint.js';

/** How much bigger the shell is than the character. Fits a bare body. */
export const SHELL = 1.35;

/** The four states a caller can ask about. */
export const EGG_STATES = ['closed', 'wobbling', 'cracked', 'opening'];

export function eggState(e) {
  if (!e || !e.on) return null;
  if (e.open > 0.001) return 'opening';
  if (e.crack >= 0.999) return 'cracked';
  if (e.wobble > 0.01 || e.crack > 0) return 'wobbling';
  return 'closed';
}

/* ==========================================================================
   The fissure
   ========================================================================== */

/**
 * The crack, as a polyline across the shell.
 *
 * Three properties it must have, and all three are the difference between a
 * crack and a scribble:
 *
 *  - **x-monotone.** It walks left to right and never doubles back, so the
 *    shell is cut into exactly two pieces and each piece is a simple polygon.
 *    A path that wanders backwards makes a shell that cannot be filled.
 *  - **It meets the boundary exactly.** Both ends land ON the sampled
 *    silhouette — `halfWidthAt` is the same measurement the body is drawn
 *    from — so no sliver of shell is left hanging at either end.
 *  - **It is seeded and stateless.** The same seed gives the same fissure in
 *    the browser, in the exporter and in a test, which is what lets a hatch be
 *    a snapshot at all.
 *
 * Branches are short, one-sided and deliberately do NOT reach the boundary:
 * a branch that gets there would split the shell into three.
 */
export function crackPath(seed = 1, g = G, opts = {}) {
  const rnd = makeRandom((seed | 0) * 2654435761 % 2147483647 || 1);
  const rx = g.R * SHELL, ry = g.RY * SHELL;
  const steps = opts.steps ?? 13;

  /* Where it crosses, as a fraction of the shell's height. Kept in the upper
     third: a shell that opens across its middle is a bowl with a lid, and the
     character has nowhere to sit. */
  const yMid = -ry * (0.10 + rnd() * 0.12);
  const tilt = (rnd() - 0.5) * ry * 0.10;

  const edge = y => halfWidthAt(y / SHELL, g) * SHELL;
  const y0 = yMid - tilt, y1 = yMid + tilt;
  const pts = [[-edge(y0), y0]];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    /* x is a strict function of t, so the path cannot double back however the
       zigzag lands. Only y is random. */
    const x = lerp(-edge(y0), edge(y1), t);
    const zig = (rnd() - 0.5) * ry * 0.16 * Math.sin(t * Math.PI);
    pts.push([x, lerp(y0, y1, t) + zig]);
  }
  pts.push([edge(y1), y1]);

  /* Branches: short spurs off a mid vertex, going up or down, stopping well
     inside the shell. They read as a fissure spreading; they must not connect
     to the boundary or the shell falls into three pieces. */
  const branches = [];
  const n = opts.branches ?? 2;
  for (let b = 0; b < n; b++) {
    const at = 3 + Math.floor(rnd() * (steps - 6));
    const [bx, by] = pts[at];
    const dir = rnd() < 0.5 ? -1 : 1;
    const len = ry * (0.10 + rnd() * 0.10);
    branches.push([[bx, by],
                   [bx + (rnd() - 0.5) * rx * 0.06, by + dir * len * 0.55],
                   [bx + (rnd() - 0.5) * rx * 0.10, by + dir * len]]);
  }

  return { pts, branches, y0, y1, rx, ry };
}

/** Cumulative arc length along a polyline. */
function arcLengths(pts) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return acc;
}

/**
 * The first `k` of a polyline BY ARC LENGTH.
 *
 * By vertex count instead — which is the obvious version — the fissure crawls
 * fast through the tight zigzags and slowly across the straight runs, so it
 * visibly changes speed while nothing else does. Arc length is what makes it
 * look like one thing spreading.
 */
export function revealByLength(pts, k) {
  if (k >= 1) return pts.slice();
  if (k <= 0) return [];
  const acc = arcLengths(pts);
  const want = acc[acc.length - 1] * k;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (acc[i] <= want) { out.push(pts[i]); continue; }
    const t = (want - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    out.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]);
    break;
  }
  return out;
}

/* ==========================================================================
   The two halves
   ========================================================================== */

/**
 * The shell as two closed polygons, cut along the crack.
 *
 * Sampled from the same `halfWidthAt` table the body is drawn from, so the
 * shell's outline and the character's are the same curve at two scales — which
 * is what makes the hatch read.
 *
 * The seam is overlapped by a hair. Two polygons that share an exact edge
 * still anti-alias against each other, and at `open = 0` that shows as a
 * bright hairline straight down the middle of an egg that is supposed to be
 * whole.
 */
export function shellHalves(crack, g = G, N = 48) {
  const { pts, y0, y1, rx, ry } = crack;
  /* Two polygons that share an exact edge still anti-alias against each other,
     and at `open = 0` that shows as a bright hairline straight down the middle
     of an egg that is supposed to be whole. Half a pixel of overlap each way
     costs nothing and removes it. */
  const SEAM = 0.6;

  /* The flank, from one height to another, on one side. Sampled from the same
     half-width table the body is drawn from — which is what makes the shell's
     outline and the character's the same curve at two scales, and the hatch
     read as "it was in there all along". */
  const side = (from, to, dir) => {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const y = lerp(from, to, i / N);
      out.push([dir * halfWidthAt(clamp(y, -ry, ry) / SHELL, g) * SHELL, y]);
    }
    return out;
  };

  const along = dy => pts.map(([x, y]) => [x, y + dy]);

  /* Lid: the crack left to right, up the right flank to the crown, back down
     the left flank to where the crack began. */
  const top = [...along(-SEAM), ...side(y1, -ry, 1), ...side(-ry, y0, -1)];

  /* Bowl: the same crack, down the right flank, round the base, up the left. */
  const bottom = [...along(SEAM), ...side(y1, ry, 1), ...side(ry, y0, -1)];

  return { top, bottom, rx, ry };
}

/* ==========================================================================
   Drawing
   ========================================================================== */

const poly = (s, pts, close = true) => {
  s.begin();
  pts.forEach(([x, y], i) => (i ? s.line(x, y) : s.move(x, y)));
  if (close) s.close();
};

/** The whole, uncracked shell — one shape, so it has no seam to show. */
function wholeShell(s, g, T, shellPaint, outline, w) {
  if (outline) {
    s.begin(); silhouetteSub(s, g.R * SHELL, g.RY * SHELL, 0, 0, g);
    s.stroke(outline, w, 'round', 'round');
  }
  s.begin(); silhouetteSub(s, g.R * SHELL, g.RY * SHELL, 0, 0, g);
  s.fill(shellPaint);
}

/**
 * How far the top has hinged, and how far it has flown.
 *
 * The lid does not simply spring away: for the first third it pivots on the
 * far end of the crack, which is what a shell does when the thing inside
 * pushes. Only after that does it detach and rise. A free spring from frame
 * one reads as the lid teleporting.
 */
export function lidTransform(open, crack) {
  const hinge = smooth(0, 0.34, open);
  const fly = smooth(0.28, 1, open);
  return {
    pivot: [crack.pts[crack.pts.length - 1][0] * 0.9, crack.y1],
    rotate: -hinge * 0.42 - fly * 0.5,
    dx: fly * crack.rx * 0.34,
    dy: -fly * crack.ry * 1.15,
    alpha: 1 - smooth(0.72, 1, open) * 0.85,
  };
}

/**
 * The egg, drawn around whatever the caller draws inside it.
 *
 * `inner()` is the character. It is called between the two halves, because
 * that is physically where it is: behind the bowl it is sitting in and in
 * front of the lid that has come off. Passing it in rather than drawing it
 * here keeps this file about the shell.
 */
export function drawEgg(s, S, T, inner) {
  const g = S.g || G;
  const e = S.egg;
  if (!e || !e.on) { if (inner) inner(); return; }

  /* Mostly eggshell, with a little of the character mixed in so it belongs to
     them. Lightening the body instead — which is what this did — gives a pink
     character a pink shell, and a hatch you cannot see happening because the
     thing coming out is the colour of the thing it is coming out of. */
  const shell = T.eggShell || mix(T.body, '#FFF6E9', 0.86);
  const innerTone = T.eggInner || darken(shell, 0.22);
  const line = T.eggCrack || darken(shell, 0.45);
  const outline = T.outline || null;
  const w = outline ? T.outlineW * 2 : 0;

  const crack = e._path || (e._path = crackPath(e.seed, g));
  const open = e.open;

  s.save();
  /* The wobble is the whole egg rocking on its base, so it pivots at the
     bottom rather than at the centre — an egg that rotates about its middle
     is an egg floating in space. */
  if (e.wobble > 0.001) {
    s.translate(0, g.RY * SHELL);
    s.rotate(Math.sin(e.t * 13) * 0.055 * e.wobble);
    s.translate(0, -g.RY * SHELL);
  }

  if (open <= 0.001) {
    /* Whole while merely cracked. One shape, no seam — the halves only exist
       once there is a reason for them to move apart. */
    wholeShell(s, g, T, shell, outline, w);
    drawFissure(s, crack, e.crack, line, g);
    s.restore();
    return;
  }

  const { top, bottom } = shellHalves(crack, g);
  const lid = lidTransform(open, crack);

  /* The lid, behind everything: it has come off and is on its way up and back. */
  s.save();
  s.alpha(lid.alpha);
  s.translate(lid.pivot[0] + lid.dx, lid.pivot[1] + lid.dy);
  s.rotate(lid.rotate);
  s.translate(-lid.pivot[0], -lid.pivot[1]);
  if (outline) { poly(s, top); s.stroke(outline, w, 'round', 'round'); }
  poly(s, top); s.fill(shell);
  /* The underside. Without a visible thickness the shell reads as torn paper
     rather than as something that was holding a creature. */
  poly(s, crack.pts.map(([x, y]) => [x, y - 0.6]), false);
  s.stroke(innerTone, 7, 'butt', 'round');
  s.restore();

  /* The character, clipped so that what is still INSIDE the shell stays
     inside it. Without this the body pokes out below the bowl while it is
     climbing — the shell is 1.35× the character, so there is more character
     than bowl at the bottom of the rise.

     The clip is the shell's own outline UNIONED with everything above the
     crack: inside the shell it is contained, above the rim it is free. Drawn
     as two subpaths with the same winding, which nonzero fill unions. */
  if (inner) {
    s.save();
    s.begin();
    s.move(-crack.rx * 3, -crack.ry * 4);
    s.line(crack.rx * 3, -crack.ry * 4);
    s.line(crack.rx * 3, crack.y0);
    s.line(-crack.rx * 3, crack.y0);
    s.close();
    silhouetteSub(s, g.R * SHELL, g.RY * SHELL, 0, 0, g);
    s.clip();
    inner();
    s.restore();
  }

  /* The bowl, in front: the character is standing in it. */
  if (outline) { poly(s, bottom); s.stroke(outline, w, 'round', 'round'); }
  poly(s, bottom); s.fill(shell);
  /* The lip — the inside edge of the bowl, which is the other half of the
     thickness the lid showed. */
  poly(s, crack.pts.map(([x, y]) => [x, y + 0.6]), false);
  s.stroke(innerTone, 8, 'butt', 'round');

  s.restore();
}

/** The fissure itself, revealed by arc length, branches and all. */
function drawFissure(s, crack, k, colour, g) {
  if (k <= 0.001) return;
  const shown = revealByLength(crack.pts, k);
  if (shown.length > 1) { poly(s, shown, false); s.stroke(colour, 3.2, 'round', 'round'); }
  /* Branches appear with the stretch of crack they hang off, not all at the
     end — a fissure that sprouts every branch at once reads as a decal. */
  for (const b of crack.branches) {
    const at = crack.pts.findIndex(([x]) => x >= b[0][0]) / crack.pts.length;
    if (k < at + 0.06) continue;
    poly(s, revealByLength(b, clamp((k - at) / 0.18, 0, 1)), false);
    s.stroke(colour, 2.4, 'round', 'round');
  }
}
