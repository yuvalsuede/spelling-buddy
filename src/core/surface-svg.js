/**
 * SVG backend for the Surface API.
 *
 * Because every shape in the rig is already a mathematical primitive, a frame
 * can be emitted as real SVG geometry — not a rasterised trace. The output is
 * editable in Figma/Illustrator, scales infinitely, and stays byte-small.
 *
 * Implementation notes:
 *   - Transforms are baked per-element as a matrix rather than emitted as
 *     nested <g>. That keeps save/restore semantics exact without needing to
 *     reconcile the group tree against an interleaved clip stack.
 *   - Arcs and ellipses are converted to cubic Béziers (≤90° per segment,
 *     the standard 4/3·tan(Δ/4) construction), which is what every vector tool
 *     does internally anyway.
 */

/* ------------------------------------------------------------ 2D matrices */
const IDENT = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const mTranslate = (x, y) => [1, 0, 0, 1, x, y];
const mScale     = (x, y) => [x, 0, 0, y, 0, 0];
const mRotate    = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };

const n = v => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(3));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* -------------------------------------------- elliptical arc → cubic path */
function arcToCubics(out, cx, cy, rx, ry, rot, a0, a1, ccw) {
  // normalise sweep
  let delta = a1 - a0;
  if (ccw) { if (delta > 0) delta -= Math.PI * 2; }
  else     { if (delta < 0) delta += Math.PI * 2; }
  if (Math.abs(delta) > Math.PI * 2) delta = Math.sign(delta) * Math.PI * 2;

  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const at = t => {
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [cx + x * cosR - y * sinR, cy + x * sinR + y * cosR];
  };
  const dAt = t => {
    const x = -rx * Math.sin(t), y = ry * Math.cos(t);
    return [x * cosR - y * sinR, x * sinR + y * cosR];
  };

  const segs = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segs;
  const k = (4 / 3) * Math.tan(step / 4);

  let t = a0;
  const start = at(t);
  out.start = out.start || start;
  if (out.needMove) { out.d.push(`M${n(start[0])} ${n(start[1])}`); out.needMove = false; }
  else              { out.d.push(`L${n(start[0])} ${n(start[1])}`); }

  for (let i = 0; i < segs; i++) {
    const t0 = t, t1 = t + step;
    const p0 = at(t0), p1 = at(t1);
    const d0 = dAt(t0), d1 = dAt(t1);
    out.d.push(
      `C${n(p0[0] + k * d0[0])} ${n(p0[1] + k * d0[1])} ` +
      `${n(p1[0] - k * d1[0])} ${n(p1[1] - k * d1[1])} ` +
      `${n(p1[0])} ${n(p1[1])}`
    );
    t = t1;
  }
  out.cur = at(t);
}

/* ------------------------------------------------------------- the class */
export class SVGSurface {
  constructor({ width = 320, height = 320, originCentre = true, background = null } = {}) {
    this.kind = 'svg';
    this.width = width;
    this.height = height;
    this.background = background;
    this.body = [];
    this.defs = [];
    this._clipId = 0;

    this.state = { m: originCentre ? mTranslate(width / 2, height / 2) : IDENT.slice(), a: 1 };
    this.stack = [];
    this._openGroups = 0;
    this._resetPath();
  }

  _resetPath() { this._p = { d: [], needMove: true, cur: null, start: null }; }
  get _m() { return this.state.m; }

  save() {
    this.stack.push({ m: this.state.m.slice(), a: this.state.a, groups: this._openGroups });
  }

  restore() {
    const s = this.stack.pop();
    if (!s) return;
    // Close any clip groups opened since this save().
    while (this._openGroups > s.groups) { this.body.push('</g>'); this._openGroups--; }
    this.state = { m: s.m, a: s.a };
  }
  translate(x, y) { this.state.m = mul(this.state.m, mTranslate(x, y)); }
  rotate(a)       { this.state.m = mul(this.state.m, mRotate(a)); }
  scale(sx, sy)   { this.state.m = mul(this.state.m, mScale(sx, sy === undefined ? sx : sy)); }
  alpha(mult)     { this.state.a *= mult; }
  getAlpha()      { return this.state.a; }

  begin()            { this._resetPath(); }
  move(x, y)         { this._p.d.push(`M${n(x)} ${n(y)}`); this._p.needMove = false; this._p.cur = [x, y]; }
  line(x, y)         { if (this._p.needMove) this.move(x, y); else { this._p.d.push(`L${n(x)} ${n(y)}`); this._p.cur = [x, y]; } }
  quad(cx, cy, x, y) { if (this._p.needMove) this.move(x, y); this._p.d.push(`Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`); this._p.cur = [x, y]; }
  cubic(a, b, c, d, x, y) { if (this._p.needMove) this.move(x, y); this._p.d.push(`C${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(x)} ${n(y)}`); this._p.cur = [x, y]; }
  close()            { this._p.d.push('Z'); }

  arc(cx, cy, r, a0, a1, ccw) { arcToCubics(this._p, cx, cy, r, r, 0, a0, a1, !!ccw); }
  ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2, ccw = false) {
    arcToCubics(this._p, cx, cy, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, a0, a1, !!ccw);
  }
  rect(x, y, w, h) {
    this._p.d.push(`M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`);
    this._p.needMove = false;
  }

  _attrs(extra = '') {
    const m = this._m;
    const t = `matrix(${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4])} ${n(m[5])})`;
    return ` transform="${t}"${extra}`;
  }

  fill(color, evenOdd = false) {
    if (!this._p.d.length) return;
    const op = this.state.a < 0.999 ? ` fill-opacity="${n(this.state.a)}"` : '';
    const fr = evenOdd ? ' fill-rule="evenodd"' : '';
    this.body.push(`<path d="${this._p.d.join('')}" fill="${color}"${fr}${op}${this._attrs()}/>`);
  }

  stroke(color, width, cap = 'round', join = 'round') {
    if (!this._p.d.length) return;
    const op = this.state.a < 0.999 ? ` stroke-opacity="${n(this.state.a)}"` : '';
    this.body.push(
      `<path d="${this._p.d.join('')}" fill="none" stroke="${color}" stroke-width="${n(width)}"` +
      ` stroke-linecap="${cap}" stroke-linejoin="${join}"${op}${this._attrs()}/>`
    );
  }

  /**
   * Clipping.
   *
   * Shapes carry their absolute CTM baked into a `transform`, and SVG resolves
   * `clip-path` in the user space established *after* that transform — so
   * putting clip-path on the shape itself would apply the matrix twice and
   * clip everything away. Instead the clip opens a plain untransformed <g> at
   * root space and the clipPath geometry carries the absolute matrix. Both
   * then live in the same coordinate system, and nesting groups gives
   * intersection semantics identical to canvas.
   */
  clip() {
    if (!this._p.d.length) return;
    const m = this._m;
    const id = `bc${++this._clipId}`;
    const t = `matrix(${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4])} ${n(m[5])})`;
    this.defs.push(`<clipPath id="${id}"><path d="${this._p.d.join('')}" transform="${t}"/></clipPath>`);
    this.body.push(`<g clip-path="url(#${id})">`);
    this._openGroups++;
  }

  text(str, x, y, o = {}) {
    const weight = o.weight ?? 700;
    const size   = o.size ?? 16;
    const family = o.family ?? 'system-ui, -apple-system, sans-serif';
    const anchor = { left: 'start', center: 'middle', right: 'end' }[o.align ?? 'center'];
    const dom    = { top: 'hanging', middle: 'central', alphabetic: 'auto', bottom: 'text-top' }[o.baseline ?? 'middle'] || 'central';
    const op = this.state.a < 0.999 ? ` fill-opacity="${n(this.state.a)}"` : '';
    this.body.push(
      `<text x="${n(x)}" y="${n(y)}" fill="${o.color ?? '#000'}" font-family="${family}"` +
      ` font-size="${n(size)}" font-weight="${weight}" text-anchor="${anchor}"` +
      ` dominant-baseline="${dom}"${op}${this._attrs()}>${esc(str)}</text>`
    );
  }

  clear() { this.body.length = 0; this.defs.length = 0; this._openGroups = 0; this.stack.length = 0; }

  /** Serialise to a complete standalone SVG document. */
  toString() {
    const tail = '</g>'.repeat(this._openGroups);   // close anything left open
    const bg = this.background
      ? `<rect width="${this.width}" height="${this.height}" fill="${this.background}"/>`
      : '';
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" ` +
           `viewBox="0 0 ${this.width} ${this.height}">${defs}${bg}${this.body.join('')}${tail}</svg>`;
  }
}
