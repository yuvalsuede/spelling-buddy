/**
 * Small numeric helpers. No dependencies, no allocation in hot paths.
 */

export const lerp   = (a, b, t) => a + (b - a) * t;
export const clamp  = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const TAU    = Math.PI * 2;
export const deg    = d => d * Math.PI / 180;
export const rad    = r => r * 180 / Math.PI;

/**
 * Deterministic PRNG (mulberry32). Every random draw in the rig goes through
 * one of these so exports are reproducible: same seed, same sprite sheet.
 */
export function makeRandom(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.reseed = s => { a = s >>> 0; };
  return next;
}

/**
 * Damped spring integrator. Returns [position, velocity].
 *
 * This is the single most important function for how the character *feels*.
 * Eased tweens arrive and stop; springs overshoot and settle, which is what
 * reads as weight. Every impulse in the rig is injected as velocity into one
 * of these rather than as a target keyframe.
 */
export function spring(pos, vel, target, dt, k = 190, d = 15) {
  vel += ((target - pos) * k - vel * d) * dt;
  return [pos + vel * dt, vel];
}

/** Frame-rate independent exponential approach. `h` = fraction remaining after 1s. */
export const approach = (cur, target, h, dt) => lerp(cur, target, 1 - Math.pow(h, dt));
