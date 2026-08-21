/**
 * Paint descriptors.
 *
 * `fill()` and `stroke()` take their paint as an argument rather than reading
 * mutable context state — that is what lets one set of drawing calls feed both
 * backends. A colour string was enough while everything was flat. Shading
 * needs gradients, and a gradient must mean *exactly* the same thing on canvas
 * and in exported SVG or the two outputs drift, which is the one failure this
 * architecture exists to prevent.
 *
 * So a paint is either a CSS colour string or a plain, serialisable object:
 *
 *   { type: 'linear', x0, y0, x1, y1, stops: [[offset, colour], …] }
 *   { type: 'radial', cx, cy, r, fx?, fy?, stops: [[offset, colour], …] }
 *
 * Coordinates are in the **current user space** — the same space as the path
 * being filled. Canvas gets that for free (gradient coordinates are baked
 * through the CTM at creation); the SVG backend uses
 * `gradientUnits="userSpaceOnUse"` on an element that already carries the same
 * matrix, which resolves to the same place.
 *
 * Being plain data also keeps the rig deterministic: a paint can be hashed,
 * snapshotted and diffed like any other geometry.
 */

/**
 * An alpha, rounded.
 *
 * A computed opacity goes into the SVG as whatever the host's float printer
 * decides to emit, and two machines do not always agree on the last digit:
 * `0.09676626564305739` here, `0.0967662656430574` there. Nothing looks
 * different — but the exported file differs byte for byte, which turns a
 * snapshot suite into a machine-detector. Four places is finer than any screen
 * can show and identical everywhere.
 */
export const alpha = a => +(+a).toFixed(4);

export const isGradient = p => !!p && typeof p === 'object' && Array.isArray(p.stops);

/** Stable key for caching and de-duplication. */
export function paintKey(p) {
  if (!isGradient(p)) return String(p);
  const nums = p.type === 'linear'
    ? [p.x0, p.y0, p.x1, p.y1]
    : [p.cx, p.cy, p.r, p.fx ?? p.cx, p.fy ?? p.cy];
  return p.type + ':' + nums.map(v => (+v).toFixed(2)).join(',') + ':' +
         p.stops.map(([o, c]) => `${(+o).toFixed(3)}${c}`).join('|');
}

/**
 * Two-stop vertical gradient across a box — the shading the character uses
 * almost everywhere, expressed once so the numbers are not scattered.
 */
export function vertical(top, bottom, y0, y1, mid) {
  const stops = mid
    ? [[0, top], [0.55, mid], [1, bottom]]
    : [[0, top], [1, bottom]];
  return { type: 'linear', x0: 0, y0, x1: 0, y1, stops };
}

/** Off-centre highlight, the way a soft light source reads on a round body. */
export function sheen(cx, cy, r, inner, outer, fx = cx, fy = cy) {
  return { type: 'radial', cx, cy, r, fx, fy, stops: [[0, inner], [1, outer]] };
}

/**
 * The form light.
 *
 * One light for the whole character, fixed in world space and never attached
 * to the turn — a highlight that swings with the yaw reads as a moving lamp,
 * and the point of having form at all is to give the face something to travel
 * ACROSS. Anything worn takes the same light at a lower strength, because a
 * flat hat on a shaded head is exactly the sticker problem the shading was
 * added to solve.
 *
 * Three stops, not two. The mid stop is where the light runs out; without it
 * the terminator starts at the highlight and a sphere comes out looking like a
 * gradient swatch.
 */
export function formLight(r, { lit = 0.13, dark = 0.26, cx = -0.34, cy = -0.40,
                               spread = 1.62, mid = 0.42 } = {}) {
  return {
    type: 'radial',
    cx: cx * r, cy: cy * r, r: r * spread,
    stops: [
      [0,   `rgba(255,255,255,${alpha(lit)})`],
      [mid, 'rgba(255,255,255,0)'],
      [1,   `rgba(0,0,0,${alpha(dark)})`],
    ],
  };
}

/** Mix two hex colours. Small, exact, and dependency-free. */
export function mix(a, b, t) {
  const parse = h => {
    const s = h.replace('#', '');
    const v = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a), [r2, g2, b2] = parse(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Lighten/darken towards white/black by `t`. */
export const lighten = (hex, t) => mix(hex, '#FFFFFF', t);
export const darken   = (hex, t) => mix(hex, '#000000', t);
