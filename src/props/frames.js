/**
 * Frames — where a prop lives, and what the turn does to it.
 *
 * A frame is the answer to "when the head turns thirty degrees, what happens
 * to this thing?" There are only about eight honest answers, and every one of
 * them took at least one wrong attempt to find on the six accessories that
 * shipped before this file existed. Writing them down once is the whole point:
 * an item author says `headBillboard({ at: [-0.52, -0.66, 0.53] })` and never
 * has to learn any of it.
 *
 * The rules a frame enforces, each of which is a shipped bug:
 *
 *  - **Skull hardware uses a true rotation, never the face's wrap cheat.** The
 *    cheat pulls features inward so eyes never overhang the body edge; applied
 *    to a headphone cup it drags the cup into the middle of the face.
 *  - **Depth sorts; it does not fade.** A prop crossing the horizon is drawn
 *    in the far pass or split at the horizon — never faded out, because solid
 *    objects do not dissolve.
 *  - **Foreshorten only the axis that foreshortens, and stop before the shape
 *    stops reading.** Scaling both axes shrinks a bow to a speck.
 *
 * Every frame returns PLACEMENTS: `{ side, kind, … }` where `side` is
 * `'near'` or `'far'` and decides which pass paints it. The compiler paints
 * them; nothing here draws.
 */

import { G } from '../core/geometry.js';
import { clamp } from '../core/math.js';

/* ==========================================================================
   Head space
   ========================================================================== */

/**
 * A unit vector in the head's own frame, projected to screen.
 *
 * X right, Y **down**, Z toward the viewer at rest: the top of the head is
 * (0,−1,0) and the face is (0,0,1). Returns the screen position on the head's
 * radii, plus the depth that decides which pass draws it.
 */
export function headPoint(X, Y, Z, S, k = 1) {
  const g = S.g || G;
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
  const x1 =  X * cy + Z * sy;
  const z1 = -X * sy + Z * cy;
  const y2 =  Y * cp + z1 * sp;
  const z2 = -Y * sp + z1 * cp;
  return { x: x1 * g.R * k, y: y2 * g.RY * k, z: z2 * g.R * k };
}

/** The head's up direction on screen — spikes, stems and bows follow it. */
export function upVector(S) {
  const t = headPoint(0, -1, 0, S);
  const m = Math.hypot(t.x, t.y) || 1;
  return { x: t.x / m, y: t.y / m };
}

const loop = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2, i));
const span = (n, a0, a1, f) =>
  Array.from({ length: n }, (_, i) => f(a0 + ((a1 - a0) * i) / (n - 1), i));

/** A horizontal ring at height `u` (−1 crown, 0 equator), front at a = 0. */
export function ringPoints(u, S, n = 64, k = 1) {
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return loop(n, a => headPoint(r * Math.sin(a), u, r * Math.cos(a), S, k));
}

/**
 * Cut a curve at the horizon, into near runs and far runs.
 *
 * Returned as runs rather than one polygon a side, because a loop can cross
 * the horizon more than once. The crossing point is interpolated, so the two
 * halves share an exact edge and nothing flickers as a vertex changes sign.
 */
export function splitDepth(pts, closed = true) {
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

/* ==========================================================================
   The frames
   ========================================================================== */

/**
 * Flat art stuck to a point on the skull, turning with it.
 *
 * The workhorse: clips, bows, flowers, badges, patches, most of the catalogue.
 * The art stays face-on to the viewer — it is a billboard — but its anchor
 * rides the sphere, it rolls with the head's up axis, and it narrows across
 * the turn down to `minFacing`, below which a bow stops being a bow.
 */
export const headBillboard = ({ at, radius = 1.02, orient = 'head-up',
                                minFacing = 0.52, roll = 0 }) => ({
  kind: 'billboard',
  resolve(S) {
    const g = S.g || G;
    const p = headPoint(at[0], at[1], at[2], S, radius);
    const k = Math.max(minFacing, Math.abs(p.z) / g.R);
    const up = upVector(S);
    const rotate = orient === 'head-up' ? Math.atan2(up.x, -up.y) + roll : roll;
    return [{ side: p.z >= 0 ? 'near' : 'far', kind: 'billboard',
              x: p.x, y: p.y, z: p.z, rotate, sx: k, sy: 1 }];
  },
});

/**
 * A solid band around the head, as quads.
 *
 * A ring PARKED in head space — which is what the crown was — sits dead still
 * while the face swings away underneath it, then vanishes when its anchor
 * crosses the horizon. Built segment by segment and sorted per segment, it is
 * worn from every angle, including from behind.
 */
export const headRing = ({ u, thickness = 0.09, radius = 1.02, segments = 24 }) => ({
  kind: 'ring',
  resolve(S) {
    const lo = ringPoints(u, S, segments, radius);
    const hi = ringPoints(u - thickness, S, segments, radius);
    const out = [];
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const mid = (lo[i].z + lo[j].z) / 2;
      out.push({ side: mid >= 0 ? 'near' : 'far', kind: 'poly',
                 pts: [lo[i], lo[j], hi[j], hi[i]] });
    }
    out.lo = lo; out.hi = hi;
    return out;
  },
  /* Spikes, jewels and scallops need to know where the band's edges landed. */
  edges(S) {
    return { lo: ringPoints(u, S, segments, radius),
             hi: ringPoints(u - thickness, S, segments, radius) };
  },
});

/**
 * A stroked band — the near half of a ring only.
 *
 * The far half is inside the head, so drawing it is not "behind": it is a line
 * across the back of a solid object that would show through nothing.
 */
export const headBand = ({ u, width = 11, radius = 1.006, segments = 64 }) => ({
  kind: 'band',
  resolve(S) {
    return splitDepth(ringPoints(u, S, segments, radius)).near
      .map(pts => ({ side: 'near', kind: 'stroke', pts, width, close: false,
                     cap: 'butt', join: 'round' }));
  },
});

/**
 * An arch over the head — ear, over the crown, ear.
 *
 * It runs from the top of one cup to the top of the other, not ear to ear: a
 * hoop carried down to the ear line becomes, at profile, a bar straight down
 * the middle of the face. And it leans BACK as it rises, the way a band sits
 * on a real head — a perfectly flat hoop is a vertical stick at profile.
 *
 * `width` grows with the turn because face-on you see the band's thickness and
 * from the side you see the width of the strap.
 */
export const headHoop = ({ end = 0.38, lean = 0.30, drop = -0.05, radius = 1.03,
                          width = 9, widthAcross = 13, segments = 48 }) => ({
  kind: 'hoop',
  resolve(S) {
    const pts = span(segments, end, Math.PI - end, a => headPoint(
      Math.cos(a) * radius, -Math.sin(a) * radius, drop - lean * Math.sin(a), S));
    const w = width + widthAcross * Math.abs(Math.sin(S.yaw));
    const cut = splitDepth(pts, false);
    return [
      ...cut.near.map(p => ({ side: 'near', kind: 'stroke', pts: p, width: w, close: false })),
      ...cut.far .map(p => ({ side: 'far',  kind: 'stroke', pts: p, width: w, close: false })),
    ];
  },
});

/**
 * Everything above a ring, closed off the top of the picture and clipped to
 * the head: a hat's crown.
 *
 * Bounded below by the ring's LOWER arc. Filling a rectangle down to the
 * ring's highest point looks equivalent and is not — the rectangle's edge is
 * straight and the ring's top is a curve, so two black crescents open up
 * between them, which is what the head tipping forward used to look like.
 */
export const headDome = ({ u, radius = 1.006 }) => ({
  kind: 'dome',
  clipToHead: radius,
  resolve(S) {
    const g = S.g || G;
    const ring = ringPoints(u, S, 64, radius);
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
    return [{ side: 'near', kind: 'poly',
              pts: [{ x: -g.R * 1.7, y: -g.RY * 2 }, ...lower, { x: g.R * 1.7, y: -g.RY * 2 }] }];
  },
});

/**
 * A cone or a truncated cone standing on the head — the volume every tall hat
 * is made of.
 *
 * Built as quads between two rings and sorted per quad, for the same reason a
 * crown is built segment by segment: a cone parked in head space sits dead
 * still while the head turns, and a cone drawn as one screen-space triangle
 * has no back, so nothing of it shows when the character turns away. Quads
 * between rings give a solid that is worn from every angle, with the far side
 * passing behind the skull.
 *
 * `topRadius: 0` is a point — a party hat. Anything larger is a chef's hat or
 * a stovepipe. `leanZ` tips the whole thing forward or back, which is most of
 * what makes a wizard's hat read as a wizard's hat rather than as a cone.
 */
export const headCone = ({ u, radius = 0.86, topRadius = 0, height = 1.5,
                          leanZ = 0, leanX = 0, segments = 28 }) => {
  const at = (r, y, dz, dx, S) => loop(segments, a =>
    headPoint(r * Math.sin(a) + dx, y, r * Math.cos(a) + dz, S, 1));
  return {
    kind: 'cone',
    rings(S) {
      return {
        base: at(radius, u, 0, 0, S),
        top: at(topRadius, u - height, leanZ, leanX, S),
      };
    },
    /* ONE polygon a side, not a quad per segment.
       Quads were the first version, and they left a fan of hairlines up the
       front of every cone: two SVG polygons sharing an exact edge still
       anti-alias against each other, so every seam showed as a thin darker
       line. A cone only has two parts that matter — the half facing you and
       the half that does not — so that is what it is drawn as. */
    resolve(S) {
      return this.outline(S);
    },
    silhouette(S) {
      return this.outline(S);
    },
    /**
     * The two halves, split at the horizon.
     *
     * Split on the RINGS and then joined, never the other way round. Building
     * the whole outline first and depth-splitting that was the second version,
     * and it deleted the hat: the apex sits exactly on the horizon at face-on,
     * the base ring's endpoints sit within a float of it, and the cut sliced
     * the triangle into an apex with no base and a base with no apex — each
     * with zero area. Cutting the ring first cannot do that, because the apex
     * is attached after the cut and belongs to both halves.
     *
     * In an orthographic projection this is also exactly right: the visible
     * surface of a cone is the half facing the viewer, and its screen outline
     * is the apex plus that half's arc.
     */
    outline(S) {
      const { base, top } = this.rings(S);
      const cut = ring => {
        const c = splitDepth(ring, true);
        const longest = runs => runs.sort((a, b) => b.length - a.length)[0] || [];
        return { near: longest(c.near), far: longest(c.far) };
      };
      const b = cut(base);
      const out = [];

      if (topRadius === 0) {
        const apex = top.reduce((a, p) => ({
          x: a.x + p.x / top.length, y: a.y + p.y / top.length, z: a.z + p.z / top.length,
        }), { x: 0, y: 0, z: 0 });
        if (b.far.length > 1) out.push({ side: 'far', kind: 'poly', pts: [apex, ...b.far] });
        if (b.near.length > 1) out.push({ side: 'near', kind: 'poly', pts: [apex, ...b.near] });
        return out;
      }

      const t = cut(top);
      if (b.far.length > 1 && t.far.length > 1)
        out.push({ side: 'far', kind: 'poly', pts: [...t.far.slice().reverse(), ...b.far] });
      if (b.near.length > 1 && t.near.length > 1)
        out.push({ side: 'near', kind: 'poly', pts: [...t.near.slice().reverse(), ...b.near] });
      return out;
    },
  };
};

/**
 * A flat disc in the head's own horizontal plane — every brim in the
 * catalogue.
 *
 * Wider than the head by design: `radius` is in head units, so 1.5 is a sun
 * hat. It is split at the horizon like everything else, which is what makes
 * the far side of a brim pass behind the skull instead of lying across the
 * face.
 *
 * `droop` dips the front and lifts the back — a brim that is dead flat reads
 * as a plate. `lobes` waves the edge, which is the cheapest honest tricorn:
 * three bumps in the outline and the shape is a pirate hat before any detail
 * is drawn.
 */
export const headDisc = ({ u, radius = 1.45, droop = 0, lobes = 0, lobeAmp = 0.12,
                          phase = 0, segments = 56 }) => ({
  kind: 'disc',
  resolve(S) {
    const pts = loop(segments, a => {
      const r = radius * (1 + (lobes ? lobeAmp * Math.cos(lobes * a + phase) : 0));
      return headPoint(r * Math.sin(a), u + droop * Math.cos(a), r * Math.cos(a), S, 1);
    });
    const cut = splitDepth(pts, true);
    return [
      ...cut.far.map(p => ({ side: 'far', kind: 'poly', pts: p })),
      ...cut.near.map(p => ({ side: 'near', kind: 'poly', pts: p })),
    ];
  },
  /* Same runs, left open: the ends of a run are where the brim passes behind
     the head, and closing them draws a chord straight across it. */
  silhouette(S) {
    return this.resolve(S).map(p => ({ ...p, close: false }));
  },
});

/**
 * A flat rectangular plate in the head's own plane — the mortarboard, and
 * anything else square that sits on top.
 *
 * The perimeter is subdivided rather than being four corners: the horizon cut
 * interpolates between samples, and four of them put the crossing point up to
 * a whole edge away from where it belongs, which shows as the board visibly
 * jumping as the head turns.
 */
export const headPlate = ({ u, halfW = 1.25, halfD = 1.25, tiltZ = 0, perEdge = 8 }) => ({
  kind: 'plate',
  resolve(S) {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const pts = [];
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      for (let k = 0; k < perEdge; k++) {
        const t = k / perEdge;
        const sx = ax + (bx - ax) * t, sz = az + (bz - az) * t;
        pts.push(headPoint(sx * halfW, u + tiltZ * sz, sz * halfD, S, 1));
      }
    }
    const cut = splitDepth(pts, true);
    return [
      ...cut.far.map(p => ({ side: 'far', kind: 'poly', pts: p })),
      ...cut.near.map(p => ({ side: 'near', kind: 'poly', pts: p })),
    ];
  },
  silhouette(S) {
    return this.resolve(S).map(p => ({ ...p, close: false }));
  },
});

/**
 * Both ears at once, near one and far one sorted separately.
 *
 * `paired` visibility lives here: at profile one cup is behind the skull and
 * the other is edge-on, and the honest drawing shows the near one large and
 * the far one as a sliver — not both, and not neither.
 */
export const earPair = ({ u = -0.10, radius = 1.0, minFacing = 0, place = 'transform' }) => ({
  kind: 'pair',
  resolve(S) {
    const g = S.g || G;
    return [-1, 1].map(side => {
      const p = headPoint(side * 1.0, u, 0, S, radius);
      const facing = Math.abs(p.z) / g.R;
      return { side: p.z >= 0 ? 'near' : 'far', kind: 'billboard', ear: side,
               x: p.x, y: p.y, z: p.z, rotate: 0, raw: place === 'size',
               sx: Math.max(minFacing, facing), sy: 1, facing };
    });
  },
});

/**
 * Spikes standing off the top edge of a ring — a crown's points.
 *
 * They rise along the head's own up axis, so they lean with a tilted head
 * instead of standing bolt upright on it, and they are narrow and tall: a wide
 * base makes a serrated collar, not a crown. Their height grows with how much
 * of that part of the band faces the viewer, which is what stops the far side
 * from looking like the near side seen through the head.
 */
export const headSpikes = ({ u, thickness = 0.09, radius = 1.02, segments = 24,
                             every = 3, height = 42, grow = 0.38 }) => ({
  kind: 'spikes',
  resolve(S) {
    const g = S.g || G;
    const hi = ringPoints(u - thickness, S, segments, radius);
    const up = upVector(S);
    const out = [];
    for (let i = 0; i < segments; i += every) {
      const a = hi[(i - 1 + segments) % segments], b = hi[i], c = hi[(i + 1) % segments];
      const h = height * ((1 - grow) + grow * Math.abs(b.z) / g.R);
      const tip = { x: b.x + up.x * h, y: b.y + up.y * h };
      out.push({ side: b.z >= 0 ? 'near' : 'far', kind: 'poly', pts: [a, tip, c] });
    }
    return out;
  },
});

/**
 * The FACE's frame, not the skull's — for anything that has to stay with the
 * eyes.
 *
 * Glasses are the only accessory that belongs here, and getting it wrong is
 * instantly visible: rims that stay put while the eyes slide away read as a
 * mask floating in front of the character. It inherits the face's own
 * visibility, so a prop in this frame leaves when the face does.
 */
export const facePlane = ({ follow = 'centre' } = {}) => ({
  kind: 'face',
  resolve(S) {
    const F = S._face;
    if (!F || F.vis <= 0.01) return [];
    if (follow === 'eyes') {
      return [{ side: 'near', kind: 'face', vis: F.vis, eyes: [F.eyeL, F.eyeR] }];
    }
    return [{ side: 'near', kind: 'billboard', x: F.cx ?? 0, y: F.cy ?? 0, z: 1,
              rotate: F.lean ?? 0, sx: F.fx ?? 1, sy: 1, vis: F.vis }];
  },
});

/** A point on the head that does not billboard — a button, a stem, a jewel. */
export const headAnchor = ({ at, radius = 1.0, hideBehind = -0.5,
                             sortDepth = true, place = 'transform' }) => ({
  kind: 'anchor',
  resolve(S) {
    const g = S.g || G;
    const p = headPoint(at[0], at[1], at[2], S, radius);
    if (p.z <= g.R * hideBehind) return [];
    /* `sortDepth: false` pins the anchor to the near pass whatever its depth.
       A cap's button is the case: it is allowed to sit a little past the
       horizon and still be part of the crown of the hat, because what is
       behind it is the hat, not the head. */
    return [{ side: !sortDepth || p.z >= 0 ? 'near' : 'far', kind: 'billboard',
              x: p.x, y: p.y, z: p.z, rotate: 0, sx: 1, sy: 1, raw: place === 'size' }];
  },
});

export { clamp, span };
