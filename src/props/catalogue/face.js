/**
 * Face props — the ones that belong to the FACE, not to the skull.
 *
 * The distinction is the whole reason `frames.js` separates the two. A cap is
 * on the head: it follows the skull's true rotation. Glasses are on the face:
 * they follow the face's own wrap and inherit its visibility, so they leave
 * when it does. Get it the wrong way round and rims stay put while the eyes
 * slide away — a mask floating in front of the character.
 *
 * This is also the first use of the escape hatch. Eyewear reads off the two
 * eye anchors and strokes between them, which is not a shape tree; the plan
 * budgets ten to fifteen custom renderers out of seventy-five, and this is one
 * of them. Note that it still declares its slot, footprint, passes, materials
 * and checks like everything else — the escape hatch is for the drawing, never
 * for the metadata.
 */

import { defineProp } from '../registry.js';
import { facePlane } from '../frames.js';
import { G } from '../../core/geometry.js';

defineProp({
  id: 'glasses',
  kind: 'wearable',
  slot: 'face',
  occupies: ['face.eyes'],
  passes: ['faceFront'],
  z: 10,
  overrides: { ink: 'color' },
  checks: { visibility: 'face', minReadableSize: 48, contrastAgainst: 'face' },
  parts: [{
    frame: facePlane({ follow: 'eyes' }),
    art(s, p, ctx, S) {
      const g = S.g || G;
      const col = ctx.col('ink');
      /* Sized off the EYE, not off `eyeR`. On a build with big eyes a lens
         pegged to the arc radius lands inside them, and the character ends up
         wearing its own pupils. */
      const rest = g.eyeRX ?? g.eyeR * 0.58;
      const r = Math.max(g.eyeR * 1.35, rest * 1.5);
      const [eyeL, eyeR] = p.eyes;

      s.save();
      s.alpha(p.vis * 0.95);

      /* The bridge is drawn between the two eye anchors rather than at a fixed
         width: at three-quarter view the eyes are closer together, and a fixed
         bridge would visibly detach. */
      s.begin();
      s.move(eyeL.x + r * eyeL.fx * 0.9, eyeL.y);
      s.line(eyeR.x - r * eyeR.fx * 0.9, eyeR.y);
      s.stroke(col, 4);

      for (const e of [eyeL, eyeR]) {
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
  }],
});
