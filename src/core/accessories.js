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

import { G, project, faceProject, silhouettePath } from './geometry.js';
import { smooth, clamp } from './math.js';
import { darken as darkenHex } from './paint.js';

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
      const p = at(-50, -64, S);
      if (p.a <= 0.02) return;
      const col = tint(T, o), knot = o.knot || darkenHex(col, 0.14), R = 26;
      s.save();
      s.alpha(p.a);
      s.translate(p.x, p.y);
      s.rotate(-0.26);
      /* Only the horizontal narrows with the turn. Scaling both axes shrinks a
         bow into a speck the moment the head moves. */
      s.scale(Math.max(0.20, Math.abs(p.fx)), 1);

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
      // tails
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
      const band = o.band || darkenHex(col, 0.18);

      /* The dome is a SEGMENT OF THE HEAD — the same ellipse, arced over the
         top and closed along a chord. Anything else (an ellipse clipped to the
         head, which is what this was) reads as a bowl cut, because a haircut is
         exactly what "a shape filling the top of the head" looks like. Being a
         segment means it hugs the silhouette at every angle for free. */
      /* The dome is the head's own silhouette, clipped to everything above a
         chord. Not an ellipse arc: the head is an egg, and a cap that clips to
         a circle overhangs it by a few pixels either side — small, and it reads
         instantly as a mistake. */
      const chordY = -G.RY * 0.40;

      s.save();
      silhouettePath(s, G.R * 1.005, G.RY * 1.005);
      s.clip();
      s.begin(); s.rect(-G.R * 1.2, -G.RY * 1.2, G.R * 2.4, chordY + G.RY * 1.2); s.fill(col);
      s.begin(); s.rect(-G.R * 1.2, chordY - 9, G.R * 2.4, 11); s.fill(band);
      s.restore();

      /* Button at the crown, nudged with the turn so it stays on the dome. */
      const f = project(0, -30, G.R, S.yaw, S.pitch);
      s.begin(); s.ellipse(f.x * 0.05, -G.RY * 0.86, 7.5, 6.5); s.fill(band);

      /* The brim points where the face points, and is drawn AFTER the dome so
         it sits in front of it. Wider than the head, or it reads as a stripe
         rather than as something projecting off the hat. */
      if (f.z > -18) {
        /* A half-disc, not a lens: clipping the top away leaves the flat edge
           against the band and the curve hanging over the face, which is what
           you actually see of a brim from the front. Opaque until it is nearly
           behind the head — a translucent brim shows the face through it. */
        const behind = clamp((f.z + 18) / 34, 0, 1);
        s.save();
        s.alpha(0.15 + 0.85 * behind);
        s.translate(f.x * 0.52, chordY + 3);
        s.rotate(Math.sin(S.yaw) * 0.13);
        s.begin();
        s.rect(-G.R * 1.3, 0, G.R * 2.6, 60);
        s.clip();
        s.begin();
        s.ellipse(0, 0, G.R * 0.92, 30);
        s.fill(col);
        s.restore();
      }
    },
  },

  /* ---------------------------------------------------------- headphones */
  headphones: {
    z: 'front',
    draw(s, S, T, o = {}) {
      const col = tint(T, o);
      const pad = o.pad || darkenHex(col, 0.20);

      /* The band is the head's own outline, stroked and clipped to the crown.
         Drawn as its own arc it floats above the head at some angles and
         detaches at others; borrowed from the silhouette it cannot. */
      s.save();
      s.begin();
      s.rect(-G.R * 1.4, -G.RY * 1.4, G.R * 2.8, G.RY * 1.4 - G.RY * 0.18);
      s.clip();
      silhouettePath(s, G.R * 1.02, G.RY * 1.02);
      s.stroke(col, 10, 'round', 'round');
      s.restore();

      /* Cups sit on the silhouette at ear height and narrow with the turn; the
         far one passes behind the head. */
      const w = 0.34 + 0.66 * Math.abs(Math.cos(S.yaw));
      for (const side of [-1, 1]) {
        const p = at(side * 96, -12, S, G.R);
        if (p.z < -18) continue;
        s.save();
        s.translate(side * G.R * 0.97 * Math.max(0.34, w), -G.RY * 0.10);
        s.begin(); s.ellipse(0, 0, 19 * Math.max(0.34, w), 25); s.fill(col);
        s.begin(); s.ellipse(0, 0, 11 * Math.max(0.34, w), 15); s.fill(pad);
        s.restore();
      }
    },
  },

  /* --------------------------------------------------------------- crown */
  crown: {
    z: 'front',
    draw(s, S, T, o = {}) {
      const col = o.color || '#FFC94A';
      const gem = o.gem || '#E2664F';
      const p = at(0, -30, S);
      const w = G.R * 0.46 * Math.max(0.22, Math.abs(Math.cos(S.yaw)) * 0.55 + 0.45);
      const baseY = -G.RY * 0.60, tipY = -G.RY * 0.95;

      s.save();
      /* Follows the head round rather than staying pinned to the centre. */
      s.translate(p.x * 0.55, 0);

      /* Points first, then a base band over them: the band hides the joins, so
         the points can be plain triangles instead of one fiddly closed path. */
      for (const k of [-1, 0, 1]) {
        const cx = k * w * 0.62;
        const h = k === 0 ? tipY - 6 : tipY + 7;
        s.begin();
        s.move(cx - w * 0.34, baseY);
        s.line(cx, h);
        s.line(cx + w * 0.34, baseY);
        s.close();
        s.fill(col);
        s.begin(); s.ellipse(cx, h + 3, 4.6, 4.6); s.fill(gem);
      }
      s.begin();
      s.rect(-w, baseY - 9, w * 2, 13);
      s.fill(col);
      s.begin(); s.ellipse(0, baseY - 2, 5, 5); s.fill(gem);
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
