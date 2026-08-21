/**
 * The face: frame construction, eye primitives, and the expression set.
 *
 * Expressions never see angles. They receive a `frame` of already-projected
 * positions and foreshortening factors and draw into it, so adding a new
 * expression costs nothing in projection logic.
 */
import { G, faceProject, project, halfWidthAt } from './geometry.js';
import { clamp, smooth, lerp } from './math.js';
import { blendViseme, drawViseme } from './visemes.js';

/** Build the per-instant face frame from the rig's orientation. */
export function faceFrame(S) {
  const { yaw, pitch } = S;
  const lx = S.look.x * 4.5, ly = S.look.y * 3.5;

  const hole = faceProject(0, G.faceCY, yaw, pitch);

  /* How square-on the face is: 1 head-on, 0 at the limb. The recess shading
     deepens with it — more of the wall of the hole faces you as it turns.

     Tried and rejected: tilting the patch to the true ellipse of a circular cap
     (short axis along the outward normal). It is correct for a SMALL disc and
     wrong here, because this hole is a 43° cap — nearly half the visible face
     of the sphere. At that size the tilt angle swings ~64° between head-on and
     three-quarter, the fringe spins with it, and the features, which are laid
     out upright, fall out of the shape. Correct geometry, worse drawing. */
  const n = project(0, G.faceCY, G.Rf, yaw, pitch, false);
  const fore = Math.abs(n.z) / G.Rf;
  const eL   = faceProject(-G.eyeDX, G.faceCY + G.eyeDY, yaw, pitch);
  const eR   = faceProject( G.eyeDX, G.faceCY + G.eyeDY, yaw, pitch);
  const mo   = faceProject(0, G.faceCY + G.mouthDY, yaw, pitch);

  /* Fade the whole face across the terminator so nothing ever pops — and
     finish the fade EARLY.

     Two things shrink the face as the head turns, and only one of them is
     depth: the patch also narrows to nothing. Fading purely on depth left a
     six-pixel column of pale face, still a third opaque, standing in the
     middle of a dark head between about 78° and 90° — with a hard vertical
     edge and a stray blush dot beside it. At that width it does not read as a
     face turning away, it reads as a scratch on the lens. So the fade is over
     before the patch is too thin to be legible as a face. */
  const vis = smooth(0.13, 0.28, hole.z / G.Rf);

  /* The head is an EGG, and the face has to travel inside an egg.
     
     Every position in this file used to come off a sphere of radius `Rf`: the
     face slid along a circular path while the outline it lives in is narrow at
     the crown and widest below centre. So on the way round it bound against
     the outline on one side and left a gulf on the other, and the oval stopped
     closing — which reads as a piece cut out of the side of the ball rather
     than a hole in a head.

     So the turn no longer produces a POSITION, it produces a fraction: how far
     across the available room the face has travelled, −1 to 1. The room is
     whatever the egg actually gives at that height, less the patch's own width
     and the rim of body that has to stay visible all the way round. The face
     cannot bind, because binding is not expressible. */
  const RIM = 12;
  const rx0 = G.faceRX * Math.max(0.24, Math.abs(hole.fx));
  const ry0 = G.faceRY * Math.max(0.04, Math.abs(hole.fy));

  /* −1 … 1, from the UNCHEATED projection. The old wrap cheat existed to stop
     the face overhanging the outline; the room below now guarantees that by
     construction, so the travel no longer has to be shortened to be safe — and
     shortening it here as well is what made the turn read as a face that
     barely moves. */
  const u = clamp(n.x / (G.Rf * Math.cos(Math.asin(clamp(G.faceCY / G.Rf, -1, 1)))), -1, 1);

  /* The room at the face's own height, and at the top of the fringe, which is
     the part that actually ran out of head first. */
  const roomAt = (y, half) => Math.max(0, halfWidthAt(y) - RIM - half);
  const room = Math.min(
    roomAt(hole.y, rx0),
    roomAt(hole.y - ry0 * 1.14, rx0 * 0.94),
    roomAt(hole.y + ry0 * 0.92, rx0 * 0.55),
  );

  const holeX = u * room;
  /* The features are laid out around the anchor, so they move with it. Leaving
     them behind puts the face inside the hole and the eyes on the body. */
  const dx = holeX - hole.x;

  /* If even a centred patch does not fit at that height — a hard nod puts the
     face where the egg is genuinely narrower than the face is wide — it gives
     up width rather than position, down to a floor past which shrinking stops
     being a fit and starts being a different character. */
  const widest = Math.max(1, halfWidthAt(hole.y) - RIM);
  let fit = Math.min(1, widest / rx0);

  /* And the same in the other axis. A nod carries the fringe toward the crown
     and the chin toward the base, where the egg runs out of head vertically —
     defending only the width leaves the face flush with the top or bottom of
     the silhouette, which is the same failure turned ninety degrees. */
  const top = hole.y - ry0 * 1.14, bot = hole.y + ry0;
  if (top < -G.RY + RIM) fit = Math.min(fit, (hole.y + G.RY - RIM) / (ry0 * 1.14));
  if (bot > G.RY - RIM) fit = Math.min(fit, (G.RY - RIM - hole.y) / ry0);
  fit = clamp(fit, 0.72, 1);

  const eye = (p, ox, dy) => ({
    x: p.x + ox + dx, y: p.y + dy,
    fx: Math.max(0.20, Math.abs(p.fx)), fy: Math.abs(p.fy),
    a: smooth(-0.05, 0.22, p.z / G.Rf),
  });

  return {
    vis,
    /* How far the anchor was moved to keep the face inside the egg. Anything
       positioned off `faceProject` outside this file has to move with it —
       the blush did not, and ended up as a pink dot on the cheek of the body
       rather than on the face. */
    dx,
    hole: {
      x: holeX, y: hole.y,
      /* rx runs ALONG the outward direction and carries all the foreshortening;
         ry runs across it and never shortens, because a hole turning away gets
         narrower, not smaller.

         Floored, not free: left to the projection the patch keeps narrowing to
         a hairline, and the last few degrees before profile are a pale scratch
         rather than a face. Held at a legible width, it fades out as a small
         lens instead — which is what the fade is for. */
      rx: rx0 * fit, ry: ry0 * fit,
      fore,
    },
    eyeL:  eye(eL, lx * Math.abs(eL.fx), ly),
    eyeR:  eye(eR, lx * Math.abs(eR.fx), ly),
    mouth: eye(mo, 0, 0),
  };
}

/* ------------------------------------------------------------- primitives */
/* Each primitive draws at the ORIGIN. `withEye` has already translated and
   scaled by the projection, so foreshortening comes for free. */

function withEye(s, e, blink, fn) {
  if (e.a <= 0.01) return;
  s.save();
  s.alpha(e.a);
  s.translate(e.x, e.y);
  s.scale(Math.max(0.04, e.fx), e.fy * lerp(1, 0.10, blink));
  fn(s);
  s.restore();
}

const pArcUp = (s, T) => {            // ∩  happy
  s.begin(); s.arc(0, 0, G.eyeR, Math.PI * 1.02, Math.PI * 1.98);
  s.stroke(T.feature, G.eyeW);
};
const pArcDown = (s, T) => {          // ∪  content
  s.begin(); s.arc(0, 0, G.eyeR, Math.PI * 0.05, Math.PI * 0.95);
  s.stroke(T.feature, G.eyeW);
};
const pDot = (s, T, rx = G.eyeR * 0.58, ry = G.eyeR * 0.72) => {
  s.begin(); s.ellipse(0, 0, rx, ry); s.fill(T.feature);
  /* Specular highlights. Two, not one, and off-centre: a single centred dot
     reads as a pupil looking at you, two off-centre read as a wet surface,
     which is most of what makes an eye look alive rather than printed. */
  if (T.gloss) {
    s.begin(); s.ellipse(-rx * 0.34, -ry * 0.38, rx * 0.30, ry * 0.26); s.fill(T.gloss);
    s.begin(); s.ellipse( rx * 0.30,  ry * 0.30, rx * 0.16, ry * 0.14); s.fill(T.gloss);
  }
};
const pWink = (s, T, flip) => {       // >  squeezed shut
  const r = G.eyeR * 0.62;
  s.save(); s.scale(flip ? -1 : 1, 1);
  s.begin(); s.move(-r, -r * 1.3); s.line(r * 0.85, 0); s.line(-r, r * 1.3);
  s.stroke(T.feature, G.eyeW * 0.85);
  s.restore();
};
const pStar = (s, T, r = G.eyeR) => {  // ★  proud
  s.begin();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.44 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.close(); s.fill(T.feature);
};
const pSpiral = (s, T, spin) => {     // @  dizzy
  s.begin();
  for (let i = 0; i <= 56; i++) {
    const t = i / 56, a = t * Math.PI * 4 + spin, r = t * G.eyeR * 0.9;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.stroke(T.feature, 3.8);
};
const pLid = (s, T) => {              // half-closed — sleepy
  /* A sliver of eye left showing under the lid. Fully covered it reads as
     "eyes shut", which is what `content` already says; sleepy has to look like
     it is losing the fight. */
  const r = G.eyeR;
  /* Clipped, not painted over. Covering the top of the eye with a face-coloured
     rectangle worked while the face was flat; against a gradient it shows up as
     a paler patch, which is exactly the kind of thing that only appears once
     you look at it. */
  s.save();
  s.begin(); s.rect(-r * 1.2, r * 0.02, r * 2.4, r * 1.6); s.clip();
  s.begin(); s.ellipse(0, r * 0.16, r * 0.55, r * 0.62); s.fill(T.feature);
  s.restore();
  s.begin(); s.move(-r * 0.80, r * 0.02); s.quad(0, r * 0.30, r * 0.80, r * 0.12);
  s.stroke(T.feature, 4.4);
};

function brow(s, T, e, dx, dy, tilt, w = 12) {
  if (e.a <= 0.01) return;
  s.save(); s.alpha(e.a);
  s.translate(e.x + dx * e.fx, e.y + dy);
  s.scale(Math.max(0.04, e.fx), e.fy);
  s.rotate(tilt);
  s.begin(); s.move(-w, 0); s.line(w, 0);
  s.stroke(T.feature, 4.2);
  s.restore();
}

/**
 * The mouth.
 *
 * While speech is active the viseme system owns this slot entirely — the
 * expression's own mouth would fight it. Eyes and brows stay under the
 * expression's control, so "speaking while proud" reads correctly.
 */
function mouth(s, T, F, S, w, open, shape = 'o') {
  if (F.mouth.a <= 0.01) return;

  if (S.speech && S.speech.active) {
    s.save(); s.alpha(F.mouth.a);
    s.translate(F.mouth.x, F.mouth.y);
    s.scale(Math.max(0.04, F.mouth.fx), F.mouth.fy);
    drawViseme(s, T, blendViseme(S.speech.cur, S.speech.next, S.speech.blend));
    s.restore();
    return;
  }

  if (open < 0.02) return;
  s.save(); s.alpha(F.mouth.a);
  s.translate(F.mouth.x, F.mouth.y);
  s.scale(Math.max(0.04, F.mouth.fx), F.mouth.fy);
  if (shape === 'o') {
    s.begin(); s.ellipse(0, 0, w * 0.5, w * 0.5 * clamp(open, 0.12, 1.2)); s.fill(T.feature);
  } else if (shape === 'smile') {
    /* Stroked rather than filled: it stays legible at 24px in a toolbar,
       where a filled mouth turns into a smudge. */
    s.begin(); s.arc(0, -w * 0.24, w * 0.62, Math.PI * 0.13, Math.PI * 0.87);
    s.stroke(T.feature, 5.4);
  } else if (shape === 'grin') {
    /* Open smile. The flat top is the closed lip line, so it reads as an open
       mouth rather than as a hole in the face. */
    const rx = w * 0.62, ry = w * 0.52 * clamp(open, 0.35, 1.2);
    s.begin();
    s.move(-rx, 0);
    s.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
    s.close();
    s.fill(T.feature);
    /* A tongue turns an open mouth from a hole into a face. Clipped to the
       mouth so it can never spill past the lip line. */
    if (T.tongue && ry > w * 0.28) {
      s.save();
      s.begin();
      s.move(-rx, 0); s.ellipse(0, 0, rx, ry, 0, 0, Math.PI); s.close();
      s.clip();
      s.begin(); s.ellipse(0, ry * 0.72, rx * 0.56, ry * 0.62); s.fill(T.tongue);
      s.restore();
    }
  } else if (shape === 'cat') {
    /* ω — the one mouth shape that is unambiguously affectionate rather than
       merely pleased. Reserved for `content`, so it keeps meaning something. */
    const u = w * 0.34;
    s.begin();
    s.move(-2 * u, -u * 0.35);
    s.quad(-u, u * 0.95, 0, -u * 0.15);
    s.quad(u, u * 0.95, 2 * u, -u * 0.35);
    s.stroke(T.feature, 4.8);
  } else if (shape === 'wave') {
    const u = w * 0.34;
    s.begin();
    s.move(-2 * u, 0); s.quad(-u, -u * 0.85, 0, 0); s.quad(u, u * 0.85, 2 * u, 0);
    s.stroke(T.feature, 4.6);
  }
  s.restore();
}

/* ------------------------------------------------------------ expressions */
export const EXPRESSIONS = {
  /* The resting face. Round eyes with a highlight and a visible smile — this
     is what a child sees for most of a lesson, so it is the one that has to
     read as friendly with nothing happening. It used to be squinted arcs and
     no mouth at all, which read as "asleep with its eyes open". */
  happy(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pDot(x, T));
    withEye(s, F.eyeR, S.blink, x => pDot(x, T));
    mouth(s, T, F, S, 30, Math.max(S.talk, 0.55), 'smile');
  },

  excited(s, T, F, S) {
    withEye(s, F.eyeL, 0, x => pWink(x, T, false));
    withEye(s, F.eyeR, 0, x => pWink(x, T, true));
    mouth(s, T, F, S, 30, Math.max(S.talk, 0.85), 'grin');
  },

  thinking(s, T, F, S) {
    // eyes cast up and to the side — where a person actually looks to think
    withEye(s, F.eyeL, S.blink, x => { x.translate(-2.5, -5); pDot(x, T, G.eyeR * 0.50, G.eyeR * 0.62); });
    withEye(s, F.eyeR, S.blink, x => { x.translate(-2.5, -5); pDot(x, T, G.eyeR * 0.50, G.eyeR * 0.62); });
    brow(s, T, F.eyeL, -2, -28, -0.07);
    brow(s, T, F.eyeR,  0, -31, -0.13);
    mouth(s, T, F, S, 22, Math.max(S.talk, 0.45), 'wave');
  },

  surprised(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pDot(x, T, G.eyeR * 0.68, G.eyeR * 0.84));
    withEye(s, F.eyeR, S.blink, x => pDot(x, T, G.eyeR * 0.68, G.eyeR * 0.84));
    brow(s, T, F.eyeL, 0, -28, -0.10, 12);
    brow(s, T, F.eyeR, 0, -28,  0.10, 12);
    mouth(s, T, F, S, 22, Math.max(S.talk, 0.9), 'o');
  },

  proud(s, T, F, S) {
    withEye(s, F.eyeL, S.blink * 0.4, x => pStar(x, T));
    withEye(s, F.eyeR, S.blink * 0.4, x => pStar(x, T));
    mouth(s, T, F, S, 34, Math.max(S.talk, 0.7), 'grin');
  },

  sleepy(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pLid(x, T));
    withEye(s, F.eyeR, S.blink, x => pLid(x, T));
    mouth(s, T, F, S, 16, 0.42, 'o');
  },

  confused(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pDot(x, T, G.eyeR * 0.42, G.eyeR * 0.52));   // squinting
    withEye(s, F.eyeR, S.blink, x => pDot(x, T, G.eyeR * 0.66, G.eyeR * 0.82));   // wide
    brow(s, T, F.eyeL, 0, -21,  0.20, 11);                                        // low
    brow(s, T, F.eyeR, 0, -31, -0.12, 12);                                        // way up
    mouth(s, T, F, S, 24, 1, 'wave');
  },

  dizzy(s, T, F, S) {
    withEye(s, F.eyeL, 0, x => pSpiral(x, T,  S.t * 4));
    withEye(s, F.eyeR, 0, x => pSpiral(x, T, -S.t * 4));
    mouth(s, T, F, S, 26, 0.7, 'wave');
  },

  /* Closed happy arcs and a ω mouth: the most affectionate face in the set,
     which is why it is `content` and not the default. */
  content(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pArcUp(x, T));
    withEye(s, F.eyeR, S.blink, x => pArcUp(x, T));
    mouth(s, T, F, S, 30, Math.max(S.talk, 0.6), 'cat');
  },
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
