/**
 * SVG export.
 *
 * Because the character is already mathematics, a frame can be emitted as real
 * vector geometry rather than a raster trace: editable in Figma or Illustrator,
 * infinitely scalable, and a few KB. This is the payoff of the Surface
 * abstraction — the same drawing code that runs at 60fps also produces build
 * artifacts, so the assets can never drift from the runtime.
 *
 * Runs in Node and in the browser; it touches no DOM.
 */
import { Buddy } from '../core/buddy.js';
import { SVGSurface } from '../core/surface-svg.js';
import { DESIGN } from '../core/geometry.js';
import { drawGlyph, glyphBounds, METRICS } from '../core/glyphs.js';

/** Render whatever a Buddy currently looks like as an SVG string. */
export function toSVG(buddy, { width = DESIGN, height = DESIGN, background = null,
                               padding = 0, idPrefix = '' } = {}) {
  const s = new SVGSurface({ width, height, originCentre: true, background, idPrefix });
  const k = (Math.min(width, height) / DESIGN) * (1 - padding);
  s.scale(k, k);
  buddy.render(s);
  return s.toString();
}

/**
 * Render a single named pose from scratch — deterministic, no live rig needed.
 *
 * @param {object} pose
 * @param {string} pose.expression
 * @param {number} pose.yaw    degrees
 * @param {number} pose.pitch  degrees
 * @param {number} pose.roll   degrees
 * @param {boolean} pose.hands force hands visible
 * @param {string}  pose.letter hold a letter card
 */
export function poseSVG(pose = {}, opts = {}) {
  const b = new Buddy({
    theme: opts.theme ?? 'ink',
    /* Which build to pose. Per instance, so a sheet can hold two of them. */
    shape: opts.shape ?? 'v1',
    seed: opts.seed ?? 1,
    expression: pose.expression ?? 'happy',
    showHands: pose.hands === true,
    showTrail: false,
    autoLook: false,
  });
  b.face(pose.yaw ?? 0, pose.pitch ?? 0);
  if (pose.roll) b.s.rollTarget = (pose.roll * Math.PI) / 180;
  if (pose.letter) { b.hold(pose.letter); }
  // pose.hands may be true (both), 'l' or 'r' (one)
  if (pose.hands === 'l' || pose.hands === 'r') b.s.hand[pose.hands].want = 1;
  if (pose.handLift) b.s.hand[pose.hands === 'l' ? 'l' : 'r'].lift = pose.handLift;
  if (pose.handOut)  b.s.hand[pose.hands === 'l' ? 'l' : 'r'].out  = pose.handOut;
  if (pose.expression) { b.s.expr = b.s.prevExpr = pose.expression; }
  b.settle();
  return toSVG(b, opts);
}

/**
 * A short, stable id namespace from an asset's name.
 *
 * Every exported file that might end up inlined next to another one needs its
 * own — see `SVGSurface`'s `idPrefix`. Derived from the name rather than a
 * counter so the same asset produces the same file every time, which is what
 * makes a checksum-based export check possible at all.
 */
export function idPrefixFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 5) + '-';
}

/** The standard 8-frame turnaround, as individual SVG strings. */
export function turnaroundSVGs({ steps = 8, expression = 'happy', ...opts } = {}) {
  return Array.from({ length: steps }, (_, i) => {
    const yaw = (360 / steps) * i;
    const name = `turn-${Math.round(yaw)}`;
    return { name, yaw, svg: poseSVG({ expression, yaw }, { idPrefix: idPrefixFor(name), ...opts }) };
  });
}

/** One SVG per expression, head-on. */
export function expressionSVGs(opts = {}) {
  return Buddy.expressions.map(name => ({
    name: `expr-${name}`,
    expression: name,
    svg: poseSVG({ expression: name }, { idPrefix: idPrefixFor(`expr-${name}`), ...opts }),
  }));
}

/**
 * Lay poses out in a labelled grid inside a single SVG — the character sheet.
 */
export function sheetSVG(poses, { cols = 4, cell = 200, gap = 8, theme = 'ink', label = true,
                                  background = '#FFFFFF', labelColor = '#5F667E' } = {}) {
  const rows = Math.ceil(poses.length / cols);
  const labelH = label ? 26 : 0;
  const W = cols * cell + gap * (cols + 1);
  const H = rows * (cell + labelH) + gap * (rows + 1);

  const parts = poses.map((p, i) => {
    const cx = gap + (i % cols) * (cell + gap);
    const cy = gap + Math.floor(i / cols) * (cell + labelH + gap);
    const inner = poseSVG(p, { theme, width: cell, height: cell, padding: 0.12 });
    // strip the outer <svg> wrapper and re-nest as a translated group
    const body = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const text = label
      ? `<text x="${cx + cell / 2}" y="${cy + cell + 15}" text-anchor="middle" ` +
        `font-family="system-ui,sans-serif" font-size="12" font-weight="600" ` +
        `fill="${labelColor}">${p.label ?? p.expression ?? ''}</text>`
      : '';
    return `<g transform="translate(${cx} ${cy})">${body}</g>${text}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
         `<rect width="${W}" height="${H}" fill="${background}"/>${parts.join('')}</svg>`;
}

/**
 * A specimen sheet of the whole alphabet on ruled paper.
 *
 * Useful for the thing that is otherwise hard to check: that the metrics agree
 * with each other. Every mis-set x-height, every letter that fails to sit on
 * the baseline, is obvious in one glance here and invisible in a unit test.
 */
export function alphabetSVG({
  rows = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ',
          'abcdefghijklm', 'nopqrstuvwxyz',
          '0123456789', "'-.?!"],
  cap = 78, cellW = 96, rowH = 150, pad = 24,
  ink = '#16161A', rule = '#4A90D9', background = '#FFFFFF',
} = {}) {
  const cols = Math.max(...rows.map(r => [...r].length));
  const W = cols * cellW + pad * 2;
  const H = rows.length * rowH + pad * 2;
  const s = new SVGSurface({ width: W, height: H, originCentre: false, background });

  rows.forEach((row, r) => {
    const y0 = pad + r * rowH + rowH / 2;
    const chars = [...row];
    const deep = chars.some(c => glyphBounds(c).bottom > METRICS.baseline + 1e-6);
    const guides = [[METRICS.cap, 0.22], [METRICS.xLine, 0.12], [METRICS.baseline, 0.5]];
    if (deep) guides.push([METRICS.descender, 0.12]);
    for (const [u, a] of guides) {
      s.save(); s.alpha(a);
      s.begin(); s.move(pad, y0 + u * cap); s.line(W - pad, y0 + u * cap);
      s.stroke(rule, 1);
      s.restore();
    }
    chars.forEach((ch, i) => {
      s.save();
      s.translate(pad + i * cellW + cellW / 2, y0);
      drawGlyph(s, ch, cap, ink, 0.145, true, 'baseline');
      s.restore();
    });
  });

  return s.toString();
}
