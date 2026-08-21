/**
 * The face: frame construction, eye primitives, and the expression set.
 *
 * Expressions never see angles. They receive a `frame` of already-projected
 * positions and foreshortening factors and draw into it, so adding a new
 * expression costs nothing in projection logic.
 */
import { G, faceProject } from './geometry.js';
import { clamp, smooth, lerp } from './math.js';
import { blendViseme, drawViseme } from './visemes.js';

/** Build the per-instant face frame from the rig's orientation. */
export function faceFrame(S) {
  const { yaw, pitch } = S;
  const lx = S.look.x * 4.5, ly = S.look.y * 3.5;

  const hole = faceProject(0, G.faceCY, yaw, pitch);
  const eL   = faceProject(-G.eyeDX, G.faceCY + G.eyeDY, yaw, pitch);
  const eR   = faceProject( G.eyeDX, G.faceCY + G.eyeDY, yaw, pitch);
  const mo   = faceProject(0, G.faceCY + G.mouthDY, yaw, pitch);

  // Fade the whole face across the terminator so nothing ever pops.
  const vis = smooth(-0.02, 0.30, hole.z / G.Rf);
  const eye = (p, dx, dy) => ({
    x: p.x + dx, y: p.y + dy,
    fx: Math.abs(p.fx), fy: Math.abs(p.fy),
    a: smooth(-0.05, 0.22, p.z / G.Rf),
  });

  return {
    vis,
    hole: {
      x: hole.x, y: hole.y,
      rx: G.faceRX * Math.max(0.04, Math.abs(hole.fx)),
      ry: G.faceRY * Math.max(0.04, Math.abs(hole.fy)),
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
const pDot = (s, T, rx = 7, ry = 9) => {
  s.begin(); s.ellipse(0, 0, rx, ry); s.fill(T.feature);
};
const pWink = (s, T, flip) => {       // >  squeezed shut
  s.save(); s.scale(flip ? -1 : 1, 1);
  s.begin(); s.move(-7, -9); s.line(6, 0); s.line(-7, 9);
  s.stroke(T.feature, G.eyeW);
  s.restore();
};
const pStar = (s, T, r = 13) => {     // ★  proud
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
    const t = i / 56, a = t * Math.PI * 4 + spin, r = t * 11.5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.stroke(T.feature, 3.4);
};
const pLid = (s, T) => {              // heavy droopy lid — sleepy
  s.begin(); s.ellipse(0, 0, 7, 9); s.fill(T.feature);
  s.begin(); s.rect(-13, -15, 26, 17); s.fill(T.face);   // lid painted back over
  s.begin(); s.move(-11, 1.5); s.quad(0, -1.5, 11, 3);
  s.stroke(T.feature, 4.2);
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
    s.begin(); s.arc(0, -3, w * 0.6, Math.PI * 0.15, Math.PI * 0.85);
    s.stroke(T.feature, 5);
  } else if (shape === 'wave') {
    s.begin(); s.move(-9, 0); s.quad(-4.5, -5, 0, 0); s.quad(4.5, 5, 9, 0);
    s.stroke(T.feature, 4.5);
  }
  s.restore();
}

/* ------------------------------------------------------------ expressions */
export const EXPRESSIONS = {
  happy(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pArcUp(x, T));
    withEye(s, F.eyeR, S.blink, x => pArcUp(x, T));
    mouth(s, T, F, S, 13, S.talk, 'o');
  },

  excited(s, T, F, S) {
    withEye(s, F.eyeL, 0, x => pWink(x, T, false));
    withEye(s, F.eyeR, 0, x => pWink(x, T, true));
    mouth(s, T, F, S, 15, Math.max(S.talk, 0.55), 'o');
  },

  thinking(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => { x.translate(-2, -5); pDot(x, T, 6.5, 8); });
    withEye(s, F.eyeR, S.blink, x => { x.translate(-2, -5); pDot(x, T, 6.5, 8); });
    brow(s, T, F.eyeL, -2, -26, -0.07);
    brow(s, T, F.eyeR,  0, -28, -0.13);
    mouth(s, T, F, S, 10, Math.max(S.talk, 0.35), 'wave');
  },

  surprised(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pDot(x, T, 7.5, 9.5));
    withEye(s, F.eyeR, S.blink, x => pDot(x, T, 7.5, 9.5));
    brow(s, T, F.eyeL, 0, -24, -0.10, 11);
    brow(s, T, F.eyeR, 0, -24,  0.10, 11);
    mouth(s, T, F, S, 12, Math.max(S.talk, 0.8), 'o');
  },

  proud(s, T, F, S) {
    withEye(s, F.eyeL, S.blink * 0.4, x => pStar(x, T));
    withEye(s, F.eyeR, S.blink * 0.4, x => pStar(x, T));
    mouth(s, T, F, S, 16, Math.max(S.talk, 0.6), 'smile');
  },

  sleepy(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pLid(x, T));
    withEye(s, F.eyeR, S.blink, x => pLid(x, T));
    mouth(s, T, F, S, 9, 0.5, 'o');
  },

  confused(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pDot(x, T, 5.5, 7));      // squinting
    withEye(s, F.eyeR, S.blink, x => pDot(x, T, 7.5, 9.5));    // wide
    brow(s, T, F.eyeL, 0, -19,  0.20, 10);                     // low
    brow(s, T, F.eyeR, 0, -28, -0.12, 11);                     // way up
    mouth(s, T, F, S, 11, 1, 'wave');
  },

  dizzy(s, T, F, S) {
    withEye(s, F.eyeL, 0, x => pSpiral(x, T,  S.t * 4));
    withEye(s, F.eyeR, 0, x => pSpiral(x, T, -S.t * 4));
    mouth(s, T, F, S, 13, 0.7, 'wave');
  },

  content(s, T, F, S) {
    withEye(s, F.eyeL, S.blink, x => pArcDown(x, T));
    withEye(s, F.eyeR, S.blink, x => pArcDown(x, T));
    mouth(s, T, F, S, 14, Math.max(S.talk, 0.5), 'smile');
  },
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
