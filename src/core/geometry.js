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
  eyeR:    16,    // eye arc radius
  eyeW:    12,    // eye stroke weight
  mouthDY: 31,

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
export const WRAP_X = 0.45;
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
export function headRegion(s, S, k = 1) {
  const sy = Math.sin(S.yaw);
  const bulge = Math.abs(sy) * TURN_BULGE;
  s.begin();
  silhouetteSub(s, G.R * k, G.RY * k);
  if (bulge > 0.6) {
    silhouetteSub(s, G.R * 0.93 * k, G.RY * 0.95 * k,
                  -Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10);
  }
}
