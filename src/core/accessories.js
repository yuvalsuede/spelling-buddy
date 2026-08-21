/**
 * Accessories.
 *
 * Everything here is positioned on the same sphere as the face, so the turn
 * carries it for free: a bow swings round the head, glasses foreshorten and
 * slide with the eyes, a cap passes behind the silhouette. Nothing needs a
 * per-accessory special case for the turn, because the turn is not something
 * accessories participate in — it is something the coordinate system does.
 *
 * Each entry declares:
 *   z      'front' draws over the head, 'back' behind it
 *   draw   (surface, state, theme) — plain drawing, same Surface API as the rig
 *
 * Adding one is a draw function and a name. There is no registry of poses to
 * update and no sprite to re-export, which is the whole point of the character
 * being mathematics.
 */

import { G, project, faceProject } from './geometry.js';
import { smooth, clamp } from './math.js';

/* A point on the head's own sphere, with its foreshortening and a fade that
   carries it off the terminator instead of popping. */
function at(sx, sy, S, R = G.R) {
  const p = project(sx, sy, R, S.yaw, S.pitch);
  return { ...p, a: smooth(-0.05, 0.25, p.z / R) };
}

/* Worn things need to read against the head, and the head is usually the
   darkest thing on screen. Defaulting to the spark colour puts blue on a blue
   character; a warm accent contrasts with every skin in the set. */
const tint = (T, o) => o.color || T.accent || '#FFC94A';

export const ACCESSORIES = {
  /* ------------------------------------------------------------- glasses */
  glasses: {
    z: 'front',
    draw(s, S, T, o = {}) {
      const F = S._face;
      if (!F || F.vis <= 0.01) return;
      const col = o.color || T.feature;
      const r = G.eyeR * 1.35;
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
    z: 'front',
    draw(s, S, T, o = {}) {
      const p = at(-50, -66, S);
      if (p.a <= 0.02) return;
      const col = tint(T, o), R = 27;
      s.save();
      s.alpha(p.a);
      s.translate(p.x, p.y);
      s.rotate(-0.3);
      /* Only the horizontal narrows with the turn. Scaling both axes shrinks a
         bow into a speck the moment the head moves. */
      s.scale(Math.max(0.18, Math.abs(p.fx)), 1);
      for (const side of [-1, 1]) {
        s.save();
        s.translate(side * R * 0.78, 0);
        s.rotate(side * 0.42);
        s.begin(); s.ellipse(0, 0, R * 0.80, R * 0.52); s.fill(col);
        s.restore();
      }
      s.begin(); s.ellipse(0, 0, R * 0.30, R * 0.30); s.fill(col);
      s.restore();
    },
  },

  /* -------------------------------------------------------------- flower */
  flower: {
    z: 'front',
    draw(s, S, T, o = {}) {
      const p = at(-56, -70, S);
      if (p.a <= 0.02) return;
      const col = o.color || '#F26D8B', R = 16;
      s.save();
      s.alpha(p.a);
      s.translate(p.x, p.y);
      s.scale(Math.max(0.18, Math.abs(p.fx)), 1);
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
    z: 'front',
    draw(s, S, T, o = {}) {
      const col = tint(T, o);
      const c = at(0, -80, S);
      if (c.a <= 0.02) return;
      s.save();
      s.alpha(c.a);
      /* Clipped to the head so the crown can be a simple ellipse and still sit
         on the silhouette at every angle. */
      s.begin(); s.ellipse(0, 0, G.R, G.RY); s.clip();
      s.begin(); s.ellipse(c.x, c.y + 26, G.R * 0.96, G.RY * 0.62); s.fill(col);
      s.restore();

      // peak, on the side the head is facing
      const dir = Math.sin(S.yaw) >= 0 ? 1 : -1;
      const b = at(dir * 52, -48, S);
      if (b.a > 0.02) {
        s.save();
        s.alpha(b.a);
        s.translate(b.x, b.y);
        s.scale(Math.max(0.08, Math.abs(b.fx)) * dir, 1);
        s.begin(); s.ellipse(30, 0, 44, 13); s.fill(col);
        s.restore();
      }
    },
  },

  /* ---------------------------------------------------------- headphones */
  headphones: {
    z: 'front',
    draw(s, S, T, o = {}) {
      const col = tint(T, o);
      /* The band is an arc over the crown, narrowed with the turn. Sampling it
         along the sphere at a fixed latitude gives a straight bar, which reads
         as a helmet rather than as a headband. */
      const w = 0.30 + 0.70 * Math.abs(Math.cos(S.yaw));
      s.save();
      s.begin();
      s.ellipse(0, -S.pitch * 18, G.R * 1.03 * w, G.RY * 1.03, 0, Math.PI * 1.06, Math.PI * 1.94);
      s.stroke(col, 9);
      s.restore();

      /* Cups ride the silhouette, and the far one hides behind the head. */
      for (const side of [-1, 1]) {
        const p = at(side * 97, -14, S, G.R);
        if (p.z < -10) continue;
        s.save();
        s.translate(side * G.R * 1.0 * Math.max(0.30, w), p.y);
        s.begin();
        s.ellipse(0, 0, 16 * Math.max(0.30, w), 22);
        s.fill(col);
        s.restore();
      }
    },
  },

  /* --------------------------------------------------------------- crown */
  crown: {
    z: 'front',
    draw(s, S, T, o = {}) {
      const col = o.color || '#FFC94A';
      const p = at(0, -76, S);
      if (p.a <= 0.02) return;
      const w = 34 * Math.max(0.18, Math.abs(p.fx)), h = 26;
      s.save();
      s.alpha(p.a);
      s.translate(p.x, p.y - 4);
      s.begin();
      s.move(-w, h * 0.42);
      s.line(-w, -h * 0.30); s.line(-w * 0.5, h * 0.10);
      s.line(0, -h * 0.62);  s.line(w * 0.5, h * 0.10);
      s.line(w, -h * 0.30);  s.line(w, h * 0.42);
      s.close();
      s.fill(col);
      s.restore();
    },
  },
};

export const ACCESSORY_NAMES = Object.keys(ACCESSORIES);

export function drawAccessories(s, S, T, where) {
  const list = S.accessories;
  if (!list || !list.length) return;
  for (const item of list) {
    const name = typeof item === 'string' ? item : item.name;
    const a = ACCESSORIES[name];
    if (!a || a.z !== where) continue;
    s.save();
    a.draw(s, S, T, typeof item === 'string' ? {} : item);
    s.restore();
  }
}
