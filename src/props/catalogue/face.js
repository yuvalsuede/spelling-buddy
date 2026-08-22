/**
 * Face props — the ones that belong to the FACE, not to the skull.
 *
 * The distinction is the whole reason `frames.js` separates the two. A cap is
 * on the head: it follows the skull's true rotation. Glasses are on the face:
 * they follow the face's own wrap and inherit its visibility, so they leave
 * when it does. Get it the wrong way round and rims stay put while the eyes
 * slide away — a mask floating in front of the character.
 *
 * All eight are one primitive with a different lens, which is why they share
 * `eyewear()`. What that primitive knows, and no variant has to:
 *
 *  - **Size off the EYE, not off `eyeR`.** On a build with big eyes a lens
 *    pegged to the arc radius lands inside them and the character ends up
 *    wearing its own pupils.
 *  - **The bridge is drawn between the two eye anchors**, not at a fixed
 *    width: at three-quarter view the eyes are closer together, and a fixed
 *    bridge visibly detaches.
 *  - **Each lens takes its own eye's alpha and foreshortening**, so a lens
 *    narrows and leaves exactly when the eye under it does.
 *
 * The one rule every variant obeys: **nothing opaque over a pupil.** Eyes are
 * where this character's entire expressive range lives; sunglasses that black
 * them out do not make a cool character, they make a character that cannot
 * act. The dark lenses are a tint, and the pupils read straight through them.
 */

import { defineProp } from '../registry.js';
import { facePlane } from '../frames.js';
import { G } from '../../core/geometry.js';

/**
 * One piece of eyewear.
 *
 * `lens(s, e, r, ctx, col)` draws one lens around an eye anchor `e` at radius
 * `r`, already inside that eye's alpha. Everything else — the frame, the
 * bridge, visibility, foreshortening — is here.
 */
const eyewear = (id, o = {}) => defineProp({
  id,
  kind: 'wearable',
  slot: 'face',
  occupies: ['face.eyes'],
  passes: ['faceFront'],
  z: o.z ?? 10,
  overrides: { ink: 'color', ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: 'face', minReadableSize: 48, contrastAgainst: 'face' },
  parts: [{
    frame: facePlane({ follow: 'eyes' }),
    art(s, p, ctx, S) {
      const g = S.g || G;
      const col = ctx.col(o.role || 'ink');
      const rest = g.eyeRX ?? g.eyeR * 0.58;
      const r = Math.max(g.eyeR * 1.35, rest * 1.5) * (o.scale ?? 1);
      const [eyeL, eyeR] = p.eyes;

      s.save();
      s.alpha(p.vis * 0.95);

      if (o.bridge !== false) {
        s.begin();
        s.move(eyeL.x + r * eyeL.fx * (o.bridgeGap ?? 0.9), eyeL.y + (o.bridgeY ?? 0));
        s.line(eyeR.x - r * eyeR.fx * (o.bridgeGap ?? 0.9), eyeR.y + (o.bridgeY ?? 0));
        s.stroke(col, o.bridgeW ?? 4);
      }

      const eyes = o.single ? [eyeR] : [eyeL, eyeR];
      for (const e of eyes) {
        if (e.a <= 0.02) continue;
        s.save();
        s.alpha(e.a);
        if (o.lens) o.lens(s, e, r, ctx, col);
        else {
          s.begin();
          s.ellipse(e.x, e.y, r * Math.max(0.06, e.fx), r * e.fy);
          s.stroke(col, 4.4);
        }
        s.restore();
      }

      if (o.extra) o.extra(s, p, r, ctx, col);
      s.restore();
    },
  }],
});

/* The original: a soft oval rim. Unchanged, and the snapshots prove it. */
eyewear('glasses');

/* ------------------------------------------------------------ rim shapes */

eyewear('round-glasses', {
  scale: 1.06,
  lens(s, e, r, ctx, col) {
    /* A true circle, so the vertical radius follows the horizontal one rather
       than the eye's own aspect — that is what makes round glasses read as
       round instead of as the default rim slightly changed. */
    const rx = r * Math.max(0.06, e.fx);
    s.begin(); s.ellipse(e.x, e.y, rx, r * 0.98 * e.fy); s.stroke(col, 3.6);
  },
});

eyewear('square-glasses', {
  scale: 1.02,
  lens(s, e, r, ctx, col) {
    const w = r * Math.max(0.06, e.fx) * 2, h = r * e.fy * 1.7, rad = Math.min(5, w / 2, h / 2);
    s.begin();
    s.move(e.x - w / 2 + rad, e.y - h / 2);
    s.line(e.x + w / 2 - rad, e.y - h / 2); s.quad(e.x + w / 2, e.y - h / 2, e.x + w / 2, e.y - h / 2 + rad);
    s.line(e.x + w / 2, e.y + h / 2 - rad); s.quad(e.x + w / 2, e.y + h / 2, e.x + w / 2 - rad, e.y + h / 2);
    s.line(e.x - w / 2 + rad, e.y + h / 2); s.quad(e.x - w / 2, e.y + h / 2, e.x - w / 2, e.y + h / 2 - rad);
    s.line(e.x - w / 2, e.y - h / 2 + rad); s.quad(e.x - w / 2, e.y - h / 2, e.x - w / 2 + rad, e.y - h / 2);
    s.close();
    s.stroke(col, 4.2);
  },
});

/* ------------------------------------------------------------ fun shapes */

eyewear('heart-glasses', {
  scale: 1.14,
  defaults: { ink: '#F26D8B' },
  lens(s, e, r, ctx, col) {
    const w = r * Math.max(0.06, e.fx) * 2, h = r * e.fy * 1.75;
    s.begin();
    s.move(e.x, e.y + h * 0.48);
    s.cubic(e.x - w * 0.62, e.y + h * 0.02, e.x - w * 0.50, e.y - h * 0.58, e.x, e.y - h * 0.18);
    s.cubic(e.x + w * 0.50, e.y - h * 0.58, e.x + w * 0.62, e.y + h * 0.02, e.x, e.y + h * 0.48);
    s.close();
    s.stroke(col, 4);
  },
});

eyewear('star-glasses', {
  scale: 1.20,
  defaults: { ink: '#F2B33D' },
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx), ry = r * e.fy;
    s.begin();
    for (let i = 0; i < 10; i++) {
      const k = i % 2 ? 0.46 : 1;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = e.x + Math.cos(a) * rx * k, py = e.y + Math.sin(a) * ry * k;
      i ? s.line(px, py) : s.move(px, py);
    }
    s.close();
    s.stroke(col, 3.4);
  },
});

/**
 * Sunglasses.
 *
 * Tinted, never opaque. A filled black lens is the one thing eyewear on this
 * character must not do: the eyes carry every expression it has, and blacking
 * them out costs more than the prop is worth. The pupils read through.
 */
eyewear('sun-glasses', {
  scale: 1.10,
  defaults: { ink: '#3A3742' },
  bridgeW: 5,
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx), ry = r * e.fy * 0.98;
    s.save();
    s.alpha(0.42);
    s.begin(); s.ellipse(e.x, e.y, rx, ry); s.fill(col);
    s.restore();
    s.begin(); s.ellipse(e.x, e.y, rx, ry); s.stroke(col, 4.4);
  },
});

/**
 * Safety goggles: one wide lens across both eyes, plus the strap.
 *
 * The strap is what makes goggles goggles rather than large glasses, and it
 * has to leave the face at the sides — so it is drawn from the outer edge of
 * each lens outward, and it foreshortens with that eye like everything else.
 */
eyewear('safety-goggles', {
  scale: 1.16,
  defaults: { ink: '#5FA85C' },
  bridge: false,
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx) * 1.12, ry = r * e.fy * 1.05;
    s.save();
    s.alpha(0.28);
    s.begin(); s.ellipse(e.x, e.y, rx, ry); s.fill('#FFFFFF');
    s.restore();
    s.begin(); s.ellipse(e.x, e.y, rx, ry); s.stroke(col, 5.2);
  },
  extra(s, p, r, ctx, col) {
    const [eyeL, eyeR] = p.eyes;
    s.begin();
    s.move(eyeL.x + r * eyeL.fx * 1.05, eyeL.y);
    s.line(eyeR.x - r * eyeR.fx * 1.05, eyeR.y);
    s.stroke(col, 5.2);
    for (const [e, side] of [[eyeL, -1], [eyeR, 1]]) {
      if (e.a <= 0.02) continue;
      s.begin();
      s.move(e.x + side * r * e.fx * 1.2, e.y);
      s.line(e.x + side * (r * e.fx * 1.2 + 14), e.y - 3);
      s.stroke(col, 4.5);
    }
  },
});

/**
 * A monocle: one lens, and a chain that falls under gravity.
 *
 * The chain does NOT follow the face's lean — it hangs. Everything else on
 * this character rotates with something; a chain is the exception, and getting
 * that wrong makes it read as a wire soldered to the frame.
 */
eyewear('monocle', {
  scale: 1.12,
  single: true,
  bridge: false,
  defaults: { ink: '#C8A24A' },
  lens(s, e, r, ctx, col) {
    s.begin();
    s.ellipse(e.x, e.y, r * Math.max(0.06, e.fx), r * e.fy);
    s.stroke(col, 4.8);
  },
  extra(s, p, r, ctx, col) {
    const e = p.eyes[1];
    if (e.a <= 0.02) return;
    const x = e.x + r * e.fx * 0.6, y = e.y + r * e.fy;
    s.begin();
    s.move(x, y);
    s.cubic(x + 6, y + 14, x + 2, y + 24, x - 4, y + 32);
    s.stroke(col, 2.6);
  },
});
