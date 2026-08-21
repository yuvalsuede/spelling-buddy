/**
 * Canvas2D backend for the Surface API.
 *
 * The rig never touches a CanvasRenderingContext2D directly. It draws against
 * this narrow interface, which means the exact same drawing code can also emit
 * SVG (see surface-svg.js) with no branching and no risk of the two outputs
 * drifting apart.
 *
 * Two deliberate differences from raw Canvas2D:
 *   - fill()/stroke() take their paint as arguments instead of reading mutable
 *     `fillStyle`/`strokeStyle` state. Stateless paint makes the SVG backend
 *     trivial and removes a whole class of "forgot to reset the style" bugs.
 *   - alpha() multiplies rather than assigns, so nested groups compose.
 */
import { isGradient, paintKey } from './paint.js';

export class CanvasSurface {
  constructor(ctx) {
    this.ctx = ctx;
    this.kind = 'canvas';
    /* Canvas gradients are objects baked into the CTM at creation, so they
       cannot be cached across a transform change. They can be cached within
       one, which is where the repeats actually are — the same body gradient is
       asked for several times per frame. Cleared every clear(). */
    this._grad = new Map();
  }

  /** A colour string passes through; a paint descriptor becomes a gradient. */
  _paint(p) {
    if (!isGradient(p)) return p;
    const key = paintKey(p) + '|' + this.ctx.getTransform?.().toString();
    const hit = this._grad.get(key);
    if (hit) return hit;
    const g = p.type === 'radial'
      ? this.ctx.createRadialGradient(p.fx ?? p.cx, p.fy ?? p.cy, 0, p.cx, p.cy, Math.max(1e-4, p.r))
      : this.ctx.createLinearGradient(p.x0, p.y0, p.x1, p.y1);
    for (const [offset, colour] of p.stops) g.addColorStop(Math.min(1, Math.max(0, offset)), colour);
    if (this._grad.size > 256) this._grad.clear();
    this._grad.set(key, g);
    return g;
  }

  save()               { this.ctx.save(); }
  restore()            { this.ctx.restore(); }
  translate(x, y)      { this.ctx.translate(x, y); }
  rotate(a)            { this.ctx.rotate(a); }
  scale(sx, sy)        { this.ctx.scale(sx, sy === undefined ? sx : sy); }
  alpha(mult)          { this.ctx.globalAlpha *= mult; }
  getAlpha()           { return this.ctx.globalAlpha; }

  begin()              { this.ctx.beginPath(); }
  move(x, y)           { this.ctx.moveTo(x, y); }
  line(x, y)           { this.ctx.lineTo(x, y); }
  quad(cx, cy, x, y)   { this.ctx.quadraticCurveTo(cx, cy, x, y); }
  cubic(c1x, c1y, c2x, c2y, x, y) { this.ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y); }
  arc(cx, cy, r, a0, a1, ccw)     { this.ctx.arc(cx, cy, r, a0, a1, !!ccw); }
  rect(x, y, w, h)     { this.ctx.rect(x, y, w, h); }
  close()              { this.ctx.closePath(); }

  ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2, ccw = false) {
    // Guard: a zero/negative radius throws in some engines, and the rig
    // legitimately drives radii to ~0 at full profile.
    this.ctx.ellipse(cx, cy, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, a0, a1, !!ccw);
  }

  fill(color, evenOdd = false) {
    this.ctx.fillStyle = this._paint(color);
    this.ctx.fill(evenOdd ? 'evenodd' : 'nonzero');
  }

  stroke(color, width, cap = 'round', join = 'round') {
    this.ctx.strokeStyle = this._paint(color);
    this.ctx.lineWidth = width;
    this.ctx.lineCap = cap;
    this.ctx.lineJoin = join;
    this.ctx.stroke();
  }

  clip(evenOdd = false) { this.ctx.clip(evenOdd ? 'evenodd' : 'nonzero'); }

  text(str, x, y, o = {}) {
    const weight = o.weight ?? 700;
    const size   = o.size ?? 16;
    const family = o.family ?? 'system-ui, -apple-system, sans-serif';
    this.ctx.font = `${weight} ${size}px ${family}`;
    this.ctx.textAlign = o.align ?? 'center';
    this.ctx.textBaseline = o.baseline ?? 'middle';
    this.ctx.fillStyle = o.color ?? '#000';
    this.ctx.fillText(str, x, y);
  }

  /** Clear the whole backing store, ignoring the current transform. */
  clear() {
    this._grad.clear();
    const c = this.ctx.canvas;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.ctx.restore();
  }
}
