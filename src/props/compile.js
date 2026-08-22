/**
 * The compiler.
 *
 * A prop definition is data: parts, each with a frame and a shape tree. This
 * turns one into the `draw(surface, state, theme, options, where)` function the
 * renderer already knows how to call — so a compiled prop and a hand-written
 * one are indistinguishable downstream, and every existing invariant runs
 * against both without being told which is which.
 *
 * What the compiler owns, so that no item author has to:
 *
 *  - projection and which pass a part lands in
 *  - foreshortening across the turn, and the floor under it
 *  - clipping a hat's crown to the head's actual outline (which is an egg, and
 *    a hat clipped to a circle overhangs it by a few pixels either side —
 *    small, and it reads instantly as a mistake)
 *  - the form light, at worn strength
 *  - the outline pass, per shape rather than per item
 *  - material roles
 *
 * Those are the four things that took several attempts each on the original
 * six accessories. They are now written down once.
 */

import { G, headRegion } from '../core/geometry.js';
import { formLight } from '../core/paint.js';
import { palette } from './materials.js';
import { paintShape } from './shapes.js';

/* Worn things take the character's own light at about two-thirds strength:
   they are smaller and much lighter than the head, so the full terminator
   turns a yellow cap into a brown one. */
export const WORN = { lit: 0.16, dark: 0.17 };

const strokePath = (s, pts, close) => {
  s.begin();
  pts.forEach((p, i) => (i ? s.line(p.x, p.y) : s.move(p.x, p.y)));
  if (close) s.close();
};

/**
 * Compile a definition into a drawable.
 *
 * Returns `{ draw }`, matching the accessory interface exactly.
 */
export function compileProp(def) {
  const parts = def.parts || [];

  return {
    def,
    draw(s, S, T, o = {}, where) {
      const g = S.g || G;
      const col = palette(T, o, def.overrides || {}, def.defaults || {});
      const want = where === 'front' ? 'near' : 'far';
      const gloss = def.gloss === false ? null : formLight(g.R, WORN);

      /* Consecutive parts that want the same clip share ONE clip block.
         A cap's dome and its band are the case: both are clipped to the head's
         real outline, and opening the clip twice puts them in two groups —
         which draws the same pixels and is a different document, so the port
         check that compares this against the hand-written drawing byte for
         byte would never go green. It also says something true: they are
         clipped together because they are one hat. */
      let open = null;
      const clipFor = part => part.clip ?? part.frame.clipToHead ?? null;
      const closeClip = () => { if (open !== null) { s.restore(); open = null; } };

      for (const part of parts) {
        const frame = part.frame;
        const placements = frame.resolve(S, T) || [];
        const mine = placements.filter(p => p.side === want);
        if (!mine.length) continue;

        const wantClip = clipFor(part);
        if (wantClip !== open) {
          closeClip();
          if (wantClip !== null) {
            s.save();
            headRegion(s, S, wantClip, false);
            s.clip();
            open = wantClip;
          }
        }

        /* A part may swap its own materials — a cap's brim is its accent
           darkened, and the part says so rather than the shape tree carrying
           a second copy of the palette. */
        const ctx = { col: role => col(part.material?.[role] || role),
                      contour: s.contour === true,
                      gloss: part.gloss === false ? null : gloss };

        /* A part may paint its far side differently. The cap is the reason: the
           only thing you see of a cap from behind is the peak showing past the
           far edge, and it is the brim's darker colour, not the crown's. */
        const fillFor = p => (p.side === 'far' && part.fillFar) || part.fill || 'accent';
        const glossOn = p => ctx.gloss && !ctx.contour &&
                             !(part.gloss === 'near' && p.side === 'far');

        for (const p of mine) {
          if (p.kind === 'poly') {
            strokePath(s, p.pts, true);
            s.fill(ctx.col(fillFor(p)));
            if (glossOn(p)) {
              strokePath(s, p.pts, true);
              s.fill(ctx.gloss);
            }
          } else if (p.kind === 'stroke') {
            if (ctx.contour && part.outline === 'none') continue;
            strokePath(s, p.pts, p.close);
            s.stroke(ctx.col(fillFor(p)), p.width, p.cap || 'round', p.join || 'round');
            if (glossOn(p)) {
              strokePath(s, p.pts, p.close);
              s.stroke(ctx.gloss, p.width, p.cap || 'round', p.join || 'round');
            }
          } else if (p.kind === 'billboard') {
            const art = typeof part.art === 'function' ? part.art(p, S, T, o) : part.art;
            if (!art) continue;
            s.save();
            if (p.vis !== undefined) s.alpha(p.vis);
            /* `raw` means the frame foreshortened by changing the art's SIZE
               rather than by scaling it. The difference matters on an outlined
               skin: a scale transform squashes the contour stroke along with
               the shape, so a headphone cup at three-quarter view would get a
               thick edge on one axis and a thin one on the other. */
            if (!p.raw) {
              s.translate(p.x, p.y);
              if (p.rotate) s.rotate(p.rotate);
              s.scale(p.sx ?? 1, p.sy ?? 1);
            }
            paintShape(s, art, ctx);
            s.restore();
          } else if (p.kind === 'face') {
            const art = part.art;
            if (typeof art === 'function') art(s, p, ctx, S, T, o);
          }
        }
      }

      closeClip();
    },
  };
}
