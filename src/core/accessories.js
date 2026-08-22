/**
 * Accessories — things the character WEARS.
 *
 * The rule that makes this work, and the one that took several attempts to
 * find: a worn thing is not a picture stuck to the front of the head. It is a
 * shape that lives in the head's own coordinate frame and gets rotated with
 * it, so that turning away puts part of it behind the skull and the rest of it
 * out past the silhouette — a cap keeps its crown from behind and shows its
 * brim on the far side, a headband wraps rather than floats, a crown stays a
 * ring instead of vanishing at three-quarter view.
 *
 * Three things follow from that and are worth stating, because each one is a
 * bug that shipped:
 *
 *  - **Worn things use a true rotation, not the face's wrap cheat.** The cheat
 *    (`WRAP_X`) pulls features inward so eyes never overhang the body edge.
 *    Applying it to hardware drags an earcup into the middle of the face at
 *    profile. Things on the skull follow the skull, and the skull's outline
 *    does not cheat.
 *  - **Depth sorts, it does not fade.** Fading an accessory out as it crosses
 *    the terminator makes it dissolve mid-turn. Solid objects do not dissolve;
 *    they pass behind. Every part is drawn in the `back` pass or the `front`
 *    pass according to its own depth, and closed shapes are *split* at the
 *    horizon so nothing pops when the sign flips.
 *  - **Foreshorten the axis that actually foreshortens.** Scaling both axes
 *    shrinks a bow to a speck at three-quarter view; scaling to zero turns a
 *    flower into a smear. Narrow only across the turn, and never past the
 *    point where the shape stops being readable.
 *
 * Each entry is `draw(surface, state, theme, options, where)` where `where` is
 * `'back'` or `'front'`, and the same function is called for both passes.
 */

import { G, silhouettePath, headRegion } from './geometry.js';
import { clamp } from './math.js';
import { darken as darkenHex, formLight } from './paint.js';

/* ==========================================================================
   Head space
   ========================================================================== */

/**
 * A point in the head's own frame, on screen.
 *
 * Input is a unit vector: X right, Y **down**, Z toward the viewer at rest —
 * so the top of the head is (0,-1,0) and the face is (0,0,1). Output is the
 * screen position on the head's radii plus the depth that decides which pass
 * draws it.
 *
 * This is a real rotation. `project()` next door is not — it is the stylised
 * one the face uses. The two must stay different: the face cheats inward so it
 * never overhangs, and a cap that cheated with it would slide off the head.
 */
export function headPoint(X, Y, Z, S, k = 1) {
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
  const x1 =  X * cy + Z * sy;
  const z1 = -X * sy + Z * cy;
  const y2 =  Y * cp + z1 * sp;
  const z2 = -Y * sp + z1 * cp;
  return { x: x1 * G.R * k, y: y2 * G.RY * k, z: z2 * G.R * k };
}

/** `n` samples of a closed curve, as head-space screen points. */
const loop = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2, i));

/** `n` samples of an open curve between two parameters, inclusive. */
const span = (n, a0, a1, f) =>
  Array.from({ length: n }, (_, i) => f(a0 + ((a1 - a0) * i) / (n - 1), i));

/**
 * A horizontal ring around the head at height `u` (−1 crown, 0 equator).
 * `a = 0` is the front of the head and the ring runs to the character's left.
 */
function ring(u, S, n = 64, k = 1) {
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return loop(n, a => headPoint(r * Math.sin(a), u, r * Math.cos(a), S, k));
}

/**
 * Cut a closed loop at the horizon.
 *
 * Returned as runs rather than a single polygon on each side, because a loop
 * can cross the horizon more than once. The crossing point is interpolated, so
 * the near half and the far half share an exact edge and the shape does not
 * flicker as a vertex changes sign.
 */
function splitDepth(pts, closed = true) {
  const n = pts.length;
  const cross = (a, b) => {
    const t = a.z / (a.z - b.z);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
  };
  const runs = [];
  let cur = { near: pts[0].z >= 0, pts: [pts[0]] };
  const last = closed ? n : n - 1;
  for (let i = 1; i <= last; i++) {
    const prev = pts[(i - 1) % n], p = pts[i % n];
    const near = p.z >= 0;
    if (near !== cur.near) {
      const x = cross(prev, p);
      cur.pts.push(x);
      runs.push(cur);
      cur = { near, pts: [x, p] };
    } else cur.pts.push(p);
  }
  runs.push(cur);
  if (closed && runs.length > 1 && runs[0].near === runs[runs.length - 1].near) {
    const tail = runs.pop();
    runs[0].pts = tail.pts.concat(runs[0].pts);
  }
  const of = k => runs.filter(r => r.near === k).map(r => r.pts).filter(p => p.length > 2);
  return { near: of(true), far: of(false) };
}

const path = (s, pts, close = true) => {
  s.begin();
  pts.forEach((p, i) => (i ? s.line(p.x, p.y) : s.move(p.x, p.y)));
  if (close) s.close();
};

/**
 * The region ABOVE a ring — a dome, closed off the top of the picture.
 *
 * Bounded below by the ring's LOWER arc, which is the whole point. Filling a
 * rectangle down to the ring's highest point and adding the ring on top of it
 * looks equivalent and is not: the rectangle's edge is straight and the ring's
 * top is a curve, so two black crescents open up between them — a slot cut
 * across the hat, which is exactly what the head tipping forward used to look
 * like.
 */
function domePath(s, ring) {
  let lo = 0, hi = 0;
  ring.forEach((p, i) => { if (p.x < ring[lo].x) lo = i; if (p.x > ring[hi].x) hi = i; });
  const arc = (a, b) => {
    const out = [];
    for (let i = a; ; i = (i + 1) % ring.length) { out.push(ring[i]); if (i === b) break; }
    return out;
  };
  const l2r = arc(lo, hi), r2l = arc(hi, lo);
  const mean = a => a.reduce((t, p) => t + p.y, 0) / a.length;
  const lower = mean(l2r) >= mean(r2l) ? l2r : r2l.slice().reverse();

  s.begin();
  s.move(-G.R * 1.7, -G.RY * 2);
  lower.forEach(p => s.line(p.x, p.y));
  s.line(G.R * 1.7, -G.RY * 2);
  s.close();
}

/** The head's up direction on screen, as a unit vector — spikes follow it. */
function upVector(S) {
  const t = headPoint(0, -1, 0, S);
  const m = Math.hypot(t.x, t.y) || 1;
  return { x: t.x / m, y: t.y / m };
}

/* Worn things need to read against the head, and the head is usually the
   darkest thing on screen. Defaulting to the spark colour puts blue on a blue
   character; a warm accent contrasts with every skin in the set. */
const tint = (T, o) => o.color || T.accent || '#FFC94A';

const FRONT = 'front';

/* Worn things take the character's own light, at about two-thirds strength:
   they are smaller and much lighter than the head, so the full terminator
   turns a yellow cap into a brown one. Without any of it a flat hat sits on a
   shaded head and reads as a sticker — which is the exact problem the head's
   shading was added to solve, moved up one layer. */
const WORN = { lit: 0.16, dark: 0.17 };

/* ==========================================================================
   The set
   ========================================================================== */

export const ACCESSORIES = {
  /* ------------------------------------------------------------- glasses */
  glasses: {
    /* The one accessory that belongs to the FACE rather than the skull, so it
       uses the face's own frame and inherits its wrap and its visibility. Rims
       that stayed put while the eyes slid away would read as a mask floating
       in front of the character. */
    draw(s, S, T, o = {}, where) {
      if (where !== FRONT) return;
      const F = S._face;
      if (!F || F.vis <= 0.01) return;
      const col = o.color || T.feature;
      /* Sized off the EYE, not off `eyeR`. On a build with big eyes a lens
         pegged to the arc radius lands inside them, and the character ends up
         wearing its own pupils. */
      const rest = G.eyeRX ?? G.eyeR * 0.58;
      const r = Math.max(G.eyeR * 1.35, rest * 1.5);
      s.save();
      s.alpha(F.vis * 0.95);

      /* The bridge is drawn between the two eye anchors rather than at a fixed
         width: at three-quarter view the eyes are closer together, and a fixed
         bridge would visibly detach. */
      s.begin();
      s.move(F.eyeL.x + r * F.eyeL.fx * 0.9, F.eyeL.y);
      s.line(F.eyeR.x - r * F.eyeR.fx * 0.9, F.eyeR.y);
      s.stroke(col, 4);

      for (const e of [F.eyeL, F.eyeR]) {
        if (e.a <= 0.02) continue;
        s.save();
        s.alpha(e.a);
        s.begin();
        s.ellipse(e.x, e.y, r * Math.max(0.06, e.fx), r * e.fy);
        s.stroke(col, 4.4);
        s.restore();
      }
      s.restore();
    },
  },

  /* ----------------------------------------------------------------- bow */
  bow: {
    draw(s, S, T, o = {}, where) {
      const p = headPoint(-0.44, -0.70, 0.50, S, 1.02);
      if ((p.z >= 0) !== (where === FRONT)) return;

      const col = tint(T, o), knot = o.knot || darkenHex(col, 0.14), R = 26;
      /* Narrow only across the turn, and not below the width at which a bow
         still reads as a bow. Scaling both axes — which is what this did —
         shrinks it to a speck the moment the head moves. */
      const k = Math.max(0.52, Math.abs(p.z) / G.R);
      const up = upVector(S);

      s.save();
      s.translate(p.x, p.y);
      s.rotate(Math.atan2(up.x, -up.y) - 0.24);
      s.scale(k, 1);

      /* Two loops pinched at the knot, with a concave outer edge — a pair of
         ellipses reads as earmuffs, which is what this was. */
      for (const side of [-1, 1]) {
        s.begin();
        s.move(0, 0);
        s.cubic(side * R * 0.55, -R * 0.72, side * R * 1.30, -R * 0.60, side * R * 1.22, -R * 0.05);
        s.cubic(side * R * 1.16, R * 0.52, side * R * 0.50, R * 0.62, 0, 0);
        s.close();
        s.fill(col);
      }
      for (const side of [-1, 1]) {
        s.begin();
        s.move(side * R * 0.14, R * 0.10);
        s.cubic(side * R * 0.44, R * 0.62, side * R * 0.52, R * 0.95, side * R * 0.30, R * 1.10);
        s.cubic(side * R * 0.20, R * 0.80, side * R * 0.04, R * 0.55, 0, R * 0.16);
        s.close();
        s.fill(col);
      }
      s.begin(); s.ellipse(0, 0, R * 0.26, R * 0.30); s.fill(knot);
      s.restore();
    },
  },

  /* -------------------------------------------------------------- flower */
  flower: {
    draw(s, S, T, o = {}, where) {
      const p = headPoint(-0.50, -0.64, 0.55, S, 1.02);
      if ((p.z >= 0) !== (where === FRONT)) return;

      const col = o.color || '#F26D8B', R = 16;
      const k = Math.max(0.55, Math.abs(p.z) / G.R);
      const up = upVector(S);
      s.save();
      s.translate(p.x, p.y);
      s.rotate(Math.atan2(up.x, -up.y));
      s.scale(k, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        s.begin();
        s.ellipse(Math.cos(a) * R, Math.sin(a) * R, R * 0.72, R * 0.72);
        s.fill(col);
      }
      s.begin(); s.ellipse(0, 0, R * 0.60, R * 0.60); s.fill(o.centre || '#FFD97A');
      s.restore();
    },
  },

  /* ----------------------------------------------------------------- cap */
  cap: {
    draw(s, S, T, o = {}, where) {
      const col = tint(T, o);
      const band = o.band || darkenHex(col, 0.18);

      const U = -0.40;                       // where the rim sits on the head
      const rim = ring(U, S, 64, 1.006);
      const rr  = Math.sqrt(1 - U * U);      // the rim's radius on the head

      /* The peak is a HALF disc, hinged on the rim and tilting downward as it
         runs forward — never a whole one. A whole disc has half of itself
         buried inside the skull, and the buried half comes back out the moment
         the head turns: at three-quarter-from-behind it swings up over the
         crown as a great yellow plate with nothing holding it on.

         Tilted rather than flat because a flat peak is edge-on — invisible —
         whenever the head is level, which is most of the time. */
      const B = 0.82, Z0 = 0.32, A = Math.sqrt(rr * rr - Z0 * Z0), TILT = 0.40;
      const yAt = Z => U + 0.04 + TILT * Math.max(0, Z - Z0);
      const peak = [
        ...span(40, 0, Math.PI, t => {
          const Z = Z0 + B * Math.sin(t);
          return headPoint(A * Math.cos(t), yAt(Z), Z, S, 1);
        }),
        /* and straight back across the hinge. Following the head's curve here
           instead looks more careful and is worse: it makes the peak
           non-planar, the horizon no longer cuts it along a straight line, and
           the near half — closed off with a chord — swells into a yellow shelf
           standing across the head at three-quarter-from-behind. The hinge is
           under the dome at every angle, so nothing is lost by keeping the
           peak flat. */
        ...span(12, 1, -1, u => headPoint(A * u, yAt(Z0), Z0, S, 1)),
      ];
      const half = splitDepth(peak);
      const edge = o.brim || darkenHex(col, 0.10);

      /* Behind the head: the far part of the peak, drawn before the skull so
         the skull cuts it. Turned away, that is what you see of a cap — the
         peak just showing past the far edge. */
      if (where !== FRONT) {
        for (const run of half.far) { path(s, run); s.fill(edge); }
        return;
      }

      /* The dome is everything above the rim, clipped to what the body
         actually fills. Borrowed from the outline rather than drawn as an
         ellipse: the head is an egg, and a cap clipped to a circle overhangs
         it by a few pixels either side — small, and it reads instantly as a
         mistake. */
      s.save();
      headRegion(s, S, 1.006, false);
      s.clip();
      domePath(s, rim);
      s.fill(col);
      domePath(s, rim);
      s.fill(formLight(G.R, WORN));

      /* The band is the near half of the rim only. The far half is inside the
         head. */
      for (const run of splitDepth(rim).near) {
        path(s, run, false);
        s.stroke(band, 11, 'butt', 'round');
      }
      s.restore();

      /* Button at the crown — a point on the head, so it rides with it. */
      const btn = headPoint(0, -1, 0, S, 0.90);
      if (btn.z > -G.R * 0.5) {
        s.begin(); s.ellipse(btn.x, btn.y, 7.5, 6.5); s.fill(band);
      }

      for (const run of half.near) {
        path(s, run); s.fill(col);
        path(s, run); s.fill(formLight(G.R, WORN));
      }
    },
  },

  /* ---------------------------------------------------------- headphones */
  headphones: {
    draw(s, S, T, o = {}, where) {
      const col = tint(T, o);
      const pad = o.pad || darkenHex(col, 0.20);

      /* The band is a hoop in the head's own coronal plane — ear, over the
         crown, ear. Borrowing the silhouette instead, which is what this did,
         gives a band that is pixel-identical at every angle: it stops being
         worn and becomes a decal on the lens. */
      /* It runs from the top of one cup to the top of the other, not ear to
         ear: a hoop that carries on down to the ear line becomes, at profile,
         a bar straight down the middle of the face. */
      const E = 0.38;
      /* And it leans BACK as it rises, the way a band actually sits on a head.
         A perfectly flat hoop is a straight vertical bar at profile — correct,
         and it reads as a stick with a disc on the end. */
      const hoop = span(48, E, Math.PI - E, a => headPoint(
        Math.cos(a) * 1.03, -Math.sin(a) * 1.03, -0.05 - 0.30 * Math.sin(a), S));
      /* Seen face-on you see the band's thickness; seen from the side you see
         the width of the strap. One term for each. */
      const w = 9 + 13 * Math.abs(Math.sin(S.yaw));
      const hs = splitDepth(hoop, false);
      for (const run of (where === FRONT ? hs.near : hs.far)) {
        path(s, run, false);
        s.stroke(col, w, 'round', 'round');
        path(s, run, false);
        s.stroke(formLight(G.R, WORN), w, 'round', 'round');
      }

      /* Cups sit ON the head at ear height. Their size follows how much of the
         cup faces the viewer, which is the one thing that actually changes. */
      for (const side of [-1, 1]) {
        const p = headPoint(side * 1.0, -0.10, 0, S, 1.0);
        if ((p.z >= 0) !== (where === FRONT)) continue;
        const face = Math.abs(p.z) / G.R;
        const rx = 8 + 15 * face;
        s.save();
        s.begin(); s.ellipse(p.x, p.y, rx, 25); s.fill(col);
        s.begin(); s.ellipse(p.x, p.y, rx, 25); s.fill(formLight(G.R, WORN));
        s.begin(); s.ellipse(p.x, p.y, rx * 0.58, 15); s.fill(pad);
        s.restore();
      }
    },
  },

  /* --------------------------------------------------------------- crown */
  crown: {
    draw(s, S, T, o = {}, where) {
      const col = tint(T, o);
      const gem = o.gem || '#E2664F';

      /* A crown is a RING. Parked in head space — which is what this was — it
         sits dead still while the face swings away underneath, then disappears
         entirely once its anchor crosses the horizon. Built as a ring and
         drawn segment by segment into whichever pass each segment belongs to,
         it is worn from every angle, including from behind. */
      const N = 24, U = -0.70, K = 1.02;
      const lo = ring(U, S, N, K);
      const hi = ring(U - 0.09, S, N, K);
      const up = upVector(S);
      const near = where === FRONT;

      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const mid = (lo[i].z + lo[j].z) / 2;
        if ((mid >= 0) !== near) continue;
        /* One quad per segment, sharing exact edges with its neighbours, so
           the band has no seams and needs no winding rules. */
        path(s, [lo[i], lo[j], hi[j], hi[i]]);
        s.fill(col);
        path(s, [lo[i], lo[j], hi[j], hi[i]]);
        s.fill(formLight(G.R, WORN));
      }

      /* Points rise from the top of the band along the head's own up axis, so
         they lean with a tilt instead of standing bolt upright on a tipped
         head. Narrow and tall: a wide base makes a serrated collar, not a
         crown. */
      const H = 42;
      for (let i = 0; i < N; i += 3) {
        const a = hi[(i - 1 + N) % N], b = hi[i], c = hi[(i + 1) % N];
        if ((b.z >= 0) !== near) continue;
        const h = H * (0.62 + 0.38 * Math.abs(b.z) / G.R);
        const tip = { x: b.x + up.x * h, y: b.y + up.y * h };
        path(s, [a, tip, c]);
        s.fill(col);
        path(s, [a, tip, c]);
        s.fill(formLight(G.R, WORN));
      }

      /* One gem, at the front of the band. A gem on every point reads as
         measles at small sizes. */
      const f = headPoint(0, U - 0.045, Math.sqrt(1 - U * U), S, K);
      if (near && f.z > G.R * 0.25) {
        s.begin();
        s.ellipse(f.x, f.y, 5.2, 5.2);
        s.fill(gem);
      }
    },
  },
};

export const ACCESSORY_NAMES = Object.keys(ACCESSORIES);

/**
 * A surface that STROKES whatever it is asked to fill.
 *
 * On a themed skin with a contour, an accessory without one reads as pasted
 * on — the body has a drawn edge and the hat does not. Giving each item its
 * own outline by hand would mean rewriting six accessories and getting the
 * stroke-then-fill ordering right in each; running the item's own drawing
 * twice does it once, for all of them, and cannot fall out of step with the
 * shapes because it IS the shapes. The contour pass lays every edge down
 * first and the real pass covers the internal ones, exactly as the body does.
 */
function contourPass(s, colour, w) {
  return new Proxy(s, {
    get(t, k) {
      if (k === 'fill') return () => t.stroke(colour, w, 'round', 'round');
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

export function drawAccessories(s, S, T, where) {
  const list = S.accessories;
  if (!list || !list.length) return;
  const w = T.outline ? (T.outlineWornW ?? T.outlineW * 0.62) * 2 : 0;
  for (const item of list) {
    const name = typeof item === 'string' ? item : item.name;
    const a = ACCESSORIES[name];
    if (!a) continue;
    const o = typeof item === 'string' ? {} : item;
    if (w > 0) {
      s.save();
      a.draw(contourPass(s, T.outline, w), S, T, o, where);
      s.restore();
    }
    s.save();
    a.draw(s, S, T, o, where);
    s.restore();
  }
}

export { clamp };
