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
import { G, project, faceProject, silhouettePath, silhouetteSub, headRegion, profileSub, profileAmount, facePatchSurface, capPoint, faceWrapShift, faceYaw, facePitch, halfWidthAt } from './geometry.js';
import { clamp, lerp, smooth } from './math.js';
import { faceFrame, EXPRESSIONS } from './expressions.js';
import { drawGlyph, METRICS } from './glyphs.js';
import { vertical, sheen, darken, formLight, alpha } from './paint.js';
import { drawAccessories } from './accessories.js';
import { glyphPath } from './trace.js';
import { drawTrace } from './trace.js';

/* --------------------------------------------------------------- silhouette */
/**
 * The body's paint.
 *
 * Flat by default. When a theme carries a `shade` block the body is filled
 * with a vertical gradient instead — authored in the body's own local space
 * (top of the silhouette to the bottom), which is the one space both backends
 * agree on without a transform to reconcile.
 */
function bodyPaint(T, g = G) {
  const sh = T.shade && T.shade.body;
  if (!sh) return T.body;
  return vertical(sh.top, sh.bottom, -g.RY, g.RY, sh.mid);
}

/**
 * Ears.
 *
 * They live on the same sphere as everything else, so the turn carries them
 * for free: they swing round the silhouette, foreshorten, and the far one
 * passes behind the head without any special case. Drawn before the body so
 * the body's own fill covers where they join it.
 */
/** The ear tone: the body gradient, stepped down. */
function earShade(T, g = G) {
  const sh = T.shade && T.shade.body;
  if (!sh) return darken(T.body, 0.11);
  return vertical(darken(sh.top, 0.11), darken(sh.bottom, 0.11), -g.RY, g.RY,
                  sh.mid ? darken(sh.mid, 0.11) : undefined);
}

function earShapes(s, S, T, each) {
  if (!T.ears) return;
  const g = S.g || G;
  for (const side of [-1, 1]) {
    const p = project(side * g.earSX, g.earSY, g.R, S.yaw, S.pitch);
    /* Kept round rather than foreshortened flat, and never allowed inside the
       silhouette. An ear is a lump on the side of a head, not a decal printed
       on the sphere: squash it with the projection and it becomes a pair of
       headphones; let the projection carry it inward as the head turns and it
       simply disappears under the face. */
    const k = 0.62 + 0.38 * Math.abs(p.fx);
    const out = Math.sign(p.x) || side;
    const x = out * Math.max(Math.abs(p.x), g.R * 0.86);
    each(x, p.y, g.earR * k, g.earR * g.earRY, side * g.earTilt);
  }
}

/**
 * The silhouette: ears, turn bulge and head, drawn as one shape.
 *
 * Every piece is stroked before any piece is filled. That ordering is the
 * whole trick — the contour ends up following the union, and the internal
 * seams where the ear meets the head, or the bulge meets the head, are painted
 * out by the fills. Stroke-and-fill each piece in turn instead and you get a
 * character that reads as three circles glued together.
 */
function drawBody(s, S, T) {
  const g = S.g || G;
  const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
  const paint = bodyPaint(T, g);
  const bulge = Math.abs(sy) * 15;
  const hasBulge = bulge > 0.6;

  /* The silhouette. An ellipse is a ball; the blob is an egg — flatter and
     narrower across the top, widest below centre, sitting on a broad base.
     Drawn as four cubics so it deforms with squash-and-stretch exactly like
     the ellipse did. */
  const shape = (rx, ry, ox = 0, oy = 0) => silhouettePath(s, rx, ry, ox, oy, g);

  const feet = each => {
    if (!g.footR) return;
    for (const side of [-1, 1]) each(side * g.footDX, g.RY - g.footDY, g.footR * 1.25, g.footR);
  };

  const bulgePath = () => {
    shape(g.R * 0.93, g.RY * 0.95, -Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10);
  };
  const headPath = () => shape(g.R, g.RY);

  /* EXPERIMENT (`profile`). The brow/nose/chin break on the leading edge. Same
     paint, same light, same contour as the head — it is part of the head, not
     a thing stuck to it. */
  const prof = S.profile ? profileAmount(S) : 0;
  const profPath = () => { s.begin(); profileSub(s, S, 1, prof); };

  if (T.outline) {
    const w = T.outlineW * 2;
    earShapes(s, S, T, (x, y, rx, ry, tilt) => {
      s.begin(); s.ellipse(x, y, rx, ry, tilt); s.stroke(T.outline, w, 'round', 'round');
    });
    feet((x, y, rx, ry) => { s.begin(); s.ellipse(x, y, rx, ry); s.stroke(T.outline, w, 'round', 'round'); });
    if (hasBulge) { bulgePath(); s.stroke(T.outline, w, 'round', 'round'); }
    if (prof > 0.002) { profPath(); s.stroke(T.outline, w, 'round', 'round'); }
    headPath(); s.stroke(T.outline, w, 'round', 'round');
  }

  /* `'darker'` is the interesting case: with no contour, an ear the same
     colour as the head simply disappears into it at the front. A tonal step
     separates them the way depth does in the real world — and unlike a drawn
     line it needs no special handling where the two shapes meet. */
  const earPaint = T.ears === true ? paint
                 : T.ears === 'darker' ? earShade(T, g)
                 : T.ears;
  earShapes(s, S, T, (x, y, rx, ry, tilt) => {
    s.begin(); s.ellipse(x, y, rx, ry, tilt); s.fill(earPaint);
  });
  feet((x, y, rx, ry) => { s.begin(); s.ellipse(x, y, rx, ry); s.fill(earPaint); });
  if (hasBulge) { bulgePath(); s.fill(paint); }
  if (prof > 0.002) { profPath(); s.fill(paint); }
  headPath(); s.fill(paint);

  /* FORM.
     
     Until this existed the character was a flat disc that slid a white patch
     across itself, and at three-quarter view it read as a sticker on a circle
     rather than as a head turning away. Nothing in the rig implied a light
     source, so nothing implied a surface either.

     One light, fixed in world space — never attached to the turn. A highlight
     that swings with the yaw reads as a moving lamp; a fixed one lets the face
     travel across a form that stays put, which is the whole cue. Three stops
     rather than two: the mid stop is where the light runs out, and without it
     the terminator starts at the highlight and the ball looks like a gradient
     swatch instead of a sphere. */
  /* Over EVERYTHING the body fills — outline, turn bulge, ears, feet — not just
     the outline. Applied to the outline alone it stops dead at the bulge, and
     the bulge is by definition the part that sticks out past it: you get a
     shaded ball with an unshaded crescent welded to one side and a hard seam
     between them. It is worst at three-quarter view, which is exactly where
     the shading was supposed to help. */
  if (T.form !== false) {
    s.begin();
    silhouetteSub(s, g.R, g.RY, 0, 0, g);
    if (hasBulge) {
      silhouetteSub(s, g.R * 0.93, g.RY * 0.95,
                    -Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10, g);
    }
    earShapes(s, S, T, (x, y, rx, ry, tilt) => s.ellipse(x, y, rx, ry, tilt));
    feet((x, y, rx, ry) => s.ellipse(x, y, rx, ry));
    if (prof > 0.002) profileSub(s, S, 1, prof);
    s.fill(formLight(g.R, {
      lit: (T.formBase ?? 0.13) * (T.formLit ?? 1),
      dark: (T.formBaseDark ?? 0.26) * (T.formDark ?? 1),
      spread: T.formSpread ?? 1.62,
      mid: T.formMid ?? 0.42,
      cx: T.formCX ?? -0.34, cy: T.formCY ?? -0.40,
    }));
  }

  if (T.shade && T.shade.sheen) {
    s.save();
    s.alpha(T.shade.sheen);
    headPath();
    s.fill(sheen(-g.R * 0.28, -g.RY * 0.34, g.R * 1.15,
                 T.shade.sheenColor || '#FFFFFF', 'rgba(255,255,255,0)'));
    s.restore();
  }

  // Back of the head: a hair whorl and a cowlick, so turning away is a pose
  // rather than a blank disc.
  /* The whorl is the symbol for "you are looking at the back of its head", so
     it cannot be on screen while a face is. With the profile in, a face is
     still there at ninety degrees, and the two together read as a back view
     with a face stuck to the edge of it. It waits for the face to go. */
  const face = S._face;
  const backness = smooth(0.30, -0.45, cy) * (S.profile ? 1 - (face ? face.vis : 0) : 1);
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
      s.begin(); s.ellipse(0, 0, 9 - i * 2, 20 - i * 5); s.fill(paint);
      s.restore();
    }
    s.restore();
  }
}

/**
 * The face patch.
 *
 * A plain ellipse by default. With `T.hairline` the top edge is scalloped —
 * the single most characterful line in this style of character, because it is
 * what says "creature with a head of hair" rather than "circle inside a
 * circle".
 *
 * One function, used for both the fill and the feature clip, so the features
 * can never be clipped to a different shape than the one that was drawn.
 */
function facePatchPath(s, F, T, S) {
  const g = F.g || G;
  const { x, y, rx, ry, rot = 0, lean = 0, sq = 1 } = F.hole;
  const bumps = T.hairline || 0;
  if (lean === 2) { projectedPatchPath(s, F, T, S); return; }
  if (lean) { leaningPatchPath(s, x, y, rx / sq, ry, sq, rot, bumps); return; }
  if (!bumps) { s.begin(); s.ellipse(x, y, rx, ry); return; }

  /* The ellipse everywhere except across the top, where scallops replace it.
     The break points sit at the temples (-20° and 200°), so the sides of the
     face stay a clean curve and only the hairline is shaped. */
  const a0 = -20 * Math.PI / 180, a1 = 200 * Math.PI / 180;
  s.begin();
  s.ellipse(x, y, rx, ry, 0, a0, a1);          // upper right, round the bottom, to upper left

  const xs = x + rx * Math.cos(a1);
  const xe = x + rx * Math.cos(a0), ye = y + ry * Math.sin(a0);
  const step = (xe - xs) / bumps;
  for (let i = 0; i < bumps; i++) {
    const px = xs + i * step, nx = px + step;
    const endY = i === bumps - 1 ? ye : y - ry * 0.66;
    /* The peak rises toward the middle of the face, so the centre lock is the
       tallest — a flat row of identical bumps reads as a zigzag, not as hair. */
    const centreness = 1 - Math.abs((px + nx) / 2 - x) / rx;
    s.quad(px + step * 0.5, y - ry * (0.98 + 0.16 * centreness), nx, endY);
  }
  s.close();
}

/**
 * The same patch, drawn the way a face on a round head actually projects.
 *
 * The upright version above squashes across screen-x. That is only right when
 * the face is level with the head's centre; this one is not — it sits low, so
 * as the head turns, the direction pointing out of the face points out AND
 * down, and everything on the face is squeezed along THAT line instead.
 *
 * So the shape is built face-on — a circle with the fringe across the top,
 * exactly as it is drawn at rest — and then squeezed once, along `rot`. The
 * lean of the oval and the bank of the fringe both fall out of that single
 * squash; neither is placed by hand, which is why they cannot disagree.
 *
 * The squeeze is affine, so a quadratic stays a quadratic: mapping the two
 * control points of each scallop is exact, not an approximation.
 */
function leaningPatchPath(s, x, y, a, b, sq, rot, bumps) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  /* face-on point → screen. Split into the part along the squeeze axis, which
     shortens, and the part across it, which does not. */
  const P = (px, py) => {
    const along = px * c + py * sn;
    return [x + px - along * c + along * sq * c,
            y + py - along * sn + along * sq * sn];
  };

  const N = 96;
  if (!bumps) {
    s.begin();
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const [X, Y] = P(a * Math.cos(t), b * Math.sin(t));
      if (i) s.line(X, Y); else s.move(X, Y);
    }
    s.close();
    return;
  }

  /* Same break points as the upright path — temples at -20° and 200° — so the
     sides stay a clean curve and only the hairline is shaped. */
  const a0 = -20 * Math.PI / 180, a1 = 200 * Math.PI / 180;
  s.begin();
  for (let i = 0; i <= N; i++) {
    const t = a0 + (a1 - a0) * (i / N);
    const [X, Y] = P(a * Math.cos(t), b * Math.sin(t));
    if (i) s.line(X, Y); else s.move(X, Y);
  }

  const xs = a * Math.cos(a1);
  const xe = a * Math.cos(a0), ye = b * Math.sin(a0);
  const step = (xe - xs) / bumps;
  for (let i = 0; i < bumps; i++) {
    const px = xs + i * step, nx = px + step;
    const endY = i === bumps - 1 ? ye : -b * 0.66;
    const centreness = 1 - Math.abs((px + nx) / 2) / a;
    const [cx, cy] = P(px + step * 0.5, -b * (0.98 + 0.16 * centreness));
    const [ex, ey] = P(nx, endY);
    s.quad(cx, cy, ex, ey);
  }
  s.close();
}

/**
 * The patch as a projected surface, not as a shape in screen space.
 *
 * Every point of the face-on outline goes through `faceProject` — the exact
 * call the eyes and the mouth use — so the patch and the features are the same
 * kind of object and cannot drift apart. The lean, the bank of the fringe, the
 * crowding of the far scallops and the wrap past the limb all fall out of the
 * projection; none of them is drawn.
 *
 * Sampled rather than curved: the projection is not affine, so a Bézier
 * through it is no longer the same Bézier, and mapping control points would be
 * an approximation dressed up as a curve. At this sample count the difference
 * is under a pixel at the sizes this rig renders at.
 */
function projectedPatchPath(s, F, T, S) {
  const g = F.g || G;
  const fit = F.fit ?? 1;
  const pts = facePatchSurface(g.faceRX * fit, g.faceRY * fit, T.hairline || 0, 64, g);
  const fy = faceYaw(S.yaw), fp = facePitch(S.pitch);
  const w = faceWrapShift(fy, fp, g);
  const dx = (F.dx ?? 0) + w.x;

  /* Smoothed back into curves on the way out, through the midpoints of the
     sampled polygon. Half the commands of a polyline at the same fidelity,
     and this path is written into the file several times a frame — as the
     contour, as the fill, and as the clip the features are cut to. */
  const P = pts.map(([sx, sy]) => {
    const q = capPoint(sx, sy - g.faceCY, fy, fp, g);
    return [q.x + dx, q.y + w.y];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  s.begin();
  let m0 = mid(P[P.length - 1], P[0]);
  s.move(m0[0], m0[1]);
  for (let i = 0; i < P.length; i++) {
    const m1 = mid(P[i], P[(i + 1) % P.length]);
    s.quad(P[i][0], P[i][1], m1[0], m1[1]);
  }
  s.close();

  /* The nose belongs to the face.

     The projected patch reaches the outline but not past it, and the outline
     past it is exactly where the nose is — so the bump came out dark, a beak
     biting into a white face. Adding the face's own stretch of the leading
     edge as a second subpath hands it to every step downstream at once: it
     fills in the face colour, takes the same form light, and the eyes and
     mouth clip to it. Wound the same way as the patch, so a nonzero fill
     unions them. */
  const amt = S.profile ? profileAmount(S) : 0;
  if (amt > 0.01) {
    const midY = F.hole.y, halfH = F.hole.ry || 1;
    /* Only once the face has actually arrived at the edge. Drawn while there
       is still head between the patch and the outline, this is not a nose —
       it is a white splinter floating on the rim with a gap behind it.

       Measured on the patch's OWN outline at the height the nose occupies,
       not on its bounding box: under a nod the patch tilts inside that box
       and stops reaching the edge exactly where the nose is, and a box-based
       gap says everything is fine while a slab hangs off the cheek. */
    const dir = Math.sign(Math.sin(S.yaw)) || 1;
    const noseY = midY + halfH * 0.34;
    let reach = -Infinity;
    for (const [px, py] of P) {
      if (Math.abs(py - noseY) < halfH * 0.22) reach = Math.max(reach, dir * px);
    }
    const gap = halfWidthAt(noseY, g) - (reach > -Infinity ? reach : 0);
    const near = smooth(22, 8, gap);
    if (near > 0.01) {
      profileSub(s, S, 1, amt * near, [midY - halfH * 0.34, midY + halfH * 1.02],
                 clamp(gap + 6, 10, 26));
    }
  }
}

/** A box big enough to cover the patch, for fills that are already clipped. */
function coverPatch(s, F) {
  const { x, y, rx, ry } = F.hole;
  s.begin();
  s.ellipse(x, y, Math.max(rx, ry) * 1.6, Math.max(rx, ry) * 1.6);
}

/* --------------------------------------------------------------------- face */
function drawFace(s, S, T) {
  const g = S.g || G;
  /* Computed once per frame before anything draws and parked on the state, so
     accessories can align to the eyes without recomputing the projection —
     glasses that do not sit exactly where the eyes are look like a mistake at
     every angle except dead front. */
  const F = S._face || faceFrame(S);
  if (F.vis <= 0.01) return F;

  s.save();
  s.alpha(F.vis);

  /* The face is a hole IN the head, so it cannot leave the head.
     
     Nothing enforced that. Between about 30° and 50° of turn the fringe at the
     top of the patch reached past the outline by a few pixels — the head is an
     egg and narrows toward the crown, the patch does not know that — and a
     scalloped white band appeared hanging off the silhouette. The oval stopped
     closing inside the shape, which is the single loudest way to say "this is
     a sticker" in a drawing that has no other outlines.

     Clipped slightly inside the body, so there is always a rim of head around
     the face rather than the two edges landing on top of each other. */
  s.save();
  /* The rim closes at profile.

     Head-on, the face is clipped a shade inside the body so a rim of head
     always shows around it — two edges landing on top of each other read as a
     mistake. At profile the opposite is true: the face IS the leading edge,
     and a rim there leaves a hairline of body between the face's contour and
     the head's, which on an outlined skin is a doubled line down the nose. */
  headRegion(s, S, 0.985 + 0.015 * (S.profile ? profileAmount(S) : 0));
  s.clip();

  /* The face patch is optional. Without it the features sit straight on the
     body, which is what most of this genre does — and it is the difference
     between a character and a bowling ball, because a light disc inside a dark
     ring reads as a finger hole no matter how good the face inside it is. */
  if (T.face) {
    facePatchPath(s, F, T, S);
    /* The face's own contour is LIGHTER than the body's. At the body's weight
       the patch turns into a ring, and a light disc inside a heavy ring is the
       finger-hole reading the patch exists to avoid. */
    if (T.outline) {
      s.stroke(T.outlineFace ?? T.outline, (T.outlineFaceW ?? T.outlineW * 0.9) * 2,
               'round', 'round');
    }
    facePatchPath(s, F, T, S);
    s.fill(T.shade && T.shade.face
      ? vertical(T.shade.face.top, T.shade.face.bottom,
                 F.hole.y - F.hole.ry, F.hole.y + F.hole.ry)
      : T.face);

    /* The lip of the recess. A hole in a solid has a shaded edge on the side
       the light comes from; a decal printed on the surface does not. This one
       line is most of what separates the two readings, and it costs a clipped
       gradient. It deepens as the head turns away, because that is when more
       of the wall of the hole is facing you. */
    const amt = S.profile ? profileAmount(S) : 0;
    if (T.recess !== false) {
      /* Both of the things that darken the face deepen as it turns away, and
         at the limb they land on top of each other on a patch that is already
         on the dark side of the light — three greys stacked, and the profile
         goes to slate. They back off where the profile takes over. */
      const d = ((T.recessBase ?? 0.10) + (T.recessTurn ?? 0.24) * (1 - (F.hole.fore ?? 1)))
              * (1 - 0.7 * amt);
      s.save();
      facePatchPath(s, F, T, S);
      s.clip();
      /* The clip is the shape; the fill only has to cover it. Repeating the
         patch path here writes it into the file a third time to no effect. */
      coverPatch(s, F);
      s.fill({
        type: 'radial',
        cx: F.hole.x - F.hole.rx * 0.5, cy: F.hole.y - F.hole.ry * 0.62,
        r: F.hole.ry * 1.85,
        stops: [[0, `rgba(0,0,0,${alpha(d)})`], [0.6, 'rgba(0,0,0,0)']],
      });
      s.restore();
    }

    /* The same light that shapes the body, run across the face.

       EXPERIMENT (`faceForm`). The body carries a world-fixed form light and
       the face patch carried none, so the head reads as round and the face
       reads as a card stuck to it — brightest on the away side just as often
       as not, which is the one thing a surface on a sphere cannot do. Same
       light, same centre, same radius as the body's: continuous by
       construction rather than by matching two sets of numbers. */
    if (S.faceForm) {
      s.save();
      facePatchPath(s, F, T, S);
      s.clip();
      coverPatch(s, F);
      /* Lighter than the body's. The face is the one part of the character
         that has to stay legible on the dark side of the light: shaded to the
         same depth as the head, at profile it goes grey and the expression
         goes with it. */
      s.fill(formLight(g.R, { lit: 0.10 * S.faceForm, dark: 0.20 * S.faceForm * (1 - 0.45 * amt) }));
      s.restore();
    }
  }

  if (S.showBlush && T.blush) {
    /* Inside the patch. Spilling onto the body it reads as a bruise on any
       dark skin — a 70% pink over near-black is a purple smudge, not a cheek. */
    s.save(); s.alpha(T.blushA ?? 0.7);
    if (T.face) { facePatchPath(s, F, T, S); s.clip(); }
    /* Beside the eyes, not somewhere absolute. Blush that does not track the
       feature layout ends up under the chin the moment a character puts its
       face lower on the head. */
    for (const sx of [-(g.eyeDX + g.blushDX), g.eyeDX + g.blushDX]) {
      /* Same lagged angle as the patch and the features, or the blush ends
         up on a cheek the face has left behind. */
      const b = faceProject(sx, g.faceCY + g.eyeDY + g.blushDY,
                            S.faceLean === 2 ? faceYaw(S.yaw) : S.yaw,
                            S.faceLean === 2 ? facePitch(S.pitch) : S.pitch, g);
      b.x += F.dx ?? 0;
      if (b.z <= 0) continue;
      s.save();
      s.translate(b.x, b.y);
      s.scale(Math.abs(b.fx), Math.abs(b.fy));
      s.begin(); s.ellipse(0, 0, g.blushRX, g.blushRY); s.fill(T.blush);
      s.restore();
    }
    s.restore();
  }

  // Clip features so nothing ever spills off the character — to the patch when
  // there is one, otherwise to the silhouette itself.
  s.save();
  if (T.face) facePatchPath(s, F, T, S);
  else silhouettePath(s, g.R * 0.98, g.RY * 0.98, 0, 0, g);
  s.clip();

  if (S.xfade < 1 && S.prevExpr !== S.expr) {
    s.save(); s.alpha(1 - S.xfade); EXPRESSIONS[S.prevExpr](s, T, F, S); s.restore();
    s.save(); s.alpha(S.xfade);     EXPRESSIONS[S.expr](s, T, F, S);     s.restore();
  } else {
    EXPRESSIONS[S.expr](s, T, F, S);
  }
  s.restore();
  s.restore();   // features
  s.restore();   // the head clip
  return F;
}

/* -------------------------------------------------------------------- hands */
function handAt(S, side) {
  const g = S.g || G;
  const sgn = side === 'l' ? -1 : 1;
  const h = S.hand[side];
  return project(sgn * (g.handSX + h.out * 22), g.handSY - h.lift * g.handLift,
                 g.Rh, S.yaw, S.pitch);
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
  const g = S.g || G;
  const h = S.hand[side];
  if (h.show <= 0.01) return;
  const sgn = side === 'l' ? -1 : 1;
  const R = g.handR;
  const sq = clamp(0.55 + Math.abs(p.fx) * 0.45, 0.4, 1);

  s.save();
  s.alpha(clamp(h.show, 0, 1));
  s.translate(p.x, p.y);
  s.rotate(h.swing * sgn);
  s.scale(sgn * sq, 1);          // mirror so the thumb faces the body

  /* Thumb clearly outside the palm's silhouette — tucked inside it the shape
     collapses back into a featureless blob, which is what made the first two
     attempts read as an ear and then as a tab.

     Both pieces are stroked before either is filled, so the contour follows
     the union and no seam appears where the thumb meets the palm. */
  const thumb = () => { s.begin(); s.ellipse(-R * 0.82, -R * 0.32, R * 0.38, R * 0.30, -0.62); };
  const palm  = () => { s.begin(); s.ellipse(0, 0, R * 0.86, R * 1.02); };

  if (T.outline) {
    thumb(); s.stroke(T.outline, (T.outlineW * 2) / Math.max(0.4, sq), 'round', 'round');
    palm();  s.stroke(T.outline, (T.outlineW * 2) / Math.max(0.4, sq), 'round', 'round');
  }
  thumb(); s.fill(T.hand);
  palm();  s.fill(T.hand);
  s.restore();
}

/* ------------------------------------------------------------------- sparks */
function drawSparks(s, S, T, far) {
  const g = S.g || G;
  if (!S.showSparks) return;
  g.sparks.forEach((sp, i) => {
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
    s.translate(g.Rs * Math.sin(lon) * depth,
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
  const g = S.g || G;
  if (!S.heldLetter) return;
  const p = project(g.handSX * 0.9, g.handSY - 60, g.Rh, S.yaw, S.pitch);
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
  s.stroke(T.outline || T.body, T.outline ? T.outlineW : 4);

  /* Drawn from our own geometry, not a font: the glyph fills a unit cap-box
     centred on the origin, so it lands dead centre of the card in both
     backends with no baseline metric to disagree about. */
  /* 'ink' alignment: a card holds one letter with nothing to sit beside, so
     it wants its visible mass centred. Baseline-aligning a lowercase 'a' in a
     card just looks like the letter has slipped to the floor. */
  drawGlyph(s, S.heldLetter, 30, T.outline || T.feature || T.body, 0.145, true, 'ink');
  s.restore();
}

/* -------------------------------------------------------------- tracing */
function drawTracePanel(s, S, T) {
  const g = S.g || G;
  const tr = S.trace;
  if (!tr.active || !tr.ch) return;

  s.save();
  s.translate(g.trace.x, g.trace.y);

  /* Writing guides, the way ruled paper does it. The x-line is drawn fainter
     than the cap line and the baseline because it is a secondary rule — but it
     has to be there: without it a lowercase 'o' has nothing to sit against and
     "short letters stop here" is not something the child can see. The
     descender rule only appears for letters that actually go below. */
  const halfW = g.trace.cap * 0.62;
  const cap = g.trace.cap;
  /* Ink extents, not control-point extents: a Bézier's handles sit outside the
     curve, so an `o` would ask for a descender rule it does not need. */
  const gb = glyphPath(tr.ch);
  const inkBottom = gb.strokes.length
    ? Math.max(...gb.strokes.flatMap(st => st.pts.map(pt => pt[1])))
    : METRICS.baseline;
  const rules = [
    [METRICS.cap * cap, 0.28],
    [METRICS.xLine * cap, 0.15],
    [METRICS.baseline * cap, 0.28],
  ];
  if (inkBottom > METRICS.baseline + 0.02) rules.push([METRICS.descender * cap, 0.15]);
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
  s.translate(g.trace.x, g.trace.y);
  const pen = drawTrace(s, tr.ch, g.trace.cap, tr.u,
                        { ghost: T.ghost, ink: T.body });
  s.restore();

  /* The pen. Hidden while the stroke is lifted, so the gap between the stem
     of an A and its crossbar reads as picking the pencil up. */
  if (pen && !pen.penUp && tr.u < 1) {
    s.save();
    s.translate(g.trace.x + pen.x, g.trace.y + pen.y);
    s.begin(); s.ellipse(0, 0, 8.5, 8.5); s.fill(T.spark);
    s.begin(); s.ellipse(0, 0, 3.4, 3.4); s.fill(T.face);
    s.restore();
  }
}

/* ================================================================== render */
export function render(surface, S, T) {
  const g = S.g || G;
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
    s.ellipse(S.offX * 0.5 + S.shiftX, g.ground,
              lerp(78, 44, hgt) * (0.92 + Math.abs(Math.cos(S.yaw)) * 0.08), 11);
    s.fill(T.shadow);
    s.restore();
  }

  s.save();
  s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
  s.translate(S.shiftX, 0);

  /* motion trail — ghost silhouettes while moving fast */
  if (S.showTrail && S.trail.length > 1) {
    /* `ghost`, not `g` — the geometry is called `g` in this function now, and
       a ghost frame carries no radii. It read `undefined` and the whole trail
       came out as NaN. */
    S.trail.forEach((ghost, i) => {
      if (ghost.speed < 0.6) return;
      const k = (i + 1) / S.trail.length;
      s.save();
      s.alpha(0.16 * k * clamp(ghost.speed, 0, 1));
      s.translate(ghost.x, ghost.y);
      s.rotate(ghost.roll);
      s.begin(); s.ellipse(0, 0, g.R * 0.97, g.RY * 0.97); s.fill(T.body);
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

  /* Always behind the body: the head overlaps where they join, which is what
     makes them read as attached rather than stuck on. */
  S._face = faceFrame(S);

  /* The passes, in order. Two of them — `back` and `front` — used to be the
     whole vocabulary, which is enough for things that live on the skull and
     nothing else: a collar is in front of the body and behind the face, a held
     thing is in front of one hand and behind the other. See `PASSES`. */
  drawAccessories(s, S, T, 'rearExternal');
  drawAccessories(s, S, T, 'headRear');
  drawBody(s, S, T);
  drawAccessories(s, S, T, 'bodyFront');
  drawFace(s, S, T);
  drawAccessories(s, S, T, 'headFront');
  drawAccessories(s, S, T, 'faceFront');

  drawAccessories(s, S, T, 'heldRear');
  if (pL.z >= 0) drawHand(s, S, T, 'l', pL);
  if (pR.z >= 0) drawHand(s, S, T, 'r', pR);
  drawAccessories(s, S, T, 'heldFront');
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
