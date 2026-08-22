/**
 * Geometry and the 2.5D projection.
 *
 * Everything is authored in a 320×320 design space with the origin at the
 * centre. The renderer applies exactly one transform to map that space onto
 * whatever surface it is drawing to, which is why the rig is resolution
 * independent and identical between Canvas and SVG output.
 */
import { clamp } from './math.js';

export const DESIGN = 320;

export const G = {
  R:   100,   // body radius, x
  RY:  104,   // body radius, y

  Rf:   96,   // radius of the sphere FACE features live on
  Rh:  134,   // radius of the sphere HANDS orbit on
  Rs:  124,   // radius of the sphere SPARKS orbit on

  /* Baby schema, applied deliberately: a larger face hole, features set below
     its midline, and eyes big enough to carry a highlight. Those three numbers
     are most of what separates "a circle with a face" from something a five
     year old wants to look at. */
  /* Silhouette shape. `blob: 0` is a plain ellipse — a ball. Above zero the
     outline becomes an egg: narrower and flatter across the top, widest below
     centre, settling onto a broad base. It is a small change in the numbers
     and the whole difference between a creature and a bowling ball. */
  blob:    0.28,  // 0 = ellipse, 1 = full egg. Just enough to stop it reading
  blobLow: 0.10,  // as a sphere, not so much that it stops being the same shape
  footR:   0,     // little feet at the base; 0 = none
  footDX: 34,
  footDY:  4,

  /* The face hole sits LOW and large, not concentric. A light circle dead
     centre in a dark one is a bowling ball — that is the whole gestalt, and no
     amount of work on the face inside it helps. Drop it and the INK stops
     being a ring and starts being hair. */
  faceCY:  26,    // face-hole centre in surface coords
  faceRX:  66,
  faceRY:  67,

  eyeDX:   23,    // eye offset from face centre
  eyeDY:    9,
  eyeR:    16,    // eye arc radius — arcs, stars, winks, spirals
  eyeW:    12,    // eye stroke weight
  /* The resting eye's own radii. Null means "derive them from `eyeR`", which
     is what the rig did when every eye was a dot; naming them separately is
     what lets an eye be TALLER than it is wide without dragging every other
     expression's proportions with it. */
  eyeRX:  null,
  eyeRY:  null,
  mouthDY: 31,
  mouthW:  30,    // resting mouth width
  /* Cheeks, relative to the eye layout — see the note in `drawFace`. */
  blushDX: 15,    // out from the eye
  blushDY:  7,    // down from the eye
  blushRX: 11.5,
  blushRY:  7,

  earSX:   93,    // ears sit on the silhouette, surface coords
  earSY:  -22,
  earR:    31,    // ear radius at full-front
  earRY:    1,    // ear vertical scale (>1 = long and floppy)
  earTilt:  0,    // radians, mirrored per side

  handSX: 106,    // hand rest position, surface coords
  handSY:  44,
  handR:   20,
  handLift: 58,   // how far one unit of `lift` raises a hand

  ground: 126,    // y of the ground-shadow ellipse

  // where the traced letter sits while the character stands aside
  trace: { x: 64, y: 2, cap: 118, shift: -84, scale: 0.68 },

  sparks: [
    { a: Math.asin(56 / 124),  y: -128, rx: 11, ry: 21, rot: 0.32 },
    { a: Math.asin(92 / 124),  y: -103, rx:  9, ry: 17, rot: 0.95 },
    { a: Math.asin(105 / 124), y:  -66, rx:  7, ry: 13, rot: 1.40 },
  ],
};

/**
 * How far features "cheat" inward as the head turns.
 *
 * A true orthographic projection slides features all the way out to the
 * silhouette, where they overhang the body edge and look broken. Animators
 * solve this by pulling the travel in. WRAP_X is that cheat: no effect
 * head-on, ~45% pull-back at full profile. Foreshortening is NOT cheated —
 * it still comes from the real angle — so the squash stays physically
 * correct while the translation stays inside the shape.
 */
/* Raised from 0.45. At 0.45 the fringe at the top of the face patch reached
   past the silhouette between about 30° and 50° of turn — the head is an egg
   and narrows toward the crown, and the patch's travel did not know that. The
   clip in `drawFace` is the guarantee; this is what keeps the clip from ever
   having to bite, because a face cut flat by the outline is no better than one
   hanging off it. */
export const WRAP_X = 0.54;
export const WRAP_Y = 0.30;

/**
 * Project a point from flat "surface coords" (the x/y you would design it at,
 * face-on) onto the rotated sphere.
 *
 * @returns {{x,y,z,fx,fy}} position, depth (>0 = near hemisphere), and the two
 *          foreshortening factors for scaling the feature itself.
 */
export function project(sx, sy, R, yaw, pitch, useWrap = true) {
  const lon = Math.asin(clamp(sx / R, -1, 1)) + yaw;
  const lat = Math.asin(clamp(sy / R, -1, 1)) + pitch;
  const cl  = Math.cos(lat);

  const wx = useWrap ? 1 - WRAP_X * Math.abs(Math.sin(yaw))   : 1;
  const wy = useWrap ? 1 - WRAP_Y * Math.abs(Math.sin(pitch)) : 1;

  return {
    x:  R * Math.sin(lon) * cl * wx,
    y:  R * Math.sin(lat) * wy,
    z:  R * Math.cos(lon) * cl,
    fx: Math.cos(lon),
    fy: Math.cos(lat),
  };
}

/**
 * Project a face feature, anchored to the wrapped position of the face group.
 *
 * Applying the wrap cheat per-feature would squeeze the eyes together on top
 * of the genuine perspective compression, crowding them into a blob near
 * profile. Instead the cheat moves only the group's anchor; features are then
 * laid out around it with the true, uncheated projection. Travel is stylised,
 * internal spacing stays honest.
 */
export function faceProject(sx, sy, yaw, pitch) {
  const aW = project(0, G.faceCY, G.Rf, yaw, pitch, true);
  const a0 = project(0, G.faceCY, G.Rf, yaw, pitch, false);
  const q  = project(sx, sy, G.Rf, yaw, pitch, false);
  return { x: q.x + (aW.x - a0.x), y: q.y + (aW.y - a0.y), z: q.z, fx: q.fx, fy: q.fy };
}

/**
 * How far the FACE is turned, which is not quite how far the head is turned.
 *
 * Physically the visible face at ninety degrees is a sliver: correct, and
 * unreadable — the eye ends up a few dark pixels on a two-pixel band, and the
 * turn gets LESS legible at 75° than at 90°, which reads as a glitch. Every
 * hand-drawn turnaround cheats this: the face lags the head, so a full profile
 * still shows a face's worth of face, pushed hard against the leading edge.
 *
 * The lag is on the foreshortening only. Travel is not cheated here — the
 * anchor still walks all the way out onto the outline — so the head reads as
 * fully turned while the face stays legible.
 */
export const FACE_LAG = 0.22;

export function faceYaw(yaw) {
  return yaw * (1 - FACE_LAG * Math.abs(Math.sin(yaw)));
}

/** The same cheat on the nod, at half strength — a face looking down and away
    goes to a diagonal sliver otherwise, and a sliver is not an expression. */
export function facePitch(pitch) {
  return pitch * (1 - FACE_LAG * 0.5 * Math.abs(Math.sin(pitch)));
}

/**
 * A point of the face patch, placed on the head as a CAP.
 *
 * `project` treats surface x and y as longitude and latitude, which is fine
 * for small features and wrong for a patch this size: a circle in lon/lat is
 * not a circle on a sphere, and the bottom of the face — which sits close to
 * the pole of the face sphere — pinches to a point as the head turns. The
 * patch came out with a tail on it.
 *
 * So the patch is placed the way a sticker actually lies on a ball: take the
 * offset from the face centre in the tangent plane, roll it onto the surface
 * along a great circle, then turn the head. No pinch, because there is no
 * pole in the construction.
 *
 * @returns {{x,y,z}} screen position and depth, in design units
 */
export function capPoint(u, v, yaw, pitch, R = G.Rf) {
  const latC = Math.asin(clamp(G.faceCY / R, -1, 1));
  const cc = Math.cos(latC), sc = Math.sin(latC);

  /* Centre direction C = (0, sin latC, cos latC), and the two directions along
     the surface at that point: e1 to the right, e2 downward. */
  const d = Math.hypot(u, v);
  let X, Y, Z;
  if (d < 1e-6) {
    X = 0; Y = sc; Z = cc;
  } else {
    const th = d / R, ct = Math.cos(th), st = Math.sin(th);
    const mu = u / d, mv = v / d;
    X = mu * st;
    Y = sc * ct + mv * cc * st;
    Z = cc * ct - mv * sc * st;
  }

  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = X * cy + Z * sy, z1 = -X * sy + Z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = Y * cp + z1 * sp, z2 = -Y * sp + z1 * cp;
  return { x: x1 * R, y: y2 * R, z: z2 * R };
}

/**
 * The wrap cheat's group offset — how far `faceProject` moves the whole face
 * away from the true projection. Anything drawn beside the features has to
 * take the same shift or it slides off them as the head turns.
 */
export function faceWrapShift(yaw, pitch) {
  const aW = project(0, G.faceCY, G.Rf, yaw, pitch, true);
  const a0 = project(0, G.faceCY, G.Rf, yaw, pitch, false);
  return { x: aW.x - a0.x, y: aW.y - a0.y };
}

/**
 * The face patch, in SURFACE coordinates — the flat x/y it would be drawn at
 * face-on, before any projection.
 *
 * The patch used to be built in screen space and squashed. That is an affine
 * map, and an affine map preserves relative spacing: the fringe scallops stay
 * evenly spread while the silhouette beside them foreshortens progressively.
 * The two disagree, and the eye reads the disagreement as a flat decal on a
 * round head — which is the complaint, stated in geometry.
 *
 * Built here instead and pushed through the SAME projection the eyes and
 * mouth use, the crowding is not something to model: the far scallops bunch
 * and the near ones spread because that is what the projection does to
 * anything on the surface. The patch cannot disagree with the features,
 * because it is no longer a different kind of object from them.
 *
 * @returns {Array<[number, number]>} closed loop, surface coords
 */
export function facePatchSurface(rx = G.faceRX, ry = G.faceRY, bumps = 0, N = 132) {
  const pts = [];
  const cy = G.faceCY;

  if (!bumps) {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push([rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    return pts;
  }

  /* Break points at the temples, as in the drawn version: the sides stay a
     clean curve and only the hairline is shaped. */
  const a0 = -20 * Math.PI / 180, a1 = 200 * Math.PI / 180;
  const M = Math.round(N * 0.62);
  for (let i = 0; i <= M; i++) {
    const t = a0 + (a1 - a0) * (i / M);
    pts.push([rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }

  const xs = rx * Math.cos(a1), xe = rx * Math.cos(a0);
  const ye = cy + ry * Math.sin(a0);
  const step = (xe - xs) / bumps;
  const per = Math.max(5, Math.round((N - M) / bumps));
  let fromX = xs, fromY = cy + ry * Math.sin(a1);

  for (let i = 0; i < bumps; i++) {
    const px = xs + i * step, nx = px + step;
    const endY = i === bumps - 1 ? ye : cy - ry * 0.66;
    /* The peak rises toward the middle of the face: a flat row of identical
       bumps reads as a zigzag, not as hair. */
    const centreness = 1 - Math.abs((px + nx) / 2) / rx;
    const cx = px + step * 0.5, cty = cy - ry * (0.98 + 0.16 * centreness);
    for (let j = 1; j <= per; j++) {
      const u = j / per, m = 1 - u;
      pts.push([m * m * fromX + 2 * m * u * cx + u * u * nx,
                m * m * fromY + 2 * m * u * cty + u * u * endY]);
    }
    fromX = nx; fromY = endY;
  }
  return pts;
}

/**
 * The character's outline, as a path on a Surface.
 *
 * Exported rather than kept private to the renderer because anything worn on
 * the head has to agree with it exactly. A cap that clips to an ellipse while
 * the head is an egg overhangs the silhouette by a few pixels on each side —
 * small, and instantly reads as a mistake.
 */
export function silhouettePath(s, rx = G.R, ry = G.RY, ox = 0, oy = 0) {
  s.begin();
  silhouetteSub(s, rx, ry, ox, oy);
}

/** The outline as a SUBPATH — no `begin()`, so it can be unioned with others. */
export function silhouetteSub(s, rx = G.R, ry = G.RY, ox = 0, oy = 0) {
  const t = G.blob;
  if (t <= 0) { s.ellipse(ox, oy, rx, ry); return; }
  const top = 1 - 0.30 * t;
  const low = G.blobLow * t;
  const base = 1 - 0.18 * t;
  const yw = oy + ry * low;
  s.move(ox, oy - ry);
  s.cubic(ox + rx * 0.62 * top, oy - ry, ox + rx, oy - ry * 0.42, ox + rx, yw);
  s.cubic(ox + rx, oy + ry * 0.70, ox + rx * base * 0.66, oy + ry, ox, oy + ry);
  s.cubic(ox - rx * base * 0.66, oy + ry, ox - rx, oy + ry * 0.70, ox - rx, yw);
  s.cubic(ox - rx, oy - ry * 0.42, ox - rx * 0.62 * top, oy - ry, ox, oy - ry);
  s.close();
}

/* --------------------------------------------------------------------------
   The profile.

   EXPERIMENT (`S.profile`). Past about sixty degrees the character has nothing
   to look at from the side: the face fades out and what is left is a plain egg
   with a hair whorl on it. A head reads as a head from the side because the
   outline BREAKS — brow, nose, lip, chin. Nothing here broke it, so there was
   no side view, only a back view arriving early.

   It is one offset curve added to the leading edge, sampled off the same
   half-width table the face is fitted against, so the bump always starts
   exactly on the outline however the egg is shaped. Amplitude rides on the
   turn: nothing at all up to about 25°, full by profile, so the front view is
   untouched.
   -------------------------------------------------------------------------- */
const LOBE = (y, at, w) => Math.exp(-(((y - at) / w) ** 2));

/**
 * Outward offset from the outline at height `y`, in design units.
 *
 * Measured from where the FACE is, not from the middle of the head. A nod
 * carries the face down the egg; lobes pinned to fixed heights leave the nose
 * behind on the forehead, which is worse than having no nose at all.
 *
 * The chin lobe sits where the face still reaches at the limb. Put it lower —
 * where a chin belongs on the egg — and it grows past the bottom of the face
 * patch, so the profile ends in a dark hook under a pale face.
 */
export function profileOffset(y, faceY = G.faceCY) {
  const d = y - faceY;
  /* A profile reads as a face because of ALTERNATION — brow, dip, nose, notch,
     chin, at comparable weights. One lobe three times the others is not a
     nose, it is an event, and an event on an outline is a lump. The bridge dip
     is the piece that was missing: convex-concave-convex is what makes a nose
     root, and without it the nose is a spout on a teapot. */
  return 4 * LOBE(d, -26, 18)      // brow
       - 3 * LOBE(d, 6, 8)         // bridge — the dip between brow and nose
       + 10 * LOBE(d, 22, 11.5)    // nose — snub, not a beak
       - 4 * LOBE(d, 30, 8)        // the notch under it, where the mouth is
       + 6 * LOBE(d, 38, 10);      // chin, high enough that the outline is
                                   // still vertical enough to show it
}

/**
 * How much profile there is at this yaw: none head-on, all of it at the limb.
 *
 * Late, deliberately. A nose that starts growing at three-quarter view puts a
 * lump on a cheek that is still facing you, with a stretch of plain head
 * between it and the face — which reads as swelling, not as a profile. It
 * belongs to the last thirty degrees, where the face is at the edge and the
 * nose is the thing breaking it.
 */
export function profileAmount(S) {
  const a = (Math.abs(Math.sin(S.yaw)) - 0.72) / 0.26;
  const ramp = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
  if (ramp <= 0) return 0;

  /* And only while the face is still on THIS side of the limb.

     `sin` alone is symmetric about ninety degrees, so a head turned to 110°
     — showing the back of its skull — scored as much profile as one at 70°,
     and grew a nose on the side of its head. It was invisible until the
     profile became the default, because nothing had rendered past 90°: the
     bug was in the range the contact sheets did not cover. */
  const c = Math.cos(S.yaw);
  const f = (c + 0.12) / 0.12;
  const front = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);

  /* And it backs off under a nod. A head looking down and away has no clean
     profile to draw: the face tips out of the plane the lobes are laid out in,
     and what is left is a nose the face no longer reaches — a dark wedge
     biting into the cheek, which is what shipped for one commit. Both the
     bump and the face's own stretch of the leading edge read this, so they
     cannot disagree about how much nose there is. */
  const q = (Math.abs(S.pitch || 0) - 0.18) / 0.32;
  const nod = q <= 0 ? 1 : q >= 1 ? 0 : 1 - q * q * (3 - 2 * q);
  return ramp * front * nod;
}

/**
 * The brow/nose/chin bump as a SUBPATH, wound the same way as the outline so
 * a nonzero fill unions the two rather than punching one out of the other.
 */
export function profileSub(s, S, k = 1, amt = profileAmount(S), band = null, inset = 10) {
  if (amt <= 0.002) return false;
  const dir = Math.sign(Math.sin(S.yaw)) || 1;
  const faceY = faceProject(0, G.faceCY, S.yaw, S.pitch).y;
  /* `band` narrows the run to the part of the leading edge that is FACE rather
     than head — brow to chin, with the forehead left to the fringe. Filled in
     the face's own colour it is what makes the nose belong to the face; the
     same lobes drawn only in the body colour give a nose growing out of a
     scalp. */
  const y0 = band ? band[0] : faceY - G.RY * 0.87;
  const y1 = band ? band[1] : Math.min(G.RY * 0.94, faceY + G.RY * 0.66);
  const N = 24;
  const at = (y, out) => {
    const half = halfWidthAt(y / k) * k;
    return [dir * (half + out), y];
  };
  /* Down the leading edge on the right, up it on the left — either way the
     winding matches the outline's. */
  const step = (y1 - y0) / N;
  const FADE = 16 * k;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const y = y0 + i * step;
    /* Faded at both ends when the run is a band rather than the whole edge:
       a lobe cut off mid-rise leaves a step in the outline, and a step reads
       as a rendering fault. */
    const t = band
      ? Math.min(1, (y - y0) / FADE) * Math.min(1, (y1 - y) / FADE)
      : 1;
    pts.push(at(y, profileOffset(y / k, faceY) * k * amt * t * t * (3 - 2 * t)));
  }
  /* Sampled, so it has to be smoothed back into a curve on the way out: a
     polyline silhouette is faceted, and facets on an outline this large read as
     a rendering fault long before they read as a nose. */
  /* The way back is INSIDE the head, so the join never shows: the return line
     is the outline itself, pulled in far enough that rounding on the sampled
     bump cannot leave a hairline of background between the two shapes. */
  const back = [];
  for (let i = N; i >= 0; i--) {
    const y = y0 + i * step;
    back.push(at(y, -inset * k));
  }
  const path = dir > 0 ? pts.concat(back) : back.concat(pts).reverse();
  s.move(path[0][0], path[0][1]);
  for (let i = 1; i < path.length - 1; i++) {
    const [x1, yy1] = path[i], [x2, yy2] = path[i + 1];
    s.quad(x1, yy1, (x1 + x2) / 2, (yy1 + yy2) / 2);
  }
  s.line(path[path.length - 1][0], path[path.length - 1][1]);
  s.close();
  return true;
}

/** How far the turn pushes the outline sideways, in design units. */
export const TURN_BULGE = 15;

/**
 * Everything the head actually fills — the outline AND the turn bulge — as one
 * path, so a worn thing can clip to exactly the shape the body paints.
 *
 * Clipping a cap to the outline alone leaves the bulge sticking out bare at
 * every angle except dead-on: a crescent of scalp above the hat, which reads
 * as the hat being too small rather than as a clipping mistake. Both subpaths
 * wind the same way, so a nonzero fill unions them without an even-odd rule.
 */
export function headRegion(s, S, k = 1, withProfile = true) {
  const sy = Math.sin(S.yaw);
  const bulge = Math.abs(sy) * TURN_BULGE;
  s.begin();
  silhouetteSub(s, G.R * k, G.RY * k);
  if (bulge > 0.6) {
    silhouetteSub(s, G.R * 0.93 * k, G.RY * 0.95 * k,
                  -Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10);
  }
  /* And the nose, when there is one. The face is clipped to this region, so
     leaving the profile out of it clips the face to a head that is not the one
     being painted — the nose would be the one part of the head the face is
     forbidden to reach, which is backwards: at profile the nose IS face.

     A hat is a different matter. The nose is not part of the skull a cap sits
     on, and clipping worn things to a region that grows a nose makes them
     twitch as it arrives: `withProfile: false` gives them the plain head. */
  if (S.profile && withProfile) profileSub(s, S, k);
}


/* --------------------------------------------------------------------------
   How wide the head is at a given height.

   Sampled once from the same cubics `silhouetteSub` draws, because the head is
   an egg and every closed-form approximation of it is wrong exactly where it
   matters — the narrowing toward the crown, which is where the face patch kept
   walking off the edge.
   -------------------------------------------------------------------------- */
const HALF_N = 96;
const buildHalfW = () => {
  const t = G.blob, top = 1 - 0.30 * t, low = G.blobLow * t, base = 1 - 0.18 * t;
  const rx = G.R, ry = G.RY, yw = ry * low;
  const bez = (p0, p1, p2, p3, u) => {
    const m = 1 - u;
    return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
  };
  const table = new Float64Array(HALF_N + 1);
  for (let i = 0; i <= 2000; i++) {
    const u = i / 2000;
    for (const [yy, xx] of [
      [bez(-ry, -ry, -ry * 0.42, yw, u), bez(0, rx * 0.62 * top, rx, rx, u)],
      [bez(yw, ry * 0.70, ry, ry, u), bez(rx, rx, rx * base * 0.66, 0, u)],
    ]) {
      const k = Math.round(((yy + ry) / (2 * ry)) * HALF_N);
      if (k >= 0 && k <= HALF_N && xx > table[k]) table[k] = xx;
    }
  }
  return table;
};
let HALF_W = buildHalfW();

/**
 * Proportion presets.
 *
 * The rig is ~15 numbers, so a whole different build of the same character is
 * a table of numbers rather than a fork of the drawing code. `v1` is what
 * shipped; `kawaii` is the squat, wide, bottom-heavy build with taller eyes,
 * a smaller mouth set higher, and cheeks carried low and wide.
 *
 * Applying one rebuilds the half-width table, because the face is fitted
 * against the egg by measurement and the measurement is of THIS egg.
 */
export const SHAPES = {
  v1: {
    R: 100, RY: 104, blob: 0.28, blobLow: 0.10,
    faceCY: 26, faceRX: 66, faceRY: 67, ground: 126,
    eyeDX: 23, eyeDY: 9, eyeR: 16, eyeW: 12, eyeRX: null, eyeRY: null,
    mouthDY: 31, mouthW: 30,
    blushDX: 15, blushDY: 7, blushRX: 11.5, blushRY: 7,
  },
  kawaii: {
    R: 104, RY: 96, blob: 0.34, blobLow: 0.16,
    faceCY: 24, faceRX: 70, faceRY: 62, ground: 118,
    eyeDX: 28, eyeDY: 5, eyeR: 18, eyeW: 8.5, eyeRX: 15, eyeRY: 20.5,
    mouthDY: 27, mouthW: 22,
    blushDX: 18, blushDY: 15, blushRX: 15, blushRY: 8.5,
  },
};

export function applyShape(name) {
  const preset = SHAPES[name];
  if (!preset) throw new Error(`unknown shape: ${name}`);
  Object.assign(G, preset);
  HALF_W = buildHalfW();
  return G;
}

/** The silhouette's half-width at height `y`. 0 above the crown or below the base. */
export function halfWidthAt(y) {
  const f = ((y + G.RY) / (2 * G.RY)) * HALF_N;
  if (f <= 0 || f >= HALF_N) return 0;
  const i = Math.floor(f), t = f - i;
  return HALF_W[i] * (1 - t) + HALF_W[i + 1] * t;
}
