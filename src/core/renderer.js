/**
 * The renderer. Pure function of (surface, state, theme) → drawing calls.
 *
 * It holds no state of its own, which is what makes deterministic export
 * possible: hand a Surface and a frozen state object to `render` and you get
 * that exact frame, on canvas or as SVG, now or in a build step.
 *
 * Draw order matters and is deliberate:
 *   shadow → far sparks → far hands → trail → body → face → near hands →
 *   near sparks → held letter → particles
 */
import { G, project, faceProject } from './geometry.js';
import { clamp, lerp, smooth } from './math.js';
import { faceFrame, EXPRESSIONS } from './expressions.js';
import { drawGlyph, glyphBounds, METRICS } from './glyphs.js';
import { drawTrace } from './trace.js';

/* --------------------------------------------------------------- silhouette */
function drawBody(s, S, T) {
  const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);

  // A bulge opposite the turn suggests the volume behind the face. Two
  // overlapping fills in one colour read as a single solid shape.
  const bulge = Math.abs(sy) * 15;
  if (bulge > 0.6) {
    s.begin();
    s.ellipse(-Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10, G.R * 0.93, G.RY * 0.95);
    s.fill(T.body);
  }
  s.begin();
  s.ellipse(0, 0, G.R, G.RY);
  s.fill(T.body);

  // Back of the head: a hair whorl and a cowlick, so turning away is a pose
  // rather than a blank disc.
  const backness = smooth(0.30, -0.45, cy);
  if (backness > 0.01) {
    const dir = -Math.sign(sy) || 1;
    const oy = -S.pitch * 26;
    s.save();
    s.alpha(backness);

    s.save();
    s.translate(dir * 10, oy + 6);
    s.rotate(dir * 0.4);
    s.begin();
    for (let i = 0; i <= 70; i++) {
      const t = i / 70, a = t * Math.PI * 3.1 * dir, r = 6 + t * 40;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.92;
      i ? s.line(x, y) : s.move(x, y);
    }
    s.stroke(T.bodyDeep, 7);
    s.restore();

    for (let i = 0; i < 2; i++) {
      s.save();
      s.translate(dir * (16 + i * 20), oy - 88 + i * 10);
      s.rotate(dir * (0.7 + i * 0.5));
      s.begin(); s.ellipse(0, 0, 9 - i * 2, 20 - i * 5); s.fill(T.body);
      s.restore();
    }
    s.restore();
  }
}

/* --------------------------------------------------------------------- face */
function drawFace(s, S, T) {
  const F = faceFrame(S);
  if (F.vis <= 0.01) return F;

  s.save();
  s.alpha(F.vis);

  s.begin();
  s.ellipse(F.hole.x, F.hole.y, F.hole.rx, F.hole.ry);
  s.fill(T.face);

  if (S.showBlush && T.blush) {
    s.save(); s.alpha(0.55);
    for (const sx of [-34, 34]) {
      const b = faceProject(sx, G.faceCY + 20, S.yaw, S.pitch);
      if (b.z <= 0) continue;
      s.save();
      s.translate(b.x, b.y);
      s.scale(Math.abs(b.fx), Math.abs(b.fy));
      s.begin(); s.ellipse(0, 0, 9, 5.5); s.fill(T.blush);
      s.restore();
    }
    s.restore();
  }

  // Clip features to the hole so nothing ever spills onto the body.
  s.save();
  s.begin();
  s.ellipse(F.hole.x, F.hole.y, F.hole.rx, F.hole.ry);
  s.clip();

  if (S.xfade < 1 && S.prevExpr !== S.expr) {
    s.save(); s.alpha(1 - S.xfade); EXPRESSIONS[S.prevExpr](s, T, F, S); s.restore();
    s.save(); s.alpha(S.xfade);     EXPRESSIONS[S.expr](s, T, F, S);     s.restore();
  } else {
    EXPRESSIONS[S.expr](s, T, F, S);
  }
  s.restore();
  s.restore();
  return F;
}

/* -------------------------------------------------------------------- hands */
function handAt(S, side) {
  const sgn = side === 'l' ? -1 : 1;
  const h = S.hand[side];
  return project(sgn * (G.handSX + h.out * 22), G.handSY - h.lift * G.handLift,
                 G.Rh, S.yaw, S.pitch);
}

/**
 * A hand.
 *
 * A plain ellipse at head height reads as an ear, which is exactly how the
 * first version looked. A mitten — squarer palm plus a thumb on the inboard
 * side — reads as a hand even at 40px, and the thumb also tells you which way
 * round it is during a wave.
 */
function drawHand(s, S, T, side, p) {
  const h = S.hand[side];
  if (h.show <= 0.01) return;
  const sgn = side === 'l' ? -1 : 1;
  const R = G.handR;
  const sq = clamp(0.55 + Math.abs(p.fx) * 0.45, 0.4, 1);

  s.save();
  s.alpha(clamp(h.show, 0, 1));
  s.translate(p.x, p.y);
  s.rotate(h.swing * sgn);
  s.scale(sgn * sq, 1);          // mirror so the thumb faces the body

  /* Thumb first, clearly outside the palm's silhouette — tucked inside it the
     shape collapses back into a featureless blob, which is what made the first
     two attempts read as an ear and then as a tab. */
  s.begin();
  s.ellipse(-R * 0.82, -R * 0.32, R * 0.38, R * 0.30, -0.62);
  s.fill(T.hand);

  // palm — organic, slightly taller than wide
  s.begin();
  s.ellipse(0, 0, R * 0.86, R * 1.02);
  s.fill(T.hand);
  s.restore();
}

/* ------------------------------------------------------------------- sparks */
function drawSparks(s, S, T, far) {
  if (!S.showSparks) return;
  G.sparks.forEach((sp, i) => {
    const lon = sp.a + S.yaw;
    const z = Math.cos(lon);
    if ((z < 0) !== far) return;
    const phase = S.t * 3.1 * S.tempo - i * 0.5;
    const pulse = 1 + Math.sin(phase) * 0.14 + S.sparkPop * 0.55;
    const depth = 0.78 + 0.22 * z;

    /* A spark changes layer at z = 0. Alpha and mirroring must therefore be
       continuous functions of z, or it visibly pops as it crosses: stepping
       alpha 0.92 → 0.45 and flipping the tilt with sign(z) both did. */
    const depthFade = lerp(0.42, 0.92, smooth(-0.30, 0.30, z));
    const mirror = Math.tanh(z * 3.2);

    s.save();
    s.alpha(depthFade * clamp(0.7 + S.sparkPop * 0.3, 0, 1));
    s.translate(G.Rs * Math.sin(lon) * depth,
                sp.y + Math.sin(phase * 0.7) * 3 - S.sparkPop * 10 - S.pitch * 30);
    s.rotate(sp.rot * mirror + S.sparkPop * 0.3);
    s.begin();
    s.ellipse(0, 0, sp.rx * pulse * Math.max(0.35, Math.abs(z) * 0.5 + 0.5), sp.ry * pulse);
    s.fill(T.spark);
    s.restore();
  });
}

/* ------------------------------------------------------------- letter card */
function drawHeldLetter(s, S, T) {
  if (!S.heldLetter) return;
  const p = project(G.handSX * 0.9, G.handSY - 60, G.Rh, S.yaw, S.pitch);
  if (p.z < -20) return;
  const pop = 1 + S.letterPop * 0.45;
  const w = 46, h = 54, r = 10;

  s.save();
  s.alpha(smooth(-40, 10, p.z));
  s.translate(p.x, p.y);
  s.rotate(Math.sin(S.t * 2.2) * 0.08);
  s.scale(pop * Math.max(0.25, Math.abs(p.fx) * 0.6 + 0.4), pop);

  // rounded card, built from lines + arcs so it exports as real geometry
  s.begin();
  s.move(-w / 2 + r, -h / 2);
  s.line(w / 2 - r, -h / 2);  s.arc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0);
  s.line(w / 2, h / 2 - r);   s.arc(w / 2 - r,  h / 2 - r, r, 0, Math.PI / 2);
  s.line(-w / 2 + r, h / 2);  s.arc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI);
  s.line(-w / 2, -h / 2 + r); s.arc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
  s.close();
  s.fill(T.face);
  s.stroke(T.body, 4);

  /* Drawn from our own geometry, not a font: the glyph fills a unit cap-box
     centred on the origin, so it lands dead centre of the card in both
     backends with no baseline metric to disagree about. */
  /* 'ink' alignment: a card holds one letter with nothing to sit beside, so
     it wants its visible mass centred. Baseline-aligning a lowercase 'a' in a
     card just looks like the letter has slipped to the floor. */
  drawGlyph(s, S.heldLetter, 30, T.body, 0.145, true, 'ink');
  s.restore();
}

/* -------------------------------------------------------------- tracing */
function drawTracePanel(s, S, T) {
  const tr = S.trace;
  if (!tr.active || !tr.ch) return;

  s.save();
  s.translate(G.trace.x, G.trace.y);

  /* Writing guides, the way ruled paper does it. The x-line is drawn fainter
     than the cap line and the baseline because it is a secondary rule — but it
     has to be there: without it a lowercase 'o' has nothing to sit against and
     "short letters stop here" is not something the child can see. The
     descender rule only appears for letters that actually go below. */
  const halfW = G.trace.cap * 0.62;
  const cap = G.trace.cap;
  const gb = glyphBounds(tr.ch);
  const rules = [
    [METRICS.cap * cap, 0.28],
    [METRICS.xLine * cap, 0.15],
    [METRICS.baseline * cap, 0.28],
  ];
  if (gb && gb.bottom > METRICS.baseline + 1e-6) rules.push([METRICS.descender * cap, 0.15]);
  s.save();
  for (const [y, a] of rules) {
    s.save(); s.alpha(a);
    s.begin(); s.move(-halfW, y); s.line(halfW, y);
    s.stroke(T.bodyDeep, 1.6);
    s.restore();
  }
  s.restore();
  s.restore();

  s.save();
  s.translate(G.trace.x, G.trace.y);
  const pen = drawTrace(s, tr.ch, G.trace.cap, tr.u,
                        { ghost: T.ghost, ink: T.body });
  s.restore();

  /* The pen. Hidden while the stroke is lifted, so the gap between the stem
     of an A and its crossbar reads as picking the pencil up. */
  if (pen && !pen.penUp && tr.u < 1) {
    s.save();
    s.translate(G.trace.x + pen.x, G.trace.y + pen.y);
    s.begin(); s.ellipse(0, 0, 8.5, 8.5); s.fill(T.spark);
    s.begin(); s.ellipse(0, 0, 3.4, 3.4); s.fill(T.face);
    s.restore();
  }
}

/* ================================================================== render */
export function render(surface, S, T) {
  const s = surface;

  const bob    = Math.sin(S.t * 1.9 * S.tempo) * 5 * S.bobAmt;
  const breath = 1 + Math.sin(S.t * 1.35 * S.tempo) * 0.018 * S.breathAmt;
  const lift   = bob + S.hover;

  /* ground shadow — reacts to height and to the turn */
  if (S.showShadow) {
    const hgt = clamp((lift + 8) / 60, 0, 1);
    s.save();
    s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
    s.alpha(lerp(0.95, 0.25, hgt));
    s.begin();
    s.ellipse(S.offX * 0.5 + S.shiftX, G.ground,
              lerp(78, 44, hgt) * (0.92 + Math.abs(Math.cos(S.yaw)) * 0.08), 11);
    s.fill(T.shadow);
    s.restore();
  }

  s.save();
  s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
  s.translate(S.shiftX, 0);

  /* motion trail — ghost silhouettes while moving fast */
  if (S.showTrail && S.trail.length > 1) {
    S.trail.forEach((g, i) => {
      if (g.speed < 0.6) return;
      const k = (i + 1) / S.trail.length;
      s.save();
      s.alpha(0.16 * k * clamp(g.speed, 0, 1));
      s.translate(g.x, g.y);
      s.rotate(g.roll);
      s.begin(); s.ellipse(0, 0, G.R * 0.97, G.RY * 0.97); s.fill(T.body);
      s.restore();
    });
  }

  s.save();
  s.translate(S.offX, S.offY - lift);
  s.rotate(S.roll + Math.sin(S.t * 0.9 * S.tempo) * 0.02 * S.bobAmt);
  s.scale(S.squashX * breath, S.squashY * breath);

  const pL = handAt(S, 'l'), pR = handAt(S, 'r');

  drawSparks(s, S, T, true);
  if (pL.z <  0) drawHand(s, S, T, 'l', pL);
  if (pR.z <  0) drawHand(s, S, T, 'r', pR);

  drawBody(s, S, T);
  drawFace(s, S, T);

  if (pL.z >= 0) drawHand(s, S, T, 'l', pL);
  if (pR.z >= 0) drawHand(s, S, T, 'r', pR);
  drawSparks(s, S, T, false);
  drawHeldLetter(s, S, T);

  s.restore();  // body transform
  s.restore();  // scale

  /* the traced letter lives in world space beside the character */
  s.save();
  s.scale(S.scale, S.scale);
  drawTracePanel(s, S, T);
  s.restore();

  /* particles live in world space, unaffected by squash */
  s.save();
  s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
  s.translate(S.offX + S.shiftX, S.offY - lift);
  S.particles.draw(s);
  s.restore();
}
