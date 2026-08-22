/**
 * The 2D shapes a prop is drawn from.
 *
 * These are DESCRIPTIONS, not drawing calls: a nested plain-object tree that
 * the compiler paints once per pass. Keeping them inert is what buys the three
 * things a hand-written `draw()` cannot give:
 *
 *  - **The outline is per shape, not per item.** The contour pass used to
 *    stroke every fill an item made, which meant the knot of a bow and the gem
 *    of a crown got an outline too — a different drawing at small sizes. A
 *    shape declares `outline: 'outer'` (it is part of the silhouette) or
 *    `'none'` (it is an internal detail), and the compiler honours it.
 *  - **A prop can be inspected without being drawn.** The registry checks that
 *    every fill is a material role and that nothing is smaller than the
 *    minimum readable size, by walking the tree. No renderer involved.
 *  - **`repeat` and `mirror` are one line.** Five petals, eight points, a pair
 *    of anything: the shapes that make a catalogue are mostly the same shape
 *    said several times.
 *
 * Coordinates are local to the shape's placement, in screen pixels at rest,
 * y down. The frame owns everything about where that placement is.
 */

/* --------------------------------------------------------------- helpers */

const node = (type, o) => ({ type, x: 0, y: 0, fill: 'accent', outline: 'outer', ...o });

/** A shape tree, optionally transformed as a whole. */
export const group = (children, o = {}) =>
  ({ type: 'group', x: 0, y: 0, rotate: 0, sx: 1, sy: 1, ...o, children: children.filter(Boolean) });

/** `n` copies of a shape, `f(i, n)` returning each. */
export const repeat = (n, f, o = {}) =>
  group(Array.from({ length: n }, (_, i) => f(i, n)), o);

/** The same shape on both sides of the local y axis. `f(side)` gets ±1. */
export const mirror = (f, o = {}) => group([f(-1), f(1)], o);

/** `n` copies spaced evenly around a circle of radius `r`. `f(angle, i)`. */
export const around = (n, r, f, o = {}) =>
  group(Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (o.phase || 0);
    const child = f(a, i);
    return { ...child, x: (child.x || 0) + Math.cos(a) * r, y: (child.y || 0) + Math.sin(a) * r };
  }), o);

/* ---------------------------------------------------------------- shapes */

export const ellipse = o => node('ellipse', { ry: o.rx, ...o });
export const circle  = o => node('ellipse', { ry: o.r, rx: o.r, ...o });

export const roundedRect = o => node('rrect', { r: 6, ...o });

/** A star. `points` spikes, alternating `outer` and `inner` radius. */
export const star = o => node('star', { points: 5, rotate: 0, inner: o.outer * 0.44, ...o });

/** A heart, `size` wide. Two lobes and a point — one cubic per side. */
export const heart = o => node('heart', { size: 20, rotate: 0, ...o });

/** A flower head: `petals` round petals around a hub. Petal fill only. */
export const rosette = o =>
  around(o.petals ?? 5, o.r ?? 16, () => circle({ r: o.petalR ?? (o.r ?? 16) * 0.72, fill: o.fill ?? 'accent', outline: o.outline ?? 'outer' }), { x: o.x || 0, y: o.y || 0 });

/** A closed polygon through explicit points: `[[x, y], …]`. */
export const polygon = o => node('poly', o);

/**
 * An explicit path, as a command list — the escape hatch for a shape that is
 * not any of the above. `['M', x, y] ['L', x, y] ['C', …6] ['Q', …4] ['Z']`.
 */
export const path = o => node('path', { cmds: [], ...o });

/** An open stroked curve. `width` is in pixels at rest. */
export const line = o =>
  node('line', { width: 4, cap: 'round', join: 'round', fill: null, stroke: 'accent', outline: 'none', ...o });

/* ---------------------------------------------------------------- paint */

const RRECT = (s, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2);
  s.begin();
  s.move(x - w / 2 + rr, y - h / 2);
  s.line(x + w / 2 - rr, y - h / 2); s.quad(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + rr);
  s.line(x + w / 2, y + h / 2 - rr); s.quad(x + w / 2, y + h / 2, x + w / 2 - rr, y + h / 2);
  s.line(x - w / 2 + rr, y + h / 2); s.quad(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - rr);
  s.line(x - w / 2, y - h / 2 + rr); s.quad(x - w / 2, y - h / 2, x - w / 2 + rr, y - h / 2);
  s.close();
};

const STAR = (s, n, { x, y, outer, inner, points, rotate }) => {
  s.begin();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2 + rotate;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? s.line(px, py) : s.move(px, py);
  }
  s.close();
};

const HEART = (s, { x, y, size, rotate }) => {
  const w = size, h = size * 0.92;
  const pt = (px, py) => {
    if (!rotate) return [x + px, y + py];
    const c = Math.cos(rotate), sn = Math.sin(rotate);
    return [x + px * c - py * sn, y + px * sn + py * c];
  };
  s.begin();
  s.move(...pt(0, h * 0.52));
  s.cubic(...pt(-w * 0.62, h * 0.02), ...pt(-w * 0.52, -h * 0.62), ...pt(0, -h * 0.20));
  s.cubic(...pt(w * 0.52, -h * 0.62), ...pt(w * 0.62, h * 0.02), ...pt(0, h * 0.52));
  s.close();
};

/**
 * Paint one shape tree.
 *
 * `ctx.col(role)` resolves a material; `ctx.contour` is true on the outline
 * pass, where shapes that declared `outline: 'none'` are skipped entirely —
 * that is the whole mechanism that keeps a contour off a gem.
 */
export function paintShape(s, n, ctx) {
  if (!n) return;
  if (ctx.contour && n.outline === 'none') return;

  if (n.type === 'group') {
    const moved = n.x || n.y || n.rotate || n.sx !== 1 || n.sy !== 1;
    if (moved) {
      s.save();
      s.translate(n.x || 0, n.y || 0);
      if (n.rotate) s.rotate(n.rotate);
      if (n.sx !== 1 || n.sy !== 1) s.scale(n.sx ?? 1, n.sy ?? 1);
    }
    for (const c of n.children) paintShape(s, c, ctx);
    if (moved) s.restore();
    return;
  }

  switch (n.type) {
    case 'ellipse': s.begin(); s.ellipse(n.x, n.y, Math.abs(n.rx), Math.abs(n.ry), n.rotate || 0); break;
    case 'rrect':   RRECT(s, n.x, n.y, n.w, n.h, n.r); break;
    case 'star':    STAR(s, n, n); break;
    case 'heart':   HEART(s, n); break;
    case 'poly':
      s.begin();
      n.pts.forEach(([px, py], i) => (i ? s.line(n.x + px, n.y + py) : s.move(n.x + px, n.y + py)));
      s.close();
      break;
    case 'path':
      s.begin();
      for (const c of n.cmds) {
        const [k, ...a] = c;
        if (k === 'M') s.move(n.x + a[0], n.y + a[1]);
        else if (k === 'L') s.line(n.x + a[0], n.y + a[1]);
        else if (k === 'Q') s.quad(n.x + a[0], n.y + a[1], n.x + a[2], n.y + a[3]);
        else if (k === 'C') s.cubic(n.x + a[0], n.y + a[1], n.x + a[2], n.y + a[3], n.x + a[4], n.y + a[5]);
        else if (k === 'Z') s.close();
      }
      break;
    case 'line':
      s.begin();
      n.pts.forEach(([px, py], i) => (i ? s.line(n.x + px, n.y + py) : s.move(n.x + px, n.y + py)));
      s.stroke(ctx.col(n.stroke), n.width, n.cap, n.join);
      return;
    default: throw new Error(`unknown shape: ${n.type}`);
  }
  s.fill(ctx.col(n.fill));

  /* The form light: the same world-fixed gradient the head takes, at worn
     strength, so a hat is lit from the side the character is lit from. Without
     it a flat hat on a shaded head reads as a sticker — the exact problem the
     head's own shading was added to solve, moved up one layer.

     It is a second fill of the SAME path, so the path is rebuilt rather than
     kept: the surface API is stateless by design, and re-describing is cheaper
     than teaching it to remember. Only silhouette shapes take it — a light
     over a 5px gem is noise. */
  if (ctx.gloss && n.outline === 'outer' && !ctx.contour) {
    paintShape(s, { ...n, __lit: true }, { ...ctx, gloss: null, col: () => ctx.gloss });
  }
}

/** Walk a tree — used by the registry's checks, never by the renderer. */
export function walkShape(n, fn) {
  if (!n) return;
  fn(n);
  if (n.type === 'group') n.children.forEach(c => walkShape(c, fn));
}
