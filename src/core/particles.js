/**
 * Particle system — confetti, stars, sparkles, zzz, sweat drops, letters.
 *
 * Deliberately tiny: a flat array, Euler integration, no pooling. At the
 * volumes this character emits (tens, not thousands) the allocation cost is
 * irrelevant and the simplicity is worth more.
 */
import { smooth } from './math.js';
import { drawGlyph } from './glyphs.js';

export class Particles {
  constructor(random) {
    this.list = [];
    this.random = random;
  }

  emit(type, count, o = {}) {
    const R = this.random;
    for (let i = 0; i < count; i++) {
      const spread = o.spread ?? 0.6;
      const a  = o.angle !== undefined ? o.angle + R.range(-spread, spread) : R.range(0, Math.PI * 2);
      const sp = R.range(o.spdMin ?? 90, o.spdMax ?? 260);
      this.list.push({
        type,
        x: (o.x ?? 0) + R.range(-14, 14),
        y: (o.y ?? 0) + R.range(-14, 14),
        vx: Math.cos(a) * sp + (o.vx ?? 0),
        vy: Math.sin(a) * sp + (o.vy ?? 0),
        rot: R.range(0, Math.PI * 2),
        vrot: R.range(-9, 9),
        size: R.range(o.sizeMin ?? 5, o.sizeMax ?? 11),
        life: 0,
        ttl: R.range(o.ttlMin ?? 0.9, o.ttlMax ?? 1.7),
        grav: o.grav ?? 520,
        drag: o.drag ?? 0.86,
        color: o.color ?? '#000',
        char: o.char,
      });
    }
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life += dt;
      if (p.life >= p.ttl) { L.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  draw(s) {
    for (const p of this.list) {
      const k = 1 - p.life / p.ttl;
      s.save();
      s.alpha(smooth(0, 0.25, k));
      s.translate(p.x, p.y);
      s.rotate(p.rot);

      switch (p.type) {
        case 'confetti':
          s.begin(); s.rect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6); s.fill(p.color);
          break;

        case 'star':
          s.begin();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? p.size * 0.42 : p.size;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            i ? s.line(x, y) : s.move(x, y);
          }
          s.close(); s.fill(p.color);
          break;

        case 'sparkle': {
          const q = p.size;
          s.begin();
          s.move(0, -q);
          s.quad(0, 0, q, 0); s.quad(0, 0, 0, q);
          s.quad(0, 0, -q, 0); s.quad(0, 0, 0, -q);
          s.fill(p.color);
          break;
        }

        case 'drop':
          s.begin();
          s.move(0, -p.size * 1.3);
          s.quad(p.size * 0.9, p.size * 0.3, 0, p.size);
          s.quad(-p.size * 0.9, p.size * 0.3, 0, -p.size * 1.3);
          s.fill(p.color);
          break;

        case 'zzz':
          drawGlyph(s, 'Z', p.size * 2.4, p.color, 0.17);
          break;

        case 'letter':
          drawGlyph(s, p.char || 'A', p.size * 2.6, p.color, 0.16);
          break;
      }
      s.restore();
    }
  }

  clear() { this.list.length = 0; }
  get count() { return this.list.length; }
}
