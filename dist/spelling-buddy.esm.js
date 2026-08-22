var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/core/math.js
var lerp = (a, b, t) => a + (b - a) * t;
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
var smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
var TAU = Math.PI * 2;
var deg = (d) => d * Math.PI / 180;
var rad = (r) => r * 180 / Math.PI;
function makeRandom(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.reseed = (s) => {
    a = s >>> 0;
  };
  return next;
}
function spring(pos, vel, target, dt, k = 190, d = 15) {
  vel += ((target - pos) * k - vel * d) * dt;
  return [pos + vel * dt, vel];
}
var approach = (cur, target, h, dt) => lerp(cur, target, 1 - Math.pow(h, dt));

// src/core/paint.js
var alpha = (a) => +(+a).toFixed(4);
var isGradient = (p) => !!p && typeof p === "object" && Array.isArray(p.stops);
function paintKey(p) {
  if (!isGradient(p)) return String(p);
  const nums = p.type === "linear" ? [p.x0, p.y0, p.x1, p.y1] : [p.cx, p.cy, p.r, p.fx ?? p.cx, p.fy ?? p.cy];
  return p.type + ":" + nums.map((v) => (+v).toFixed(2)).join(",") + ":" + p.stops.map(([o, c]) => `${(+o).toFixed(3)}${c}`).join("|");
}
function vertical(top, bottom, y0, y1, mid) {
  const stops = mid ? [[0, top], [0.55, mid], [1, bottom]] : [[0, top], [1, bottom]];
  return { type: "linear", x0: 0, y0, x1: 0, y1, stops };
}
function sheen(cx, cy, r, inner, outer, fx = cx, fy = cy) {
  return { type: "radial", cx, cy, r, fx, fy, stops: [[0, inner], [1, outer]] };
}
function formLight(r, {
  lit = 0.13,
  dark = 0.26,
  cx = -0.34,
  cy = -0.4,
  spread = 1.62,
  mid = 0.42
} = {}) {
  return {
    type: "radial",
    cx: cx * r,
    cy: cy * r,
    r: r * spread,
    stops: [
      [0, `rgba(255,255,255,${alpha(lit)})`],
      [mid, "rgba(255,255,255,0)"],
      [1, `rgba(0,0,0,${alpha(dark)})`]
    ]
  };
}
function mix(a, b, t) {
  const parse = (h) => {
    const s = h.replace("#", "");
    const v = s.length === 3 ? s.split("").map((c2) => c2 + c2).join("") : s;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a), [r2, g2, b2] = parse(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
var lighten = (hex, t) => mix(hex, "#FFFFFF", t);
var darken = (hex, t) => mix(hex, "#000000", t);

// src/core/theme.js
var TOKENS = {
  canvas: "#FFFFFF",
  ink: "#16161A",
  green: "#2CB02B",
  blue: "#1478C9",
  cream: "#F6F1E7"
};
var base = {
  /* Optional sticker treatment. `outline` draws a contour under every fill,
     `ears` puts two shapes on the silhouette, `tongue` fills an open mouth.
     All three are off unless a theme asks for them, so the flat drawing stays
     the default and nothing existing changes shape. */
  outline: null,
  outlineW: 5,
  ears: null,
  tongue: null,
  hairline: 0,
  // scallops across the top of the face patch
  blush: "rgba(255,138,168,0.50)",
  ghost: "rgba(22,22,26,0.12)",
  // the un-traced letter
  correct: TOKENS.green,
  wrong: TOKENS.blue,
  /* What anything WORN is painted in. Warm gold reads against eleven of the
     twelve skins; on amber it is very nearly the character's own colour, and a
     cap the same colour as the head is not a cap, it is a haircut. That one is
     overridden in the skin rather than computed, because contrast is a
     judgement — and the invariant in `scripts/visual.mjs` is what keeps the
     judgement honest when a thirteenth skin arrives. */
  accent: "#FFC94A"
};
function shadeFor(body) {
  return {
    /* The brand colour itself is the middle stop, not merely the average of
       two approximations of it. INK is *the* action colour in v4.1, so it has
       to actually be present in the character, with the light above it and the
       shadow below. */
    body: { top: lighten(body, 0.16), mid: body, bottom: darken(body, 0.3) },
    sheen: 0.1,
    face: { top: "#FFFFFF", bottom: "#F1F1F5" }
  };
}
function lum(hex) {
  const v = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function formFor(body) {
  const L2 = lum(body);
  return { formLit: 0.3 + 0.85 * Math.min(1, L2 / 0.25), formDark: 1.05 - 0.45 * L2 };
}
function skin(name, body, o = {}) {
  return {
    ...base,
    name,
    shade: null,
    hairline: 3,
    gloss: "#FFFFFF",
    body,
    bodyDeep: o.bodyDeep ?? lighten(body, 0.34),
    hand: o.hand ?? darken(body, 0.14),
    /* The hairline fringe. Its own slot, defaulting to the body — set it and
       the fringe becomes a separate mass instead of a silhouette detail. */
    hair: o.hair ?? null,
    /* The face tints with the skin. A white face under a coloured head reads
       as two unrelated things; a 6% wash of the body colour makes the whole
       character one palette while staying comfortably light behind the
       features. */
    face: o.face ?? mix(body, TOKENS.canvas, 0.94),
    feature: o.feature ?? TOKENS.ink,
    spark: o.spark ?? TOKENS.blue,
    accent: o.accent ?? base.accent,
    blush: o.blush ?? "rgba(255,138,168,0.42)",
    shadow: rgba(body, 0.15),
    ghost: rgba(body, 0.16),
    confetti: o.confetti ?? [TOKENS.green, TOKENS.blue, body, "#FFC94A"]
  };
}
function rgba(hex, a) {
  const v = hex.replace("#", "");
  const f = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`;
}
var kawaiiBase = {
  shade: null,
  hairline: 3,
  gloss: "#FFFDF8",
  glossScale: 1.06,
  outlineW: 3.25,
  outlineFaceW: 2.9,
  spark: TOKENS.blue,
  /* Softer, wider, and much shallower than the flat set's: a pastel body has
     no near-black to hide a hard terminator in. */
  formBase: 0.08,
  formBaseDark: 0.1,
  formSpread: 1.95,
  formMid: 0.58,
  formCX: -0.38,
  formCY: -0.42,
  formLit: 1,
  formDark: 1,
  recessBase: 0.04,
  recessTurn: 0.08,
  blushA: 0.46
};
var THEMES = {
  /**
   * v4.1 default. INK body on white canvas — the character is drawn in the
   * action colour, which makes it read as part of the product's voice rather
   * than as decoration. Blue is reserved for the sparks (attention/selection)
   * and green appears only on correct-answer feedback.
   */
  ink: {
    ...base,
    name: "ink",
    /* Flat, deliberately. A smooth top-to-bottom ramp is how you paint a
       sphere, and v4.1 treats INK as a flat action colour — the gradient was
       working against both. */
    shade: null,
    hairline: 3,
    gloss: "#FFFFFF",
    body: TOKENS.ink,
    /* The whorl has to read against a flat, near-black body. */
    bodyDeep: "#5C5C6E",
    hand: "#2A2A31",
    face: TOKENS.canvas,
    feature: TOKENS.ink,
    spark: TOKENS.blue,
    shadow: "rgba(22,22,26,0.13)",
    blush: "rgba(255,138,168,0.42)",
    ghost: "rgba(22,22,26,0.13)",
    confetti: [TOKENS.green, TOKENS.blue, TOKENS.ink, "#FFC94A", TOKENS.cream]
  },
  /** Selection-blue body. Softer, more "assistant", still on-token. */
  blue: {
    ...base,
    name: "blue",
    body: TOKENS.blue,
    bodyDeep: "#0F63A8",
    hand: "#1160A6",
    face: TOKENS.canvas,
    feature: TOKENS.ink,
    spark: TOKENS.ink,
    shadow: "rgba(20,120,201,0.16)",
    ghost: "rgba(20,120,201,0.18)",
    confetti: [TOKENS.green, TOKENS.blue, "#FFC94A", TOKENS.ink, "#7EC4F2"]
  },
  /** Warm editorial variant — cream field, ink character. */
  cream: {
    ...base,
    name: "cream",
    body: TOKENS.ink,
    bodyDeep: "#33333A",
    hand: "#2A2A31",
    face: TOKENS.cream,
    feature: TOKENS.ink,
    /* Not green. v4.1 reserves it for progress and correct-answer feedback,
       and sparks are decoration. */
    spark: TOKENS.blue,
    shadow: "rgba(22,22,26,0.12)",
    confetti: [TOKENS.green, TOKENS.blue, "#FFC94A", TOKENS.ink]
  },
  /** The original exploration colour. Kept so v1/v2 output stays reproducible. */
  indigo: skin("indigo", "#4A56D8", { spark: "#FFC94A" }),
  /* ------------------------------------------------------------------ skins
       One character, many colours. Everything below is the same silhouette,
       the same face and the same hairline — only the palette moves, which is
       what makes them read as a cast rather than as different characters.
  
       v4.1 position, stated plainly: `ink`, `blue` and `cream` are on-token.
       The rest are exploration colours and deliberately exclude green, which
       the brand reserves for progress and correct-answer feedback — a green
       character would spend the "you got it right" colour on decoration. */
  slate: skin("slate", "#3A4356"),
  plum: skin("plum", "#7B4B94", { spark: "#FFC94A" }),
  berry: skin("berry", "#B0407A", { spark: "#FFC94A" }),
  coral: skin("coral", "#E2664F", { face: "#FFF6F1", spark: TOKENS.blue }),
  amber: skin("amber", "#D9902B", {
    face: "#FFFBF0",
    feature: "#4A3312",
    spark: TOKENS.blue,
    accent: "#F6F1E7"
  }),
  teal: skin("teal", "#17808C", { face: "#F1FBFC" }),
  rose: skin("rose", "#E38AA6", { face: "#FFF7F9", feature: "#5A2A3A", spark: TOKENS.ink }),
  /** Inverted: a pale character with ink features.
  
        Deepened from `#EEF1F7`. The character is a light face inside a darker
        head, and at that value the two closed up: what rendered was a blank egg
        with a pair of eyes floating on it. The face had not gone anywhere —
        there was simply nothing to say where it ended. */
  snow: skin("snow", "#D9E0EC", {
    face: "#FFFFFF",
    feature: TOKENS.ink,
    hand: "#C6D0E0",
    spark: TOKENS.blue,
    blush: "rgba(240,150,165,0.60)"
  }),
  /* ------------------------------------------------------------- kawaii set
  
       A different reading of the same character: the darkest value in the
       drawing is the CONTOUR, not a field of near-black. Every one of them
       carries an outline, because a drawn line is what the whole cute-sticker
       idiom is built on — without it a pastel body on white canvas is a stain,
       not a character.
  
       Three weights of line, deliberately: the body's, the face patch's at
       ninety per cent of it, and nothing at all inside. The face's own edge at
       the body's weight turns the patch into a ring, which is the finger-hole
       the patch exists to avoid.
  
       The form light is softer and wider than the flat set's, and the recess is
       nearly off: this palette has no near-black to hide a hard terminator in. */
  oat: {
    ...base,
    ...kawaiiBase,
    name: "oat",
    body: "#DCC4AE",
    face: "#FFF9F2",
    outline: "#4B3C38",
    feature: "#51413E",
    blush: "#E8A7AF",
    accent: "#78BCE6",
    bodyDeep: "#4B3C38",
    hand: "#D3B8A0",
    shadow: rgba("#4B3C38", 0.13),
    ghost: rgba("#4B3C38", 0.16),
    confetti: [TOKENS.green, TOKENS.blue, "#DCC4AE", "#78BCE6"]
  },
  strawberry: {
    ...base,
    ...kawaiiBase,
    name: "strawberry",
    body: "#F0B8C5",
    face: "#FFF8F6",
    outline: "#563844",
    feature: "#5F414A",
    blush: "#E48FA3",
    accent: "#F6C451",
    bodyDeep: "#563844",
    hand: "#E7A9B8",
    shadow: rgba("#563844", 0.13),
    ghost: rgba("#563844", 0.16),
    confetti: [TOKENS.green, TOKENS.blue, "#F0B8C5", "#F6C451"]
  },
  sky: {
    ...base,
    ...kawaiiBase,
    name: "sky",
    body: "#A9D5EB",
    face: "#FAFDFF",
    outline: "#334A59",
    feature: "#3C515E",
    blush: "#E8A8B5",
    accent: "#F2BD64",
    bodyDeep: "#334A59",
    hand: "#9BCBE4",
    shadow: rgba("#334A59", 0.13),
    ghost: rgba("#334A59", 0.16),
    confetti: [TOKENS.green, TOKENS.blue, "#A9D5EB", "#F2BD64"]
  },
  lavender: {
    ...base,
    ...kawaiiBase,
    name: "lavender",
    body: "#C5B9E8",
    face: "#FCFAFF",
    outline: "#433B59",
    feature: "#4B435F",
    blush: "#E1A1BB",
    accent: "#F3C65C",
    bodyDeep: "#433B59",
    hand: "#B9ACE0",
    shadow: rgba("#433B59", 0.13),
    ghost: rgba("#433B59", 0.16),
    confetti: [TOKENS.green, TOKENS.blue, "#C5B9E8", "#F3C65C"]
  },
  apricot: {
    ...base,
    ...kawaiiBase,
    name: "apricot",
    body: "#F0C08F",
    face: "#FFF9F0",
    outline: "#594033",
    feature: "#61493D",
    blush: "#E99AA5",
    accent: "#78BFE3",
    bodyDeep: "#594033",
    hand: "#E6B37F",
    shadow: rgba("#594033", 0.13),
    ghost: rgba("#594033", 0.16),
    confetti: [TOKENS.green, TOKENS.blue, "#F0C08F", "#78BFE3"]
  },
  inkling: {
    ...base,
    ...kawaiiBase,
    name: "inkling",
    body: "#34323B",
    face: "#FFF8F2",
    outline: "#16161A",
    feature: "#2B2730",
    blush: "#DFA1AC",
    accent: "#F1C65B",
    bodyDeep: "#5C5C6E",
    hand: "#2A2A31",
    shadow: rgba("#16161A", 0.13),
    ghost: rgba("#16161A", 0.16),
    confetti: [TOKENS.green, TOKENS.blue, "#34323B", "#F1C65B"]
  }
};
var DEFAULT_THEME = "ink";
var withForm = (t) => "formLit" in t ? t : { ...t, ...formFor(t.body) };
function resolveTheme(theme) {
  if (!theme) return withForm({ ...THEMES[DEFAULT_THEME] });
  if (typeof theme === "string") {
    const t = THEMES[theme];
    if (!t) throw new Error(`Unknown theme "${theme}". Available: ${Object.keys(THEMES).join(", ")}`);
    return withForm({ ...t });
  }
  const baseName = theme.extends || DEFAULT_THEME;
  const merged = { ...THEMES[baseName], ...theme };
  if (theme.body && !("shade" in theme) && THEMES[baseName].shade) merged.shade = shadeFor(theme.body);
  if (theme.body && !("formLit" in theme)) {
    delete merged.formLit;
    delete merged.formDark;
  }
  return withForm(merged);
}

// src/core/geometry.js
var DESIGN = 320;
var G = {
  R: 100,
  // body radius, x
  RY: 104,
  // body radius, y
  Rf: 96,
  // radius of the sphere FACE features live on
  Rh: 134,
  // radius of the sphere HANDS orbit on
  Rs: 124,
  // radius of the sphere SPARKS orbit on
  /* Baby schema, applied deliberately: a larger face hole, features set below
     its midline, and eyes big enough to carry a highlight. Those three numbers
     are most of what separates "a circle with a face" from something a five
     year old wants to look at. */
  /* Silhouette shape. `blob: 0` is a plain ellipse — a ball. Above zero the
     outline becomes an egg: narrower and flatter across the top, widest below
     centre, settling onto a broad base. It is a small change in the numbers
     and the whole difference between a creature and a bowling ball. */
  blob: 0.28,
  // 0 = ellipse, 1 = full egg. Just enough to stop it reading
  blobLow: 0.1,
  // as a sphere, not so much that it stops being the same shape
  footR: 0,
  // little feet at the base; 0 = none
  footDX: 34,
  footDY: 4,
  /* The face hole sits LOW and large, not concentric. A light circle dead
     centre in a dark one is a bowling ball — that is the whole gestalt, and no
     amount of work on the face inside it helps. Drop it and the INK stops
     being a ring and starts being hair. */
  faceCY: 26,
  // face-hole centre in surface coords
  faceRX: 66,
  faceRY: 67,
  eyeDX: 23,
  // eye offset from face centre
  eyeDY: 9,
  eyeR: 16,
  // eye arc radius — arcs, stars, winks, spirals
  eyeW: 12,
  // eye stroke weight
  /* The resting eye's own radii. Null means "derive them from `eyeR`", which
     is what the rig did when every eye was a dot; naming them separately is
     what lets an eye be TALLER than it is wide without dragging every other
     expression's proportions with it. */
  eyeRX: null,
  eyeRY: null,
  mouthDY: 31,
  mouthW: 30,
  // resting mouth width
  /* Cheeks, relative to the eye layout — see the note in `drawFace`. */
  blushDX: 15,
  // out from the eye
  blushDY: 7,
  // down from the eye
  blushRX: 11.5,
  blushRY: 7,
  earSX: 93,
  // ears sit on the silhouette, surface coords
  earSY: -22,
  earR: 31,
  // ear radius at full-front
  earRY: 1,
  // ear vertical scale (>1 = long and floppy)
  earTilt: 0,
  // radians, mirrored per side
  handSX: 106,
  // hand rest position, surface coords
  handSY: 44,
  handR: 20,
  handLift: 58,
  // how far one unit of `lift` raises a hand
  ground: 126,
  // y of the ground-shadow ellipse
  // where the traced letter sits while the character stands aside
  trace: { x: 64, y: 2, cap: 118, shift: -84, scale: 0.68 },
  sparks: [
    { a: Math.asin(56 / 124), y: -128, rx: 11, ry: 21, rot: 0.32 },
    { a: Math.asin(92 / 124), y: -103, rx: 9, ry: 17, rot: 0.95 },
    { a: Math.asin(105 / 124), y: -66, rx: 7, ry: 13, rot: 1.4 }
  ]
};
var WRAP_X = 0.54;
var WRAP_Y = 0.3;
function project(sx, sy, R3, yaw, pitch, useWrap = true) {
  const lon = Math.asin(clamp(sx / R3, -1, 1)) + yaw;
  const lat = Math.asin(clamp(sy / R3, -1, 1)) + pitch;
  const cl = Math.cos(lat);
  const wx = useWrap ? 1 - WRAP_X * Math.abs(Math.sin(yaw)) : 1;
  const wy = useWrap ? 1 - WRAP_Y * Math.abs(Math.sin(pitch)) : 1;
  return {
    x: R3 * Math.sin(lon) * cl * wx,
    y: R3 * Math.sin(lat) * wy,
    z: R3 * Math.cos(lon) * cl,
    fx: Math.cos(lon),
    fy: Math.cos(lat)
  };
}
function faceProject(sx, sy, yaw, pitch, g = G) {
  const aW = project(0, g.faceCY, g.Rf, yaw, pitch, true);
  const a0 = project(0, g.faceCY, g.Rf, yaw, pitch, false);
  const q = project(sx, sy, g.Rf, yaw, pitch, false);
  return { x: q.x + (aW.x - a0.x), y: q.y + (aW.y - a0.y), z: q.z, fx: q.fx, fy: q.fy };
}
var FACE_LAG = 0.22;
function faceYaw(yaw) {
  return yaw * (1 - FACE_LAG * Math.abs(Math.sin(yaw)));
}
function facePitch(pitch) {
  return pitch * (1 - FACE_LAG * 0.5 * Math.abs(Math.sin(pitch)));
}
function capPoint(u, v, yaw, pitch, g = G) {
  const R3 = g.Rf;
  const latC = Math.asin(clamp(g.faceCY / R3, -1, 1));
  const cc = Math.cos(latC), sc = Math.sin(latC);
  const d = Math.hypot(u, v);
  let X2, Y, Z;
  if (d < 1e-6) {
    X2 = 0;
    Y = sc;
    Z = cc;
  } else {
    const th = d / R3, ct = Math.cos(th), st = Math.sin(th);
    const mu = u / d, mv = v / d;
    X2 = mu * st;
    Y = sc * ct + mv * cc * st;
    Z = cc * ct - mv * sc * st;
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = X2 * cy + Z * sy, z1 = -X2 * sy + Z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = Y * cp + z1 * sp, z2 = -Y * sp + z1 * cp;
  return { x: x1 * R3, y: y2 * R3, z: z2 * R3 };
}
function faceWrapShift(yaw, pitch, g = G) {
  const aW = project(0, g.faceCY, g.Rf, yaw, pitch, true);
  const a0 = project(0, g.faceCY, g.Rf, yaw, pitch, false);
  return { x: aW.x - a0.x, y: aW.y - a0.y };
}
function facePatchSurface(rx, ry, fringe = 0, N = 132, g = G) {
  const pts = [];
  const cy = g.faceCY;
  const spec = fringeSpec(fringe);
  const bumps = spec.bumps || 0;
  if (!bumps) {
    for (let i = 0; i < N; i++) {
      const t = i / N * Math.PI * 2;
      pts.push([rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    return pts;
  }
  const a0 = -20 * Math.PI / 180, a1 = 200 * Math.PI / 180;
  const M2 = Math.round(N * 0.62);
  for (let i = 0; i <= M2; i++) {
    const t = a0 + (a1 - a0) * (i / M2);
    pts.push([rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  const xs = rx * Math.cos(a1), xe = rx * Math.cos(a0);
  const ye = cy + ry * Math.sin(a0);
  const step = (xe - xs) / bumps;
  const per = Math.max(5, Math.round((N - M2) / bumps));
  let fromX = xs, fromY = cy + ry * Math.sin(a1);
  for (let i = 0; i < bumps; i++) {
    const px = xs + i * step, nx = px + step;
    const endY = i === bumps - 1 ? ye : cy - ry * (0.66 + 0.3 * (spec.parting || 0) * dip(i, bumps));
    const mid = (px + nx) / 2;
    const centreness = 1 - Math.abs(mid - (spec.lift || 0) * rx) / rx;
    const from = spec.split ? 1 - centreness : centreness;
    const rise = 0.16 * (spec.body ?? 1) * Math.pow(Math.max(0, from), spec.focus ?? 1);
    const cx = px + step * 0.5, cty = cy - ry * (0.98 + rise);
    for (let j = 1; j <= per; j++) {
      const u = j / per, m = 1 - u;
      pts.push([
        m * m * fromX + 2 * m * u * cx + u * u * nx,
        m * m * fromY + 2 * m * u * cty + u * u * endY
      ]);
    }
    fromX = nx;
    fromY = endY;
  }
  return pts;
}
function dip(i, n2) {
  if (n2 < 2) return 0;
  const t = (i + 1) / n2;
  return Math.max(0, 1 - Math.abs(t - 0.5) * 4);
}
var FRINGES = {
  smooth: { bumps: 0 },
  "soft-3": { bumps: 3 },
  "soft-5": { bumps: 5 },
  /* One tall scallop in the middle, and the rise concentrated hard enough to
     read as a tuft rather than as a slightly uneven fringe. The first values
     here were too polite — every fringe came out looking like `soft-3` with a
     wobble, which is a variant, not a character. */
  "center-tuft": { bumps: 3, body: 3.4, focus: 2.6 },
  "side-left": { bumps: 4, lift: -0.8, body: 2.6, focus: 1.1 },
  "side-right": { bumps: 4, lift: 0.8, body: 2.6, focus: 1.1 },
  /* A parting is the only one of these that is about the GAPS rather than the
     bumps: high at the temples, low down the middle. Measured from the centre
     like the others it came out as a tuft — the exact shape it is meant to be
     the opposite of. */
  curtain: { bumps: 4, body: 2.6, parting: 1.5, focus: 1.2, split: true }
};
var FRINGE_NAMES = Object.keys(FRINGES);
var EARS = {
  none: null,
  nub: { sx: 93, sy: -18, r: 20, ry: 1, tilt: 0, kind: "round" },
  round: { sx: 93, sy: -22, r: 31, ry: 1, tilt: 0, kind: "round" },
  point: { sx: 90, sy: -30, r: 27, ry: 1.3, tilt: 0.34, kind: "point" },
  flop: { sx: 96, sy: 4, r: 26, ry: 1.85, tilt: 0.82, kind: "flop" }
};
var EAR_NAMES = Object.keys(EARS);
function earSpec(e) {
  if (e == null) return null;
  if (typeof e === "string") {
    if (!(e in EARS)) throw new Error(`unknown ear "${e}". Available: ${EAR_NAMES.join(", ")}`);
    return EARS[e];
  }
  return e;
}
function fringeSpec(f) {
  if (f == null || f === 0) return FRINGES.smooth;
  if (typeof f === "number") return { bumps: f };
  if (typeof f === "string") {
    const spec = FRINGES[f];
    if (!spec) throw new Error(`unknown fringe "${f}". Available: ${FRINGE_NAMES.join(", ")}`);
    return spec;
  }
  return f;
}
function silhouettePath(s, rx, ry, ox = 0, oy = 0, g = G) {
  s.begin();
  silhouetteSub(s, rx, ry, ox, oy, g);
}
function silhouetteSub(s, rx, ry, ox = 0, oy = 0, g = G) {
  const t = g.blob;
  if (t <= 0) {
    s.ellipse(ox, oy, rx, ry);
    return;
  }
  const top = 1 - 0.3 * t;
  const low = g.blobLow * t;
  const base2 = 1 - 0.18 * t;
  const yw = oy + ry * low;
  s.move(ox, oy - ry);
  s.cubic(ox + rx * 0.62 * top, oy - ry, ox + rx, oy - ry * 0.42, ox + rx, yw);
  s.cubic(ox + rx, oy + ry * 0.7, ox + rx * base2 * 0.66, oy + ry, ox, oy + ry);
  s.cubic(ox - rx * base2 * 0.66, oy + ry, ox - rx, oy + ry * 0.7, ox - rx, yw);
  s.cubic(ox - rx, oy - ry * 0.42, ox - rx * 0.62 * top, oy - ry, ox, oy - ry);
  s.close();
}
var LOBE = (y, at, w) => Math.exp(-(((y - at) / w) ** 2));
function profileOffset(y, faceY, g = G) {
  if (faceY === void 0) faceY = g.faceCY;
  const d = y - faceY;
  return 4 * LOBE(d, -26, 18) - 3 * LOBE(d, 6, 8) + 10 * LOBE(d, 22, 11.5) - 4 * LOBE(d, 30, 8) + 6 * LOBE(d, 38, 10);
}
function profileAmount(S) {
  const a = (Math.abs(Math.sin(S.yaw)) - 0.72) / 0.26;
  const ramp = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
  if (ramp <= 0) return 0;
  const c = Math.cos(S.yaw);
  const f = (c + 0.12) / 0.12;
  const front = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
  const q = (Math.abs(S.pitch || 0) - 0.18) / 0.32;
  const nod = q <= 0 ? 1 : q >= 1 ? 0 : 1 - q * q * (3 - 2 * q);
  return ramp * front * nod;
}
function profileSub(s, S, k = 1, amt = profileAmount(S), band = null, inset = 10) {
  if (amt <= 2e-3) return false;
  const g = S.g || G;
  const dir = Math.sign(Math.sin(S.yaw)) || 1;
  const faceY = faceProject(0, g.faceCY, S.yaw, S.pitch, g).y;
  const y0 = band ? band[0] : faceY - g.RY * 0.87;
  const y1 = band ? band[1] : Math.min(g.RY * 0.94, faceY + g.RY * 0.66);
  const N = 24;
  const at = (y, out) => {
    const half = halfWidthAt(y / k, g) * k;
    return [dir * (half + out), y];
  };
  const step = (y1 - y0) / N;
  const FADE = 16 * k;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const y = y0 + i * step;
    const t = band ? Math.min(1, (y - y0) / FADE) * Math.min(1, (y1 - y) / FADE) : 1;
    pts.push(at(y, profileOffset(y / k, faceY, g) * k * amt * t * t * (3 - 2 * t)));
  }
  const back = [];
  for (let i = N; i >= 0; i--) {
    const y = y0 + i * step;
    back.push(at(y, -inset * k));
  }
  const path2 = dir > 0 ? pts.concat(back) : back.concat(pts).reverse();
  s.move(path2[0][0], path2[0][1]);
  for (let i = 1; i < path2.length - 1; i++) {
    const [x1, yy1] = path2[i], [x2, yy2] = path2[i + 1];
    s.quad(x1, yy1, (x1 + x2) / 2, (yy1 + yy2) / 2);
  }
  s.line(path2[path2.length - 1][0], path2[path2.length - 1][1]);
  s.close();
  return true;
}
var TURN_BULGE = 15;
function headRegion(s, S, k = 1, withProfile = true) {
  const g = S.g || G;
  const sy = Math.sin(S.yaw);
  const bulge = Math.abs(sy) * TURN_BULGE;
  s.begin();
  silhouetteSub(s, g.R * k, g.RY * k, 0, 0, g);
  if (bulge > 0.6) {
    silhouetteSub(
      s,
      g.R * 0.93 * k,
      g.RY * 0.95 * k,
      -Math.sign(sy) * bulge * 0.85,
      2 - S.pitch * 10,
      g
    );
  }
  if (S.profile && withProfile) profileSub(s, S, k);
}
var HALF_N = 96;
var buildHalfW = (g = G) => {
  const t = g.blob, top = 1 - 0.3 * t, low = g.blobLow * t, base2 = 1 - 0.18 * t;
  const rx = g.R, ry = g.RY, yw = ry * low;
  const bez = (p0, p1, p2, p3, u) => {
    const m = 1 - u;
    return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3;
  };
  const table = new Float64Array(HALF_N + 1);
  for (let i = 0; i <= 2e3; i++) {
    const u = i / 2e3;
    for (const [yy, xx] of [
      [bez(-ry, -ry, -ry * 0.42, yw, u), bez(0, rx * 0.62 * top, rx, rx, u)],
      [bez(yw, ry * 0.7, ry, ry, u), bez(rx, rx, rx * base2 * 0.66, 0, u)]
    ]) {
      const k = Math.round((yy + ry) / (2 * ry) * HALF_N);
      if (k >= 0 && k <= HALF_N && xx > table[k]) table[k] = xx;
    }
  }
  return table;
};
var HALF_W = buildHalfW();
var SHAPES = {
  v1: {
    R: 100,
    RY: 104,
    blob: 0.28,
    blobLow: 0.1,
    faceCY: 26,
    faceRX: 66,
    faceRY: 67,
    ground: 126,
    eyeDX: 23,
    eyeDY: 9,
    eyeR: 16,
    eyeW: 12,
    eyeRX: null,
    eyeRY: null,
    mouthDY: 31,
    mouthW: 30,
    blushDX: 15,
    blushDY: 7,
    blushRX: 11.5,
    blushRY: 7
  },
  kawaii: {
    R: 104,
    RY: 96,
    blob: 0.34,
    blobLow: 0.16,
    faceCY: 24,
    faceRX: 70,
    faceRY: 62,
    ground: 118,
    eyeDX: 28,
    eyeDY: 5,
    eyeR: 18,
    eyeW: 8.5,
    eyeRX: 15,
    eyeRY: 20.5,
    mouthDY: 27,
    mouthW: 22,
    blushDX: 18,
    blushDY: 15,
    blushRX: 15,
    blushRY: 8.5
  },
  /* The three CAST builds.
     `cuddle` is today's kawaii unchanged, and the other two move by about four
     and eight per cent. That is deliberately not much: past roughly ±8% the
     builds stop being the same family and start being different species, which
     is the opposite of the decision taken — one creature, many looks. The
     features do not move at all between builds. Same eyes, same mouth, same
     blush: what changes is the egg they sit in. */
  cuddle: {
    R: 104,
    RY: 96,
    blob: 0.34,
    blobLow: 0.16,
    faceCY: 24,
    faceRX: 70,
    faceRY: 62,
    ground: 118,
    eyeDX: 28,
    eyeDY: 5,
    eyeR: 18,
    eyeW: 8.5,
    eyeRX: 15,
    eyeRY: 20.5,
    mouthDY: 27,
    mouthW: 22,
    blushDX: 18,
    blushDY: 15,
    blushRX: 15,
    blushRY: 8.5
  },
  classic: {
    R: 100,
    RY: 100,
    blob: 0.32,
    blobLow: 0.15,
    faceCY: 25,
    faceRX: 67,
    faceRY: 65,
    ground: 122,
    eyeDX: 28,
    eyeDY: 5,
    eyeR: 18,
    eyeW: 8.5,
    eyeRX: 15,
    eyeRY: 20.5,
    mouthDY: 27,
    mouthW: 22,
    blushDX: 18,
    blushDY: 15,
    blushRX: 15,
    blushRY: 8.5
  },
  sprout: {
    R: 96,
    RY: 104,
    blob: 0.3,
    blobLow: 0.13,
    faceCY: 26,
    faceRX: 64,
    faceRY: 67,
    ground: 126,
    eyeDX: 28,
    eyeDY: 5,
    eyeR: 18,
    eyeW: 8.5,
    eyeRX: 15,
    eyeRY: 20.5,
    mouthDY: 27,
    mouthW: 22,
    blushDX: 18,
    blushDY: 15,
    blushRX: 15,
    blushRY: 8.5
  }
};
var BUILD_NAMES = ["classic", "cuddle", "sprout"];
function createGeometry(shape = "v1", overrides = {}) {
  const preset = SHAPES[shape];
  if (!preset) throw new Error(`unknown shape: ${shape}`);
  const g = { ...G, ...preset, ...overrides, shape };
  g.halfW = buildHalfW(g);
  return Object.freeze(g);
}
function applyShape(name) {
  const preset = SHAPES[name];
  if (!preset) throw new Error(`unknown shape: ${name}`);
  Object.assign(G, preset);
  G.halfW = HALF_W = buildHalfW(G);
  return G;
}
function halfWidthAt(y, g = null) {
  const ry = g ? g.RY : G.RY;
  const table = g && g.halfW || HALF_W;
  const f = (y + ry) / (2 * ry) * HALF_N;
  if (f <= 0 || f >= HALF_N) return 0;
  const i = Math.floor(f), t = f - i;
  return table[i] * (1 - t) + table[i + 1] * t;
}

// src/core/visemes.js
var VISEMES = {
  rest: { w: 14, h: 3, round: 1, teeth: 0, tongue: 0, lift: 0 },
  MBP: { w: 22, h: 2.6, round: 1, teeth: 0, tongue: 0, lift: 0 },
  // m b p — lips pressed wide
  AI: { w: 29, h: 26, round: 0.75, teeth: 0.34, tongue: 0, lift: 0 },
  // ah  eye
  E: { w: 31, h: 15, round: 0.5, teeth: 0.46, tongue: 0, lift: 0 },
  // eh  ee
  O: { w: 21, h: 23, round: 1, teeth: 0, tongue: 0, lift: 0 },
  // oh
  U: { w: 15, h: 16, round: 1, teeth: 0, tongue: 0, lift: 0 },
  // oo
  WQ: { w: 12, h: 13, round: 1, teeth: 0, tongue: 0, lift: 0 },
  // w  qu
  FV: { w: 23, h: 8, round: 0.35, teeth: 0.8, tongue: 0, lift: 2 },
  // f v
  L: { w: 24, h: 19, round: 0.6, teeth: 0.2, tongue: 1, lift: 0 },
  // l  th
  etc: { w: 23, h: 11, round: 0.6, teeth: 0.4, tongue: 0, lift: 0 }
  // c d g k n r s t z
};
var VISEME_NAMES = Object.keys(VISEMES);
function blendViseme(a, b, t) {
  const A = VISEMES[a] || VISEMES.rest;
  const B2 = VISEMES[b] || VISEMES.rest;
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    w: A.w + (B2.w - A.w) * k,
    h: A.h + (B2.h - A.h) * k,
    round: A.round + (B2.round - A.round) * k,
    teeth: A.teeth + (B2.teeth - A.teeth) * k,
    tongue: A.tongue + (B2.tongue - A.tongue) * k,
    lift: A.lift + (B2.lift - A.lift) * k
  };
}
function drawViseme(s, T2, p) {
  const w = p.w, h = p.h, r = p.round;
  const oy = p.lift + h * 0.22;
  if (h < 3.2) {
    s.begin();
    s.move(-w / 2, oy);
    s.quad(0, oy + 1.4, w / 2, oy);
    s.stroke(T2.feature, 4.4);
    return;
  }
  const hw = w / 2, hh = h / 2;
  const cx = hw * r * 0.72;
  const cy = hh * r * 0.72;
  const path2 = () => {
    s.begin();
    s.move(-hw, oy);
    s.cubic(-hw, oy - cy, -cx, oy - hh, 0, oy - hh);
    s.cubic(cx, oy - hh, hw, oy - cy, hw, oy);
    s.cubic(hw, oy + cy, cx, oy + hh, 0, oy + hh);
    s.cubic(-cx, oy + hh, -hw, oy + cy, -hw, oy);
    s.close();
  };
  path2();
  s.fill(T2.feature);
  if (p.teeth > 0.02 || p.tongue > 0.02) {
    s.save();
    path2();
    s.clip();
    if (p.teeth > 0.02) {
      s.begin();
      s.rect(-hw, oy - hh, w, hh * p.teeth);
      s.fill(T2.face);
    }
    if (p.tongue > 0.02) {
      s.begin();
      s.ellipse(0, oy + hh * 0.5, hw * 0.6, hh * 0.55 * p.tongue);
      s.fill("#C8657C");
    }
    s.restore();
  }
}
var LETTER_VISEMES = {
  A: ["AI", "E"],
  // /eɪ/
  B: ["MBP", "E"],
  // /biː/
  C: ["etc", "E"],
  // /siː/
  D: ["etc", "E"],
  // /diː/
  E: ["E"],
  // /iː/
  F: ["E", "FV"],
  // /ɛf/
  G: ["etc", "E"],
  // /dʒiː/
  H: ["AI", "E", "etc"],
  // /eɪtʃ/
  I: ["AI", "E"],
  // /aɪ/
  J: ["etc", "AI", "E"],
  // /dʒeɪ/
  K: ["etc", "AI", "E"],
  // /keɪ/
  L: ["E", "L"],
  // /ɛl/
  M: ["E", "MBP"],
  // /ɛm/
  N: ["E", "etc"],
  // /ɛn/
  O: ["O", "U"],
  // /oʊ/
  P: ["MBP", "E"],
  // /piː/
  Q: ["etc", "U"],
  // /kjuː/
  R: ["AI", "etc"],
  // /ɑːr/
  S: ["E", "etc"],
  // /ɛs/
  T: ["etc", "E"],
  // /tiː/
  U: ["E", "U"],
  // /juː/
  V: ["FV", "E"],
  // /viː/
  W: ["etc", "U", "E", "U"],
  // /ˈdʌbəljuː/ — compressed
  X: ["E", "etc"],
  // /ɛks/
  Y: ["WQ", "AI", "E"],
  // /waɪ/
  Z: ["etc", "E"]
  // /ziː/ (US) — /zɛd/ users can override
};
var DIGRAPHS = [
  ["sch", ["etc", "etc"]],
  ["tch", ["etc"]],
  ["igh", ["AI"]],
  ["ough", ["O"]],
  ["ch", ["etc"]],
  ["sh", ["etc"]],
  ["th", ["L"]],
  ["ph", ["FV"]],
  ["wh", ["WQ"]],
  ["ck", ["etc"]],
  ["ng", ["etc"]],
  ["qu", ["etc", "U"]],
  ["oo", ["U"]],
  ["ee", ["E"]],
  ["ea", ["E"]],
  ["ai", ["AI"]],
  ["ay", ["AI"]],
  ["oa", ["O"]],
  ["oi", ["O"]],
  ["oy", ["O"]],
  ["ou", ["O"]],
  ["ow", ["O"]],
  ["au", ["O"]],
  ["aw", ["O"]],
  ["ie", ["AI"]],
  ["ei", ["E"]],
  ["ue", ["U"]],
  ["ui", ["U"]]
];
var SINGLES = {
  a: "AI",
  e: "E",
  i: "AI",
  o: "O",
  u: "U",
  y: "AI",
  b: "MBP",
  m: "MBP",
  p: "MBP",
  f: "FV",
  v: "FV",
  w: "WQ",
  l: "L"
};
function wordToVisemes(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  const out = [];
  let i = 0;
  while (i < w.length) {
    if (i === w.length - 1 && w[i] === "e" && w.length > 2 && !"aeiou".includes(w[i - 1])) break;
    let matched = false;
    for (const [g, vs] of DIGRAPHS) {
      if (w.startsWith(g, i)) {
        out.push(...vs);
        i += g.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (w[i] === w[i + 1] && !"aeiou".includes(w[i])) {
      i++;
      continue;
    }
    out.push(SINGLES[w[i]] || "etc");
    i++;
  }
  return out.length ? out : ["rest"];
}
function lettersToVisemes(word) {
  return String(word || "").toUpperCase().replace(/[^A-Z]/g, "").split("").flatMap((ch) => LETTER_VISEMES[ch] || ["etc"]);
}

// src/core/expressions.js
function faceFrame(S) {
  const g = S.g || G;
  const pitch = S.faceLean === 2 ? facePitch(S.pitch) : S.pitch;
  const yaw = S.faceLean === 2 ? faceYaw(S.yaw) : S.yaw;
  const lx = S.look.x * 4.5, ly = S.look.y * 3.5;
  const hole = faceProject(0, g.faceCY, yaw, pitch, g);
  const n2 = project(0, g.faceCY, g.Rf, yaw, pitch, false);
  const nTrue = yaw === S.yaw ? n2 : project(0, g.faceCY, g.Rf, S.yaw, pitch, false);
  const fore = Math.abs(n2.z) / g.Rf;
  const eL = faceProject(-g.eyeDX, g.faceCY + g.eyeDY, yaw, pitch, g);
  const eR = faceProject(g.eyeDX, g.faceCY + g.eyeDY, yaw, pitch, g);
  const mo = faceProject(0, g.faceCY + g.mouthDY, yaw, pitch, g);
  const vis = S.profile ? smooth(-0.1, 0.02, hole.z / g.Rf) : smooth(0.13, 0.28, hole.z / g.Rf);
  const RIM = 12;
  const lean = S.faceLean || 0;
  const rot = Math.atan2(n2.y, n2.x);
  const sq = Math.max(0.24, fore);
  const rx0 = g.faceRX * (lean ? sq : Math.max(0.24, Math.abs(hole.fx)));
  const ry0 = g.faceRY * (lean ? 1 : Math.max(0.04, Math.abs(hole.fy)));
  let m2 = null;
  if (lean === 2) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [sx, sy] of facePatchSurface(g.faceRX, g.faceRY, 0, 56, g)) {
      const q = capPoint(sx, sy - g.faceCY, yaw, pitch, g);
      if (q.x < x0) x0 = q.x;
      if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y;
      if (q.y > y1) y1 = q.y;
    }
    m2 = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2 };
  }
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const halfW = m2 ? m2.hw : lean ? Math.hypot(rx0 * cr, ry0 * sr) : rx0;
  const halfH = m2 ? m2.hh : lean ? Math.hypot(rx0 * sr, ry0 * cr) : ry0;
  const midY = m2 ? m2.cy + faceWrapShift(yaw, pitch, g).y : hole.y;
  const own = m2 ? m2.cx + faceWrapShift(yaw, pitch, g).x : hole.x;
  const u = clamp(nTrue.x / (g.Rf * Math.cos(Math.asin(clamp(g.faceCY / g.Rf, -1, 1)))), -1, 1);
  const roomAt = (y, half) => Math.max(0, halfWidthAt(y, g) - RIM - half);
  const room = Math.min(
    roomAt(midY, halfW),
    roomAt(midY - halfH * 1.14, halfW * 0.94),
    roomAt(midY + halfH * 0.92, halfW * 0.55)
  );
  const amt = S.profile ? profileAmount(S) : 0;
  const edge = m2 ? halfWidthAt(midY, g) + 10 * amt - halfW : halfWidthAt(midY, g);
  const holeX = u * lerp(room, edge, amt);
  const dx = holeX - own;
  const widest = Math.max(1, halfWidthAt(midY, g) - RIM);
  let fit = Math.min(1, widest / halfW);
  const top = midY - halfH * 1.14, bot = midY + halfH;
  if (top < -g.RY + RIM) fit = Math.min(fit, (midY + g.RY - RIM) / (halfH * 1.14));
  if (bot > g.RY - RIM) fit = Math.min(fit, (g.RY - RIM - midY) / halfH);
  fit = clamp(fit, 0.72, 1);
  const eye = (p, ox, dy) => ({
    x: p.x + ox + dx,
    y: p.y + dy,
    fx: Math.max(0.2, Math.abs(p.fx)),
    fy: Math.abs(p.fy),
    a: smooth(-0.05, 0.22, p.z / g.Rf)
  });
  return {
    /* The geometry this frame was measured with. Everything downstream —
       primitives, blush, glasses — reads it from here rather than from a
       module global, which is what lets two characters differ. */
    g,
    vis,
    /* How far the anchor was moved to keep the face inside the egg. Anything
       positioned off `faceProject` outside this file has to move with it —
       the blush did not, and ended up as a pink dot on the cheek of the body
       rather than on the face. */
    dx,
    /* How much the patch had to give up to stay inside the egg. The projected
       patch is built from this, not scaled after the fact. */
    fit,
    hole: {
      x: holeX,
      y: midY,
      /* rx runs ALONG the outward direction and carries all the foreshortening;
               ry runs across it and never shortens, because a hole turning away gets
               narrower, not smaller.
      
               Floored, not free: left to the projection the patch keeps narrowing to
               a hairline, and the last few degrees before profile are a pale scratch
               rather than a face. Held at a legible width, it fades out as a small
               lens instead — which is what the fade is for. */
      rx: (m2 ? halfW : rx0) * fit,
      ry: (m2 ? halfH : ry0) * fit,
      /* The squeeze, and the direction it runs in. `rx` is along `rot`, `ry`
         across it, so the un-squeezed face is `rx / sq` by `ry` — which is
         what the patch is actually built from before it is squashed. */
      rot,
      lean,
      sq,
      fore
    },
    eyeL: eye(eL, lx * Math.abs(eL.fx), ly),
    eyeR: eye(eR, lx * Math.abs(eR.fx), ly),
    mouth: eye(mo, 0, 0)
  };
}
function withEye(s, e, blink, fn) {
  if (e.a <= 0.01) return;
  s.save();
  s.alpha(e.a);
  s.translate(e.x, e.y);
  s.scale(Math.max(0.04, e.fx), e.fy * lerp(1, 0.1, blink));
  fn(s);
  s.restore();
}
var pArcUp = (s, T2, g) => {
  s.begin();
  s.arc(0, 0, g.eyeR, Math.PI * 1.02, Math.PI * 1.98);
  s.stroke(T2.feature, g.eyeW);
};
var restX = (g) => g.eyeRX ?? g.eyeR * 0.58;
var restY = (g) => g.eyeRY ?? g.eyeR * 0.72;
var browY = (y, g) => y * (restY(g) / 11.52) ** 0.7;
var eyeAs = (g, fx, fy) => g.eyeRX == null ? [g.eyeR * fx, g.eyeR * fy] : [g.eyeRX * (fx / 0.58), g.eyeRY * (fy / 0.72)];
var pDot = (s, T2, g, rx = restX(g), ry = restY(g)) => {
  s.begin();
  s.ellipse(0, 0, rx, ry);
  s.fill(T2.feature);
  if (T2.gloss) {
    const g2 = T2.glossScale ?? 1;
    s.begin();
    s.ellipse(-rx * 0.34, -ry * 0.38, rx * 0.3 * g2, ry * 0.26 * g2);
    s.fill(T2.gloss);
    s.begin();
    s.ellipse(rx * 0.3, ry * 0.3, rx * 0.16 * g2, ry * 0.14 * g2);
    s.fill(T2.gloss);
  }
};
var pWink = (s, T2, g, flip) => {
  const r = g.eyeR * 0.62;
  s.save();
  s.scale(flip ? -1 : 1, 1);
  s.begin();
  s.move(-r, -r * 1.3);
  s.line(r * 0.85, 0);
  s.line(-r, r * 1.3);
  s.stroke(T2.feature, g.eyeW * 0.85);
  s.restore();
};
var pStar = (s, T2, g, r = g.eyeR) => {
  s.begin();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.44 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.close();
  s.fill(T2.feature);
};
var pSpiral = (s, T2, g, spin) => {
  s.begin();
  for (let i = 0; i <= 56; i++) {
    const t = i / 56, a = t * Math.PI * 4 + spin, r = t * g.eyeR * 0.9;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.stroke(T2.feature, 3.8);
};
var pLid = (s, T2, g) => {
  const r = g.eyeR;
  s.save();
  s.begin();
  s.rect(-r * 1.2, r * 0.02, r * 2.4, r * 1.6);
  s.clip();
  s.begin();
  s.ellipse(0, r * 0.16, r * 0.55, r * 0.62);
  s.fill(T2.feature);
  s.restore();
  s.begin();
  s.move(-r * 0.8, r * 0.02);
  s.quad(0, r * 0.3, r * 0.8, r * 0.12);
  s.stroke(T2.feature, 4.4);
};
function brow(s, T2, e, dx, dy, tilt, w = 12) {
  if (e.a <= 0.01) return;
  s.save();
  s.alpha(e.a);
  s.translate(e.x + dx * e.fx, e.y + dy);
  s.scale(Math.max(0.04, e.fx), e.fy);
  s.rotate(tilt);
  s.begin();
  s.move(-w, 0);
  s.line(w, 0);
  s.stroke(T2.feature, 4.2);
  s.restore();
}
function mouth(s, T2, F, S, w, open, shape = "o") {
  if (F.mouth.a <= 0.01) return;
  if (S.speech && S.speech.active) {
    s.save();
    s.alpha(F.mouth.a);
    s.translate(F.mouth.x, F.mouth.y);
    s.scale(Math.max(0.04, F.mouth.fx), F.mouth.fy);
    drawViseme(s, T2, blendViseme(S.speech.cur, S.speech.next, S.speech.blend));
    s.restore();
    return;
  }
  if (open < 0.02) return;
  s.save();
  s.alpha(F.mouth.a);
  s.translate(F.mouth.x, F.mouth.y);
  s.scale(Math.max(0.04, F.mouth.fx), F.mouth.fy);
  if (shape === "o") {
    s.begin();
    s.ellipse(0, 0, w * 0.5, w * 0.5 * clamp(open, 0.12, 1.2));
    s.fill(T2.feature);
  } else if (shape === "smile") {
    s.begin();
    s.arc(0, -w * 0.24, w * 0.62, Math.PI * 0.13, Math.PI * 0.87);
    s.stroke(T2.feature, 5.4);
  } else if (shape === "grin") {
    const rx = w * 0.62, ry = w * 0.52 * clamp(open, 0.35, 1.2);
    s.begin();
    s.move(-rx, 0);
    s.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
    s.close();
    s.fill(T2.feature);
    if (T2.tongue && ry > w * 0.28) {
      s.save();
      s.begin();
      s.move(-rx, 0);
      s.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
      s.close();
      s.clip();
      s.begin();
      s.ellipse(0, ry * 0.72, rx * 0.56, ry * 0.62);
      s.fill(T2.tongue);
      s.restore();
    }
  } else if (shape === "cat") {
    const u = w * 0.34;
    s.begin();
    s.move(-2 * u, -u * 0.35);
    s.quad(-u, u * 0.95, 0, -u * 0.15);
    s.quad(u, u * 0.95, 2 * u, -u * 0.35);
    s.stroke(T2.feature, 4.8);
  } else if (shape === "wave") {
    const u = w * 0.34;
    s.begin();
    s.move(-2 * u, 0);
    s.quad(-u, -u * 0.85, 0, 0);
    s.quad(u, u * 0.85, 2 * u, 0);
    s.stroke(T2.feature, 4.6);
  }
  s.restore();
}
var EXPRESSIONS = {
  /* The resting face. Round eyes with a highlight and a visible smile — this
     is what a child sees for most of a lesson, so it is the one that has to
     read as friendly with nothing happening. It used to be squinted arcs and
     no mouth at all, which read as "asleep with its eyes open". */
  happy(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pDot(x, T2, F.g));
    withEye(s, F.eyeR, S.blink, (x) => pDot(x, T2, F.g));
    mouth(s, T2, F, S, F.g.mouthW, Math.max(S.talk, 0.55), "smile");
  },
  excited(s, T2, F, S) {
    withEye(s, F.eyeL, 0, (x) => pWink(x, T2, F.g, false));
    withEye(s, F.eyeR, 0, (x) => pWink(x, T2, F.g, true));
    mouth(s, T2, F, S, 30, Math.max(S.talk, 0.85), "grin");
  },
  thinking(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => {
      x.translate(-2.5, -5);
      pDot(x, T2, F.g, ...eyeAs(F.g, 0.5, 0.62));
    });
    withEye(s, F.eyeR, S.blink, (x) => {
      x.translate(-2.5, -5);
      pDot(x, T2, F.g, ...eyeAs(F.g, 0.5, 0.62));
    });
    brow(s, T2, F.eyeL, -2, browY(-28, F.g), -0.07);
    brow(s, T2, F.eyeR, 0, browY(-31, F.g), -0.13);
    mouth(s, T2, F, S, 22, Math.max(S.talk, 0.45), "wave");
  },
  surprised(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pDot(x, T2, F.g, ...eyeAs(F.g, 0.68, 0.84)));
    withEye(s, F.eyeR, S.blink, (x) => pDot(x, T2, F.g, ...eyeAs(F.g, 0.68, 0.84)));
    brow(s, T2, F.eyeL, 0, browY(-28, F.g), -0.1, 12);
    brow(s, T2, F.eyeR, 0, browY(-28, F.g), 0.1, 12);
    mouth(s, T2, F, S, 22, Math.max(S.talk, 0.9), "o");
  },
  proud(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink * 0.4, (x) => pStar(x, T2, F.g));
    withEye(s, F.eyeR, S.blink * 0.4, (x) => pStar(x, T2, F.g));
    mouth(s, T2, F, S, 34, Math.max(S.talk, 0.7), "grin");
  },
  sleepy(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pLid(x, T2, F.g));
    withEye(s, F.eyeR, S.blink, (x) => pLid(x, T2, F.g));
    mouth(s, T2, F, S, 16, 0.42, "o");
  },
  confused(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pDot(x, T2, F.g, ...eyeAs(F.g, 0.42, 0.52)));
    withEye(s, F.eyeR, S.blink, (x) => pDot(x, T2, F.g, ...eyeAs(F.g, 0.66, 0.82)));
    brow(s, T2, F.eyeL, 0, browY(-21, F.g), 0.2, 11);
    brow(s, T2, F.eyeR, 0, browY(-31, F.g), -0.12, 12);
    mouth(s, T2, F, S, 24, 1, "wave");
  },
  dizzy(s, T2, F, S) {
    withEye(s, F.eyeL, 0, (x) => pSpiral(x, T2, F.g, S.t * 4));
    withEye(s, F.eyeR, 0, (x) => pSpiral(x, T2, F.g, -S.t * 4));
    mouth(s, T2, F, S, 26, 0.7, "wave");
  },
  /* Closed happy arcs and a ω mouth: the most affectionate face in the set,
     which is why it is `content` and not the default. */
  content(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pArcUp(x, T2, F.g));
    withEye(s, F.eyeR, S.blink, (x) => pArcUp(x, T2, F.g));
    mouth(s, T2, F, S, 30, Math.max(S.talk, 0.6), "cat");
  }
};
var EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

// src/core/actions.js
var ACTIONS = {
  /* ------------------------------------------------------ answer feedback */
  correct: {
    dur: 1.5,
    tags: ["feedback"],
    start(B2) {
      const S = B2.s, T2 = B2.theme;
      B2.cue("correct");
      B2.express("proud");
      S.offVY = -70;
      S.squashVY = 3.4;
      S.squashVX = -2.6;
      S.sparkPop = 1;
      S.hand.l.lift = 1;
      S.hand.r.lift = 1;
      S.hand.l.out = 0.6;
      S.hand.r.out = 0.6;
      S.hand.l.want = 1;
      S.hand.r.want = 1;
      B2.emit("confetti", 30, {
        y: -92,
        angle: -Math.PI / 2,
        spread: 1.15,
        drag: 0.975,
        spdMin: 210,
        spdMax: 470,
        grav: 700
      });
      B2.emit("star", 10, {
        y: -100,
        angle: -Math.PI / 2,
        spread: 0.9,
        drag: 0.97,
        spdMin: 180,
        spdMax: 360,
        grav: 520,
        color: T2.correct
      });
    },
    tick(B2, p) {
      const S = B2.s;
      S.hover = Math.max(0, Math.sin(Math.min(p / 0.55, 1) * Math.PI) * 46);
      S.yawTarget = Math.sin(p * Math.PI * 2) * 0.35;
      B2.once(0.5, () => {
        S.sparkPop = 0.9;
        B2.emit("sparkle", 10, { y: -70, spdMin: 60, spdMax: 170, grav: 280, color: B2.theme.correct });
      }, p);
      S.hand.l.lift = 1;
      S.hand.r.lift = 1;
      S.hand.l.out = 0.6;
      S.hand.r.out = 0.6;
      S.hand.l.want = 1;
      S.hand.r.want = 1;
      S.hand.l.swing = Math.sin(S.t * 14) * 0.4;
      S.hand.r.swing = -Math.sin(S.t * 14) * 0.4;
    },
    end(B2) {
      B2.express("happy");
      B2.s.yawTarget = 0;
    }
  },
  wrong: {
    dur: 1.1,
    tags: ["feedback"],
    start(B2) {
      const S = B2.s;
      B2.cue("wrong");
      B2.express("confused");
      S.offVX = 300;
      S.pitchTarget = 0.16;
      B2.emit("drop", 3, {
        x: 34,
        y: -46,
        spdMin: 20,
        spdMax: 70,
        grav: 380,
        color: B2.theme.wrong,
        sizeMin: 5,
        sizeMax: 8
      });
    },
    tick(B2, p) {
      const S = B2.s;
      S.yawTarget = Math.sin(p * Math.PI * 6) * 0.5;
      B2.once(0.14, () => S.offVX = -520, p);
      B2.once(0.34, () => S.offVX = 430, p);
      B2.once(0.54, () => S.offVX = -250, p);
    },
    end(B2) {
      B2.express("thinking");
      B2.s.yawTarget = 0;
      B2.s.pitchTarget = 0;
    }
  },
  nod: {
    dur: 0.9,
    tags: ["feedback"],
    start(B2) {
      B2.express("happy");
    },
    tick(B2, p) {
      const S = B2.s;
      S.pitchTarget = Math.sin(p * Math.PI * 3) * 0.3;
      B2.once(0.02, () => {
        S.offVY = 130;
        S.squashVY = -1.5;
      }, p);
      B2.once(0.38, () => {
        S.offVY = 110;
      }, p);
    },
    end(B2) {
      B2.s.pitchTarget = 0;
    }
  },
  /* ------------------------------------------------------------- the turn */
  turnaround: {
    dur: 2.2,
    tags: ["turn"],
    start(B2) {
      B2.s.yawTarget = B2.s.yaw + Math.PI * 2;
      B2.s.hand.l.out = 0.4;
      B2.s.hand.r.out = 0.4;
    },
    tick(B2, p) {
      B2.s.rollTarget = Math.sin(p * Math.PI * 2) * 0.1;
      B2.s.hand.l.want = 1;
      B2.s.hand.r.want = 1;
    },
    end(B2) {
      B2.s.yaw -= Math.PI * 2;
      B2.s.yawTarget -= Math.PI * 2;
      B2.s.rollTarget = 0;
    }
  },
  peek: {
    dur: 2.6,
    tags: ["turn"],
    start(B2) {
      B2.express("thinking");
      B2.s.yawTarget = 2.5;
    },
    tick(B2, p) {
      const S = B2.s;
      B2.once(0.3, () => {
        S.yawTarget = 2.05;
        S.pitchTarget = -0.08;
      }, p);
      B2.once(0.46, () => {
        B2.express("surprised");
        S.squashVX = 2.2;
        S.squashVY = -2.2;
      }, p);
      B2.once(0.74, () => {
        S.yawTarget = 0;
        S.pitchTarget = 0;
        B2.express("happy");
      }, p);
    },
    end(B2) {
      B2.s.yawTarget = 0;
    }
  },
  lookAround: {
    dur: 2.8,
    tags: ["turn", "idle"],
    start(B2) {
      B2.express("thinking");
    },
    tick(B2, p) {
      const S = B2.s;
      B2.once(0.05, () => {
        S.yawTarget = -0.95;
        S.pitchTarget = 0.05;
      }, p);
      B2.once(0.34, () => {
        S.yawTarget = 1.05;
      }, p);
      B2.once(0.62, () => {
        S.yawTarget = -0.35;
        S.pitchTarget = -0.18;
        B2.express("confused");
      }, p);
      B2.once(0.86, () => {
        S.yawTarget = 0;
        S.pitchTarget = 0;
      }, p);
    },
    end(B2) {
      B2.express("happy");
    }
  },
  /* ------------------------------------------------------------- physical */
  jump: {
    dur: 1.25,
    tags: ["physical"],
    start(B2) {
      B2.express("excited");
    },
    tick(B2, p, dt) {
      const S = B2.s;
      if (p < 0.2) {
        S.squashY += (0.8 - S.squashY) * (1 - Math.pow(0.02, dt));
        S.squashX += (1.18 - S.squashX) * (1 - Math.pow(0.02, dt));
      }
      B2.once(0.2, () => {
        S.squashVY = 5.5;
        S.squashVX = -4.2;
      }, p);
      if (p >= 0.2 && p < 0.82) {
        const q = (p - 0.2) / 0.62;
        S.hover = Math.sin(q * Math.PI) * 118;
        S.pitchTarget = -Math.sin(q * Math.PI) * 0.16;
      }
      B2.once(0.82, () => {
        B2.cue("land");
        S.squashVY = -6.5;
        S.squashVX = 5;
        S.pitchTarget = 0;
        B2.emit("sparkle", 7, {
          y: 110,
          angle: -Math.PI / 2,
          spdMin: 60,
          spdMax: 150,
          grav: 500,
          color: B2.theme.bodyDeep
        });
      }, p);
    },
    end(B2) {
      B2.express("happy");
      B2.s.pitchTarget = 0;
    }
  },
  wave: {
    dur: 2,
    tags: ["social"],
    start(B2) {
      B2.express("happy");
      B2.s.yawTarget = 0.34;
      B2.s.rollTarget = -0.08;
    },
    tick(B2, p) {
      const S = B2.s;
      const k = B2.ramp(p, 0.18, 0.82);
      S.hand.r.lift = k * 1.15;
      S.hand.r.out = k * 0.45;
      S.hand.r.swing = Math.sin(S.t * 13) * 0.55 * k;
      S.hand.r.want = k;
      B2.once(0.1, () => {
        S.talk = 0.6;
      }, p);
    },
    end(B2) {
      B2.s.yawTarget = 0;
      B2.s.rollTarget = 0;
    }
  },
  dance: {
    dur: 3.4,
    tags: ["social"],
    start(B2) {
      B2.express("excited");
    },
    tick(B2, p, dt) {
      const S = B2.s, w = S.t * 5.2;
      S.yawTarget = Math.sin(w) * 0.75;
      S.rollTarget = Math.sin(w * 0.5) * 0.16;
      S.hover = Math.abs(Math.sin(w)) * 26;
      S.hand.l.lift = 0.5 + Math.sin(w) * 0.5;
      S.hand.r.lift = 0.5 - Math.sin(w) * 0.5;
      S.hand.l.out = 0.5;
      S.hand.r.out = 0.5;
      S.hand.l.want = 1;
      S.hand.r.want = 1;
      S.squashY += (1 + Math.sin(w * 2) * 0.05 - S.squashY) * (1 - Math.pow(0.05, dt));
      if (B2.random() < dt * 7)
        B2.emit("sparkle", 1, {
          y: B2.random.range(-90, 20),
          spdMin: 20,
          spdMax: 80,
          grav: -40,
          ttlMin: 0.7,
          ttlMax: 1.2,
          color: B2.theme.spark
        });
    },
    end(B2) {
      B2.s.yawTarget = 0;
      B2.s.rollTarget = 0;
      B2.express("happy");
    }
  },
  dizzy: {
    dur: 3,
    tags: ["physical"],
    start(B2) {
      B2.express("dizzy");
      B2.s.yawTarget = B2.s.yaw + Math.PI * 4;
    },
    tick(B2, p, dt) {
      const S = B2.s;
      S.rollTarget = Math.sin(S.t * 7) * 0.2 * (1 - p);
      S.hover = Math.sin(S.t * 9) * 7 * (1 - p);
      if (B2.random() < dt * 5)
        B2.emit("star", 1, {
          y: -92,
          spdMin: 30,
          spdMax: 70,
          grav: -30,
          color: "#FFC94A",
          ttlMin: 0.8,
          ttlMax: 1.3
        });
    },
    end(B2) {
      B2.s.yaw -= Math.PI * 4;
      B2.s.yawTarget = 0;
      B2.s.rollTarget = 0;
      B2.express("confused");
    }
  },
  sleep: {
    dur: 4,
    tags: ["idle"],
    start(B2) {
      B2.express("sleepy");
      B2.s.pitchTarget = 0.22;
      B2.s.rollTarget = -0.14;
    },
    tick(B2, p, dt) {
      const S = B2.s;
      if (B2.random() < dt * 1.8)
        B2.emit("zzz", 1, {
          x: 44,
          y: -56,
          vx: 16,
          vy: -46,
          grav: -14,
          drag: 0.99,
          sizeMin: 5,
          sizeMax: 9,
          ttlMin: 1.6,
          ttlMax: 2.4,
          color: B2.theme.bodyDeep
        });
      S.squashY += (1 + Math.sin(S.t * 1.1) * 0.035 - S.squashY) * (1 - Math.pow(0.05, dt));
    },
    end(B2) {
      B2.express("happy");
      B2.s.pitchTarget = 0;
      B2.s.rollTarget = 0;
    }
  },
  think: {
    dur: 2.6,
    tags: ["idle"],
    start(B2) {
      B2.express("thinking");
      B2.s.yawTarget = -0.55;
      B2.s.pitchTarget = -0.12;
    },
    tick(B2, p, dt) {
      const S = B2.s;
      const k = B2.ramp(p, 0.2, 0.8);
      S.hand.r.lift = -k * 0.22;
      S.hand.r.out = -k * 0.5;
      S.hand.r.swing = Math.sin(S.t * 7) * 0.1 * k;
      S.hand.r.want = k;
      if (B2.random() < dt * 1.1)
        B2.emit("sparkle", 1, {
          x: -52,
          y: -74,
          spdMin: 15,
          spdMax: 50,
          grav: -25,
          color: B2.theme.spark,
          ttlMin: 1,
          ttlMax: 1.6
        });
    },
    end(B2) {
      B2.s.yawTarget = 0;
      B2.s.pitchTarget = 0;
    }
  },
  pop: {
    dur: 0.55,
    tags: ["micro"],
    start(B2) {
      B2.cue("pop");
      B2.s.squashVX = 4.6;
      B2.s.squashVY = -4.6;
      B2.s.sparkPop = 0.7;
      B2.emit("sparkle", 5, { spdMin: 70, spdMax: 170, grav: 300, color: B2.theme.bodyDeep });
    },
    tick() {
    },
    end() {
    }
  }
};
var ACTION_NAMES = Object.keys(ACTIONS);

// src/core/glyphs.js
var D = Math.PI / 180;
function arc(out, cx, cy, rx, ry, a0, a1, move = true) {
  const s0 = a0 * D, s1 = a1 * D;
  const delta = s1 - s0;
  const segs = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segs;
  const k = 4 / 3 * Math.tan(step / 4);
  const at = (t2) => [cx + rx * Math.cos(t2), cy + ry * Math.sin(t2)];
  const dt = (t2) => [-rx * Math.sin(t2), ry * Math.cos(t2)];
  if (move) out.push(["M", ...at(s0)]);
  let t = s0;
  for (let i = 0; i < segs; i++) {
    const t0 = t, t1 = t + step;
    const p0 = at(t0), p1 = at(t1), d0 = dt(t0), d1 = dt(t1);
    out.push([
      "C",
      p0[0] + k * d0[0],
      p0[1] + k * d0[1],
      p1[0] - k * d1[0],
      p1[1] - k * d1[1],
      p1[0],
      p1[1]
    ]);
    t = t1;
  }
}
function sub(...cmds) {
  return cmds;
}
function arcPath(cx, cy, rx, ry, a0, a1) {
  const o = [];
  arc(o, cx, cy, rx, ry, a0, a1);
  return o;
}
var T = -0.5;
var B = 0.5;
var M = 0;
var L = -0.3;
var R = 0.3;
var METRICS = {
  cap: T,
  baseline: B,
  middle: M,
  xHeight: 0.62,
  xLine: B - 0.62,
  // -0.12 — top of a lowercase o
  descender: B + 0.28,
  //  0.78 — bottom of a g
  ascender: T
};
var X = METRICS.xLine;
var DS = METRICS.descender;
var XC = (X + B) / 2;
var XR = (B - X) / 2;
var GLYPHS = {
  A: [
    sub(["M", 0, T], ["L", -0.34, B]),
    sub(["M", 0, T], ["L", 0.34, B]),
    sub(["M", -0.17, 0.13], ["L", 0.17, 0.13])
  ],
  B: [
    sub(["M", -0.3, T], ["L", -0.3, B]),
    arcPath(-0.3, -0.25, 0.34, 0.25, -90, 90),
    arcPath(-0.3, 0.25, 0.38, 0.25, -90, 90)
  ],
  C: arcPathWrap(0, 0, 0.32, 0.5, -55, -305),
  D: [
    sub(["M", -0.3, T], ["L", -0.3, B]),
    arcPath(-0.3, 0, 0.62, 0.5, -90, 90)
  ],
  E: [
    sub(["M", -0.26, T], ["L", -0.26, B]),
    sub(["M", -0.26, T], ["L", 0.26, T]),
    sub(["M", -0.26, M], ["L", 0.18, M]),
    sub(["M", -0.26, B], ["L", 0.26, B])
  ],
  F: [
    sub(["M", -0.26, T], ["L", -0.26, B]),
    sub(["M", -0.26, T], ["L", 0.26, T]),
    sub(["M", -0.26, M], ["L", 0.18, M])
  ],
  G: [[...arcPath(0, 0.02, 0.32, 0.48, -60, -352), ["L", 0.13, 0.02]]],
  H: [
    sub(["M", L, T], ["L", L, B]),
    sub(["M", R, T], ["L", R, B]),
    sub(["M", L, M], ["L", R, M])
  ],
  I: [sub(["M", 0, T], ["L", 0, B])],
  J: [
    sub(["M", 0.22, T], ["L", 0.22, 0.26]),
    arcPath(0, 0.26, 0.22, 0.22, 0, 180)
  ],
  K: [
    sub(["M", -0.26, T], ["L", -0.26, B]),
    sub(["M", 0.28, T], ["L", -0.26, 0.06]),
    sub(["M", -0.08, -0.1], ["L", 0.3, B])
  ],
  L: [sub(["M", -0.22, T], ["L", -0.22, B], ["L", 0.26, B])],
  M: [
    sub(["M", -0.34, T], ["L", -0.34, B]),
    sub(["M", -0.34, T], ["L", 0, 0.1], ["L", 0.34, T], ["L", 0.34, B])
  ],
  N: [
    sub(["M", L, T], ["L", L, B]),
    sub(["M", L, T], ["L", R, B], ["L", R, T])
  ],
  O: arcPathWrap(0, 0, 0.32, 0.5, -60, -420),
  P: [
    sub(["M", -0.3, T], ["L", -0.3, B]),
    arcPath(-0.3, -0.21, 0.38, 0.29, -90, 90)
  ],
  Q: [
    ...arcPathWrap(0, 0, 0.32, 0.5, -60, -420),
    sub(["M", 0.1, 0.26], ["L", 0.34, 0.54])
  ],
  R: [
    sub(["M", -0.3, T], ["L", -0.3, B]),
    arcPath(-0.3, -0.21, 0.38, 0.29, -90, 90),
    sub(["M", -0.04, 0.08], ["L", 0.3, B])
  ],
  S: [sub(
    ["M", 0.27, -0.34],
    ["C", 0.27, -0.52, -0.27, -0.54, -0.27, -0.22],
    ["C", -0.27, 0.02, 0.27, -0.02, 0.27, 0.24],
    ["C", 0.27, 0.54, -0.27, 0.52, -0.27, 0.34]
  )],
  T: [
    sub(["M", -0.32, T], ["L", 0.32, T]),
    sub(["M", 0, T], ["L", 0, B])
  ],
  /* One stroke — down, around, and back up. Splitting the right side into its
     own upward stroke is how a U ends up being taught backwards. */
  U: [[
    ["M", L, T],
    ["L", L, 0.16],
    ...arcPath(0, 0.16, 0.3, 0.3, 180, 0).slice(1),
    ["L", R, T]
  ]],
  V: [sub(["M", -0.32, T], ["L", 0, B], ["L", 0.32, T])],
  W: [sub(
    ["M", -0.38, T],
    ["L", -0.22, B],
    ["L", 0, -0.14],
    ["L", 0.22, B],
    ["L", 0.38, T]
  )],
  X: [
    sub(["M", -0.3, T], ["L", 0.3, B]),
    sub(["M", 0.3, T], ["L", -0.3, B])
  ],
  /* Both arms start at the top and come down to the join. Drawn as one
     zig-zag, the right arm is written upwards. */
  Y: [
    sub(["M", -0.3, T], ["L", 0, 0.02]),
    sub(["M", 0.3, T], ["L", 0, 0.02]),
    sub(["M", 0, 0.02], ["L", 0, B])
  ],
  Z: [sub(["M", -0.28, T], ["L", 0.28, T], ["L", -0.28, B], ["L", 0.28, B])],
  "'": [sub(["M", 0, T], ["L", 0, -0.24])],
  "-": [sub(["M", -0.2, M], ["L", 0.2, M])],
  /* Dots stop short of the baseline on purpose: a round cap of half the stroke
     width sits below the last point, so ending at B would hang the ink under
     the line. */
  ".": [sub(["M", 0, 0.4], ["L", 0, 0.43])],
  "?": [
    [
      ...arcPath(-0.02, -0.28, 0.22, 0.21, 170, 370),
      ["C", 0.2, -0.13, 0.02, -0.06, 0.02, 0.1]
    ],
    sub(["M", 0.02, 0.4], ["L", 0.02, 0.43])
  ],
  "!": [sub(["M", 0, T], ["L", 0, 0.16]), sub(["M", 0, 0.4], ["L", 0, 0.43])]
};
var LOWER = {
  a: [
    arcPath(-0.02, XC, 0.25, XR, -60, -420),
    sub(["M", 0.23, X], ["L", 0.23, B])
  ],
  b: [
    sub(["M", -0.25, T], ["L", -0.25, B]),
    arcPath(0, XC, 0.25, XR, 180, 540)
  ],
  c: arcPathWrap(0, XC, 0.25, XR, -55, -305),
  d: [
    arcPath(-0.02, XC, 0.25, XR, -60, -420),
    sub(["M", 0.23, T], ["L", 0.23, B])
  ],
  e: [[
    ["M", -0.26, XC],
    ["L", 0.26, XC],
    ...arcPath(0, XC, 0.26, XR, 0, -292).slice(1)
  ]],
  /* The stem is on the LEFT and the hook turns RIGHT. Mirroring it — which is
     easy to do and hard to see at small sizes — produces a shape that reads as
     a reversed 7 rather than as an f. */
  f: [
    [
      ["M", 0.15, -0.46],
      ["C", 0.02, -0.5, -0.09, -0.47, -0.09, -0.3],
      ["L", -0.09, B]
    ],
    sub(["M", -0.31, X], ["L", 0.17, X])
  ],
  g: [
    arcPath(-0.02, XC, 0.25, XR, -60, -420),
    [
      ["M", 0.23, X],
      ["L", 0.23, 0.62],
      ...arcPath(0, 0.62, 0.23, 0.17, 0, 150).slice(1)
    ]
  ],
  h: [
    sub(["M", -0.25, T], ["L", -0.25, B]),
    [...arcPath(0, XC, 0.25, XR, 180, 360), ["L", 0.25, B]]
  ],
  i: [
    sub(["M", 0, X], ["L", 0, B]),
    sub(["M", 0, -0.44], ["L", 0, -0.4])
  ],
  j: [
    [
      ["M", 0.1, X],
      ["L", 0.1, 0.62],
      ...arcPath(-0.12, 0.62, 0.22, 0.17, 0, 150).slice(1)
    ],
    sub(["M", 0.1, -0.44], ["L", 0.1, -0.4])
  ],
  k: [
    sub(["M", -0.24, T], ["L", -0.24, B]),
    sub(["M", 0.24, X], ["L", -0.24, 0.24]),
    sub(["M", -0.06, 0.1], ["L", 0.26, B])
  ],
  l: [sub(["M", 0, T], ["L", 0, B])],
  m: [
    sub(["M", -0.34, X], ["L", -0.34, B]),
    [...arcPath(-0.17, XC, 0.17, XR, 180, 360), ["L", 0, B]],
    [...arcPath(0.17, XC, 0.17, XR, 180, 360), ["L", 0.34, B]]
  ],
  n: [
    sub(["M", -0.25, X], ["L", -0.25, B]),
    [...arcPath(0, XC, 0.25, XR, 180, 360), ["L", 0.25, B]]
  ],
  o: arcPathWrap(0, XC, 0.26, XR, -60, -420),
  p: [
    sub(["M", -0.25, X], ["L", -0.25, DS]),
    arcPath(0, XC, 0.25, XR, 180, 540)
  ],
  q: [
    arcPath(-0.02, XC, 0.25, XR, -60, -420),
    sub(["M", 0.23, X], ["L", 0.23, DS])
  ],
  r: [
    sub(["M", -0.18, X], ["L", -0.18, B]),
    arcPath(0.04, XC, 0.22, XR, 180, 285)
  ],
  /* The one letter whose curve is hand-placed rather than derived, so its
     control points have to be re-fitted whenever the x-height moves. */
  s: [sub(
    ["M", 0.22, 0.02],
    ["C", 0.22, -0.17, -0.22, -0.19, -0.22, 0.02],
    ["C", -0.22, 0.16, 0.22, 0.14, 0.22, 0.29],
    ["C", 0.22, 0.57, -0.22, 0.55, -0.22, 0.36]
  )],
  t: [
    [
      ["M", 0, -0.4],
      ["L", 0, 0.3],
      ...arcPath(0.16, 0.3, 0.16, 0.2, 180, 90).slice(1)
    ],
    sub(["M", -0.2, X], ["L", 0.22, X])
  ],
  u: [
    [
      ["M", -0.25, X],
      ["L", -0.25, 0.16],
      ...arcPath(0, 0.16, 0.25, 0.34, 180, 0).slice(1),
      ["L", 0.25, X]
    ],
    sub(["M", 0.25, X], ["L", 0.25, B])
  ],
  v: [sub(["M", -0.25, X], ["L", 0, B], ["L", 0.25, X])],
  w: [sub(
    ["M", -0.33, X],
    ["L", -0.18, B],
    ["L", 0, 0.1],
    ["L", 0.18, B],
    ["L", 0.33, X]
  )],
  x: [
    sub(["M", -0.23, X], ["L", 0.23, B]),
    sub(["M", 0.23, X], ["L", -0.23, B])
  ],
  y: [
    sub(["M", -0.25, X], ["L", 0.02, 0.38]),
    sub(["M", 0.25, X], ["L", -0.08, DS])
  ],
  z: [sub(["M", -0.22, X], ["L", 0.22, X], ["L", -0.22, B], ["L", 0.22, B])]
};
var DIGITS = {
  0: arcPathWrap(0, 0, 0.28, 0.5, -60, -420),
  1: [sub(["M", -0.14, -0.3], ["L", 0.02, T], ["L", 0.02, B])],
  2: [[...arcPath(0, -0.24, 0.26, 0.26, 200, 395), ["L", -0.26, B], ["L", 0.26, B]]],
  3: [
    [...arcPath(0, -0.24, 0.24, 0.26, 195, 425)],
    [...arcPath(0, 0.22, 0.26, 0.28, -75, 160)]
  ],
  4: [
    sub(["M", 0.14, T], ["L", -0.28, 0.2], ["L", 0.28, 0.2]),
    sub(["M", 0.14, -0.06], ["L", 0.14, B])
  ],
  /* Down, around, then across the top — the bar is written last, and it is
     written left to right like every other horizontal. */
  5: [
    sub(["M", -0.22, T], ["L", -0.24, -0.02]),
    arcPath(0, 0.2, 0.26, 0.3, -100, 150),
    sub(["M", -0.22, T], ["L", 0.22, T])
  ],
  /* One stroke, top to bottom: the spine comes down from the top right and
     runs straight into the loop. Drawn as two, the spine gets written upwards. */
  6: [[
    ["M", 0.2, -0.44],
    ["C", -0.06, T, -0.26, -0.28, -0.26, 0.18],
    ...arcPath(0, 0.18, 0.26, 0.32, 180, -180).slice(1)
  ]],
  7: [sub(["M", -0.26, T], ["L", 0.26, T], ["L", -0.06, B])],
  8: [
    arcPath(0, -0.24, 0.22, 0.26, -90, -450),
    arcPath(0, 0.24, 0.26, 0.26, -90, -450)
  ],
  9: [
    [...arcPath(0, -0.18, 0.26, 0.32, -60, -420)],
    sub(["M", 0.26, -0.18], ["C", 0.26, 0.28, 0.06, B, -0.2, 0.44])
  ]
};
Object.assign(GLYPHS, LOWER, DIGITS);
function arcPathWrap(cx, cy, rx, ry, a0, a1) {
  return [arcPath(cx, cy, rx, ry, a0, a1)];
}
var GLYPH_CHARS = Object.keys(GLYPHS);
function glyph(ch) {
  const k = String(ch);
  return GLYPHS[k] || GLYPHS[k.toUpperCase()] || null;
}
function glyphBounds(ch) {
  const g = glyph(ch);
  if (!g) return { min: -0.3, max: 0.3, top: -0.5, bottom: 0.5 };
  let min = Infinity, max = -Infinity, top = Infinity, bottom = -Infinity;
  for (const p of g) for (const c of p) {
    for (let i = 1; i < c.length; i += 2) {
      if (c[i] < min) min = c[i];
      if (c[i] > max) max = c[i];
      if (c[i + 1] < top) top = c[i + 1];
      if (c[i + 1] > bottom) bottom = c[i + 1];
    }
  }
  return { min, max, top, bottom };
}
function glyphWidth(ch) {
  const b = glyphBounds(ch);
  return b.max - b.min + 0.24;
}
function drawGlyph(s, ch, cap, color, weight = 0.145, centred = true, align = "baseline") {
  const g = glyph(ch);
  if (!g) return false;
  s.save();
  s.scale(cap, cap);
  if (align === "ink") {
    const b = glyphBounds(ch);
    s.translate(0, -(b.top + b.bottom) / 2);
  }
  if (centred) {
    const b = glyphBounds(ch);
    s.translate(-(b.min + b.max) / 2, 0);
  }
  for (const path2 of g) {
    s.begin();
    for (const c of path2) {
      if (c[0] === "M") s.move(c[1], c[2]);
      else if (c[0] === "L") s.line(c[1], c[2]);
      else if (c[0] === "Q") s.quad(c[1], c[2], c[3], c[4]);
      else if (c[0] === "C") s.cubic(c[1], c[2], c[3], c[4], c[5], c[6]);
    }
    s.stroke(color, weight, "round", "round");
  }
  s.restore();
  return true;
}
function drawWord(s, text, cap, color, weight, tracking = 0.18) {
  const chars = [...String(text)].filter((c) => glyph(c));
  if (!chars.length) return;
  const bounds = chars.map(glyphBounds);
  const widths = bounds.map((b) => b.max - b.min);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cursor = -total / 2;
  for (let i = 0; i < chars.length; i++) {
    s.save();
    s.translate((cursor - bounds[i].min) * cap, 0);
    drawGlyph(s, chars[i], cap, color, weight, false, "baseline");
    s.restore();
    cursor += widths[i] + tracking;
  }
}

// src/core/particles.js
var Particles = class {
  constructor(random) {
    this.list = [];
    this.random = random;
  }
  emit(type, count, o = {}) {
    const R3 = this.random;
    for (let i = 0; i < count; i++) {
      const spread = o.spread ?? 0.6;
      const a = o.angle !== void 0 ? o.angle + R3.range(-spread, spread) : R3.range(0, Math.PI * 2);
      const sp = R3.range(o.spdMin ?? 90, o.spdMax ?? 260);
      this.list.push({
        type,
        x: (o.x ?? 0) + R3.range(-14, 14),
        y: (o.y ?? 0) + R3.range(-14, 14),
        vx: Math.cos(a) * sp + (o.vx ?? 0),
        vy: Math.sin(a) * sp + (o.vy ?? 0),
        rot: R3.range(0, Math.PI * 2),
        vrot: R3.range(-9, 9),
        size: R3.range(o.sizeMin ?? 5, o.sizeMax ?? 11),
        life: 0,
        ttl: R3.range(o.ttlMin ?? 0.9, o.ttlMax ?? 1.7),
        grav: o.grav ?? 520,
        drag: o.drag ?? 0.86,
        color: o.color ?? "#000",
        char: o.char
      });
    }
  }
  update(dt) {
    const L2 = this.list;
    for (let i = L2.length - 1; i >= 0; i--) {
      const p = L2[i];
      p.life += dt;
      if (p.life >= p.ttl) {
        L2.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
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
        case "confetti":
          s.begin();
          s.rect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
          s.fill(p.color);
          break;
        case "star":
          s.begin();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? p.size * 0.42 : p.size;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            i ? s.line(x, y) : s.move(x, y);
          }
          s.close();
          s.fill(p.color);
          break;
        case "sparkle": {
          const q = p.size;
          s.begin();
          s.move(0, -q);
          s.quad(0, 0, q, 0);
          s.quad(0, 0, 0, q);
          s.quad(0, 0, -q, 0);
          s.quad(0, 0, 0, -q);
          s.fill(p.color);
          break;
        }
        case "drop":
          s.begin();
          s.move(0, -p.size * 1.3);
          s.quad(p.size * 0.9, p.size * 0.3, 0, p.size);
          s.quad(-p.size * 0.9, p.size * 0.3, 0, -p.size * 1.3);
          s.fill(p.color);
          break;
        case "zzz":
          drawGlyph(s, "Z", p.size * 2.4, p.color, 0.17);
          break;
        case "letter":
          drawGlyph(s, p.char || "A", p.size * 2.6, p.color, 0.16);
          break;
      }
      s.restore();
    }
  }
  clear() {
    this.list.length = 0;
  }
  get count() {
    return this.list.length;
  }
};

// src/props/materials.js
var ROLES = [
  "accent",
  // the item's own colour — what a recolour changes
  "accentDeep",
  // its shadow side: bands, brims, the underside of a petal
  "accentLight",
  // its lit side: highlights, rims
  "neutral",
  // straps, stems, string — not the item's identity colour
  "neutralDeep",
  "ink",
  // the character's feature colour: rims, outlines-as-drawing
  "lens",
  // glass — carries its own alpha
  "gem",
  // the one contrasting spot: a gem, a berry, a button
  "white"
];
var FALLBACK = "#FFC94A";
function palette(T2 = {}, o = {}, overrides = {}, defaults = {}) {
  const askedFor = (role) => {
    const key = overrides[role];
    return key && o[key] || o[role] || null;
  };
  const accent = askedFor("accent") || o.color || defaults.accent || T2.accent || FALLBACK;
  const base2 = {
    accent,
    accentDeep: darken(accent, 0.18),
    accentLight: lighten(accent, 0.22),
    neutral: T2.feature ? mix(T2.feature, "#FFFFFF", 0.45) : "#8A8794",
    neutralDeep: T2.feature || "#4A4750",
    ink: T2.feature || "#3A3742",
    lens: "#FFFFFF",
    gem: "#E2664F",
    white: "#FFFFFF"
  };
  const reserved = [T2.correct, T2.wrong].filter(Boolean).map((c) => c.toLowerCase());
  return function colourFor(role) {
    if (role && typeof role === "object") {
      const from = colourFor(role.from || "accent");
      if (role.darken) return darken(from, role.darken);
      if (role.lighten) return lighten(from, role.lighten);
      return from;
    }
    if (!ROLES.includes(role)) throw new Error(`unknown material role: ${role}`);
    const want = askedFor(role) || defaults[role] || base2[role];
    if (typeof want === "string" && reserved.includes(want.toLowerCase())) {
      return mix(want, FALLBACK, 0.62);
    }
    return want;
  };
}

// src/props/shapes.js
var node = (type, o) => ({ type, x: 0, y: 0, fill: "accent", outline: "outer", ...o });
var group = (children, o = {}) => ({ type: "group", x: 0, y: 0, rotate: 0, sx: 1, sy: 1, ...o, children: children.filter(Boolean) });
var mirror = (f, o = {}) => group([f(-1), f(1)], o);
var around = (n2, r, f, o = {}) => group(Array.from({ length: n2 }, (_, i) => {
  const a = i / n2 * Math.PI * 2 - Math.PI / 2 + (o.phase || 0);
  const child = f(a, i);
  return { ...child, x: (child.x || 0) + Math.cos(a) * r, y: (child.y || 0) + Math.sin(a) * r };
}), o);
var ellipse = (o) => node("ellipse", { ry: o.rx, ...o });
var circle = (o) => node("ellipse", { ry: o.r, rx: o.r, ...o });
var roundedRect = (o) => node("rrect", { r: 6, ...o });
var star = (o) => node("star", { points: 5, rotate: 0, inner: o.outer * 0.44, ...o });
var heart = (o) => node("heart", { size: 20, rotate: 0, ...o });
var path = (o) => node("path", { cmds: [], ...o });
var custom = (o) => node("custom", { outline: "none", ...o });
var ring = (o) => node("ring", { ry: o.rx, width: 5, stroke: "accent", fill: null, outline: "none", ...o });
var line = (o) => node("line", { width: 4, cap: "round", join: "round", fill: null, stroke: "accent", outline: "none", ...o });
var RRECT = (s, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2);
  s.begin();
  s.move(x - w / 2 + rr, y - h / 2);
  s.line(x + w / 2 - rr, y - h / 2);
  s.quad(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + rr);
  s.line(x + w / 2, y + h / 2 - rr);
  s.quad(x + w / 2, y + h / 2, x + w / 2 - rr, y + h / 2);
  s.line(x - w / 2 + rr, y + h / 2);
  s.quad(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - rr);
  s.line(x - w / 2, y - h / 2 + rr);
  s.quad(x - w / 2, y - h / 2, x - w / 2 + rr, y - h / 2);
  s.close();
};
var STAR = (s, n2, { x, y, outer, inner, points, rotate }) => {
  s.begin();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = i / (points * 2) * Math.PI * 2 - Math.PI / 2 + rotate;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? s.line(px, py) : s.move(px, py);
  }
  s.close();
};
var HEART = (s, { x, y, size, rotate }) => {
  const w = size, h = size * 0.92;
  const pt = (px, py) => {
    if (!rotate) return [x + px, y + py];
    const c = Math.cos(rotate), sn = Math.sin(rotate);
    return [x + px * c - py * sn, y + px * sn + py * c];
  };
  s.begin();
  s.move(...pt(0, h * 0.52));
  s.cubic(...pt(-w * 0.62, h * 0.02), ...pt(-w * 0.52, -h * 0.62), ...pt(0, -h * 0.2));
  s.cubic(...pt(w * 0.52, -h * 0.62), ...pt(w * 0.62, h * 0.02), ...pt(0, h * 0.52));
  s.close();
};
function paintShape(s, n2, ctx) {
  if (!n2) return;
  if (ctx.contour && n2.outline === "none") return;
  if (n2.type === "group") {
    const moved = n2.x || n2.y || n2.rotate || n2.sx !== 1 || n2.sy !== 1;
    if (moved) {
      s.save();
      s.translate(n2.x || 0, n2.y || 0);
      if (n2.rotate) s.rotate(n2.rotate);
      if (n2.sx !== 1 || n2.sy !== 1) s.scale(n2.sx ?? 1, n2.sy ?? 1);
    }
    for (const c of n2.children) paintShape(s, c, ctx);
    if (moved) s.restore();
    return;
  }
  switch (n2.type) {
    case "ellipse":
      s.begin();
      s.ellipse(n2.x, n2.y, Math.abs(n2.rx), Math.abs(n2.ry), n2.rotate || 0);
      break;
    case "rrect":
      RRECT(s, n2.x, n2.y, n2.w, n2.h, n2.r);
      break;
    case "star":
      STAR(s, n2, n2);
      break;
    case "heart":
      HEART(s, n2);
      break;
    case "poly":
      s.begin();
      n2.pts.forEach(([px, py], i) => i ? s.line(n2.x + px, n2.y + py) : s.move(n2.x + px, n2.y + py));
      s.close();
      break;
    case "path":
      s.begin();
      for (const c of n2.cmds) {
        const [k, ...a] = c;
        if (k === "M") s.move(n2.x + a[0], n2.y + a[1]);
        else if (k === "L") s.line(n2.x + a[0], n2.y + a[1]);
        else if (k === "Q") s.quad(n2.x + a[0], n2.y + a[1], n2.x + a[2], n2.y + a[3]);
        else if (k === "C") s.cubic(n2.x + a[0], n2.y + a[1], n2.x + a[2], n2.y + a[3], n2.x + a[4], n2.y + a[5]);
        else if (k === "Z") s.close();
      }
      break;
    case "ring":
      s.begin();
      s.ellipse(n2.x, n2.y, Math.abs(n2.rx), Math.abs(n2.ry), n2.rotate || 0);
      s.stroke(ctx.col(n2.stroke), n2.width);
      return;
    case "custom":
      n2.draw(s, ctx);
      return;
    case "line":
      s.begin();
      n2.pts.forEach(([px, py], i) => i ? s.line(n2.x + px, n2.y + py) : s.move(n2.x + px, n2.y + py));
      s.stroke(ctx.col(n2.stroke), n2.width, n2.cap, n2.join);
      return;
    default:
      throw new Error(`unknown shape: ${n2.type}`);
  }
  s.fill(ctx.col(n2.fill));
  if (ctx.gloss && n2.outline === "outer" && !ctx.contour) {
    paintShape(s, { ...n2, __lit: true }, { ...ctx, gloss: null, col: () => ctx.gloss });
  }
}
function walkShape(n2, fn) {
  if (!n2) return;
  fn(n2);
  if (n2.type === "group") n2.children.forEach((c) => walkShape(c, fn));
}

// src/props/compile.js
var WORN = { lit: 0.16, dark: 0.17 };
var strokePath = (s, pts, close) => {
  s.begin();
  pts.forEach((p, i) => i ? s.line(p.x, p.y) : s.move(p.x, p.y));
  if (close) s.close();
};
function compileProp(def) {
  const parts = def.parts || [];
  return {
    def,
    draw(s, S, T2, o = {}, where, passName) {
      const g = S.g || G;
      const col = palette(T2, o, def.overrides || {}, def.defaults || {});
      const want = where === "front" ? "near" : "far";
      const gloss = def.gloss === false ? null : formLight(g.R, WORN);
      let open = null;
      const clipFor = (part) => part.clip ?? part.frame.clipToHead ?? null;
      const closeClip = () => {
        if (open !== null) {
          s.restore();
          open = null;
        }
      };
      const outlining = s.contour === true;
      for (const part of parts) {
        if (part.pass && passName && !(Array.isArray(part.pass) ? part.pass : [part.pass]).includes(passName)) continue;
        const frame = part.frame;
        const placements = (outlining && frame.silhouette ? frame.silhouette(S, T2) : frame.resolve(S, T2)) || [];
        const wantSide = part.side ?? want;
        const mine = wantSide === "any" ? placements : placements.filter((p) => p.side === wantSide);
        if (!mine.length) continue;
        const wantClip = clipFor(part);
        if (wantClip !== open) {
          closeClip();
          if (wantClip !== null) {
            s.save();
            headRegion(s, S, wantClip, false);
            s.clip();
            open = wantClip;
          }
        }
        const partCol = part.defaults ? palette(T2, o, def.overrides || {}, { ...def.defaults || {}, ...part.defaults }) : col;
        const ctx = {
          col: (role) => partCol(part.material?.[role] || role),
          contour: s.contour === true,
          gloss: part.gloss === false ? null : gloss
        };
        const fillFor = (p) => p.side === "far" && part.fillFar || part.fill || "accent";
        const glossOn = (p) => ctx.gloss && !ctx.contour && !(part.gloss === "near" && p.side === "far");
        for (const p of mine) {
          if (p.kind === "poly") {
            const shut = p.close !== false;
            strokePath(s, p.pts, shut);
            s.fill(ctx.col(fillFor(p)));
            if (glossOn(p)) {
              strokePath(s, p.pts, shut);
              s.fill(ctx.gloss);
            }
          } else if (p.kind === "stroke") {
            if (ctx.contour && part.outline === "none") continue;
            strokePath(s, p.pts, p.close);
            s.stroke(ctx.col(fillFor(p)), p.width, p.cap || "round", p.join || "round");
            if (glossOn(p)) {
              strokePath(s, p.pts, p.close);
              s.stroke(ctx.gloss, p.width, p.cap || "round", p.join || "round");
            }
          } else if (p.kind === "billboard") {
            const art = typeof part.art === "function" ? part.art(p, S, T2, o) : part.art;
            if (!art) continue;
            s.save();
            if (p.vis !== void 0) s.alpha(p.vis);
            if (!p.raw) {
              s.translate(p.x, p.y);
              if (p.rotate) s.rotate(p.rotate);
              s.scale(p.sx ?? 1, p.sy ?? 1);
            }
            paintShape(s, art, ctx);
            s.restore();
          } else if (p.kind === "face") {
            const art = part.art;
            if (typeof art === "function") art(s, p, ctx, S, T2, o);
          }
        }
      }
      closeClip();
    }
  };
}

// src/props/registry.js
var OCCUPANCY = [
  "skull.top",
  "skull.band",
  "skull.left",
  "skull.right",
  "skull.back",
  "face.eyes",
  "face.mouth",
  "ear.left",
  "ear.right",
  "neck.ring",
  "chest.front",
  "back",
  "hand.left",
  "hand.right"
];
var PASSES = [
  "rearExternal",
  // capes, backpacks, anything behind the whole character
  "headRear",
  // the far side of things on the skull
  "bodyFront",
  // collars, badges, aprons — over the body, under the face
  "headFront",
  // the near side of things on the skull
  "faceFront",
  // glasses and goggles — over the features
  "heldRear",
  // a held thing, behind the near hand
  "heldFront"
  // the part of it the hand does not cover
];
var VISIBILITY = [
  "circumferential",
  // bands, hats: something of it shows at every angle
  "localized",
  // clips, flowers: allowed to go fully behind the head
  "face",
  // glasses: present exactly when the face is
  "paired",
  // ears: at least the near one shows
  /* A beanie lies entirely INSIDE the head's outline: there is no part of it
     that the skull can pass in front of, so it never draws into a rear pass
     and it never should. That is not the failure the rear-pass check is
     looking for — that one is about a hat pinned to the lens — but it looks
     identical from outside, which is why it has to be declared rather than
     guessed. A cap is not skullbound: its peak leaves the silhouette. */
  "skullbound"
];
var PROPS = /* @__PURE__ */ new Map();
var fail = (id, msg) => {
  throw new Error(`prop "${id}": ${msg}`);
};
function defineProp(def) {
  const id = def.id;
  if (!id) throw new Error("a prop needs an id");
  if (PROPS.has(id)) fail(id, "already defined");
  if (!def.slot) fail(id, "needs a slot");
  const occupies = def.occupies || [];
  if (!occupies.length) fail(id, "needs an occupancy footprint");
  for (const t of occupies) if (!OCCUPANCY.includes(t)) fail(id, `unknown occupancy token "${t}"`);
  const passes = def.passes || [];
  if (!passes.length) fail(id, "needs at least one pass");
  for (const p of passes) if (!PASSES.includes(p)) fail(id, `unknown pass "${p}"`);
  const vis = def.checks?.visibility;
  if (vis && !VISIBILITY.includes(vis)) fail(id, `unknown visibility policy "${vis}"`);
  for (const part of def.parts || []) {
    if (!part.frame?.resolve) fail(id, "every part needs a frame");
    const art = typeof part.art === "function" ? null : part.art;
    walkShape(art, (n2) => {
      for (const key of ["fill", "stroke"]) {
        const v = n2[key];
        if (v == null || n2.type === "group") continue;
        if (!ROLES.includes(v)) fail(id, `${key} "${v}" is not a material role`);
      }
    });
    for (const [role, to] of Object.entries(part.material || {})) {
      const ok = typeof to === "object" ? ROLES.includes(to.from || "accent") : ROLES.includes(to);
      if (!ROLES.includes(role) || !ok) fail(id, `bad material mapping for ${role}`);
    }
  }
  const entry = {
    id,
    kind: def.kind || "wearable",
    slot: def.slot,
    occupies,
    passes,
    z: def.z ?? 50,
    /* How the hands must be posed to hold this. A one-handed pencil wants a
       hand up and a little out; a two-handed book wants both hands low and
       wide, because the midpoint of two RAISED hands is level with the eyes
       and the book ends up held across the character's own face. */
    grip: def.grip || null,
    checks: { visibility: "localized", minReadableSize: 48, contrastAgainst: "body", ...def.checks },
    ...compileProp(def)
  };
  PROPS.set(id, entry);
  return entry;
}
var getProp = (id) => PROPS.get(id);
var propIds = () => [...PROPS.keys()];
function propConflicts(id) {
  const mine = PROPS.get(id);
  if (!mine) return [];
  return propIds().filter((other) => other !== id && PROPS.get(other).occupies.some((t) => mine.occupies.includes(t)));
}
function checkLoadout(ids) {
  const problems = [];
  const taken = /* @__PURE__ */ new Map();
  const worn = [];
  for (const id of ids) {
    const p = PROPS.get(id);
    if (!p) {
      problems.push(`unknown prop "${id}"`);
      continue;
    }
    if (p.kind === "wearable") worn.push(id);
    for (const t of p.occupies) {
      if (taken.has(t)) problems.push(`${id} and ${taken.get(t)} both need ${t}`);
      else taken.set(t, id);
    }
  }
  if (worn.length > 3) problems.push(`${worn.length} worn items; the limit is three`);
  return problems;
}

// src/props/frames.js
function headPoint(X2, Y, Z, S, k = 1) {
  const g = S.g || G;
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
  const x1 = X2 * cy + Z * sy;
  const z1 = -X2 * sy + Z * cy;
  const y2 = Y * cp + z1 * sp;
  const z2 = -Y * sp + z1 * cp;
  return { x: x1 * g.R * k, y: y2 * g.RY * k, z: z2 * g.R * k };
}
function upVector(S) {
  const t = headPoint(0, -1, 0, S);
  const m = Math.hypot(t.x, t.y) || 1;
  return { x: t.x / m, y: t.y / m };
}
var loop = (n2, f) => Array.from({ length: n2 }, (_, i) => f(i / n2 * Math.PI * 2, i));
var span = (n2, a0, a1, f) => Array.from({ length: n2 }, (_, i) => f(a0 + (a1 - a0) * i / (n2 - 1), i));
function ringPoints(u, S, n2 = 64, k = 1) {
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return loop(n2, (a) => headPoint(r * Math.sin(a), u, r * Math.cos(a), S, k));
}
function splitDepth(pts, closed = true) {
  const n2 = pts.length;
  const cross = (a, b) => {
    const t = a.z / (a.z - b.z);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
  };
  const runs = [];
  let cur = { near: pts[0].z >= 0, pts: [pts[0]] };
  const last = closed ? n2 : n2 - 1;
  for (let i = 1; i <= last; i++) {
    const prev = pts[(i - 1) % n2], p = pts[i % n2];
    const near = p.z >= 0;
    if (near !== cur.near) {
      const x = cross(prev, p);
      cur.pts.push(x);
      runs.push(cur);
      cur = { near, pts: [x, p] };
    } else cur.pts.push(p);
  }
  runs.push(cur);
  if (closed && runs.length > 1 && runs[0].near === runs[runs.length - 1].near) {
    const tail = runs.pop();
    runs[0].pts = tail.pts.concat(runs[0].pts);
  }
  const of = (k) => runs.filter((r) => r.near === k).map((r) => r.pts).filter((p) => p.length > 2);
  return { near: of(true), far: of(false) };
}
var headBillboard = ({
  at,
  radius = 1.02,
  orient = "head-up",
  minFacing = 0.52,
  roll = 0
}) => ({
  kind: "billboard",
  resolve(S) {
    const g = S.g || G;
    const p = headPoint(at[0], at[1], at[2], S, radius);
    const k = Math.max(minFacing, Math.abs(p.z) / g.R);
    const up = upVector(S);
    const rotate = orient === "head-up" ? Math.atan2(up.x, -up.y) + roll : roll;
    return [{
      side: p.z >= 0 ? "near" : "far",
      kind: "billboard",
      x: p.x,
      y: p.y,
      z: p.z,
      rotate,
      sx: k,
      sy: 1
    }];
  }
});
var headRing = ({
  u,
  thickness = 0.09,
  radius = 1.02,
  segments = 24,
  arc: arc2 = null
}) => ({
  kind: "ring",
  resolve(S) {
    const lo = ringPoints(u, S, segments, radius);
    const hi = ringPoints(u - thickness, S, segments, radius);
    const out = [];
    for (let i = 0; i < segments; i++) {
      if (arc2 && (i < arc2[0] || i >= arc2[1])) continue;
      const j = (i + 1) % segments;
      const mid = (lo[i].z + lo[j].z) / 2;
      out.push({
        side: mid >= 0 ? "near" : "far",
        kind: "poly",
        i,
        pts: [lo[i], lo[j], hi[j], hi[i]]
      });
    }
    out.lo = lo;
    out.hi = hi;
    return out;
  },
  /* Spikes, jewels and scallops need to know where the band's edges landed. */
  edges(S) {
    return {
      lo: ringPoints(u, S, segments, radius),
      hi: ringPoints(u - thickness, S, segments, radius)
    };
  }
});
var headBand = ({ u, width = 11, radius = 1.006, segments = 64 }) => ({
  kind: "band",
  resolve(S) {
    return splitDepth(ringPoints(u, S, segments, radius)).near.map((pts) => ({
      side: "near",
      kind: "stroke",
      pts,
      width,
      close: false,
      cap: "butt",
      join: "round"
    }));
  }
});
var headHoop = ({
  end = 0.38,
  lean = 0.3,
  drop = -0.05,
  radius = 1.03,
  width = 9,
  widthAcross = 13,
  segments = 48
}) => ({
  kind: "hoop",
  resolve(S) {
    const pts = span(segments, end, Math.PI - end, (a) => headPoint(
      Math.cos(a) * radius,
      -Math.sin(a) * radius,
      drop - lean * Math.sin(a),
      S
    ));
    const w = width + widthAcross * Math.abs(Math.sin(S.yaw));
    const cut = splitDepth(pts, false);
    return [
      ...cut.near.map((p) => ({ side: "near", kind: "stroke", pts: p, width: w, close: false })),
      ...cut.far.map((p) => ({ side: "far", kind: "stroke", pts: p, width: w, close: false }))
    ];
  }
});
var headDome = ({ u, radius = 1.006 }) => ({
  kind: "dome",
  clipToHead: radius,
  resolve(S) {
    const g = S.g || G;
    const ring2 = ringPoints(u, S, 64, radius);
    let lo = 0, hi = 0;
    ring2.forEach((p, i) => {
      if (p.x < ring2[lo].x) lo = i;
      if (p.x > ring2[hi].x) hi = i;
    });
    const arc2 = (a, b) => {
      const out = [];
      for (let i = a; ; i = (i + 1) % ring2.length) {
        out.push(ring2[i]);
        if (i === b) break;
      }
      return out;
    };
    const l2r = arc2(lo, hi), r2l = arc2(hi, lo);
    const mean = (a) => a.reduce((t, p) => t + p.y, 0) / a.length;
    const lower = mean(l2r) >= mean(r2l) ? l2r : r2l.slice().reverse();
    return [{
      side: "near",
      kind: "poly",
      pts: [{ x: -g.R * 1.7, y: -g.RY * 2 }, ...lower, { x: g.R * 1.7, y: -g.RY * 2 }]
    }];
  }
});
var headCone = ({
  u,
  radius = 0.86,
  topRadius = 0,
  height = 1.5,
  leanZ = 0,
  leanX = 0,
  segments = 28
}) => {
  const at = (r, y, dz, dx, S) => loop(segments, (a) => headPoint(r * Math.sin(a) + dx, y, r * Math.cos(a) + dz, S, 1));
  return {
    kind: "cone",
    rings(S) {
      return {
        base: at(radius, u, 0, 0, S),
        top: at(topRadius, u - height, leanZ, leanX, S)
      };
    },
    /* ONE polygon a side, not a quad per segment.
       Quads were the first version, and they left a fan of hairlines up the
       front of every cone: two SVG polygons sharing an exact edge still
       anti-alias against each other, so every seam showed as a thin darker
       line. A cone only has two parts that matter — the half facing you and
       the half that does not — so that is what it is drawn as. */
    resolve(S) {
      return this.outline(S);
    },
    silhouette(S) {
      return this.outline(S);
    },
    /**
     * The two halves, split at the horizon.
     *
     * Split on the RINGS and then joined, never the other way round. Building
     * the whole outline first and depth-splitting that was the second version,
     * and it deleted the hat: the apex sits exactly on the horizon at face-on,
     * the base ring's endpoints sit within a float of it, and the cut sliced
     * the triangle into an apex with no base and a base with no apex — each
     * with zero area. Cutting the ring first cannot do that, because the apex
     * is attached after the cut and belongs to both halves.
     *
     * In an orthographic projection this is also exactly right: the visible
     * surface of a cone is the half facing the viewer, and its screen outline
     * is the apex plus that half's arc.
     */
    outline(S) {
      const { base: base2, top } = this.rings(S);
      const cut = (ring2) => {
        const c = splitDepth(ring2, true);
        const longest = (runs) => runs.sort((a, b2) => b2.length - a.length)[0] || [];
        return { near: longest(c.near), far: longest(c.far) };
      };
      const b = cut(base2);
      const out = [];
      if (topRadius === 0) {
        const apex = top.reduce((a, p) => ({
          x: a.x + p.x / top.length,
          y: a.y + p.y / top.length,
          z: a.z + p.z / top.length
        }), { x: 0, y: 0, z: 0 });
        if (b.far.length > 1) out.push({ side: "far", kind: "poly", pts: [apex, ...b.far] });
        if (b.near.length > 1) out.push({ side: "near", kind: "poly", pts: [apex, ...b.near] });
        return out;
      }
      const t = cut(top);
      if (b.far.length > 1 && t.far.length > 1)
        out.push({ side: "far", kind: "poly", pts: [...t.far.slice().reverse(), ...b.far] });
      if (b.near.length > 1 && t.near.length > 1)
        out.push({ side: "near", kind: "poly", pts: [...t.near.slice().reverse(), ...b.near] });
      return out;
    }
  };
};
var headDisc = ({
  u,
  radius = 1.45,
  droop = 0,
  lobes = 0,
  lobeAmp = 0.12,
  phase = 0,
  segments = 56
}) => ({
  kind: "disc",
  resolve(S) {
    const pts = loop(segments, (a) => {
      const r = radius * (1 + (lobes ? lobeAmp * Math.cos(lobes * a + phase) : 0));
      return headPoint(r * Math.sin(a), u + droop * Math.cos(a), r * Math.cos(a), S, 1);
    });
    const cut = splitDepth(pts, true);
    return [
      ...cut.far.map((p) => ({ side: "far", kind: "poly", pts: p })),
      ...cut.near.map((p) => ({ side: "near", kind: "poly", pts: p }))
    ];
  },
  /* Same runs, left open: the ends of a run are where the brim passes behind
     the head, and closing them draws a chord straight across it. */
  silhouette(S) {
    return this.resolve(S).map((p) => ({ ...p, close: false }));
  }
});
var headPlate = ({ u, halfW = 1.25, halfD = 1.25, tiltZ = 0, perEdge = 8 }) => ({
  kind: "plate",
  resolve(S) {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const pts = [];
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      for (let k = 0; k < perEdge; k++) {
        const t = k / perEdge;
        const sx = ax + (bx - ax) * t, sz = az + (bz - az) * t;
        pts.push(headPoint(sx * halfW, u + tiltZ * sz, sz * halfD, S, 1));
      }
    }
    const cut = splitDepth(pts, true);
    return [
      ...cut.far.map((p) => ({ side: "far", kind: "poly", pts: p })),
      ...cut.near.map((p) => ({ side: "near", kind: "poly", pts: p }))
    ];
  },
  silhouette(S) {
    return this.resolve(S).map((p) => ({ ...p, close: false }));
  }
});
var earPair = ({ u = -0.1, radius = 1, minFacing = 0, place = "transform" }) => ({
  kind: "pair",
  resolve(S) {
    const g = S.g || G;
    return [-1, 1].map((side) => {
      const p = headPoint(side * 1, u, 0, S, radius);
      const facing = Math.abs(p.z) / g.R;
      return {
        side: p.z >= 0 ? "near" : "far",
        kind: "billboard",
        ear: side,
        x: p.x,
        y: p.y,
        z: p.z,
        rotate: 0,
        raw: place === "size",
        sx: Math.max(minFacing, facing),
        sy: 1,
        facing
      };
    });
  }
});
var ringStuds = ({ u, radius = 1, count = 14, spin = 0, minFacing = 0.18 }) => ({
  kind: "studs",
  resolve(S) {
    const g = S.g || G;
    const r = Math.sqrt(Math.max(0, 1 - u * u)) * radius;
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + spin;
      const p = headPoint(r * Math.sin(a), u, r * Math.cos(a), S, 1);
      const facing = Math.abs(p.z) / g.R;
      out.push({
        side: p.z >= 0 ? "near" : "far",
        kind: "billboard",
        i,
        raw: true,
        x: p.x,
        y: p.y,
        z: p.z,
        rotate: 0,
        sx: 1,
        sy: 1,
        facing: Math.max(minFacing, facing)
      });
    }
    return out;
  }
});
var headSpikes = ({
  u,
  thickness = 0.09,
  radius = 1.02,
  segments = 24,
  every = 3,
  height = 42,
  grow = 0.38
}) => ({
  kind: "spikes",
  resolve(S) {
    const g = S.g || G;
    const hi = ringPoints(u - thickness, S, segments, radius);
    const up = upVector(S);
    const out = [];
    for (let i = 0; i < segments; i += every) {
      const a = hi[(i - 1 + segments) % segments], b = hi[i], c = hi[(i + 1) % segments];
      const h = height * (1 - grow + grow * Math.abs(b.z) / g.R);
      const tip = { x: b.x + up.x * h, y: b.y + up.y * h };
      out.push({ side: b.z >= 0 ? "near" : "far", kind: "poly", pts: [a, tip, c] });
    }
    return out;
  }
});
var facePlane = ({ follow = "centre" } = {}) => ({
  kind: "face",
  resolve(S) {
    const F = S._face;
    if (!F || F.vis <= 0.01) return [];
    if (follow === "eyes") {
      return [{ side: "near", kind: "face", vis: F.vis, eyes: [F.eyeL, F.eyeR] }];
    }
    return [{
      side: "near",
      kind: "billboard",
      x: F.cx ?? 0,
      y: F.cy ?? 0,
      z: 1,
      rotate: F.lean ?? 0,
      sx: F.fx ?? 1,
      sy: 1,
      vis: F.vis
    }];
  }
});
var handGrip = ({ side = "r", out = 0, lift = 0 }) => ({
  kind: "hand",
  resolve(S) {
    const h = S.hand && S.hand[side];
    if (!h || h.show <= 0.01) return [];
    const g = S.g || G;
    const sgn = side === "l" ? -1 : 1;
    const p = project(
      sgn * (g.handSX + (h.out + out) * 22),
      g.handSY - (h.lift + lift) * g.handLift,
      g.Rh,
      S.yaw,
      S.pitch
    );
    return [{
      side: p.z >= 0 ? "near" : "far",
      kind: "billboard",
      x: p.x,
      y: p.y,
      z: p.z,
      rotate: h.swing * sgn,
      sx: 1,
      sy: 1,
      hand: sgn,
      vis: h.show,
      facing: Math.abs(p.fx)
    }];
  }
});
var bothHands = ({ lift = 0, out = 0 } = {}) => ({
  kind: "hands",
  resolve(S) {
    const hl = S.hand && S.hand.l, hr = S.hand && S.hand.r;
    if (!hl || !hr || Math.min(hl.show, hr.show) <= 0.01) return [];
    const g = S.g || G;
    const at = (h, sgn) => project(
      sgn * (g.handSX + (h.out + out) * 22),
      g.handSY - (h.lift + lift) * g.handLift,
      g.Rh,
      S.yaw,
      S.pitch
    );
    const L2 = at(hl, -1), R3 = at(hr, 1);
    const z = Math.max(L2.z, R3.z);
    return [{
      side: z >= 0 ? "near" : "far",
      kind: "billboard",
      x: (L2.x + R3.x) / 2,
      y: (L2.y + R3.y) / 2,
      z,
      rotate: Math.atan2(R3.y - L2.y, R3.x - L2.x),
      sx: 1,
      sy: 1,
      span: Math.abs(R3.x - L2.x),
      vis: Math.min(hl.show, hr.show)
    }];
  }
});
var headAnchor = ({
  at,
  radius = 1,
  hideBehind = -0.5,
  sortDepth = true,
  place = "transform"
}) => ({
  kind: "anchor",
  resolve(S) {
    const g = S.g || G;
    const p = headPoint(at[0], at[1], at[2], S, radius);
    if (p.z <= g.R * hideBehind) return [];
    return [{
      side: !sortDepth || p.z >= 0 ? "near" : "far",
      kind: "billboard",
      x: p.x,
      y: p.y,
      z: p.z,
      rotate: 0,
      sx: 1,
      sy: 1,
      raw: place === "size"
    }];
  }
});

// src/props/catalogue/head-side.js
var R2 = 26;
var bowLoop = (side) => path({
  fill: "accent",
  cmds: [
    ["M", 0, 0],
    ["C", side * R2 * 0.55, -R2 * 0.72, side * R2 * 1.3, -R2 * 0.6, side * R2 * 1.22, -R2 * 0.05],
    ["C", side * R2 * 1.16, R2 * 0.52, side * R2 * 0.5, R2 * 0.62, 0, 0],
    ["Z"]
  ]
});
var bowTail = (side) => path({
  fill: "accent",
  cmds: [
    ["M", side * R2 * 0.14, R2 * 0.1],
    ["C", side * R2 * 0.44, R2 * 0.62, side * R2 * 0.52, R2 * 0.95, side * R2 * 0.3, R2 * 1.1],
    ["C", side * R2 * 0.2, R2 * 0.8, side * R2 * 0.04, R2 * 0.55, 0, R2 * 0.16],
    ["Z"]
  ]
});
defineProp({
  id: "bow",
  kind: "wearable",
  slot: "head.side",
  occupies: ["skull.left"],
  passes: ["headRear", "headFront"],
  z: 40,
  /* No form light. A bow is small and mostly edge-lit; a terminator across
     something this size reads as dirt rather than as shading. */
  gloss: false,
  overrides: { accentDeep: "knot" },
  checks: { visibility: "localized", minReadableSize: 48, contrastAgainst: "body" },
  parts: [{
    /* Slightly off the top-left of the skull, and rolled a touch out of the
       head's up axis so it sits at a jaunty angle instead of standing to
       attention. */
    frame: headBillboard({ at: [-0.44, -0.7, 0.5], radius: 1.02, minFacing: 0.52, roll: -0.24 }),
    material: { accentDeep: { from: "accent", darken: 0.14 } },
    art: group([
      bowLoop(-1),
      bowLoop(1),
      bowTail(-1),
      bowTail(1),
      /* The knot is inside the bow, so it takes no contour: an outline around
         every internal detail is a different drawing at small sizes. */
      ellipse({ rx: R2 * 0.26, ry: R2 * 0.3, fill: "accentDeep", outline: "none" })
    ])
  }]
});
var FR = 16;
defineProp({
  id: "flower",
  kind: "wearable",
  slot: "head.side",
  occupies: ["skull.left"],
  passes: ["headRear", "headFront"],
  z: 40,
  gloss: false,
  /* A flower is pink whatever the character's accent happens to be. An item
     that recolours with the skin stops being a flower and becomes a blob. */
  defaults: { accent: "#F26D8B", gem: "#FFD97A" },
  overrides: { gem: "centre" },
  checks: { visibility: "localized", minReadableSize: 48, contrastAgainst: "body" },
  parts: [{
    frame: headBillboard({ at: [-0.5, -0.64, 0.55], radius: 1.02, minFacing: 0.55 }),
    art: group([
      around(5, FR, () => circle({ r: FR * 0.72, fill: "accent" })),
      circle({ r: FR * 0.6, fill: "gem", outline: "none" })
    ])
  }]
});

// src/props/catalogue/clips.js
var clip = (id, art, o = {}) => defineProp({
  id,
  kind: "wearable",
  slot: "head.side",
  occupies: ["skull.left"],
  passes: ["headRear", "headFront"],
  z: 40,
  gloss: o.gloss ?? false,
  defaults: o.defaults,
  overrides: o.overrides,
  checks: { visibility: "localized", minReadableSize: 48, contrastAgainst: "body" },
  parts: [{
    frame: headBillboard({
      at: o.at || [-0.46, -0.68, 0.52],
      radius: 1.02,
      minFacing: o.minFacing ?? 0.54,
      roll: o.roll ?? -0.1
    }),
    material: o.material,
    art
  }]
});
clip("star-clip", group([
  star({ outer: 27, inner: 12, points: 5, fill: "accent" }),
  circle({ r: 6, fill: "accentLight", outline: "none" })
]), { defaults: { accent: "#FFC94A" } });
clip("heart-clip", group([
  heart({ size: 46, fill: "accent" }),
  /* The highlight is what makes a heart read as an object rather than as a
     symbol. Off-centre, because a centred one reads as a hole. */
  ellipse({ x: -9, y: -9, rx: 6.5, ry: 4.6, rotate: -0.5, fill: "accentLight", outline: "none" })
]), { defaults: { accent: "#F26D8B" } });
clip("moon-clip", path({
  fill: "accent",
  cmds: [
    ["M", 3, -25],
    ["C", 21, -21, 27, 0, 15, 16],
    ["C", 6, 27, -9, 27, -18, 21],
    ["C", -3, 21, 9, 9, 9, -4],
    ["C", 9, -13, 7, -21, 3, -25],
    ["Z"]
  ]
}), { defaults: { accent: "#F2E27A" }, minFacing: 0.56 });
clip("lightning-clip", path({
  fill: "accent",
  cmds: [
    ["M", 5, -27],
    ["L", -17, 3],
    ["L", -3, 3],
    ["L", -8, 27],
    ["L", 17, -5],
    ["L", 2, -5],
    ["Z"]
  ]
}), { defaults: { accent: "#FFC94A" }, minFacing: 0.5 });
var RAINBOW = ["#E0574B", "#F0913F", "#F2CE4E", "#5FA85C", "#4A73C4"];
defineProp({
  id: "rainbow-clip",
  kind: "wearable",
  slot: "head.side",
  occupies: ["skull.left"],
  passes: ["headRear", "headFront"],
  z: 40,
  gloss: false,
  checks: { visibility: "localized", minReadableSize: 48, contrastAgainst: "body" },
  parts: RAINBOW.map((hex, i) => ({
    frame: headBillboard({ at: [-0.46, -0.68, 0.52], radius: 1.02, minFacing: 0.58, roll: -0.1 }),
    defaults: { accent: hex },
    art: line({
      pts: Array.from({ length: 19 }, (_, k) => {
        const a = Math.PI + k / 18 * Math.PI, r = 30 - i * 5.6;
        return [Math.cos(a) * r, Math.sin(a) * r + 13];
      }),
      width: 6,
      stroke: "accent",
      cap: "butt"
    })
  }))
});
clip("apple-clip", group([
  /* Two lobes with a dip at the top. A single ellipse is a tomato. */
  path({
    fill: "accent",
    cmds: [
      ["M", 0, -13],
      ["C", -8, -24, -26, -19, -24, -2],
      ["C", -23, 15, -11, 27, 0, 20],
      ["C", 11, 27, 23, 15, 24, -2],
      ["C", 26, -19, 8, -24, 0, -13],
      ["Z"]
    ]
  }),
  line({ pts: [[0, -15], [2, -30]], width: 4, stroke: "neutralDeep" }),
  ellipse({ x: 11, y: -28, rx: 9, ry: 5, rotate: -0.4, fill: "gem", outline: "none" })
]), { defaults: { accent: "#E0574B", gem: "#5FA85C" }, minFacing: 0.5 });
clip("pencil-clip", group([
  roundedRect({ x: 0, y: -3, w: 16, h: 40, r: 3, fill: "accent" }),
  /* The tip is the whole read at small sizes: wood, then a dark point. */
  path({ fill: "accentLight", cmds: [["M", -8, 17], ["L", 8, 17], ["L", 0, 34], ["Z"]] }),
  path({ fill: "ink", outline: "none", cmds: [["M", -2.7, 28], ["L", 2.7, 28], ["L", 0, 34], ["Z"]] }),
  roundedRect({ x: 0, y: -25, w: 16, h: 9, r: 2.5, fill: "gem" })
]), {
  defaults: { accent: "#F2B33D", accentLight: "#F3DCA8", gem: "#E888A0" },
  minFacing: 0.46,
  roll: 0.22
});
clip("rosette", group([
  around(8, 19, () => ellipse({ rx: 11, ry: 8, fill: "accent" })),
  circle({ r: 10, fill: "accentDeep", outline: "none" }),
  path({ fill: "accent", cmds: [["M", -7, 16], ["L", -14, 37], ["L", -2, 31], ["Z"]] }),
  path({ fill: "accent", cmds: [["M", 7, 16], ["L", 14, 37], ["L", 2, 31], ["Z"]] })
]), { minFacing: 0.5 });
clip("pompom-clip", group([
  around(7, 14, () => circle({ r: 11, fill: "accent" })),
  circle({ r: 13, fill: "accent" }),
  circle({ x: -6, y: -7, r: 6, fill: "accentLight", outline: "none" })
]), { minFacing: 0.5 });
clip("butterfly-clip", group([
  mirror((side) => path({ fill: "accent", cmds: [
    ["M", 0, -3],
    ["C", side * 8, -27, side * 32, -28, side * 31, -9],
    ["C", side * 31, 3, side * 14, 7, 0, -3],
    ["Z"]
  ] })),
  mirror((side) => path({ fill: "accent", cmds: [
    ["M", 0, 3],
    ["C", side * 7, 16, side * 25, 23, side * 23, 9],
    ["C", side * 22, 0, side * 10, -2, 0, 3],
    ["Z"]
  ] })),
  ellipse({ rx: 4, ry: 18, fill: "accentDeep", outline: "none" }),
  mirror((side) => line({ pts: [[0, -14], [side * 8, -27]], width: 2.5, stroke: "accentDeep" }))
]), { defaults: { accent: "#B79BE8" }, minFacing: 0.5 });
clip("leaf-sprig", group([
  line({ pts: [[-2, 19], [2, -15]], width: 4, stroke: "accentDeep" }),
  ellipse({ x: -14, y: 2, rx: 15, ry: 9, rotate: -0.55, fill: "accent" }),
  ellipse({ x: 13, y: -9, rx: 13, ry: 8, rotate: 0.5, fill: "accent" })
]), { defaults: { accent: "#6FB56A" }, minFacing: 0.5 });
clip("ribbon", group([
  roundedRect({ x: 0, y: -17, w: 34, h: 12, r: 4, fill: "accent" }),
  path({ fill: "accentDeep", cmds: [["M", -12, -11], ["L", -20, 27], ["L", -6, 19], ["Z"]] }),
  path({ fill: "accent", cmds: [["M", 12, -11], ["L", 20, 27], ["L", 6, 19], ["Z"]] })
]), { minFacing: 0.5 });

// src/props/catalogue/headwear.js
var CU = -0.7;
defineProp({
  id: "crown",
  kind: "wearable",
  slot: "head.top",
  occupies: ["skull.top", "skull.band"],
  passes: ["headRear", "headFront"],
  z: 25,
  overrides: { gem: "gem" },
  checks: { visibility: "circumferential", minReadableSize: 48, contrastAgainst: "body" },
  parts: [
    /* The band, quad by quad, each sorted on its own depth. Neighbouring quads
       share exact edges, so the band has no seams and needs no winding rule. */
    { frame: headRing({ u: CU, thickness: 0.09, radius: 1.02, segments: 24 }) },
    { frame: headSpikes({
      u: CU,
      thickness: 0.09,
      radius: 1.02,
      segments: 24,
      every: 3,
      height: 42,
      grow: 0.38
    }) },
    /* One gem, at the front of the band. A gem on every point reads as measles
       at small sizes. */
    {
      frame: headAnchor({
        at: [0, CU - 0.045, Math.sqrt(1 - CU * CU)],
        radius: 1.02,
        hideBehind: 0.25,
        place: "size"
      }),
      art: (p) => circle({ x: p.x, y: p.y, r: 5.2, fill: "gem", outline: "none" })
    }
  ]
});
defineProp({
  id: "headphones",
  kind: "wearable",
  slot: "ears",
  occupies: ["skull.band", "ear.left", "ear.right"],
  passes: ["headRear", "headFront"],
  z: 30,
  overrides: { accentDeep: "pad" },
  checks: { visibility: "paired", minReadableSize: 48, contrastAgainst: "body" },
  parts: [
    { frame: headHoop({
      end: 0.38,
      lean: 0.3,
      drop: -0.05,
      radius: 1.03,
      width: 9,
      widthAcross: 13,
      segments: 48
    }) },
    /* The cups sit ON the head at ear height, and their WIDTH follows how much
       of the cup faces the viewer — the one thing that actually changes. Their
       height does not: a cup that shrinks in both axes reads as a button. */
    {
      frame: earPair({ u: -0.1, radius: 1, place: "size" }),
      material: { accentDeep: { from: "accent", darken: 0.2 } },
      art: (p) => {
        const rx = 8 + 15 * p.facing;
        return group([
          ellipse({ x: p.x, y: p.y, rx, ry: 25, fill: "accent" }),
          ellipse({ x: p.x, y: p.y, rx: rx * 0.58, ry: 15, fill: "accentDeep", outline: "none" })
        ]);
      }
    }
  ]
});
var RU = -0.4;
var capPeak = () => ({
  kind: "peak",
  resolve(S) {
    const rr = Math.sqrt(1 - RU * RU);
    const B2 = 0.82, Z0 = 0.32, A = Math.sqrt(rr * rr - Z0 * Z0), TILT = 0.4;
    const yAt = (Z) => RU + 0.04 + TILT * Math.max(0, Z - Z0);
    const peak = [
      ...span(40, 0, Math.PI, (t) => {
        const Z = Z0 + B2 * Math.sin(t);
        return headPoint(A * Math.cos(t), yAt(Z), Z, S, 1);
      }),
      ...span(12, 1, -1, (u) => headPoint(A * u, yAt(Z0), Z0, S, 1))
    ];
    const half = splitDepth(peak);
    return [
      ...half.far.map((pts) => ({ side: "far", kind: "poly", pts })),
      ...half.near.map((pts) => ({ side: "near", kind: "poly", pts }))
    ];
  }
});
defineProp({
  id: "cap",
  kind: "wearable",
  slot: "head.top",
  occupies: ["skull.top", "skull.band"],
  passes: ["headRear", "headFront"],
  z: 20,
  overrides: { accentDeep: "band", accentLight: "brim" },
  checks: { visibility: "circumferential", minReadableSize: 48, contrastAgainst: "body" },
  parts: [
    /* The dome is everything above the rim, clipped to what the body actually
       fills. Borrowed from the outline rather than drawn as an ellipse: the
       head is an egg, and a cap clipped to a circle overhangs it by a few
       pixels either side — small, and it reads instantly as a mistake. */
    { frame: headDome({ u: RU, radius: 1.006 }) },
    /* The band is the near half of the rim only. The far half is inside the
       head, and a line across the back of a solid object shows through
       nothing. */
    {
      frame: headBand({ u: RU, width: 11, radius: 1.006, segments: 64 }),
      clip: 1.006,
      fill: "accentDeep",
      gloss: false,
      material: { accentDeep: { from: "accent", darken: 0.18 } }
    },
    /* Button at the crown — a point on the head, so it rides with it. */
    {
      frame: headAnchor({
        at: [0, -1, 0],
        radius: 0.9,
        hideBehind: -0.5,
        sortDepth: false,
        place: "size"
      }),
      material: { accentDeep: { from: "accent", darken: 0.18 } },
      art: (p) => ellipse({ x: p.x, y: p.y, rx: 7.5, ry: 6.5, fill: "accentDeep", outline: "none" })
    },
    /* Behind the head, the far part of the peak is drawn before the skull so
       the skull cuts it — turned away, that is what you see of a cap. */
    {
      frame: capPeak(),
      fillFar: "accentLight",
      gloss: "near",
      material: { accentLight: { from: "accent", darken: 0.1 } }
    }
  ]
});

// src/props/catalogue/hats.js
var hat = (id, parts, o = {}) => defineProp({
  id,
  kind: "wearable",
  slot: "head.top",
  occupies: o.occupies || ["skull.top", "skull.band"],
  passes: ["headRear", "headFront"],
  z: o.z ?? 20,
  overrides: { accentDeep: "band", accentLight: "brim", ...o.overrides },
  defaults: o.defaults,
  checks: {
    visibility: "circumferential",
    minReadableSize: 48,
    contrastAgainst: "body",
    ...o.checks
  },
  parts
});
var turnUp = (u, width = 14, material = 0.18) => ({
  frame: headBand({ u, width, radius: 1.012, segments: 64 }),
  clip: 1.012,
  fill: "accentDeep",
  gloss: false,
  material: { accentDeep: { from: "accent", darken: material } }
});
hat("beanie", [
  { frame: headDome({ u: -0.44, radius: 1.012 }) },
  turnUp(-0.44, 15)
], { checks: { visibility: "skullbound" } });
hat("pompom-hat", [
  { frame: headDome({ u: -0.44, radius: 1.012 }) },
  turnUp(-0.44, 15),
  /* The bobble stands off the crown, so it is anchored ABOVE the head's
     surface — radius 1.16 rather than 1.0 — and pinned to the near pass: what
     is behind it is the hat, not the head. */
  {
    frame: headAnchor({
      at: [0, -1, 0],
      radius: 1.16,
      hideBehind: -0.85,
      sortDepth: false,
      place: "size"
    }),
    art: (p) => group([
      around(7, 9, () => circle({ r: 8, fill: "accentLight" }), { x: p.x, y: p.y }),
      circle({ x: p.x, y: p.y, r: 9, fill: "accentLight" })
    ])
  }
], { checks: { visibility: "skullbound" } });
hat("party-hat", [
  { frame: headCone({ u: -0.56, radius: 0.78, height: 1.15, segments: 30 }) },
  {
    frame: headAnchor({
      at: [0, -1.71, 0],
      radius: 1,
      hideBehind: -0.9,
      sortDepth: false,
      place: "size"
    }),
    art: (p) => circle({ x: p.x, y: p.y, r: 9, fill: "accentLight" })
  }
], { defaults: { accent: "#F26D8B" } });
hat("wizard-hat", [
  /* Leaning back is most of what separates a wizard's hat from a cone. */
  {
    frame: headDisc({ u: -0.44, radius: 1.42, droop: 0.11, segments: 56 }),
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.16 } }
  },
  { frame: headCone({ u: -0.5, radius: 0.82, height: 2.15, leanZ: -0.42, segments: 30 }) },
  {
    frame: headRing({ u: -0.56, thickness: 0.1, radius: 0.9, segments: 24 }),
    fill: "accentDeep",
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.24 } }
  }
], { defaults: { accent: "#6B5BB5" } });
hat("sun-hat", [
  {
    frame: headDisc({ u: -0.28, radius: 1.62, droop: 0.06 }),
    fill: "accentLight",
    material: { accentLight: { from: "accent", lighten: 0.14 } }
  },
  { frame: headDome({ u: -0.36, radius: 1.012 }) },
  turnUp(-0.36, 12, 0.2)
], { defaults: { accent: "#F0C08F" } });
hat("rain-hat", [
  {
    frame: headDisc({ u: -0.24, radius: 1.44, droop: 0.16 }),
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.12 } }
  },
  { frame: headDome({ u: -0.38, radius: 1.012 }) }
], { defaults: { accent: "#F2C744" } });
hat("explorer-hat", [
  {
    frame: headDisc({ u: -0.3, radius: 1.5, droop: 0.055 }),
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.1 } }
  },
  { frame: headDome({ u: -0.4, radius: 1.012 }) },
  turnUp(-0.4, 10, 0.26),
  {
    frame: headHoop({ end: 1.15, lean: 0, drop: 0, radius: 1.03, width: 4, widthAcross: 0 }),
    fill: "accentDeep",
    gloss: false,
    outline: "none",
    material: { accentDeep: { from: "accent", darken: 0.26 } }
  }
], { defaults: { accent: "#D8CBA6" } });
hat("pirate-hat", [
  { frame: headDisc({ u: -0.38, radius: 1.46, droop: -0.2, lobes: 3, lobeAmp: 0.2 }) },
  { frame: headDome({ u: -0.46, radius: 1.012 }) },
  {
    frame: headDisc({ u: -0.42, radius: 1.28, droop: -0.19, lobes: 3, lobeAmp: 0.2 }),
    fill: "accentLight",
    gloss: false,
    material: { accentLight: { from: "accent", lighten: 0.3 } }
  }
], { defaults: { accent: "#34323B" } });
hat("hard-hat", [
  {
    frame: headDisc({ u: -0.26, radius: 1.26, droop: 0.075 }),
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.12 } }
  },
  { frame: headDome({ u: -0.34, radius: 1.012 }) },
  /* The ridge over the crown is the one detail that makes it a hard hat
     rather than a bowl. It takes no contour — it is a moulding line, not an
     edge of the silhouette. */
  {
    frame: headHoop({ end: 1.25, lean: 0, drop: 0, radius: 1.035, width: 7, widthAcross: 0 }),
    fill: "accentLight",
    gloss: false,
    outline: "none",
    material: { accentLight: { from: "accent", lighten: 0.22 } }
  }
], { defaults: { accent: "#F2B33D" } });
hat("chef-hat", [
  /* A short flared band, then the puff. The first version made the band tall
     and the puff small, which read as a paper cup. A toque is almost all
     puff. */
  {
    frame: headCone({ u: -0.44, radius: 0.9, topRadius: 0.72, height: 0.46, segments: 30 }),
    fill: "white"
  },
  {
    frame: headAnchor({
      at: [0, -1.06, 0],
      radius: 1,
      hideBehind: -0.9,
      sortDepth: false,
      place: "size"
    }),
    art: (p) => group([
      around(6, 21, () => ellipse({ rx: 22, ry: 17, fill: "white" }), { x: p.x, y: p.y }),
      ellipse({ x: p.x, y: p.y, rx: 28, ry: 21, fill: "white" })
    ])
  }
]);
hat("graduation-cap", [
  { frame: headDome({ u: -0.56, radius: 1.012 }) },
  {
    frame: headPlate({ u: -0.7, halfW: 1.32, halfD: 1.32, tiltZ: 0.17 }),
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.14 } }
  },
  /* The tassel hangs from the near-left corner of the board and falls under
     gravity, not along the head's up axis — it is the one thing on a hat that
     does NOT rotate with the skull. */
  {
    frame: headAnchor({
      at: [-1.3, -0.6, 1.3],
      radius: 1,
      hideBehind: -0.5,
      place: "size"
    }),
    art: (p) => group([
      line({ pts: [[p.x, p.y], [p.x + 2, p.y + 26]], width: 3.5, stroke: "gem" }),
      ellipse({ x: p.x + 2, y: p.y + 33, rx: 6, ry: 9, fill: "gem", outline: "none" })
    ])
  }
], { defaults: { accent: "#34323B", gem: "#F2C744" } });
hat("tiara", [
  { frame: headRing({ u: -0.66, thickness: 0.075, radius: 1.02, segments: 24 }) },
  { frame: headSpikes({
    u: -0.66,
    thickness: 0.075,
    radius: 1.02,
    segments: 24,
    every: 8,
    height: 34,
    grow: 0.42
  }) },
  {
    frame: headAnchor({
      at: [0, -0.73, Math.sqrt(1 - 0.66 * 0.66)],
      radius: 1.02,
      hideBehind: 0.25,
      place: "size"
    }),
    art: (p) => circle({ x: p.x, y: p.y, r: 7, fill: "gem", outline: "none" })
  }
], {
  occupies: ["skull.band"],
  z: 26,
  defaults: { accent: "#F2E27A", gem: "#8FD3E8" }
});

// src/props/catalogue/ears.js
var earGear = (id, parts, o = {}) => defineProp({
  id,
  kind: "wearable",
  slot: "ears",
  occupies: o.occupies || ["skull.band", "ear.left", "ear.right"],
  passes: ["headRear", "headFront"],
  z: o.z ?? 30,
  overrides: { accentDeep: "pad", ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: "paired", minReadableSize: 48, contrastAgainst: "body" },
  parts
});
var overHead = (o = {}) => ({
  frame: headHoop({
    end: o.end ?? 0.38,
    lean: o.lean ?? 0.3,
    drop: o.drop ?? -0.05,
    radius: o.radius ?? 1.03,
    width: o.width ?? 9,
    widthAcross: o.widthAcross ?? 13,
    segments: 48
  }),
  fill: o.fill
});
earGear("earmuffs", [
  overHead({ width: 7, widthAcross: 9, lean: 0.34 }),
  {
    frame: earPair({ u: -0.1, radius: 1, place: "size" }),
    material: { accentLight: { from: "accent", lighten: 0.2 } },
    art: (p) => {
      const rx = 12 + 18 * p.facing;
      return group([
        /* The fluff has to be the OUTER shape. Drawn the other way round — a
           big smooth hub over a ring of small discs — the cluster is hidden
           and the muff reads as a plain cup that has lost its pad. */
        around(
          7,
          rx * 0.55,
          () => ellipse({ rx: rx * 0.52, ry: 14, fill: "accent" }),
          { x: p.x, y: p.y }
        ),
        ellipse({ x: p.x, y: p.y, rx: rx * 0.72, ry: 18, fill: "accentLight", outline: "none" })
      ]);
    }
  }
  /* Lavender rather than pink: half the skins in the set ARE pink, and an
     earmuff the colour of the head is an earmuff nobody can see. */
], { defaults: { accent: "#C5B9E8" } });
earGear("ear-defenders", [
  overHead({ width: 12, widthAcross: 16, lean: 0.26, radius: 1.05 }),
  {
    frame: earPair({ u: -0.08, radius: 1.02, place: "size" }),
    material: { accentDeep: { from: "accent", darken: 0.22 } },
    art: (p) => {
      const rx = 10 + 19 * p.facing;
      return group([
        ellipse({ x: p.x, y: p.y, rx, ry: 31, fill: "accent" }),
        ellipse({ x: p.x, y: p.y, rx: rx * 0.62, ry: 21, fill: "accentDeep", outline: "none" })
      ]);
    }
  }
], { defaults: { accent: "#F2C744" } });
earGear("headset-mic", [
  overHead({ width: 9, widthAcross: 13 }),
  {
    frame: earPair({ u: -0.1, radius: 1, place: "size" }),
    material: { accentDeep: { from: "accent", darken: 0.2 } },
    art: (p) => {
      const rx = 8 + 15 * p.facing;
      return group([
        ellipse({ x: p.x, y: p.y, rx, ry: 25, fill: "accent" }),
        ellipse({ x: p.x, y: p.y, rx: rx * 0.58, ry: 15, fill: "accentDeep", outline: "none" }),
        /* The boom hangs off ONE cup — the character's right — and swings in
           toward the mouth. Gating it on how much the cup faces the viewer was
           the first attempt, and it got the whole thing backwards: face-on,
           both cups are edge-on, so the boom appeared only once the head had
           turned away from it. Belonging to one cup means it goes behind the
           head exactly when that cup does, which is what the pass is for. */
        p.ear === 1 ? line({
          pts: [[p.x, p.y + 17], [p.x - 24, p.y + 33], [p.x - 42, p.y + 29]],
          width: 4,
          stroke: "accentDeep"
        }) : null,
        p.ear === 1 ? circle({ x: p.x - 46, y: p.y + 28, r: 6, fill: "accentDeep", outline: "none" }) : null
      ]);
    }
  }
], { defaults: { accent: "#4A73C4" } });
earGear("hearing-aids", [
  {
    frame: earPair({ u: -0.06, radius: 1.01, place: "size" }),
    material: { accentDeep: { from: "accent", darken: 0.24 } },
    art: (p) => {
      const rx = 6 + 9 * p.facing;
      return group([
        ellipse({ x: p.x, y: p.y - 8, rx, ry: 17, fill: "accent" }),
        ellipse({ x: p.x, y: p.y + 11, rx: rx * 0.78, ry: 9, fill: "accentDeep", outline: "none" })
      ]);
    }
  }
], { occupies: ["ear.left", "ear.right"], z: 34, defaults: { accent: "#B79BE8" } });

// src/props/catalogue/neck.js
var NECK = 0.72;
var neckwear = (id, parts, o = {}) => defineProp({
  id,
  kind: "wearable",
  slot: o.slot || "neck",
  occupies: o.occupies || ["neck.ring"],
  passes: o.passes || ["rearExternal", "faceFront"],
  z: o.z ?? 60,
  overrides: { accentDeep: "trim", ...o.overrides },
  defaults: o.defaults,
  checks: {
    visibility: "circumferential",
    minReadableSize: 48,
    contrastAgainst: "body",
    ...o.checks
  },
  parts
});
var collar = (o = {}) => ({
  frame: headRing({
    u: o.u ?? NECK,
    thickness: o.thickness ?? 0.1,
    radius: o.radius ?? 1.015,
    segments: 28
  }),
  fill: o.fill,
  gloss: o.gloss,
  material: o.material
});
var frontOf = (u, z = null, radius = 1.02) => headAnchor({
  at: [0, u, z === null ? Math.sqrt(Math.max(0, 1 - u * u)) : z],
  radius,
  hideBehind: -1.1,
  place: "size"
});
neckwear("bow-tie", [
  collar({
    thickness: 0.07,
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.2 } }
  }),
  {
    frame: frontOf(NECK - 0.02),
    material: { accentDeep: { from: "accent", darken: 0.16 } },
    art: (p) => group([
      /* Concave outer edges, pinched at the knot — two plain triangles read as
         a propeller and two plain ellipses read as earmuffs. */
      path({ x: p.x, y: p.y, fill: "accent", cmds: [
        ["M", 0, 0],
        ["C", -9, -13, -25, -12, -25, -2],
        ["C", -25, 8, -9, 10, 0, 0],
        ["Z"]
      ] }),
      path({ x: p.x, y: p.y, fill: "accent", cmds: [
        ["M", 0, 0],
        ["C", 9, -13, 25, -12, 25, -2],
        ["C", 25, 8, 9, 10, 0, 0],
        ["Z"]
      ] }),
      ellipse({ x: p.x, y: p.y, rx: 6, ry: 7.5, fill: "accentDeep", outline: "none" })
    ])
  }
], { defaults: { accent: "#E0574B" } });
neckwear("necktie", [
  collar({
    thickness: 0.07,
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.24 } }
  }),
  {
    frame: frontOf(NECK - 0.01),
    material: { accentDeep: { from: "accent", darken: 0.16 } },
    art: (p) => group([
      /* Knot first, then the blade, so the blade's top edge is hidden under
         it — a tie whose blade starts below the knot has a gap in it. */
      path({ x: p.x, y: p.y, fill: "accent", cmds: [
        ["M", 0, 3],
        ["L", -10, 14],
        ["L", 0, 38],
        ["L", 10, 14],
        ["Z"]
      ] }),
      path({ x: p.x, y: p.y, fill: "accentDeep", outline: "none", cmds: [
        ["M", -7, -5],
        ["L", 7, -5],
        ["L", 9, 6],
        ["L", -9, 6],
        ["Z"]
      ] })
    ])
  }
], { defaults: { accent: "#4A73C4" } });
neckwear("scarf", [
  collar({ u: NECK - 0.04, thickness: 0.19, radius: 1.03 }),
  {
    frame: frontOf(NECK + 0.04, null, 1.04),
    material: { accentDeep: { from: "accent", darken: 0.14 } },
    art: (p) => group([
      path({ x: p.x, y: p.y, fill: "accent", cmds: [
        ["M", -15, -6],
        ["L", -4, -6],
        ["L", -3, 28],
        ["L", -18, 28],
        ["Z"]
      ] }),
      path({ x: p.x, y: p.y, fill: "accentDeep", cmds: [
        ["M", 4, -6],
        ["L", 15, -6],
        ["L", 19, 21],
        ["L", 6, 21],
        ["Z"]
      ] })
    ])
  }
], { defaults: { accent: "#E0574B" } });
neckwear("bandana", [
  collar({
    thickness: 0.06,
    fill: "accentDeep",
    material: { accentDeep: { from: "accent", darken: 0.18 } }
  }),
  {
    frame: frontOf(NECK - 0.01),
    art: (p) => path({ x: p.x, y: p.y, fill: "accent", cmds: [
      ["M", -27, -2],
      ["L", 27, -2],
      ["Q", 23, 22, 0, 31],
      ["Q", -23, 22, -27, -2],
      ["Z"]
    ] })
  },
  {
    frame: frontOf(NECK - 0.06, null, 1.03),
    material: { accentDeep: { from: "accent", darken: 0.18 } },
    art: (p) => ellipse({
      x: p.x - 30,
      y: p.y + 2,
      rx: 8,
      ry: 6,
      rotate: -0.4,
      fill: "accentDeep",
      outline: "none"
    })
  }
], { defaults: { accent: "#F2B33D" } });
neckwear("medal", [
  {
    frame: frontOf(NECK - 0.1, null, 1.02),
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.22 } },
    art: (p) => group([
      line({ pts: [[p.x - 12, p.y], [p.x - 3, p.y + 20]], width: 5, stroke: "accentDeep" }),
      line({ pts: [[p.x + 12, p.y], [p.x + 3, p.y + 20]], width: 5, stroke: "accentDeep" })
    ])
  },
  {
    frame: frontOf(NECK + 0.13, null, 1.03),
    material: { accentLight: { from: "accent", lighten: 0.3 } },
    art: (p) => group([
      circle({ x: p.x, y: p.y, r: 14, fill: "accent" }),
      circle({ x: p.x, y: p.y, r: 8, fill: "accentLight", outline: "none" })
    ])
  }
], {
  occupies: ["neck.ring", "chest.front"],
  z: 54,
  defaults: { accent: "#F2C744" }
});
neckwear("name-badge", [
  {
    frame: frontOf(NECK + 0.1, null, 1.02),
    material: { accentDeep: { from: "accent", darken: 0.28 } },
    art: (p) => group([
      roundedRect({ x: p.x, y: p.y, w: 54, h: 36, r: 5, fill: "white" }),
      roundedRect({ x: p.x, y: p.y - 11, w: 54, h: 14, r: 5, fill: "accent", outline: "none" }),
      line({ pts: [[p.x - 18, p.y + 6], [p.x + 18, p.y + 6]], width: 3, stroke: "accentDeep" }),
      line({ pts: [[p.x - 18, p.y + 13], [p.x + 6, p.y + 13]], width: 3, stroke: "accentDeep" })
    ])
  }
], { occupies: ["chest.front"], z: 56, defaults: { accent: "#4A73C4" } });
neckwear("lanyard", [
  {
    frame: headBand({ u: NECK - 0.06, width: 6, radius: 1.02, segments: 48 }),
    fill: "accentDeep",
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.26 } }
  },
  {
    frame: frontOf(NECK + 0.12, null, 1.02),
    material: { accentDeep: { from: "accent", darken: 0.26 } },
    art: (p) => group([
      line({ pts: [[p.x, p.y - 26], [p.x, p.y - 14]], width: 5, stroke: "accentDeep" }),
      roundedRect({ x: p.x, y: p.y + 4, w: 38, h: 50, r: 5, fill: "white" }),
      roundedRect({ x: p.x, y: p.y - 12, w: 38, h: 14, r: 5, fill: "accent", outline: "none" }),
      line({ pts: [[p.x - 12, p.y + 12], [p.x + 12, p.y + 12]], width: 3, stroke: "accentDeep" }),
      line({ pts: [[p.x - 12, p.y + 20], [p.x + 4, p.y + 20]], width: 3, stroke: "accentDeep" })
    ])
  }
], { occupies: ["neck.ring", "chest.front"], z: 55, defaults: { accent: "#5FA85C" } });
neckwear("ruff-collar", [
  {
    frame: ringStuds({ u: NECK, radius: 1.05, count: 16 }),
    art: (p) => ellipse({ x: p.x, y: p.y, rx: 9 + 5 * p.facing, ry: 15, fill: "white" })
  },
  collar({
    thickness: 0.05,
    fill: "accentDeep",
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.1 } }
  })
], { z: 48, defaults: { accent: "#DCC4AE" } });
var STRIPES = ["#E0574B", "#F0913F", "#F2CE4E", "#5FA85C", "#4A73C4", "#B79BE8"];
defineProp({
  id: "rainbow-collar",
  kind: "wearable",
  slot: "neck",
  occupies: ["neck.ring"],
  passes: ["rearExternal", "faceFront"],
  z: 60,
  checks: { visibility: "circumferential", minReadableSize: 48, contrastAgainst: "body" },
  parts: STRIPES.map((hex, i) => ({
    frame: headRing({
      u: NECK,
      thickness: 0.11,
      radius: 1.02,
      segments: 24,
      arc: [i * 4, i * 4 + 4]
    }),
    defaults: { accent: hex }
  }))
});
neckwear("apron", [
  {
    frame: frontOf(NECK - 0.1, null, 1.02),
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.18 } },
    art: (p) => group([
      line({ pts: [[p.x - 22, p.y - 2], [p.x - 13, p.y + 18]], width: 5, stroke: "accentDeep" }),
      line({ pts: [[p.x + 22, p.y - 2], [p.x + 13, p.y + 18]], width: 5, stroke: "accentDeep" })
    ])
  },
  {
    frame: frontOf(NECK + 0.07, null, 1.02),
    material: { accentDeep: { from: "accent", darken: 0.18 } },
    art: (p) => group([
      path({ x: p.x, y: p.y, fill: "accent", cmds: [
        ["M", -16, -22],
        ["L", 16, -22],
        ["L", 20, -6],
        ["Q", 30, 4, 28, 26],
        ["L", -28, 26],
        ["Q", -30, 4, -20, -6],
        ["Z"]
      ] }),
      roundedRect({
        x: p.x,
        y: p.y + 12,
        w: 30,
        h: 16,
        r: 3,
        fill: "accentDeep",
        outline: "none"
      })
    ])
  }
], { occupies: ["chest.front"], z: 46, defaults: { accent: "#5FA85C" } });

// src/props/catalogue/face.js
var eyewear = (id, o = {}) => defineProp({
  id,
  kind: "wearable",
  slot: "face",
  occupies: ["face.eyes"],
  passes: ["faceFront"],
  z: o.z ?? 10,
  overrides: { ink: "color", ...o.overrides },
  defaults: o.defaults,
  checks: { visibility: "face", minReadableSize: 48, contrastAgainst: "face" },
  parts: [{
    frame: facePlane({ follow: "eyes" }),
    art(s, p, ctx, S) {
      const g = S.g || G;
      const col = ctx.col(o.role || "ink");
      const rest = g.eyeRX ?? g.eyeR * 0.58;
      const r = Math.max(g.eyeR * 1.35, rest * 1.5) * (o.scale ?? 1);
      const [eyeL, eyeR] = p.eyes;
      s.save();
      s.alpha(p.vis * 0.95);
      if (o.bridge !== false) {
        s.begin();
        s.move(eyeL.x + r * eyeL.fx * (o.bridgeGap ?? 0.9), eyeL.y + (o.bridgeY ?? 0));
        s.line(eyeR.x - r * eyeR.fx * (o.bridgeGap ?? 0.9), eyeR.y + (o.bridgeY ?? 0));
        s.stroke(col, o.bridgeW ?? 4);
      }
      const eyes = o.single ? [eyeR] : [eyeL, eyeR];
      for (const e of eyes) {
        if (e.a <= 0.02) continue;
        s.save();
        s.alpha(e.a);
        if (o.lens) o.lens(s, e, r, ctx, col);
        else {
          s.begin();
          s.ellipse(e.x, e.y, r * Math.max(0.06, e.fx), r * e.fy);
          s.stroke(col, 4.4);
        }
        s.restore();
      }
      if (o.extra) o.extra(s, p, r, ctx, col);
      s.restore();
    }
  }]
});
eyewear("glasses");
eyewear("round-glasses", {
  scale: 1.06,
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx);
    s.begin();
    s.ellipse(e.x, e.y, rx, r * 0.98 * e.fy);
    s.stroke(col, 3.6);
  }
});
eyewear("square-glasses", {
  scale: 1.02,
  lens(s, e, r, ctx, col) {
    const w = r * Math.max(0.06, e.fx) * 2, h = r * e.fy * 1.7, rad2 = Math.min(5, w / 2, h / 2);
    s.begin();
    s.move(e.x - w / 2 + rad2, e.y - h / 2);
    s.line(e.x + w / 2 - rad2, e.y - h / 2);
    s.quad(e.x + w / 2, e.y - h / 2, e.x + w / 2, e.y - h / 2 + rad2);
    s.line(e.x + w / 2, e.y + h / 2 - rad2);
    s.quad(e.x + w / 2, e.y + h / 2, e.x + w / 2 - rad2, e.y + h / 2);
    s.line(e.x - w / 2 + rad2, e.y + h / 2);
    s.quad(e.x - w / 2, e.y + h / 2, e.x - w / 2, e.y + h / 2 - rad2);
    s.line(e.x - w / 2, e.y - h / 2 + rad2);
    s.quad(e.x - w / 2, e.y - h / 2, e.x - w / 2 + rad2, e.y - h / 2);
    s.close();
    s.stroke(col, 4.2);
  }
});
eyewear("heart-glasses", {
  scale: 1.14,
  defaults: { ink: "#F26D8B" },
  lens(s, e, r, ctx, col) {
    const w = r * Math.max(0.06, e.fx) * 2, h = r * e.fy * 1.75;
    s.begin();
    s.move(e.x, e.y + h * 0.48);
    s.cubic(e.x - w * 0.62, e.y + h * 0.02, e.x - w * 0.5, e.y - h * 0.58, e.x, e.y - h * 0.18);
    s.cubic(e.x + w * 0.5, e.y - h * 0.58, e.x + w * 0.62, e.y + h * 0.02, e.x, e.y + h * 0.48);
    s.close();
    s.stroke(col, 4);
  }
});
eyewear("star-glasses", {
  scale: 1.2,
  defaults: { ink: "#F2B33D" },
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx), ry = r * e.fy;
    s.begin();
    for (let i = 0; i < 10; i++) {
      const k = i % 2 ? 0.46 : 1;
      const a = i / 10 * Math.PI * 2 - Math.PI / 2;
      const px = e.x + Math.cos(a) * rx * k, py = e.y + Math.sin(a) * ry * k;
      i ? s.line(px, py) : s.move(px, py);
    }
    s.close();
    s.stroke(col, 3.4);
  }
});
eyewear("sun-glasses", {
  scale: 1.1,
  defaults: { ink: "#3A3742" },
  bridgeW: 5,
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx), ry = r * e.fy * 0.98;
    s.save();
    s.alpha(0.42);
    s.begin();
    s.ellipse(e.x, e.y, rx, ry);
    s.fill(col);
    s.restore();
    s.begin();
    s.ellipse(e.x, e.y, rx, ry);
    s.stroke(col, 4.4);
  }
});
eyewear("safety-goggles", {
  scale: 1.16,
  defaults: { ink: "#5FA85C" },
  bridge: false,
  lens(s, e, r, ctx, col) {
    const rx = r * Math.max(0.06, e.fx) * 1.12, ry = r * e.fy * 1.05;
    s.save();
    s.alpha(0.28);
    s.begin();
    s.ellipse(e.x, e.y, rx, ry);
    s.fill("#FFFFFF");
    s.restore();
    s.begin();
    s.ellipse(e.x, e.y, rx, ry);
    s.stroke(col, 5.2);
  },
  extra(s, p, r, ctx, col) {
    const [eyeL, eyeR] = p.eyes;
    s.begin();
    s.move(eyeL.x + r * eyeL.fx * 1.05, eyeL.y);
    s.line(eyeR.x - r * eyeR.fx * 1.05, eyeR.y);
    s.stroke(col, 5.2);
    for (const [e, side] of [[eyeL, -1], [eyeR, 1]]) {
      if (e.a <= 0.02) continue;
      s.begin();
      s.move(e.x + side * r * e.fx * 1.2, e.y);
      s.line(e.x + side * (r * e.fx * 1.2 + 14), e.y - 3);
      s.stroke(col, 4.5);
    }
  }
});
eyewear("monocle", {
  scale: 1.12,
  single: true,
  bridge: false,
  defaults: { ink: "#C8A24A" },
  lens(s, e, r, ctx, col) {
    s.begin();
    s.ellipse(e.x, e.y, r * Math.max(0.06, e.fx), r * e.fy);
    s.stroke(col, 4.8);
  },
  extra(s, p, r, ctx, col) {
    const e = p.eyes[1];
    if (e.a <= 0.02) return;
    const x = e.x + r * e.fx * 0.6, y = e.y + r * e.fy;
    s.begin();
    s.move(x, y);
    s.cubic(x + 6, y + 14, x + 2, y + 24, x - 4, y + 32);
    s.stroke(col, 2.6);
  }
});

// src/props/catalogue/held.js
var held = (id, art, o = {}) => {
  const hand = o.hand || "r";
  const frame = o.frame || handGrip({ side: hand, lift: o.lift ?? 0, out: o.out ?? 0 });
  const common = { frame, art, material: o.material, gloss: o.gloss, defaults: o.defaults };
  return defineProp({
    id,
    kind: "held",
    slot: o.slot || "hand",
    occupies: o.occupies || [hand === "l" ? "hand.left" : "hand.right"],
    passes: ["rearExternal", "heldRear", "heldFront"],
    z: o.z ?? 70,
    grip: o.grip || { lift: 0.55, out: 0.35 },
    defaults: o.defaults,
    overrides: o.overrides,
    checks: {
      visibility: "localized",
      minReadableSize: 48,
      contrastAgainst: "body",
      ...o.checks
    },
    parts: [
      { ...common, pass: "rearExternal", side: "far" },
      { ...common, pass: "heldRear", side: "near" },
      ...o.front ? [{ ...common, art: o.front, pass: "heldFront", side: "near" }] : []
    ]
  });
};
var twoHanded = (id, art, o = {}) => held(
  id,
  (p) => group([art(p)], { y: o.drop ?? 10 }),
  {
    ...o,
    frame: bothHands(),
    grip: o.grip || { lift: -0.42, out: 0.62 },
    occupies: ["hand.left", "hand.right"]
  }
);
held(
  "pencil",
  (p) => group([
    roundedRect({ x: 0, y: -5.7, w: 18.5, h: 76.7, r: 2.8, fill: "accent" }),
    path({ fill: "accentLight", cmds: [["M", -9.2, 32.7], ["L", 9.2, 32.7], ["L", 0, 56.8], ["Z"]] }),
    path({ fill: "ink", outline: "none", cmds: [["M", -3.4, 47.7], ["L", 3.4, 47.7], ["L", 0, 56.8], ["Z"]] }),
    roundedRect({ x: 0, y: -39.8, w: 18.5, h: 11.4, r: 2.1, fill: "neutral", outline: "none" }),
    roundedRect({ x: 0, y: -51.1, w: 17, h: 14.2, r: 4.3, fill: "gem" })
  ], { rotate: -0.5 * p.hand }),
  { defaults: { accent: "#F2B33D", accentLight: "#F3DCA8", gem: "#E888A0" } }
);
held(
  "crayon",
  (p) => group([
    roundedRect({ x: 0, y: 0, w: 25.6, h: 65.3, r: 4.3, fill: "accent" }),
    path({ fill: "accent", cmds: [["M", -12.8, 28.4], ["L", 12.8, 28.4], ["L", 0, 48.3], ["Z"]] }),
    roundedRect({ x: 0, y: 2.8, w: 27, h: 28.4, r: 2.8, fill: "accentLight", outline: "none" })
  ], { rotate: -0.45 * p.hand }),
  { defaults: { accent: "#E0574B" } }
);
held(
  "marker",
  (p) => group([
    roundedRect({ x: 0, y: -2.8, w: 27, h: 56.8, r: 5.7, fill: "accent" }),
    roundedRect({ x: 0, y: -34.1, w: 29.8, h: 25.6, r: 7.1, fill: "accentDeep" }),
    path({ fill: "ink", cmds: [["M", -8.5, 25.6], ["L", 8.5, 25.6], ["L", 5.7, 42.6], ["L", -5.7, 42.6], ["Z"]] })
  ], { rotate: -0.42 * p.hand }),
  { defaults: { accent: "#4A73C4" }, material: { accentDeep: { from: "accent", darken: 0.24 } } }
);
held(
  "paintbrush",
  (p) => group([
    roundedRect({ x: 0, y: -11.4, w: 12.8, h: 65.3, r: 4.3, fill: "accent" }),
    roundedRect({ x: 0, y: 25.6, w: 17, h: 17, r: 2.8, fill: "neutral" }),
    path({ fill: "ink", cmds: [["M", -8.5, 34.1], ["L", 8.5, 34.1], ["L", 4.3, 59.6], ["L", -4.3, 59.6], ["Z"]] })
  ], { rotate: -0.5 * p.hand }),
  { defaults: { accent: "#C8A24A", ink: "#4A73C4" } }
);
held(
  "chalk",
  (p) => group([
    roundedRect({ x: 0, y: 0, w: 25, h: 70, r: 3, fill: "accent" }),
    roundedRect({ x: 0, y: 27, w: 25, h: 16, r: 3, fill: "accentLight", outline: "none" })
  ], { rotate: -0.4 * p.hand }),
  {
    defaults: { accent: "#E6DDCB" },
    material: { accentLight: { from: "accent", darken: 0.12 } }
  }
);
held(
  "ruler",
  (p) => group([
    roundedRect({ x: 0, y: 0, w: 99.4, h: 21.3, r: 4.3, fill: "accent" }),
    ...[-28, -20, -12, -4, 4, 12, 20, 28].map((x, i) => line({ pts: [[x, 10.6], [x, i % 2.8 ? 0 : -4.3]], width: 2.8, stroke: "accentDeep" }))
  ], { rotate: -0.2 * p.hand }),
  { defaults: { accent: "#F2CE4E" }, material: { accentDeep: { from: "accent", darken: 0.34 } } }
);
held(
  "pointer",
  (p) => group([
    roundedRect({ x: 0, y: 0, w: 8.5, h: 105.1, r: 4.3, fill: "accent" }),
    circle({ x: 0, y: -54, r: 9.9, fill: "accentDeep" })
  ], { rotate: -0.62 * p.hand }),
  { defaults: { accent: "#34323B" }, material: { accentDeep: { from: "accent", lighten: 0.55 } } }
);
held(
  "magnifier",
  (p) => group([
    roundedRect({ x: 0, y: 36.9, w: 12.8, h: 48.3, r: 5.7, fill: "accentDeep" }),
    /* Glass first, then the rim as a STROKE. Filling the rim over the glass —
       which is what this did — makes the lens an opaque disc, and a magnifier
       you cannot see through is a lollipop. */
    circle({ x: 0, y: -8.5, r: 29.8, fill: "lens" }),
    ring({ x: 0, y: -8.5, rx: 29.8, width: 6.5, stroke: "accent" })
  ], { rotate: -0.3 * p.hand }),
  {
    defaults: { accent: "#4A73C4" },
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.3 } }
  }
);
held(
  "clipboard",
  (p) => group([
    roundedRect({ x: 0, y: 0, w: 65.3, h: 85.2, r: 5.7, fill: "accent" }),
    roundedRect({ x: 0, y: 4.3, w: 54, h: 65.3, r: 2.8, fill: "white" }),
    roundedRect({ x: 0, y: -36.9, w: 28.4, h: 14.2, r: 4.3, fill: "neutralDeep" }),
    ...[-8, 0, 8, 16].map((y) => line({ pts: [[-19.9, y], [y === 22.7 ? 5.7 : 19.9, y]], width: 3.4, stroke: "neutral" }))
  ], { rotate: -0.12 * p.hand }),
  { defaults: { accent: "#C8A24A" } }
);
held(
  "closed-book",
  (p) => group([
    roundedRect({ x: 0, y: 0, w: 62.5, h: 79.5, r: 4.3, fill: "accent" }),
    roundedRect({ x: 25.6, y: 0, w: 11.4, h: 71, r: 2.8, fill: "white" }),
    roundedRect({ x: -24.1, y: 0, w: 9.9, h: 79.5, r: 4.3, fill: "accentDeep", outline: "none" }),
    line({ pts: [[-5.7, -22.7], [17, -22.7]], width: 4.3, stroke: "accentLight" }),
    line({ pts: [[-5.7, -11.4], [8.5, -11.4]], width: 4.3, stroke: "accentLight" })
  ], { rotate: -0.1 * p.hand }),
  {
    defaults: { accent: "#5FA85C" },
    material: {
      accentDeep: { from: "accent", darken: 0.26 },
      accentLight: { from: "accent", lighten: 0.45 }
    }
  }
);
twoHanded("open-book", (p) => {
  const w = Math.max(58, Math.min(120, p.span)) / 2;
  return group([
    path({ fill: "white", cmds: [
      ["M", 0, -5.7],
      ["L", -w, -22.7],
      ["L", -w, 28.4],
      ["L", 0, 36.9],
      ["Z"]
    ] }),
    path({ fill: "white", cmds: [
      ["M", 0, -5.7],
      ["L", w, -22.7],
      ["L", w, 28.4],
      ["L", 0, 36.9],
      ["Z"]
    ] }),
    line({ pts: [[0, -5.7], [0, 36.9]], width: 4.3, stroke: "accent" }),
    ...[2, 9, 16].map((dy) => line({
      pts: [[-w * 1.1, -8.5 + dy], [-w * 0.3, -1.4 + dy]],
      width: 2.8,
      stroke: "neutral"
    })),
    ...[2, 9, 16].map((dy) => line({
      pts: [[w * 0.3, -1.4 + dy], [w * 1.1, -8.5 + dy]],
      width: 2.8,
      stroke: "neutral"
    }))
  ]);
}, { defaults: { accent: "#E0574B" } });
held(
  "flashcards",
  (p) => group([
    roundedRect({ x: -9.9, y: 5.7, w: 54, h: 68.2, r: 5.7, fill: "white", rotate: 0 }),
    roundedRect({ x: 0, y: 0, w: 54, h: 68.2, r: 5.7, fill: "white" }),
    roundedRect({ x: 9.9, y: -5.7, w: 54, h: 68.2, r: 5.7, fill: "white" }),
    roundedRect({ x: 9.9, y: -22.7, w: 54, h: 17, r: 5.7, fill: "accent", outline: "none" })
  ], { rotate: -0.14 * p.hand }),
  { defaults: { accent: "#B79BE8" } }
);
var letterCard = (id, fallback) => held(
  id,
  (p, S, T2, o) => group([
    roundedRect({ x: 0, y: 0, w: 65.3, h: 82.4, r: 7.1, fill: "white" }),
    roundedRect({ x: 0, y: -32.7, w: 65.3, h: 17, r: 7.1, fill: "accent", outline: "none" }),
    custom({ draw(s, ctx) {
      s.save();
      s.translate(0, 6);
      drawGlyph(s, String(o.letter ?? fallback)[0], 57, ctx.col("ink"), 0.16, true, "ink");
      s.restore();
    } })
  ], { rotate: -0.1 * p.hand, x: -26 * p.hand, y: -20 }),
  { defaults: { accent: "#4A73C4" } }
);
letterCard("alphabet-card", "A");
letterCard("number-card", "3");
held(
  "letter-tile",
  (p, S, T2, o) => group([
    roundedRect({ x: 0, y: 0, w: 65.3, h: 65.3, r: 8.5, fill: "accent" }),
    roundedRect({ x: -2.1, y: -2.1, w: 55.4, h: 55.4, r: 5.7, fill: "accentLight", outline: "none" }),
    custom({ draw(s, ctx) {
      s.save();
      s.translate(-1, -1);
      drawGlyph(s, String(o.letter ?? "B")[0], 43, ctx.col("ink"), 0.17, true, "ink");
      s.restore();
    } })
  ], { rotate: -0.08 * p.hand, x: -22 * p.hand, y: -18 }),
  {
    defaults: { accent: "#DCC4AE" },
    material: { accentLight: { from: "accent", lighten: 0.4 } }
  }
);
held(
  "puzzle-piece",
  (p) => group([
    path({ fill: "accent", cmds: [
      ["M", -31.2, -31.2],
      ["L", -5.7, -31.2],
      ["C", -5.7, -45.4, 14.2, -45.4, 14.2, -31.2],
      ["L", 31.2, -31.2],
      ["L", 31.2, -5.7],
      ["C", 45.4, -5.7, 45.4, 14.2, 31.2, 14.2],
      ["L", 31.2, 31.2],
      ["L", -31.2, 31.2],
      ["L", -31.2, 14.2],
      ["C", -17, 14.2, -17, -5.7, -31.2, -5.7],
      ["Z"]
    ] })
  ], { rotate: -0.1 * p.hand }),
  { defaults: { accent: "#F0913F" } }
);
held(
  "building-block",
  (p) => group([
    roundedRect({ x: 0, y: 5.7, w: 68.2, h: 48.3, r: 5.7, fill: "accent" }),
    roundedRect({ x: -17, y: -22.7, w: 21.3, h: 17, r: 5.7, fill: "accent" }),
    roundedRect({ x: 17, y: -22.7, w: 21.3, h: 17, r: 5.7, fill: "accent" }),
    line({ pts: [[-27, 17], [27, 17]], width: 3.5, stroke: "accentDeep" })
  ], { rotate: -0.06 * p.hand }),
  {
    defaults: { accent: "#E0574B" },
    material: { accentDeep: { from: "accent", darken: 0.22 } }
  }
);
twoHanded("abacus", (p) => {
  const w = Math.max(64, Math.min(118, p.span)) / 2;
  return group([
    roundedRect({ x: 0, y: 0, w: w * 2 + 10, h: 71, r: 7.1, fill: "accent" }),
    roundedRect({ x: 0, y: 0, w: w * 2 - 4, h: 54, r: 2.8, fill: "white", outline: "none" }),
    ...[-13, 0, 13].map((y, row) => group(
      [0, 1, 2, 3].map((i) => circle({
        x: -w + 10 + i * ((w * 2 - 20) / 3.4) + (row === 1 ? 6 : 0),
        y,
        r: 9.2,
        fill: row === 1 ? "gem" : "accentDeep",
        outline: "none"
      }))
    ))
  ]);
}, {
  defaults: { accent: "#C8A24A", gem: "#4A73C4" },
  material: { accentDeep: { from: "accent", darken: 0.34 } }
});
twoHanded(
  "globe",
  (p) => group([
    path({ fill: "neutralDeep", cmds: [
      ["M", -22.7, 42.6],
      ["L", 22.7, 42.6],
      ["L", 14.2, 31.2],
      ["L", -14.2, 31.2],
      ["Z"]
    ] }),
    circle({ x: 0, y: -2.8, r: 38.3, fill: "accent" }),
    path({ fill: "accentDeep", outline: "none", cmds: [
      ["M", -25.6, -14.2],
      ["C", -14.2, -28.4, 0, -19.9, 2.8, -5.7],
      ["C", -5.7, 0, -19.9, 0, -25.6, -14.2],
      ["Z"]
    ] }),
    path({ fill: "accentDeep", outline: "none", cmds: [
      ["M", 8.5, 8.5],
      ["C", 19.9, 2.8, 31.2, 11.4, 25.6, 22.7],
      ["C", 17, 28.4, 8.5, 19.9, 8.5, 8.5],
      ["Z"]
    ] })
  ], { rotate: 0 }),
  {
    defaults: { accent: "#4A73C4" },
    material: { accentDeep: { from: "accent", lighten: 0.45 } }
  }
);
held(
  "trophy",
  (p) => group([
    roundedRect({ x: 0, y: 42.6, w: 48.3, h: 14.2, r: 4.3, fill: "accentDeep" }),
    roundedRect({ x: 0, y: 28.4, w: 17, h: 19.9, r: 4.3, fill: "accent" }),
    ...[-1, 1].map((side) => path({ fill: "accent", cmds: [
      ["M", side * 21.3, -28.4],
      ["C", side * 45.4, -28.4, side * 45.4, 2.8, side * 19.9, 5.7],
      ["L", side * 19.9, -2.8],
      ["C", side * 35.5, -4.3, side * 35.5, -21.3, side * 21.3, -21.3],
      ["Z"]
    ] })),
    path({ fill: "accent", cmds: [
      ["M", -24.1, -34.1],
      ["L", 24.1, -34.1],
      ["C", 24.1, 5.7, 14.2, 19.9, 0, 19.9],
      ["C", -14.2, 19.9, -24.1, 5.7, -24.1, -34.1],
      ["Z"]
    ] }),
    circle({ x: 0, y: -17, r: 8.5, fill: "accentLight", outline: "none" })
  ], { rotate: -0.06 * p.hand }),
  {
    defaults: { accent: "#F2C744" },
    material: {
      accentDeep: { from: "accent", darken: 0.26 },
      accentLight: { from: "accent", lighten: 0.45 }
    }
  }
);

// src/props/catalogue/back.js
var backwear = (id, parts, o = {}) => defineProp({
  id,
  kind: "wearable",
  slot: "back",
  occupies: o.occupies || ["back"],
  passes: ["rearExternal", "faceFront"],
  z: o.z ?? 8,
  overrides: { accentDeep: "trim", ...o.overrides },
  defaults: o.defaults,
  checks: {
    visibility: "circumferential",
    minReadableSize: 48,
    contrastAgainst: "body",
    ...o.checks
  },
  parts
});
var behind = (u, radius = 1) => headAnchor({
  at: [0, u, -Math.sqrt(Math.max(0, 1 - u * u))],
  radius,
  hideBehind: -1.1,
  place: "size"
});
var infront = (u, radius = 1.02) => headAnchor({
  at: [0, u, Math.sqrt(Math.max(0, 1 - u * u))],
  radius,
  hideBehind: -1.1,
  place: "size"
});
var WIDER = 214;
backwear("backpack", [
  {
    frame: behind(0.3, 1),
    material: {
      accentDeep: { from: "accent", darken: 0.2 },
      accentLight: { from: "accent", lighten: 0.16 }
    },
    art: (p) => group([
      roundedRect({ x: p.x, y: p.y - 4, w: WIDER, h: 132, r: 30, fill: "accent" }),
      /* The front pocket and the flap are what separate a backpack from a
         rounded rectangle, and they are the only parts of it that show when
         the character has its back to you. */
      roundedRect({ x: p.x, y: p.y - 46, w: WIDER, h: 50, r: 26, fill: "accentDeep" }),
      roundedRect({ x: p.x, y: p.y + 30, w: 96, h: 48, r: 12, fill: "accentLight" }),
      roundedRect({ x: p.x, y: p.y - 24, w: 30, h: 11, r: 4, fill: "accentLight", outline: "none" })
    ])
  },
  /* Two straps over the front. Curved, and stopping short of the middle: a
     pair of straight bars across an egg reads as a harness. */
  {
    frame: infront(0.82),
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.2 } },
    art: (p) => group([-1, 1].map((side) => line({
      pts: [[p.x + side * 52, p.y - 16], [p.x + side * 46, p.y + 6], [p.x + side * 40, p.y + 18]],
      width: 11,
      stroke: "accentDeep"
    })))
  }
], { defaults: { accent: "#E0574B" } });
backwear("library-bag", [
  {
    frame: behind(0.36, 1),
    material: { accentDeep: { from: "accent", darken: 0.22 } },
    art: (p) => group([
      path({ x: p.x, y: p.y, fill: "accent", cmds: [
        ["M", -104, -34],
        ["L", 104, -34],
        ["Q", 114, 34, 76, 62],
        ["L", -76, 62],
        ["Q", -114, 34, -104, -34],
        ["Z"]
      ] }),
      roundedRect({ x: p.x, y: p.y - 30, w: 208, h: 18, r: 7, fill: "accentDeep", outline: "none" }),
      /* A book corner poking out of the top — a library bag with nothing in it
         is a shopping bag. */
      roundedRect({ x: p.x + 44, y: p.y - 52, w: 38, h: 34, r: 3, fill: "white" })
    ])
  },
  {
    frame: infront(0.82),
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.22 } },
    art: (p) => line({
      pts: [[p.x + 54, p.y - 16], [p.x + 47, p.y + 6], [p.x + 38, p.y + 20]],
      width: 12,
      stroke: "accentDeep"
    })
  }
], { defaults: { accent: "#5FA85C" } });
backwear("cape", [
  {
    frame: behind(0.2, 1),
    material: { accentDeep: { from: "accent", darken: 0.18 } },
    art: (p) => path({ x: p.x, y: p.y, fill: "accent", cmds: [
      ["M", -54, -46],
      ["L", 54, -46],
      ["C", 76, 10, 88, 52, 92, 92],
      ["Q", 62, 76, 44, 96],
      ["Q", 16, 78, 0, 98],
      ["Q", -16, 78, -44, 96],
      ["Q", -62, 76, -92, 92],
      ["C", -88, 52, -76, 10, -54, -46],
      ["Z"]
    ] })
  },
  /* The clasp: a cord across the throat with a disc on it. On a character
     with no shoulders this is the only thing that says the cape is fastened
     rather than balanced there. */
  {
    frame: infront(0.74),
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.18 } },
    art: (p) => group([
      line({ pts: [[p.x - 34, p.y - 4], [p.x + 34, p.y - 4]], width: 7, stroke: "accentDeep" }),
      circle({ x: p.x, y: p.y - 4, r: 10, fill: "gem" })
    ])
  }
], { defaults: { accent: "#4A73C4", gem: "#F2C744" }, z: 6 });
backwear("rolled-poster", [
  {
    frame: behind(0.24, 1),
    material: { accentDeep: { from: "accent", darken: 0.24 } },
    art: (p) => group([
      roundedRect({ x: p.x, y: p.y, w: 36, h: 250, r: 17, fill: "accent" }),
      ellipse({ x: p.x, y: p.y - 118, rx: 19, ry: 10, fill: "accentDeep", outline: "none" })
    ], { x: 0, y: -18, rotate: 0.52 })
  },
  {
    frame: infront(0.82),
    gloss: false,
    material: { accentDeep: { from: "accent", darken: 0.24 } },
    art: (p) => line({
      pts: [[p.x - 52, p.y - 16], [p.x - 46, p.y + 6], [p.x - 38, p.y + 20]],
      width: 8,
      stroke: "accentDeep"
    })
  }
], { defaults: { accent: "#F0C08F" } });

// src/core/accessories.js
var PASSES2 = PASSES;
var WHERE_OF = {
  rearExternal: "back",
  headRear: "back",
  heldRear: "back",
  bodyFront: "front",
  headFront: "front",
  faceFront: "front",
  heldFront: "front"
};
var LEGACY = {
  back: ["rearExternal", "headRear", "heldRear"],
  front: ["bodyFront", "headFront", "faceFront", "heldFront"]
};
var ACCESSORIES = Object.fromEntries(
  [...PROPS].map(([id, p]) => [id, { draw: p.draw }])
);
var ACCESSORY_META = Object.fromEntries(
  [...PROPS].map(([id, p]) => [id, {
    kind: p.kind,
    slot: p.slot,
    occupies: p.occupies,
    passes: p.passes,
    z: p.z,
    grip: p.grip
  }])
);
var ACCESSORY_NAMES = Object.keys(ACCESSORIES);
function conflictsWith(name) {
  const mine = ACCESSORY_META[name];
  if (!mine) return [];
  return ACCESSORY_NAMES.filter((other) => other !== name && ACCESSORY_META[other]?.occupies.some((t) => mine.occupies.includes(t)));
}
function contourPass(s, colour, w) {
  return new Proxy(s, {
    get(t, k) {
      if (k === "contour") return true;
      if (k === "fill") return () => t.stroke(colour, w, "round", "round");
      const v = t[k];
      return typeof v === "function" ? v.bind(t) : v;
    }
  });
}
function drawAccessories(s, S, T2, pass) {
  const list = S.accessories;
  if (!list || !list.length) return;
  const w = T2.outline ? (T2.outlineWornW ?? T2.outlineW * 0.62) * 2 : 0;
  const wanted = LEGACY[pass] ?? [pass];
  const items = list.map((item) => {
    const name = typeof item === "string" ? item : item.name;
    return {
      name,
      a: ACCESSORIES[name],
      m: ACCESSORY_META[name],
      o: typeof item === "string" ? {} : item
    };
  }).filter((x) => x.a && (!x.m || x.m.passes.some((p) => wanted.includes(p)))).sort((p, q) => (p.m?.z ?? 0) - (q.m?.z ?? 0) || ACCESSORY_NAMES.indexOf(p.name) - ACCESSORY_NAMES.indexOf(q.name));
  const where = WHERE_OF[pass] ?? pass;
  for (const { a, o } of items) {
    if (w > 0) {
      s.save();
      a.draw(contourPass(s, T2.outline, w), S, T2, o, where, pass);
      s.restore();
    }
    s.save();
    a.draw(s, S, T2, o, where, pass);
    s.restore();
  }
}

// src/core/egg.js
var SHELL = 1.35;
var EGG_STATES = ["closed", "wobbling", "cracked", "opening"];
function eggState(e) {
  if (!e || !e.on) return null;
  if (e.open > 1e-3) return "opening";
  if (e.crack >= 0.999) return "cracked";
  if (e.wobble > 0.01 || e.crack > 0) return "wobbling";
  return "closed";
}
function crackPath(seed = 1, g = G, opts = {}) {
  const rnd = makeRandom((seed | 0) * 2654435761 % 2147483647 || 1);
  const rx = g.R * SHELL, ry = g.RY * SHELL;
  const steps = opts.steps ?? 13;
  const yMid = -ry * (0.1 + rnd() * 0.12);
  const tilt = (rnd() - 0.5) * ry * 0.1;
  const edge = (y) => halfWidthAt(y / SHELL, g) * SHELL;
  const y0 = yMid - tilt, y1 = yMid + tilt;
  const pts = [[-edge(y0), y0]];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = lerp(-edge(y0), edge(y1), t);
    const zig = (rnd() - 0.5) * ry * 0.16 * Math.sin(t * Math.PI);
    pts.push([x, lerp(y0, y1, t) + zig]);
  }
  pts.push([edge(y1), y1]);
  const branches = [];
  const n2 = opts.branches ?? 2;
  for (let b = 0; b < n2; b++) {
    const at = 3 + Math.floor(rnd() * (steps - 6));
    const [bx, by] = pts[at];
    const dir = rnd() < 0.5 ? -1 : 1;
    const len = ry * (0.1 + rnd() * 0.1);
    branches.push([
      [bx, by],
      [bx + (rnd() - 0.5) * rx * 0.06, by + dir * len * 0.55],
      [bx + (rnd() - 0.5) * rx * 0.1, by + dir * len]
    ]);
  }
  return { pts, branches, y0, y1, rx, ry };
}
function arcLengths(pts) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return acc;
}
function revealByLength(pts, k) {
  if (k >= 1) return pts.slice();
  if (k <= 0) return [];
  const acc = arcLengths(pts);
  const want = acc[acc.length - 1] * k;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (acc[i] <= want) {
      out.push(pts[i]);
      continue;
    }
    const t = (want - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    out.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]);
    break;
  }
  return out;
}
function shellHalves(crack, g = G, N = 48) {
  const { pts, y0, y1, rx, ry } = crack;
  const SEAM = 0.6;
  const side = (from, to, dir) => {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const y = lerp(from, to, i / N);
      out.push([dir * halfWidthAt(clamp(y, -ry, ry) / SHELL, g) * SHELL, y]);
    }
    return out;
  };
  const along = (dy) => pts.map(([x, y]) => [x, y + dy]);
  const top = [...along(-SEAM), ...side(y1, -ry, 1), ...side(-ry, y0, -1)];
  const bottom = [...along(SEAM), ...side(y1, ry, 1), ...side(ry, y0, -1)];
  return { top, bottom, rx, ry };
}
var poly = (s, pts, close = true) => {
  s.begin();
  pts.forEach(([x, y], i) => i ? s.line(x, y) : s.move(x, y));
  if (close) s.close();
};
function wholeShell(s, g, T2, shellPaint, outline, w) {
  if (outline) {
    s.begin();
    silhouetteSub(s, g.R * SHELL, g.RY * SHELL, 0, 0, g);
    s.stroke(outline, w, "round", "round");
  }
  s.begin();
  silhouetteSub(s, g.R * SHELL, g.RY * SHELL, 0, 0, g);
  s.fill(shellPaint);
}
function lidTransform(open, crack) {
  const hinge = smooth(0, 0.34, open);
  const fly = smooth(0.28, 1, open);
  return {
    pivot: [crack.pts[crack.pts.length - 1][0] * 0.9, crack.y1],
    rotate: -hinge * 0.42 - fly * 0.5,
    dx: fly * crack.rx * 0.34,
    dy: -fly * crack.ry * 1.15,
    alpha: 1 - smooth(0.72, 1, open) * 0.85
  };
}
function drawEgg(s, S, T2, inner) {
  const g = S.g || G;
  const e = S.egg;
  if (!e || !e.on) {
    if (inner) inner();
    return;
  }
  const shell = T2.eggShell || mix(T2.body, "#FFF6E9", 0.86);
  const innerTone = T2.eggInner || darken(shell, 0.22);
  const line2 = T2.eggCrack || darken(shell, 0.45);
  const outline = T2.outline || null;
  const w = outline ? T2.outlineW * 2 : 0;
  const crack = e._path || (e._path = crackPath(e.seed, g));
  const open = e.open;
  s.save();
  if (e.wobble > 1e-3) {
    s.translate(0, g.RY * SHELL);
    s.rotate(Math.sin(e.t * 13) * 0.055 * e.wobble);
    s.translate(0, -g.RY * SHELL);
  }
  if (open <= 1e-3) {
    wholeShell(s, g, T2, shell, outline, w);
    drawFissure(s, crack, e.crack, line2, g);
    s.restore();
    return;
  }
  const { top, bottom } = shellHalves(crack, g);
  const lid = lidTransform(open, crack);
  s.save();
  s.alpha(lid.alpha);
  s.translate(lid.pivot[0] + lid.dx, lid.pivot[1] + lid.dy);
  s.rotate(lid.rotate);
  s.translate(-lid.pivot[0], -lid.pivot[1]);
  if (outline) {
    poly(s, top);
    s.stroke(outline, w, "round", "round");
  }
  poly(s, top);
  s.fill(shell);
  poly(s, crack.pts.map(([x, y]) => [x, y - 0.6]), false);
  s.stroke(innerTone, 7, "butt", "round");
  s.restore();
  if (inner) inner();
  if (outline) {
    poly(s, bottom);
    s.stroke(outline, w, "round", "round");
  }
  poly(s, bottom);
  s.fill(shell);
  poly(s, crack.pts.map(([x, y]) => [x, y + 0.6]), false);
  s.stroke(innerTone, 8, "butt", "round");
  s.restore();
}
function drawFissure(s, crack, k, colour, g) {
  if (k <= 1e-3) return;
  const shown = revealByLength(crack.pts, k);
  if (shown.length > 1) {
    poly(s, shown, false);
    s.stroke(colour, 3.2, "round", "round");
  }
  for (const b of crack.branches) {
    const at = crack.pts.findIndex(([x]) => x >= b[0][0]) / crack.pts.length;
    if (k < at + 0.06) continue;
    poly(s, revealByLength(b, clamp((k - at) / 0.18, 0, 1)), false);
    s.stroke(colour, 2.4, "round", "round");
  }
}

// src/core/trace.js
var SAMPLES_PER_CURVE = 18;
var DENSIFY = 0.02;
function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const out = [pts[0]];
  let prev = pts[0], acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    let seg = d(prev, cur);
    while (acc + seg >= step && seg > 1e-9) {
      const t = (step - acc) / seg;
      const np = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      out.push(np);
      prev = np;
      seg = d(prev, cur);
      acc = 0;
    }
    acc += seg;
    prev = cur;
  }
  const last = out[out.length - 1], end = pts[pts.length - 1];
  if (d(last, end) > 1e-9) out.push(end);
  return out;
}
function cubicAt(p0, c1, c2, p1, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
    a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]
  ];
}
function quadAt(p0, c, p1, t) {
  const u = 1 - t, a = u * u, b = 2 * u * t, d = t * t;
  return [a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]];
}
function flattenGlyph(ch) {
  const g = glyph(ch);
  if (!g) return { strokes: [], len: 0 };
  const b = glyphBounds(ch);
  const dx = (b.min + b.max) / 2;
  const strokes = [];
  for (const path2 of g) {
    const pts = [];
    let cur = [0, 0];
    for (const c of path2) {
      if (c[0] === "M") {
        cur = [c[1], c[2]];
        pts.push(cur);
      } else if (c[0] === "L") {
        cur = [c[1], c[2]];
        pts.push(cur);
      } else if (c[0] === "Q") {
        const p0 = cur, cp = [c[1], c[2]], p1 = [c[3], c[4]];
        for (let i = 1; i <= SAMPLES_PER_CURVE; i++) pts.push(quadAt(p0, cp, p1, i / SAMPLES_PER_CURVE));
        cur = p1;
      } else if (c[0] === "C") {
        const p0 = cur, c1 = [c[1], c[2]], c2 = [c[3], c[4]], p1 = [c[5], c[6]];
        for (let i = 1; i <= SAMPLES_PER_CURVE; i++) pts.push(cubicAt(p0, c1, c2, p1, i / SAMPLES_PER_CURVE));
        cur = p1;
      }
    }
    if (pts.length < 2) continue;
    const dense = resample(pts, DENSIFY).map((p) => [p[0] - dx, p[1]]);
    const cum = [0];
    for (let i = 1; i < dense.length; i++)
      cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    strokes.push({ pts: dense, cum, len: cum[cum.length - 1] });
  }
  return { strokes, len: strokes.reduce((a, s) => a + s.len, 0) };
}
var cache = /* @__PURE__ */ new Map();
function glyphPath(ch) {
  const k = String(ch).slice(0, 1);
  if (!cache.has(k)) cache.set(k, flattenGlyph(k));
  return cache.get(k);
}
function penAt(ch, u, { liftFraction = 0.1 } = {}) {
  const g = glyphPath(ch);
  if (!g.strokes.length) return null;
  const n2 = g.strokes.length;
  const lift = n2 > 1 ? liftFraction : 0;
  const drawShare = 1 - lift * (n2 - 1);
  const scale = g.len ? drawShare / g.len : 0;
  let t = Math.min(Math.max(u, 0), 1);
  for (let i = 0; i < n2; i++) {
    const s = g.strokes[i];
    const span2 = s.len * scale;
    if (t <= span2 || i === n2 - 1) {
      const d = Math.min(t / (span2 || 1), 1) * s.len;
      let lo = 0, hi = s.cum.length - 1;
      while (lo < hi - 1) {
        const mid = lo + hi >> 1;
        s.cum[mid] <= d ? lo = mid : hi = mid;
      }
      const seg = s.cum[hi] - s.cum[lo] || 1;
      const f = (d - s.cum[lo]) / seg;
      return {
        x: s.pts[lo][0] + (s.pts[hi][0] - s.pts[lo][0]) * f,
        y: s.pts[lo][1] + (s.pts[hi][1] - s.pts[lo][1]) * f,
        stroke: i,
        into: Math.min(t / (span2 || 1), 1),
        penUp: false
      };
    }
    t -= span2;
    if (t < lift) {
      const next = g.strokes[i + 1];
      return { x: next.pts[0][0], y: next.pts[0][1], stroke: i + 1, into: 0, penUp: true };
    }
    t -= lift;
  }
  const last = g.strokes[n2 - 1];
  const p = last.pts[last.pts.length - 1];
  return { x: p[0], y: p[1], stroke: n2 - 1, into: 1, penUp: false };
}
function drawTrace(s, ch, cap, u, colors, weight = 0.145) {
  const g = glyphPath(ch);
  if (!g.strokes.length) return null;
  s.save();
  s.scale(cap, cap);
  if (colors.ghost) {
    for (const st of g.strokes) {
      s.begin();
      st.pts.forEach((p, i) => i ? s.line(p[0], p[1]) : s.move(p[0], p[1]));
      s.stroke(colors.ghost, weight, "round", "round");
    }
  }
  const pen = penAt(ch, u);
  if (pen) {
    for (let i = 0; i <= pen.stroke && i < g.strokes.length; i++) {
      const st = g.strokes[i];
      const upTo = i < pen.stroke ? st.pts.length - 1 : Math.max(1, Math.round(pen.into * (st.pts.length - 1)));
      if (upTo < 1) continue;
      s.begin();
      for (let k = 0; k <= upTo; k++) k ? s.line(st.pts[k][0], st.pts[k][1]) : s.move(st.pts[k][0], st.pts[k][1]);
      if (i === pen.stroke && !pen.penUp) {
        s.line(pen.x, pen.y);
      }
      s.stroke(colors.ink, weight, "round", "round");
    }
  }
  s.restore();
  return pen ? { x: pen.x * cap, y: pen.y * cap, penUp: pen.penUp } : null;
}
function nearestOnGlyph(g, p) {
  let best = Infinity, bestStroke = 0, bestIdx = 0;
  for (let si = 0; si < g.strokes.length; si++) {
    const pts = g.strokes[si].pts;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - p[0]) ** 2 + (pts[i][1] - p[1]) ** 2;
      if (d < best) {
        best = d;
        bestStroke = si;
        bestIdx = i;
      }
    }
  }
  return { dist: Math.sqrt(best), stroke: bestStroke, idx: bestIdx };
}
function scoreTrace(ch, input, { tolerance = 0.16, diagnose = false, candidates } = {}) {
  const g = glyphPath(ch);
  const empty = {
    score: 0,
    accuracy: 0,
    coverage: 0,
    direction: 0,
    verdict: "none",
    hint: "finish",
    strokesHit: 0,
    strokes: g.strokes.length
  };
  if (!g.strokes.length || !input || !input.length) return empty;
  const pt = (p) => Array.isArray(p) ? p : [p.x, p.y];
  const nested = Array.isArray(input[0]) && Array.isArray(input[0][0]);
  const paths = (nested ? input : [input]).map((path2) => resample(path2.map(pt), tolerance * 0.5)).filter((path2) => path2.length >= 2);
  if (!paths.length) return empty;
  const user = paths.flat();
  let accSum = 0;
  const hitPaths = paths.map((path2) => path2.map((p) => {
    const n2 = nearestOnGlyph(g, p);
    accSum += Math.max(0, 1 - n2.dist / tolerance);
    return n2;
  }));
  const accuracy = accSum / user.length;
  const byStroke = g.strokes.map(() => []);
  hitPaths.forEach((hits, pi) => hits.forEach((h, i) => byStroke[h.stroke].push(paths[pi][i])));
  const strokeCoverage = g.strokes.map((st, si) => {
    const pool2 = byStroke[si];
    if (!pool2.length) return 0;
    let hit = 0;
    for (const gp of st.pts)
      if (pool2.some((up) => Math.hypot(up[0] - gp[0], up[1] - gp[1]) <= tolerance)) hit++;
    return hit / st.pts.length;
  });
  const coverage = strokeCoverage.reduce((a, b) => a + b, 0) / strokeCoverage.length;
  const strokesHit = strokeCoverage.filter((c) => c > 0.6).length;
  let forward = 0, moves = 0;
  for (const hits of hitPaths) {
    for (let i = 1; i < hits.length; i++) {
      if (hits[i].stroke !== hits[i - 1].stroke) continue;
      const d = hits[i].idx - hits[i - 1].idx;
      if (d === 0) continue;
      moves++;
      if (d > 0) forward++;
    }
  }
  const direction = moves ? forward / moves : 0.5;
  const score = Math.pow(Math.max(0, accuracy), 1.5) * Math.pow(Math.max(0, coverage), 2.2) * (0.45 + 0.55 * direction);
  const verdict = score >= 0.68 ? "great" : score >= 0.48 ? "good" : score >= 0.3 ? "close" : "again";
  const weakest = Math.min(coverage, accuracy, direction);
  const hint = coverage === weakest ? "finish" : accuracy === weakest ? "stay-on" : "direction";
  const result = {
    score,
    accuracy,
    coverage,
    direction,
    verdict,
    hint,
    strokesHit,
    strokes: g.strokes.length
  };
  if (!diagnose) return result;
  const mirrored = (Array.isArray(input[0]) && Array.isArray(input[0][0]) ? input : [input]).map((path2) => path2.map((p) => Array.isArray(p) ? [-p[0], p[1]] : [-p.x, p.y]));
  const asMirror = scoreTrace(ch, mirrored, { tolerance });
  result.reversed = asMirror.score >= 0.55 && asMirror.score > score + 0.15;
  result.mirrorScore = asMirror.score;
  const pool = candidates ?? DEFAULT_CANDIDATES;
  let best = null;
  for (const c of pool) {
    if (c === ch) continue;
    const r = scoreTrace(c, input, { tolerance });
    if (!best || r.score > best.score) best = { ch: c, score: r.score };
  }
  result.looksLike = best && best.score >= 0.55 && best.score > score + 0.2 ? best.ch : null;
  result.looksLikeScore = best ? best.score : 0;
  return result;
}
var DEFAULT_CANDIDATES = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"];
function identifyTrace(input, { candidates = DEFAULT_CANDIDATES, tolerance = 0.16, top = 3 } = {}) {
  if (!input || !input.length) return [];
  return candidates.map((ch) => ({ ch, ...scoreTrace(ch, input, { tolerance }) })).sort((a, b) => b.score - a.score).slice(0, Math.max(1, top));
}

// src/core/renderer.js
function bodyPaint(T2, g = G) {
  const sh = T2.shade && T2.shade.body;
  if (!sh) return T2.body;
  return vertical(sh.top, sh.bottom, -g.RY, g.RY, sh.mid);
}
function earShade(T2, g = G) {
  const sh = T2.shade && T2.shade.body;
  if (!sh) return darken(T2.body, 0.11);
  return vertical(
    darken(sh.top, 0.11),
    darken(sh.bottom, 0.11),
    -g.RY,
    g.RY,
    sh.mid ? darken(sh.mid, 0.11) : void 0
  );
}
function earPath(s, x, y, rx, ry, tilt, kind) {
  if (kind !== "point" && kind !== "flop") {
    s.ellipse(x, y, rx, ry, tilt);
    return;
  }
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  const at = (u, v) => [x + u * rx * c - v * ry * sn, y + u * rx * sn + v * ry * c];
  if (kind === "point") {
    s.move(...at(-0.95, 0.35));
    s.cubic(...at(-1.05, -0.55), ...at(-0.35, -1.25), ...at(0.15, -1.05));
    s.cubic(...at(0.75, -0.85), ...at(1.05, -0.05), ...at(0.85, 0.5));
    s.cubic(...at(0.4, 0.95), ...at(-0.5, 0.95), ...at(-0.95, 0.35));
    s.close();
    return;
  }
  s.move(...at(-0.9, -0.55));
  s.cubic(...at(-0.2, -1), ...at(0.85, -0.8), ...at(0.9, -0.1));
  s.cubic(...at(0.95, 0.7), ...at(0.2, 1.05), ...at(-0.35, 0.9));
  s.cubic(...at(-0.85, 0.75), ...at(-1.05, 0.1), ...at(-0.9, -0.55));
  s.close();
}
function earShapes(s, S, T2, each) {
  const g = S.g || G;
  const spec = g.ears !== void 0 ? earSpec(g.ears) : T2.ears ? EARS.round : null;
  if (!spec) return;
  if (g.ears === void 0 && !T2.ears) return;
  for (const side of [-1, 1]) {
    const p = project(side * (spec.sx ?? g.earSX), spec.sy ?? g.earSY, g.R, S.yaw, S.pitch);
    const k = 0.62 + 0.38 * Math.abs(p.fx);
    const out = Math.sign(p.x) || side;
    const x = out * Math.max(Math.abs(p.x), g.R * 0.86);
    const r = spec.r ?? g.earR;
    each(
      x,
      p.y,
      r * k,
      r * (spec.ry ?? g.earRY),
      side * (spec.tilt ?? g.earTilt),
      spec.kind || "round"
    );
  }
}
function drawBody(s, S, T2) {
  const g = S.g || G;
  const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
  const paint = bodyPaint(T2, g);
  const bulge = Math.abs(sy) * 15;
  const hasBulge = bulge > 0.6;
  const shape = (rx, ry, ox = 0, oy = 0) => silhouettePath(s, rx, ry, ox, oy, g);
  const feet = (each) => {
    if (!g.footR) return;
    for (const side of [-1, 1]) each(side * g.footDX, g.RY - g.footDY, g.footR * 1.25, g.footR);
  };
  const bulgePath = () => {
    shape(g.R * 0.93, g.RY * 0.95, -Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10);
  };
  const headPath = () => shape(g.R, g.RY);
  const prof = S.profile ? profileAmount(S) : 0;
  const profPath = () => {
    s.begin();
    profileSub(s, S, 1, prof);
  };
  if (T2.outline) {
    const w = T2.outlineW * 2;
    earShapes(s, S, T2, (x, y, rx, ry, tilt, kind) => {
      s.begin();
      earPath(s, x, y, rx, ry, tilt, kind);
      s.stroke(T2.outline, w, "round", "round");
    });
    feet((x, y, rx, ry) => {
      s.begin();
      s.ellipse(x, y, rx, ry);
      s.stroke(T2.outline, w, "round", "round");
    });
    if (hasBulge) {
      bulgePath();
      s.stroke(T2.outline, w, "round", "round");
    }
    if (prof > 2e-3) {
      profPath();
      s.stroke(T2.outline, w, "round", "round");
    }
    headPath();
    s.stroke(T2.outline, w, "round", "round");
  }
  const earPaint = T2.ears === true ? paint : T2.ears === "darker" ? earShade(T2, g) : T2.ears || earShade(T2, g);
  earShapes(s, S, T2, (x, y, rx, ry, tilt, kind) => {
    s.begin();
    earPath(s, x, y, rx, ry, tilt, kind);
    s.fill(earPaint);
  });
  feet((x, y, rx, ry) => {
    s.begin();
    s.ellipse(x, y, rx, ry);
    s.fill(earPaint);
  });
  if (hasBulge) {
    bulgePath();
    s.fill(paint);
  }
  if (prof > 2e-3) {
    profPath();
    s.fill(paint);
  }
  headPath();
  s.fill(paint);
  if (T2.form !== false) {
    s.begin();
    silhouetteSub(s, g.R, g.RY, 0, 0, g);
    if (hasBulge) {
      silhouetteSub(
        s,
        g.R * 0.93,
        g.RY * 0.95,
        -Math.sign(sy) * bulge * 0.85,
        2 - S.pitch * 10,
        g
      );
    }
    earShapes(s, S, T2, (x, y, rx, ry, tilt, kind) => earPath(s, x, y, rx, ry, tilt, kind));
    feet((x, y, rx, ry) => s.ellipse(x, y, rx, ry));
    if (prof > 2e-3) profileSub(s, S, 1, prof);
    s.fill(formLight(g.R, {
      lit: (T2.formBase ?? 0.13) * (T2.formLit ?? 1),
      dark: (T2.formBaseDark ?? 0.26) * (T2.formDark ?? 1),
      spread: T2.formSpread ?? 1.62,
      mid: T2.formMid ?? 0.42,
      cx: T2.formCX ?? -0.34,
      cy: T2.formCY ?? -0.4
    }));
  }
  if (T2.shade && T2.shade.sheen) {
    s.save();
    s.alpha(T2.shade.sheen);
    headPath();
    s.fill(sheen(
      -g.R * 0.28,
      -g.RY * 0.34,
      g.R * 1.15,
      T2.shade.sheenColor || "#FFFFFF",
      "rgba(255,255,255,0)"
    ));
    s.restore();
  }
  const face = S._face;
  const backness = smooth(0.3, -0.45, cy) * (S.profile ? 1 - (face ? face.vis : 0) : 1);
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
    s.stroke(T2.bodyDeep, 7);
    s.restore();
    for (let i = 0; i < 2; i++) {
      s.save();
      s.translate(dir * (16 + i * 20), oy - 88 + i * 10);
      s.rotate(dir * (0.7 + i * 0.5));
      s.begin();
      s.ellipse(0, 0, 9 - i * 2, 20 - i * 5);
      s.fill(paint);
      s.restore();
    }
    s.restore();
  }
}
function facePatchPath(s, F, T2, S) {
  const g = F.g || G;
  const { x, y, rx, ry, rot = 0, lean = 0, sq = 1 } = F.hole;
  const bumps = g.fringe != null ? fringeSpec(g.fringe).bumps : T2.hairline || 0;
  if (lean === 2) {
    projectedPatchPath(s, F, T2, S);
    return;
  }
  if (lean) {
    leaningPatchPath(s, x, y, rx / sq, ry, sq, rot, bumps);
    return;
  }
  if (!bumps) {
    s.begin();
    s.ellipse(x, y, rx, ry);
    return;
  }
  const a0 = -20 * Math.PI / 180, a1 = 200 * Math.PI / 180;
  s.begin();
  s.ellipse(x, y, rx, ry, 0, a0, a1);
  const xs = x + rx * Math.cos(a1);
  const xe = x + rx * Math.cos(a0), ye = y + ry * Math.sin(a0);
  const step = (xe - xs) / bumps;
  for (let i = 0; i < bumps; i++) {
    const px = xs + i * step, nx = px + step;
    const endY = i === bumps - 1 ? ye : y - ry * 0.66;
    const centreness = 1 - Math.abs((px + nx) / 2 - x) / rx;
    s.quad(px + step * 0.5, y - ry * (0.98 + 0.16 * centreness), nx, endY);
  }
  s.close();
}
function leaningPatchPath(s, x, y, a, b, sq, rot, bumps) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  const P = (px, py) => {
    const along = px * c + py * sn;
    return [
      x + px - along * c + along * sq * c,
      y + py - along * sn + along * sq * sn
    ];
  };
  const N = 96;
  if (!bumps) {
    s.begin();
    for (let i = 0; i <= N; i++) {
      const t = i / N * Math.PI * 2;
      const [X2, Y] = P(a * Math.cos(t), b * Math.sin(t));
      if (i) s.line(X2, Y);
      else s.move(X2, Y);
    }
    s.close();
    return;
  }
  const a0 = -20 * Math.PI / 180, a1 = 200 * Math.PI / 180;
  s.begin();
  for (let i = 0; i <= N; i++) {
    const t = a0 + (a1 - a0) * (i / N);
    const [X2, Y] = P(a * Math.cos(t), b * Math.sin(t));
    if (i) s.line(X2, Y);
    else s.move(X2, Y);
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
function projectedPatchPath(s, F, T2, S) {
  const g = F.g || G;
  const fit = F.fit ?? 1;
  const pts = facePatchSurface(
    g.faceRX * fit,
    g.faceRY * fit,
    g.fringe != null ? g.fringe : T2.hairline || 0,
    64,
    g
  );
  const fy = faceYaw(S.yaw), fp = facePitch(S.pitch);
  const w = faceWrapShift(fy, fp, g);
  const dx = (F.dx ?? 0) + w.x;
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
  const amt = S.profile ? profileAmount(S) : 0;
  if (amt > 0.01) {
    const midY = F.hole.y, halfH = F.hole.ry || 1;
    const dir = Math.sign(Math.sin(S.yaw)) || 1;
    const noseY = midY + halfH * 0.34;
    let reach = -Infinity;
    for (const [px, py] of P) {
      if (Math.abs(py - noseY) < halfH * 0.22) reach = Math.max(reach, dir * px);
    }
    const gap = halfWidthAt(noseY, g) - (reach > -Infinity ? reach : 0);
    const near = smooth(22, 8, gap);
    if (near > 0.01) {
      profileSub(
        s,
        S,
        1,
        amt * near,
        [midY - halfH * 0.34, midY + halfH * 1.02],
        clamp(gap + 6, 10, 26)
      );
    }
  }
}
function coverPatch(s, F) {
  const { x, y, rx, ry } = F.hole;
  s.begin();
  s.ellipse(x, y, Math.max(rx, ry) * 1.6, Math.max(rx, ry) * 1.6);
}
function drawFace(s, S, T2) {
  const g = S.g || G;
  const F = S._face || faceFrame(S);
  if (F.vis <= 0.01) return F;
  s.save();
  s.alpha(F.vis);
  s.save();
  headRegion(s, S, 0.985 + 0.015 * (S.profile ? profileAmount(S) : 0));
  s.clip();
  if (T2.face) {
    facePatchPath(s, F, T2, S);
    if (T2.outline) {
      s.stroke(
        T2.outlineFace ?? T2.outline,
        (T2.outlineFaceW ?? T2.outlineW * 0.9) * 2,
        "round",
        "round"
      );
    }
    facePatchPath(s, F, T2, S);
    s.fill(T2.shade && T2.shade.face ? vertical(
      T2.shade.face.top,
      T2.shade.face.bottom,
      F.hole.y - F.hole.ry,
      F.hole.y + F.hole.ry
    ) : T2.face);
    const amt = S.profile ? profileAmount(S) : 0;
    if (T2.recess !== false) {
      const d = ((T2.recessBase ?? 0.1) + (T2.recessTurn ?? 0.24) * (1 - (F.hole.fore ?? 1))) * (1 - 0.7 * amt);
      s.save();
      facePatchPath(s, F, T2, S);
      s.clip();
      coverPatch(s, F);
      s.fill({
        type: "radial",
        cx: F.hole.x - F.hole.rx * 0.5,
        cy: F.hole.y - F.hole.ry * 0.62,
        r: F.hole.ry * 1.85,
        stops: [[0, `rgba(0,0,0,${alpha(d)})`], [0.6, "rgba(0,0,0,0)"]]
      });
      s.restore();
    }
    if (S.faceForm) {
      s.save();
      facePatchPath(s, F, T2, S);
      s.clip();
      coverPatch(s, F);
      s.fill(formLight(g.R, { lit: 0.1 * S.faceForm, dark: 0.2 * S.faceForm * (1 - 0.45 * amt) }));
      s.restore();
    }
  }
  if (S.showBlush && T2.blush) {
    s.save();
    s.alpha(T2.blushA ?? 0.7);
    if (T2.face) {
      facePatchPath(s, F, T2, S);
      s.clip();
    }
    for (const sx of [-(g.eyeDX + g.blushDX), g.eyeDX + g.blushDX]) {
      const b = faceProject(
        sx,
        g.faceCY + g.eyeDY + g.blushDY,
        S.faceLean === 2 ? faceYaw(S.yaw) : S.yaw,
        S.faceLean === 2 ? facePitch(S.pitch) : S.pitch,
        g
      );
      b.x += F.dx ?? 0;
      if (b.z <= 0) continue;
      s.save();
      s.translate(b.x, b.y);
      s.scale(Math.abs(b.fx), Math.abs(b.fy));
      s.begin();
      s.ellipse(0, 0, g.blushRX, g.blushRY);
      s.fill(T2.blush);
      s.restore();
    }
    s.restore();
  }
  s.save();
  if (T2.face) facePatchPath(s, F, T2, S);
  else silhouettePath(s, g.R * 0.98, g.RY * 0.98, 0, 0, g);
  s.clip();
  if (S.xfade < 1 && S.prevExpr !== S.expr) {
    s.save();
    s.alpha(1 - S.xfade);
    EXPRESSIONS[S.prevExpr](s, T2, F, S);
    s.restore();
    s.save();
    s.alpha(S.xfade);
    EXPRESSIONS[S.expr](s, T2, F, S);
    s.restore();
  } else {
    EXPRESSIONS[S.expr](s, T2, F, S);
  }
  s.restore();
  s.restore();
  s.restore();
  return F;
}
function handAt(S, side) {
  const g = S.g || G;
  const sgn = side === "l" ? -1 : 1;
  const h = S.hand[side];
  return project(
    sgn * (g.handSX + h.out * 22),
    g.handSY - h.lift * g.handLift,
    g.Rh,
    S.yaw,
    S.pitch
  );
}
function drawHand(s, S, T2, side, p) {
  const g = S.g || G;
  const h = S.hand[side];
  if (h.show <= 0.01) return;
  const sgn = side === "l" ? -1 : 1;
  const R3 = g.handR;
  const sq = clamp(0.55 + Math.abs(p.fx) * 0.45, 0.4, 1);
  s.save();
  s.alpha(clamp(h.show, 0, 1));
  s.translate(p.x, p.y);
  s.rotate(h.swing * sgn);
  s.scale(sgn * sq, 1);
  const thumb = () => {
    s.begin();
    s.ellipse(-R3 * 0.82, -R3 * 0.32, R3 * 0.38, R3 * 0.3, -0.62);
  };
  const palm = () => {
    s.begin();
    s.ellipse(0, 0, R3 * 0.86, R3 * 1.02);
  };
  if (T2.outline) {
    thumb();
    s.stroke(T2.outline, T2.outlineW * 2 / Math.max(0.4, sq), "round", "round");
    palm();
    s.stroke(T2.outline, T2.outlineW * 2 / Math.max(0.4, sq), "round", "round");
  }
  thumb();
  s.fill(T2.hand);
  palm();
  s.fill(T2.hand);
  s.restore();
}
function drawSparks(s, S, T2, far) {
  const g = S.g || G;
  if (!S.showSparks) return;
  g.sparks.forEach((sp, i) => {
    const lon = sp.a + S.yaw;
    const z = Math.cos(lon);
    if (z < 0 !== far) return;
    const phase = S.t * 3.1 * S.tempo - i * 0.5;
    const pulse = 1 + Math.sin(phase) * 0.14 + S.sparkPop * 0.55;
    const depth = 0.78 + 0.22 * z;
    const depthFade = lerp(0.42, 0.92, smooth(-0.3, 0.3, z));
    const mirror2 = Math.tanh(z * 3.2);
    s.save();
    s.alpha(depthFade * clamp(0.7 + S.sparkPop * 0.3, 0, 1));
    s.translate(
      g.Rs * Math.sin(lon) * depth,
      sp.y + Math.sin(phase * 0.7) * 3 - S.sparkPop * 10 - S.pitch * 30
    );
    s.rotate(sp.rot * mirror2 + S.sparkPop * 0.3);
    s.begin();
    s.ellipse(0, 0, sp.rx * pulse * Math.max(0.35, Math.abs(z) * 0.5 + 0.5), sp.ry * pulse);
    s.fill(T2.spark);
    s.restore();
  });
}
function drawHeldLetter(s, S, T2) {
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
  s.begin();
  s.move(-w / 2 + r, -h / 2);
  s.line(w / 2 - r, -h / 2);
  s.arc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0);
  s.line(w / 2, h / 2 - r);
  s.arc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
  s.line(-w / 2 + r, h / 2);
  s.arc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI);
  s.line(-w / 2, -h / 2 + r);
  s.arc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
  s.close();
  s.fill(T2.face);
  s.stroke(T2.outline || T2.body, T2.outline ? T2.outlineW : 4);
  drawGlyph(s, S.heldLetter, 30, T2.outline || T2.feature || T2.body, 0.145, true, "ink");
  s.restore();
}
function drawTracePanel(s, S, T2) {
  const g = S.g || G;
  const tr = S.trace;
  if (!tr.active || !tr.ch) return;
  s.save();
  s.translate(g.trace.x, g.trace.y);
  const halfW = g.trace.cap * 0.62;
  const cap = g.trace.cap;
  const gb = glyphPath(tr.ch);
  const inkBottom = gb.strokes.length ? Math.max(...gb.strokes.flatMap((st) => st.pts.map((pt) => pt[1]))) : METRICS.baseline;
  const rules = [
    [METRICS.cap * cap, 0.28],
    [METRICS.xLine * cap, 0.15],
    [METRICS.baseline * cap, 0.28]
  ];
  if (inkBottom > METRICS.baseline + 0.02) rules.push([METRICS.descender * cap, 0.15]);
  s.save();
  for (const [y, a] of rules) {
    s.save();
    s.alpha(a);
    s.begin();
    s.move(-halfW, y);
    s.line(halfW, y);
    s.stroke(T2.bodyDeep, 1.6);
    s.restore();
  }
  s.restore();
  s.restore();
  s.save();
  s.translate(g.trace.x, g.trace.y);
  const pen = drawTrace(
    s,
    tr.ch,
    g.trace.cap,
    tr.u,
    { ghost: T2.ghost, ink: T2.body }
  );
  s.restore();
  if (pen && !pen.penUp && tr.u < 1) {
    s.save();
    s.translate(g.trace.x + pen.x, g.trace.y + pen.y);
    s.begin();
    s.ellipse(0, 0, 8.5, 8.5);
    s.fill(T2.spark);
    s.begin();
    s.ellipse(0, 0, 3.4, 3.4);
    s.fill(T2.face);
    s.restore();
  }
}
function render(surface, S, T2) {
  const g = S.g || G;
  const s = surface;
  const bob = Math.sin(S.t * 1.9 * S.tempo) * 5 * S.bobAmt;
  const breath = 1 + Math.sin(S.t * 1.35 * S.tempo) * 0.018 * S.breathAmt;
  const lift = bob + S.hover;
  if (S.showShadow) {
    const hgt = clamp((lift + 8) / 60, 0, 1);
    s.save();
    s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
    s.alpha(lerp(0.95, 0.25, hgt));
    s.begin();
    s.ellipse(
      S.offX * 0.5 + S.shiftX,
      g.ground,
      lerp(78, 44, hgt) * (0.92 + Math.abs(Math.cos(S.yaw)) * 0.08),
      11
    );
    s.fill(T2.shadow);
    s.restore();
  }
  s.save();
  s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
  s.translate(S.shiftX, 0);
  if (S.showTrail && S.trail.length > 1) {
    S.trail.forEach((ghost, i) => {
      if (ghost.speed < 0.6) return;
      const k = (i + 1) / S.trail.length;
      s.save();
      s.alpha(0.16 * k * clamp(ghost.speed, 0, 1));
      s.translate(ghost.x, ghost.y);
      s.rotate(ghost.roll);
      s.begin();
      s.ellipse(0, 0, g.R * 0.97, g.RY * 0.97);
      s.fill(T2.body);
      s.restore();
    });
  }
  s.save();
  s.translate(S.offX, S.offY - lift);
  s.rotate(S.roll + Math.sin(S.t * 0.9 * S.tempo) * 0.02 * S.bobAmt);
  s.scale(S.squashX * breath, S.squashY * breath);
  const pL = handAt(S, "l"), pR = handAt(S, "r");
  drawSparks(s, S, T2, true);
  if (pL.z < 0) drawHand(s, S, T2, "l", pL);
  if (pR.z < 0) drawHand(s, S, T2, "r", pR);
  S._face = faceFrame(S);
  const drawCharacter = () => {
    const e = S.egg;
    const rising = e && e.on;
    if (rising) {
      const gg = S.g || G;
      const k = smooth(0.05, 0.95, e.open);
      s.save();
      s.translate(0, lerp(gg.RY * 0.42, -gg.RY * 1.02, k));
    }
    drawAccessories(s, S, T2, "rearExternal");
    drawAccessories(s, S, T2, "headRear");
    drawBody(s, S, T2);
    drawAccessories(s, S, T2, "bodyFront");
    drawFace(s, S, T2);
    drawAccessories(s, S, T2, "headFront");
    drawAccessories(s, S, T2, "faceFront");
    drawAccessories(s, S, T2, "heldRear");
    if (pL.z >= 0) drawHand(s, S, T2, "l", pL);
    if (pR.z >= 0) drawHand(s, S, T2, "r", pR);
    drawAccessories(s, S, T2, "heldFront");
    drawSparks(s, S, T2, false);
    drawHeldLetter(s, S, T2);
    if (rising) s.restore();
  };
  if (S.egg && S.egg.on) drawEgg(s, S, T2, drawCharacter);
  else drawCharacter();
  s.restore();
  s.restore();
  s.save();
  s.scale(S.scale, S.scale);
  drawTracePanel(s, S, T2);
  s.restore();
  s.save();
  s.scale(S.scale * S.autoScale, S.scale * S.autoScale);
  s.translate(S.offX + S.shiftX, S.offY - lift);
  S.particles.draw(s);
  s.restore();
}

// src/core/cast.js
var CAST = {
  pip: { build: "classic", fringe: "center-tuft", ears: "round", theme: "oat" },
  momo: { build: "cuddle", fringe: "soft-5", ears: "flop", theme: "strawberry" },
  lumi: { build: "sprout", fringe: "side-left", ears: "nub", theme: "sky" },
  vivi: { build: "cuddle", fringe: "curtain", ears: "point", theme: "lavender" },
  tavi: { build: "classic", fringe: "soft-3", ears: "none", theme: "apricot" },
  nox: { build: "sprout", fringe: "smooth", ears: "point", theme: "inkling" },
  coco: { build: "cuddle", fringe: "center-tuft", ears: "none", theme: "coral" },
  nori: { build: "classic", fringe: "side-right", ears: "nub", theme: "teal" },
  bram: { build: "sprout", fringe: "curtain", ears: "round", theme: "plum" },
  sunny: { build: "cuddle", fringe: "soft-3", ears: "nub", theme: "amber" },
  mika: { build: "classic", fringe: "side-left", ears: "flop", theme: "snow" },
  zuzu: { build: "sprout", fringe: "soft-3", ears: "flop", theme: "indigo" }
};
var CAST_NAMES = Object.keys(CAST);
var AXES = ["build", "fringe", "ears"];
function resolveCharacter(name) {
  if (name == null) return null;
  if (typeof name === "object") return validate(name, "(inline)");
  const c = CAST[String(name).toLowerCase()];
  if (!c) throw new Error(`Unknown character "${name}". Available: ${CAST_NAMES.join(", ")}`);
  return c;
}
function validate(c, who) {
  if (c.build && !BUILD_NAMES.includes(c.build))
    throw new Error(`${who}: unknown build "${c.build}". Available: ${BUILD_NAMES.join(", ")}`);
  if (c.fringe && !FRINGE_NAMES.includes(c.fringe))
    throw new Error(`${who}: unknown fringe "${c.fringe}". Available: ${FRINGE_NAMES.join(", ")}`);
  if (c.ears && !EAR_NAMES.includes(c.ears))
    throw new Error(`${who}: unknown ears "${c.ears}". Available: ${EAR_NAMES.join(", ")}`);
  return c;
}
function distance(a, b) {
  const A = resolveCharacter(a), B2 = resolveCharacter(b);
  return AXES.filter((k) => A[k] !== B2[k]).length;
}
function tooClose(min = 2) {
  const out = [];
  for (let i = 0; i < CAST_NAMES.length; i++)
    for (let j = i + 1; j < CAST_NAMES.length; j++) {
      const d = distance(CAST_NAMES[i], CAST_NAMES[j]);
      if (d < min) out.push(`${CAST_NAMES[i]}/${CAST_NAMES[j]} differ on ${d}`);
    }
  return out;
}

// src/core/phases.js
var PHASES = {
  idle: {
    steady: true,
    expression: "happy",
    autoLook: true
  },
  typing: {
    steady: true,
    expression: "thinking",
    autoLook: true
  },
  correct: {
    action: "correct",
    then: "idle"
  },
  wrong: {
    action: "wrong",
    then: "typing"
  },
  /* Showing them the answer. `word` spells it out letter by letter; without
     one there is nothing to show, so the character just visibly thinks rather
     than pretending to know something it was not given. */
  stuck: {
    then: "typing",
    run(b, o) {
      if (o.word) b.spell(o.word, { speak: o.speak !== false, celebrate: false });
      else b.react("think");
    }
  },
  /* Letter formation. `letter` traces one; `word` traces each in turn. */
  teaching: {
    then: "idle",
    run(b, o) {
      if (o.letter) b.trace(o.letter, o.trace);
      else if (o.word) b.traceWord(o.word, o.trace);
      else b.react("think");
    }
  }
};
var PHASE_NAMES = Object.keys(PHASES);
var DONE_EVENT = {
  correct: "action:end",
  wrong: "action:end",
  stuck: "spell:done",
  teaching: "trace:done"
};
function applyPhase(buddy, name, opts = {}) {
  const spec = PHASES[name];
  if (!spec) return false;
  const cur = buddy._phase;
  if (cur && cur.name === name && !opts.force && cur.nonce === opts.nonce) return false;
  buddy.stopTrace();
  buddy.cancelSpell();
  buddy._phase = { name, nonce: opts.nonce, steady: !!spec.steady };
  if (spec.steady) buddy._phaseSteady = name;
  buddy.s.autoLook = spec.autoLook ?? false;
  if (spec.expression) buddy.express(spec.expression);
  if (spec.action) buddy.react(spec.action);
  if (spec.run) spec.run(buddy, opts);
  const evt = spec.then && DONE_EVENT[name];
  if (evt) {
    const armed = buddy._phase;
    const back = () => {
      buddy.off(evt, back);
      if (buddy._phase !== armed) return;
      applyPhase(buddy, spec.then, { word: opts.word, letter: opts.letter });
    };
    buddy.on(evt, back);
  }
  return true;
}

// src/core/buddy.js
var DEFAULTS = {
  theme: "ink",
  /* Which proportions this character is built from — `v1` or `kawaii`, or an
     object of overrides. Per instance: two buddies with different shapes can
     render in the same frame, which is what a cast needs and what the old
     global `applyShape` could not give. */
  shape: "v1",
  seed: 1,
  expression: "happy",
  scale: 1,
  bobAmt: 1,
  breathAmt: 1,
  tempo: 1,
  blinkEvery: 3.2,
  autoLook: true,
  showShadow: true,
  showSparks: true,
  showBlush: true,
  showHands: false,
  // hands appear on demand; animations request them
  showTrail: true,
  /* How the face is built.
  
       2 — the default — is the only one of these that is a surface: the patch is
       drawn face-on and pushed through the same projection as the eyes, so the
       lean, the bank of the fringe, the crowding of the far scallops and the
       wrap past the limb all fall out of one projection. 1 is the affine
       leaning ellipse and 0 is the upright oval the rig shipped with; both are
       kept because they are cheaper, and because a caller who liked the flat
       look should be able to have it. */
  faceLean: 2,
  /* The body's own form light, run across the face patch at this strength.
     Without it the head reads as round and the face reads as a card stuck to
     it — the one thing a surface on a sphere cannot do. */
  faceForm: 1,
  /* Brow, nose and chin break the leading edge in the last thirty degrees of
     turn, and the face stops fading to a blank egg at the limb. */
  profile: true,
  idleActions: false,
  // play look-around / think spontaneously
  idleEvery: [9, 20]
  // seconds between spontaneous idles
};
var Buddy = class {
  constructor(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const cast = resolveCharacter(o.character);
    if (cast) {
      if (opts.shape === void 0) o.shape = cast.build;
      if (opts.fringe === void 0) o.fringe = cast.fringe;
      if (opts.ears === void 0) o.ears = cast.ears;
      if (opts.theme === void 0) o.theme = cast.theme;
    }
    this.options = o;
    this.theme = resolveTheme(o.theme);
    const anatomy = {};
    if (o.fringe !== void 0) anatomy.fringe = o.fringe;
    if (o.ears !== void 0) anatomy.ears = o.ears;
    this.g = typeof o.shape === "string" ? createGeometry(o.shape, anatomy) : createGeometry(o.shape?.shape ?? "v1", { ...o.shape ?? {}, ...anatomy });
    this.random = makeRandom(o.seed);
    this._beats = /* @__PURE__ */ new Set();
    this._listeners = {};
    this._spellQueue = null;
    this._traceQueue = null;
    this.s = this._freshState(o);
    if (this.s.accessories.length) this.wear(this.s.accessories);
  }
  _freshState(o) {
    return {
      /* Every drawing function takes its proportions from here. */
      g: this.g,
      // tunables
      scale: o.scale,
      bobAmt: o.bobAmt,
      breathAmt: o.breathAmt,
      tempo: o.tempo,
      blinkEvery: o.blinkEvery,
      autoLook: o.autoLook,
      showShadow: o.showShadow,
      showSparks: o.showSparks,
      showBlush: o.showBlush,
      showHands: o.showHands,
      showTrail: o.showTrail,
      faceLean: o.faceLean ?? 0,
      faceForm: o.faceForm ?? 0,
      profile: o.profile ?? false,
      t: 0,
      // orientation (radians, spring driven)
      yaw: 0,
      yawV: 0,
      yawTarget: 0,
      pitch: 0,
      pitchV: 0,
      pitchTarget: 0,
      roll: 0,
      rollV: 0,
      rollTarget: 0,
      // body
      offX: 0,
      offY: 0,
      offVX: 0,
      offVY: 0,
      squashX: 1,
      squashY: 1,
      squashVX: 0,
      squashVY: 0,
      hover: 0,
      // face
      blink: 0,
      blinkPhase: 0,
      blinkTimer: 2,
      look: { x: 0, y: 0 },
      talk: 0,
      expr: o.expression,
      prevExpr: o.expression,
      xfade: 1,
      hand: {
        l: { lift: 0, swing: 0, out: 0, show: 0, want: 0, holding: false, gripLift: 0.55, gripOut: 0.35 },
        r: { lift: 0, swing: 0, out: 0, show: 0, want: 0, holding: false, gripLift: 0.55, gripOut: 0.35 }
      },
      /* The egg. `crack` is the caller's — how far the fissure has spread, set
         directly, because a crack does not settle. `open` is the rig's, and a
         spring, because once the shell starts coming apart it is a physical
         object with weight. */
      egg: {
        on: false,
        seed: 1,
        crack: 0,
        open: 0,
        openV: 0,
        openTarget: 0,
        wobble: 0,
        t: 0,
        hatch: null,
        _path: null
      },
      sparkPop: 0,
      heldLetter: null,
      letterPop: 0,
      /* speech: a viseme timeline. `cur`→`next` blend continuously, which is
         what separates articulation from a flapping jaw. */
      speech: {
        active: false,
        cur: "rest",
        next: "rest",
        blend: 1,
        queue: [],
        hold: 0,
        blendFor: 0.055
      },
      particles: new Particles(this.random),
      trail: [],
      accessories: o.accessories ? Array.isArray(o.accessories) ? o.accessories : [o.accessories] : [],
      /* letter tracing: the character stands aside and watches a letter draw
         itself, stroke by stroke, in the order you'd write it. */
      trace: {
        ch: null,
        u: 0,
        t: 0,
        dur: 2.4,
        active: false,
        hold: 0,
        penX: 0,
        penY: 0,
        penUp: false
      },
      shiftX: 0,
      autoScale: 1,
      pointer: { x: 0, y: 0, inside: false },
      action: null,
      actionT: 0,
      idleTimer: 6
    };
  }
  /* ------------------------------------------------------------ public API */
  /** Set a facial expression, cross-fading from the current one. */
  express(name) {
    if (!EXPRESSIONS[name]) throw new Error(`Unknown expression "${name}". Available: ${EXPRESSION_NAMES.join(", ")}`);
    const S = this.s;
    if (name === S.expr) return this;
    S.prevExpr = S.expr;
    S.expr = name;
    S.xfade = 0;
    S.squashVX = 1.4;
    S.squashVY = -1.4;
    this._emit("expression", name);
    return this;
  }
  /** Play a special animation. Interrupts whatever is running. */
  react(name) {
    if (!ACTIONS[name]) throw new Error(`Unknown action "${name}". Available: ${ACTION_NAMES.join(", ")}`);
    const S = this.s;
    if (S.action) ACTIONS[S.action].end(this);
    this._beats.clear();
    S.action = name;
    S.actionT = 0;
    ACTIONS[name].start(this);
    this._emit("action:start", name);
    return this;
  }
  /** Point the head. Degrees. Disables cursor tracking. */
  face(yawDeg = 0, pitchDeg = 0) {
    this.s.autoLook = false;
    this.s.yawTarget = deg(yawDeg);
    this.s.pitchTarget = deg(pitchDeg);
    return this;
  }
  /**
   * Set the lesson phase — one call instead of a choreography.
   *
   *   buddy.phase('typing')
   *   buddy.phase('stuck',    { word: 'cat' })
   *   buddy.phase('teaching', { letter: 'g' })
   *
   * Idempotent: setting the same phase twice does nothing, so it is safe to
   * call from a render. Pass `{ force: true }` to replay it.
   */
  phase(name, opts = {}) {
    applyPhase(this, name, opts);
    return this;
  }
  /** The current phase name, or null if phases are not being used. */
  get currentPhase() {
    return this._phase ? this._phase.name : null;
  }
  /** Hold up a single letter card. */
  hold(ch) {
    const S = this.s;
    S.heldLetter = ch == null ? null : String(ch).slice(0, 1);
    if (S.heldLetter) {
      this._emit("hold", S.heldLetter);
      S.letterPop = 1;
      S.hand.r.lift = 0.8;
      S.hand.r.want = 1;
      S.squashVX = 2.2;
      S.squashVY = -2.2;
      this.express("proud");
    }
    return this;
  }
  /**
   * Spell a word: hold up each letter in turn, then celebrate.
   * Driven by the rig's own clock, so it stays in sync under any timestep
   * and can be exported frame-accurately.
   */
  spell(word, { interval = 0.48, speak = true, celebrate = true } = {}) {
    const w = [...String(word || "")].filter((c) => glyph(c)).join("");
    if (!w) return this;
    this._spellQueue = { letters: w.split(""), i: 0, next: 0, interval, speak, celebrate, said: [] };
    this.express("happy");
    this._emit("spell:start", w);
    return this;
  }
  /**
   * Trace a letter: show how it is formed, stroke by stroke.
   *
   * The character steps aside, watches the pen, and points. Stroke order and
   * direction come straight from the glyph geometry — the same coordinates
   * that draw the letter also describe how to write it.
   */
  trace(ch, { duration = 2.4, hold = 0.7 } = {}) {
    const c = String(ch || "").slice(0, 1);
    if (!glyph(c)) return this;
    const t = this.s.trace;
    t.ch = c;
    t.u = 0;
    t.t = 0;
    t.dur = duration;
    t.hold = hold;
    t.active = true;
    this.express("content");
    this.cue("trace:start", c);
    this._emit("trace:start", c);
    return this;
  }
  /** Trace every letter of a word in turn. */
  traceWord(word, { duration = 2, gap = 0.35 } = {}) {
    const w = [...String(word || "")].filter((c) => glyph(c));
    if (!w.length) return this;
    this._traceQueue = { letters: w, i: 0, duration, gap, wait: 0 };
    return this;
  }
  stopTrace() {
    this._traceQueue = null;
    const t = this.s.trace;
    if (!t.active) return this;
    t.active = false;
    t.ch = null;
    this.s.yawTarget = 0;
    this.s.pitchTarget = 0;
    return this;
  }
  get tracing() {
    return this.s.trace.active;
  }
  cancelSpell() {
    this._spellQueue = null;
    this.s.heldLetter = null;
    this.stopSpeaking();
    return this;
  }
  setTheme(theme) {
    this.theme = resolveTheme(theme);
    this._emit("theme", this.theme.name);
    return this;
  }
  /**
   * Change this character's BUILD — proportions, fringe, ears — after
   * construction.
   *
   * This exists because `applyShape` stopped working and nothing said so.
   * `applyShape` mutates the module-level `G`, and once geometry became
   * per-instance every character carried its own frozen copy and ignored it:
   * the switcher in the demo went on highlighting the button it had been
   * clicked on while the drawing never moved. The suite even asserts the new
   * behaviour — "a built character ignores the global applyShape" — which is
   * right, and is exactly why a caller needs this instead.
   *
   *   buddy.setShape('sprout')
   *   buddy.setShape('cuddle', { fringe: 'curtain', ears: 'flop' })
   */
  setShape(shape, anatomy = {}) {
    const name = typeof shape === "string" ? shape : shape?.shape ?? this.options.shape ?? "v1";
    const over = typeof shape === "string" ? {} : { ...shape ?? {} };
    delete over.shape;
    const keep = {};
    if (this.g.fringe !== void 0) keep.fringe = this.g.fringe;
    if (this.g.ears !== void 0) keep.ears = this.g.ears;
    this.g = createGeometry(name, { ...keep, ...over, ...anatomy });
    this.s.g = this.g;
    this.options.shape = name;
    this._emit("shape", name);
    return this;
  }
  /* ---------------------------------------------------------------- egg */
  /**
   * Put the character in an egg, or take it out of one.
   *
   *   buddy.egg(true)                    // closed, seeded from the character
   *   buddy.egg({ seed: 12, crack: 0.4 })
   *   buddy.egg(false)
   */
  egg(v = true) {
    const e = this.s.egg;
    if (v === false || v == null) {
      Object.assign(e, {
        on: false,
        crack: 0,
        open: 0,
        openV: 0,
        openTarget: 0,
        wobble: 0,
        hatch: null,
        _path: null,
        _done: false
      });
      return this;
    }
    const o = v === true ? {} : v;
    Object.assign(e, {
      on: true,
      seed: o.seed ?? this.options.seed ?? 1,
      crack: clamp(o.crack ?? 0, 0, 1),
      open: clamp(o.open ?? 0, 0, 1),
      openV: 0,
      openTarget: clamp(o.open ?? 0, 0, 1),
      wobble: 0,
      hatch: null,
      _done: false,
      /* Thrown away so the fissure is rebuilt for the new seed. It is cached
         because it is sampled geometry, not because it is expensive. */
      _path: null
    });
    return this;
  }
  /**
   * How far the fissure has spread, 0 to 1.
   *
   * Set directly rather than animated: a crack is exactly as far along as
   * whatever is driving it says — a tap, a right answer, a progress bar — and
   * that belongs to the caller, not to a spring in here. The wobble is the
   * rig's, because a shell that is struck rocks.
   */
  crack(k) {
    const e = this.s.egg;
    if (!e.on) this.egg(true);
    const next = clamp(k, 0, 1);
    if (next > e.crack) e.wobble = Math.min(1, e.wobble + 0.6);
    e.crack = next;
    return this;
  }
  /** Finish the crack if it is not finished, then open. Emits `hatched`. */
  hatch(duration = 1.8) {
    const e = this.s.egg;
    if (!e.on) this.egg(true);
    e.hatch = { t: 0, dur: Math.max(0.2, duration) };
    e._done = false;
    return this;
  }
  /** `closed` · `wobbling` · `cracked` · `opening`, or `null` if not in one. */
  get eggState() {
    return eggState(this.s.egg);
  }
  /** Become one of the cast: build, fringe, ears and palette in one call. */
  setCharacter(name) {
    const c = resolveCharacter(name);
    if (!c) return this;
    this.setShape(c.build, { fringe: c.fringe, ears: c.ears });
    this.setTheme(c.theme);
    this.options.character = name;
    this._emit("character", name);
    return this;
  }
  /* ------------------------------------------------------------- speech */
  /** Hold a single viseme. Pass `null` or 'rest' to close the mouth. */
  viseme(name) {
    const sp = this.s.speech;
    if (!name || name === "rest") return this.stopSpeaking();
    if (!VISEMES[name]) throw new Error(`Unknown viseme "${name}". Available: ${VISEME_NAMES.join(", ")}`);
    sp.active = true;
    sp.queue.length = 0;
    sp.cur = sp.next;
    sp.next = name;
    sp.blend = 0;
    sp.hold = Infinity;
    return this;
  }
  /**
   * Play an explicit viseme timeline.
   * @param {Array<string|[string, number]>} seq  names, or [name, seconds]
   */
  sayVisemes(seq, { dur = 0.09, tail = true } = {}) {
    const sp = this.s.speech;
    sp.queue = seq.map((v) => Array.isArray(v) ? { v: v[0], d: v[1] } : { v, d: dur });
    if (tail) sp.queue.push({ v: "rest", d: 0.12 });
    if (!sp.queue.length) return this.stopSpeaking();
    sp.active = true;
    sp.hold = 0;
    sp.blend = 1;
    this._emit("speech:start");
    return this;
  }
  /**
   * Speak a written word. Approximate — English spelling is not phonetic, and
   * lip-sync only needs plausible movement in the right rhythm. Use
   * `sayVisemes()` when you need exactness.
   */
  say(text, { rate = 1 } = {}) {
    return this.sayVisemes(wordToVisemes(text), { dur: 0.09 / rate });
  }
  /** Articulate letter NAMES — "bee", "see". Exact: there are only 26. */
  sayLetters(word, { rate = 1, gap = 0.09 } = {}) {
    const seq = [];
    for (const ch of String(word || "").toUpperCase().replace(/[^A-Z]/g, "")) {
      for (const v of lettersToVisemes(ch)) seq.push([v, 0.11 / rate]);
      seq.push(["rest", gap / rate]);
    }
    return this.sayVisemes(seq, { tail: false });
  }
  /** Close the mouth and drop any pending timeline. */
  stopSpeaking() {
    const sp = this.s.speech;
    sp.queue.length = 0;
    sp.cur = sp.next;
    sp.next = "rest";
    sp.blend = 0;
    sp.hold = 0.12;
    sp.closing = true;
    return this;
  }
  /**
   * Bind to a Web Speech utterance so the mouth follows real audio.
   * `boundary` fires per word in most engines; where it doesn't, the mouth
   * simply stays closed rather than desyncing.
   */
  attachSpeech(utterance) {
    utterance.addEventListener("boundary", (e) => {
      if (e.name && e.name !== "word") return;
      const word = String(utterance.text).slice(e.charIndex).split(/\s+/)[0];
      if (word) this.say(word, { rate: utterance.rate || 1 });
    });
    utterance.addEventListener("end", () => this.stopSpeaking());
    utterance.addEventListener("error", () => this.stopSpeaking());
    return utterance;
  }
  get speaking() {
    return this.s.speech.active;
  }
  /** Feed normalised pointer position (-1..1 on both axes). */
  pointer(x, y, inside = true) {
    const p = this.s.pointer;
    p.x = x;
    p.y = y;
    p.inside = inside;
    return this;
  }
  /** Manual turn, e.g. from a drag gesture. Radians, relative. */
  turnBy(dYaw, dPitch = 0) {
    this.s.autoLook = false;
    this.s.yawTarget += dYaw;
    this.s.pitchTarget = clamp(this.s.pitchTarget + dPitch, -0.55, 0.55);
    return this;
  }
  reset() {
    this.random.reseed(this.options.seed);
    this._beats.clear();
    this._spellQueue = null;
    this._traceQueue = null;
    this._phase = null;
    this._phaseSteady = null;
    this.s = this._freshState(this.options);
    return this;
  }
  on(evt, fn) {
    var _a;
    ((_a = this._listeners)[evt] || (_a[evt] = [])).push(fn);
    return this;
  }
  /** Remove one listener. Adapters need this to unsubscribe on dispose. */
  off(evt, fn) {
    const l = this._listeners[evt];
    if (l) {
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    }
    return this;
  }
  _emit(evt, arg) {
    (this._listeners[evt] || []).forEach((f) => f(arg));
  }
  get busy() {
    return this.s.action !== null || this._spellQueue !== null || this.s.trace.active || this._traceQueue !== null;
  }
  /**
   * Named audio cue. The rig makes no sound itself — it just says when
   * something worth hearing happened, so a host can attach audio without
   * reverse-engineering animation timings.
   */
  cue(name, detail) {
    this._emit("cue", { name, detail, t: this.s.t });
    return this;
  }
  get expression() {
    return this.s.expr;
  }
  get action() {
    return this.s.action;
  }
  get yawDeg() {
    return rad(this.s.yaw);
  }
  get pitchDeg() {
    return rad(this.s.pitch);
  }
  /* ------------------------------------------------- helpers used by actions */
  emit(type, n2, o = {}) {
    this.s.particles.emit(type, n2, { color: this.theme.confetti[this.random() * this.theme.confetti.length | 0], ...o });
  }
  once(at, fn, p) {
    if (p >= at && !this._beats.has(at)) {
      this._beats.add(at);
      fn();
    }
  }
  /** 0 → 1 → 0 envelope: ramps up by `inAt`, holds, ramps down after `outAt`. */
  ramp(p, inAt, outAt) {
    const up = clamp(p / inAt, 0, 1);
    const dn = 1 - clamp((p - outAt) / (1 - outAt), 0, 1);
    return up * up * (3 - 2 * up) * dn;
  }
  /* -------------------------------------------------------------- the loop */
  update(dt) {
    const S = this.s;
    dt = Math.min(dt, 1 / 20);
    S.t += dt * S.tempo;
    S.blinkTimer -= dt;
    if (S.blinkTimer <= 0) {
      S.blinkTimer = S.blinkEvery * (0.6 + this.random() * 0.8);
      S.blinkPhase = 1e-3;
    }
    if (S.blinkPhase > 0) {
      S.blinkPhase += dt / 0.16;
      if (S.blinkPhase >= 1) {
        S.blinkPhase = 0;
        S.blink = 0;
      } else S.blink = Math.sin(S.blinkPhase * Math.PI);
    }
    if (S.xfade < 1) S.xfade = clamp(S.xfade + dt / 0.16, 0, 1);
    [S.yaw, S.yawV] = spring(S.yaw, S.yawV, S.yawTarget, dt, 120, 14);
    [S.pitch, S.pitchV] = spring(S.pitch, S.pitchV, S.pitchTarget, dt, 150, 15);
    [S.roll, S.rollV] = spring(S.roll, S.rollV, S.rollTarget, dt, 150, 14);
    [S.squashX, S.squashVX] = spring(S.squashX, S.squashVX, 1, dt);
    [S.squashY, S.squashVY] = spring(S.squashY, S.squashVY, 1, dt);
    [S.offX, S.offVX] = spring(S.offX, S.offVX, 0, dt, 150, 13);
    [S.offY, S.offVY] = spring(S.offY, S.offVY, 0, dt, 150, 13);
    for (const k of ["l", "r"]) {
      const h = S.hand[k];
      if (h.holding) {
        h.want = 1;
        h.lift = h.gripLift;
        h.out = h.gripOut;
      }
      h.lift = approach(h.lift, 0, 0.02, dt);
      h.swing = approach(h.swing, 0, 0.02, dt);
      h.out = approach(h.out, 0, 0.02, dt);
      h.want = Math.max(0, h.want - dt * 2.2);
      h.show = approach(h.show, S.showHands ? 1 : clamp(h.want, 0, 1), 1e-7, dt);
    }
    if (S.egg.on) {
      const e = S.egg;
      e.t += dt;
      e.wobble = approach(e.wobble, 0, 0.02, dt);
      if (e.hatch) {
        e.hatch.t += dt;
        const p = clamp(e.hatch.t / e.hatch.dur, 0, 1);
        e.crack = Math.max(e.crack, clamp(p / 0.15, 0, 1));
        if (p > 0.15) e.openTarget = 1;
        if (p >= 1) e.hatch = null;
      }
      [e.open, e.openV] = spring(e.open, e.openV, e.openTarget, dt, 78, 12);
      if (e.open > 0.985 && !e._done) {
        e._done = true;
        this._emit("hatched");
      }
    }
    S.sparkPop = Math.max(0, S.sparkPop - dt * 2.2);
    S.talk = Math.max(0, S.talk - dt * 1.6);
    S.letterPop = Math.max(0, S.letterPop - dt * 3.2);
    S.hover = approach(S.hover, 0, 0.02, dt);
    const tx = S.pointer.inside ? clamp(S.pointer.x, -1, 1) : 0;
    const ty = S.pointer.inside ? clamp(S.pointer.y, -1, 1) : 0;
    S.look.x = approach(S.look.x, tx * 0.6, 1e-3, dt);
    S.look.y = approach(S.look.y, ty * 0.6, 1e-3, dt);
    if (S.autoLook && !S.action) {
      S.yawTarget = approach(S.yawTarget, tx * 0.42, 0.06, dt);
      S.pitchTarget = approach(S.pitchTarget, ty * 0.2, 0.06, dt);
    }
    const speed = Math.min(1, (Math.abs(S.offVX) + Math.abs(S.offVY)) / 420 + Math.abs(S.yawV) / 9);
    S.trail.push({
      x: S.offX,
      y: S.offY - (Math.sin(S.t * 1.9 * S.tempo) * 5 * S.bobAmt + S.hover),
      roll: S.roll,
      speed
    });
    if (S.trail.length > 7) S.trail.shift();
    S.particles.update(dt);
    this._tickTrace(dt);
    this._tickSpeech(dt);
    this._tickSpell(dt);
    this._tickAction(dt);
    this._tickIdle(dt);
  }
  _tickAction(dt) {
    const S = this.s;
    if (!S.action) return;
    const a = ACTIONS[S.action];
    S.actionT += dt;
    const p = S.actionT / a.dur;
    if (p >= 1) {
      const name = S.action;
      a.end(this);
      S.action = null;
      S.actionT = 0;
      this._beats.clear();
      this._emit("action:end", name);
      return;
    }
    a.tick(this, p, dt);
  }
  _tickTrace(dt) {
    const S = this.s, tr = S.trace;
    const q = this._traceQueue;
    if (q && !tr.active) {
      q.wait -= dt;
      if (q.wait <= 0) {
        if (q.i >= q.letters.length) {
          this._traceQueue = null;
          this._emit("traceWord:done");
        } else {
          q.wait = q.gap;
          this.trace(q.letters[q.i++], { duration: q.duration });
        }
      }
    }
    const want = tr.active ? G.trace.shift : 0;
    S.shiftX = approach(S.shiftX, want, 0.02, dt);
    S.autoScale = approach(S.autoScale, tr.active ? G.trace.scale : 1, 0.02, dt);
    if (!tr.active) return;
    tr.t += dt;
    const prevStroke = tr.stroke;
    tr.u = clamp(tr.t / tr.dur, 0, 1);
    const pen = penAt(tr.ch, tr.u);
    if (pen) {
      const b = glyphBounds(tr.ch);
      tr.penX = G.trace.x + (pen.x - (b.min + b.max) / 2) * G.trace.cap;
      tr.penY = G.trace.y + pen.y * G.trace.cap;
      tr.penUp = pen.penUp;
      if (pen.stroke !== prevStroke) {
        tr.stroke = pen.stroke;
        this.cue("trace:stroke", pen.stroke);
      }
      const dx = (tr.penX - S.shiftX) / 150, dy = tr.penY / 220;
      S.yawTarget = clamp(dx * 0.55, -0.7, 0.7);
      S.pitchTarget = clamp(dy * 0.45, -0.3, 0.35);
      S.look.x = clamp(dx, -1, 1);
      S.look.y = clamp(dy * 1.6, -1, 1);
      S.hand.r.want = 1;
      S.hand.r.lift = 0.42;
      S.hand.r.out = 0.55;
    }
    if (tr.u >= 1) {
      tr.hold -= dt;
      if (tr.hold <= 0) {
        tr.active = false;
        tr.ch = null;
        tr.stroke = void 0;
        S.yawTarget = 0;
        S.pitchTarget = 0;
        this.cue("trace:done");
        this._emit("trace:done");
        this.react("nod");
      }
    }
  }
  _tickSpeech(dt) {
    const sp = this.s.speech;
    if (!sp.active) return;
    if (sp.blend < 1) sp.blend = Math.min(1, sp.blend + dt / sp.blendFor);
    if (sp.hold === Infinity) return;
    sp.hold -= dt;
    if (sp.hold > 0) return;
    const nextSeg = sp.queue.shift();
    if (!nextSeg) {
      if (sp.closing || sp.next === "rest") {
        sp.active = false;
        sp.closing = false;
        this._emit("speech:end");
      } else this.stopSpeaking();
      return;
    }
    sp.cur = sp.next;
    sp.next = nextSeg.v;
    sp.blend = 0;
    sp.hold = nextSeg.d;
  }
  _tickSpell(dt) {
    const q = this._spellQueue;
    if (!q) return;
    q.next -= dt;
    if (q.next > 0) return;
    const S = this.s;
    if (q.i >= q.letters.length) {
      this._spellQueue = null;
      S.heldLetter = null;
      this._letterBurst(q.said);
      if (q.celebrate) this.react("correct");
      this._emit("spell:done");
      return;
    }
    const ch = q.letters[q.i++];
    S.heldLetter = ch;
    S.letterPop = 1;
    if (q.speak) this.sayLetters(ch, { rate: 0.48 / q.interval });
    q.said.push(ch);
    S.squashVX = 1.8;
    S.squashVY = -1.8;
    S.yawTarget = q.i % 2 ? -0.22 : 0.22;
    S.hand.r.want = 1;
    S.hand.r.lift = 0.8;
    this.cue("letter", ch);
    this._emit("spell:letter", ch);
    q.next = q.interval;
  }
  /**
   * Throw the finished word outward as a flourish.
   *
   * Fanned upward and outward from above the crown, never from the centre —
   * a glyph that starts on the face sits on top of the eyes and mouth for its
   * whole lifetime, because particles draw last.
   */
  _letterBurst(letters) {
    const n2 = letters.length;
    if (!n2) return;
    const half = Math.max(1, Math.floor((n2 - 1) / 2));
    letters.forEach((ch, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const mag = 0.62 + Math.floor(i / 2) / half * 0.48;
      const a = -Math.PI / 2 + side * mag;
      const sp = this.random.range(250, 330);
      this.s.particles.emit("letter", 1, {
        x: Math.cos(a) * 38,
        y: -108 + Math.sin(a) * 10,
        angle: a,
        spread: 0.08,
        spdMin: sp,
        spdMax: sp + 40,
        grav: 520,
        drag: 0.987,
        sizeMin: 11,
        sizeMax: 11,
        ttlMin: 1.05,
        ttlMax: 1.3,
        char: ch,
        color: this.theme.body
      });
    });
  }
  _tickIdle(dt) {
    if (!this.options.idleActions) return;
    const S = this.s;
    if (S.action || this._spellQueue) {
      S.idleTimer = this.random.range(...this.options.idleEvery);
      return;
    }
    S.idleTimer -= dt;
    if (S.idleTimer <= 0) {
      S.idleTimer = this.random.range(...this.options.idleEvery);
      const pool = ACTION_NAMES.filter((n2) => ACTIONS[n2].tags?.includes("idle"));
      this.react(pool[this.random() * pool.length | 0]);
    }
  }
  /**
   * Snap every spring to its target and freeze the idle oscillators.
   *
   * Exporters need a pose, not a moment: without this, a "yaw 45°" sprite
   * would capture whatever the spring happened to be doing, and the bob/breath
   * cycle would make two runs differ by a pixel.
   */
  settle() {
    const S = this.s;
    S.t = 0;
    S.yaw = S.yawTarget;
    S.yawV = 0;
    S.pitch = S.pitchTarget;
    S.pitchV = 0;
    S.roll = S.rollTarget;
    S.rollV = 0;
    S.offX = S.offY = S.offVX = S.offVY = 0;
    S.squashX = S.squashY = 1;
    S.squashVX = S.squashVY = 0;
    S.hover = 0;
    S.blink = 0;
    S.blinkPhase = 0;
    S.xfade = 1;
    S.trail.length = 0;
    S.speech.blend = 1;
    S.shiftX = S.trace.active ? G.trace.shift : 0;
    S.autoScale = S.trace.active ? G.trace.scale : 1;
    for (const k of ["l", "r"]) S.hand[k].show = S.showHands || S.hand[k].want > 0 ? 1 : 0;
    return this;
  }
  /** Draw the current frame onto any Surface. */
  render(surface) {
    render(surface, this.s, this.theme);
  }
  /**
   * Accessories worn on the head. Names, or `{ name, color }` objects.
   *
   *   buddy.wear('glasses')
   *   buddy.wear(['bow', { name: 'glasses', color: '#1478C9' }])
   *   buddy.wear(null)
   */
  wear(items) {
    this.s.accessories = items == null ? [] : Array.isArray(items) ? items : [items];
    for (const side of ["l", "r"]) this.s.hand[side].holding = false;
    for (const name of this.wearing) {
      const meta = ACCESSORY_META[name];
      if (!meta || meta.kind !== "held") continue;
      for (const [token, side] of [["hand.left", "l"], ["hand.right", "r"]]) {
        if (!meta.occupies.includes(token)) continue;
        const h = this.s.hand[side];
        h.holding = true;
        h.want = 1;
        h.gripLift = meta.grip?.lift ?? 0.55;
        h.gripOut = meta.grip?.out ?? 0.35;
        h.lift = h.gripLift;
        h.out = h.gripOut;
      }
    }
    return this;
  }
  get wearing() {
    return this.s.accessories.map((a) => typeof a === "string" ? a : a.name);
  }
  /**
   * Advance by a fixed timestep without rendering. Used by exporters to reach
   * a precise moment in an animation deterministically.
   */
  step(seconds, hz = 60) {
    const dt = 1 / hz;
    let left = seconds;
    while (left > 1e-9) {
      this.update(Math.min(dt, left));
      left -= dt;
    }
    return this;
  }
  static get visemes() {
    return VISEME_NAMES;
  }
  static get phases() {
    return PHASE_NAMES.slice();
  }
  static get accessories() {
    return ACCESSORY_NAMES.slice();
  }
  static get cast() {
    return CAST_NAMES.slice();
  }
  static get eggStates() {
    return EGG_STATES.slice();
  }
  static get glyphs() {
    return Object.keys(GLYPHS);
  }
  static get expressions() {
    return EXPRESSION_NAMES;
  }
  static get actions() {
    return ACTION_NAMES;
  }
  static get designSize() {
    return DESIGN;
  }
};

// src/core/surface-canvas.js
var CanvasSurface = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.kind = "canvas";
    this._grad = /* @__PURE__ */ new Map();
  }
  /** A colour string passes through; a paint descriptor becomes a gradient. */
  _paint(p) {
    if (!isGradient(p)) return p;
    const key = paintKey(p) + "|" + this.ctx.getTransform?.().toString();
    const hit = this._grad.get(key);
    if (hit) return hit;
    const g = p.type === "radial" ? this.ctx.createRadialGradient(p.fx ?? p.cx, p.fy ?? p.cy, 0, p.cx, p.cy, Math.max(1e-4, p.r)) : this.ctx.createLinearGradient(p.x0, p.y0, p.x1, p.y1);
    for (const [offset, colour] of p.stops) g.addColorStop(Math.min(1, Math.max(0, offset)), colour);
    if (this._grad.size > 256) this._grad.clear();
    this._grad.set(key, g);
    return g;
  }
  save() {
    this.ctx.save();
  }
  restore() {
    this.ctx.restore();
  }
  translate(x, y) {
    this.ctx.translate(x, y);
  }
  rotate(a) {
    this.ctx.rotate(a);
  }
  scale(sx, sy) {
    this.ctx.scale(sx, sy === void 0 ? sx : sy);
  }
  alpha(mult) {
    this.ctx.globalAlpha *= mult;
  }
  getAlpha() {
    return this.ctx.globalAlpha;
  }
  begin() {
    this.ctx.beginPath();
  }
  move(x, y) {
    this.ctx.moveTo(x, y);
  }
  line(x, y) {
    this.ctx.lineTo(x, y);
  }
  quad(cx, cy, x, y) {
    this.ctx.quadraticCurveTo(cx, cy, x, y);
  }
  cubic(c1x, c1y, c2x, c2y, x, y) {
    this.ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
  }
  arc(cx, cy, r, a0, a1, ccw) {
    this.ctx.arc(cx, cy, r, a0, a1, !!ccw);
  }
  rect(x, y, w, h) {
    this.ctx.rect(x, y, w, h);
  }
  close() {
    this.ctx.closePath();
  }
  ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2, ccw = false) {
    this.ctx.ellipse(cx, cy, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, a0, a1, !!ccw);
  }
  fill(color, evenOdd = false) {
    this.ctx.fillStyle = this._paint(color);
    this.ctx.fill(evenOdd ? "evenodd" : "nonzero");
  }
  stroke(color, width, cap = "round", join = "round") {
    this.ctx.strokeStyle = this._paint(color);
    this.ctx.lineWidth = width;
    this.ctx.lineCap = cap;
    this.ctx.lineJoin = join;
    this.ctx.stroke();
  }
  clip(evenOdd = false) {
    this.ctx.clip(evenOdd ? "evenodd" : "nonzero");
  }
  text(str, x, y, o = {}) {
    const weight = o.weight ?? 700;
    const size = o.size ?? 16;
    const family = o.family ?? "system-ui, -apple-system, sans-serif";
    this.ctx.font = `${weight} ${size}px ${family}`;
    this.ctx.textAlign = o.align ?? "center";
    this.ctx.textBaseline = o.baseline ?? "middle";
    this.ctx.fillStyle = o.color ?? "#000";
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
};

// src/adapters/mount.js
function mount(canvas, opts = {}) {
  if (typeof canvas === "string") canvas = document.querySelector(canvas);
  if (!canvas) throw new Error("mount(): canvas element not found");
  const buddy = opts.buddy instanceof Buddy ? opts.buddy : new Buddy(opts);
  const ctx = canvas.getContext("2d", { alpha: opts.alpha !== false });
  const surface = new CanvasSurface(ctx);
  let {
    size = null,
    // fixed CSS size; null = follow the element's box
    interactive = true,
    dragToTurn = true,
    clickToPop = true,
    autoStart = true,
    maxDPR = 3,
    respectReducedMotion = true,
    announce = true,
    announcements = {}
  } = opts;
  let mq = null, onMotion = null;
  if (respectReducedMotion && typeof matchMedia === "function") {
    mq = matchMedia("(prefers-reduced-motion: reduce)");
    const base2 = {
      bob: buddy.s.bobAmt,
      breath: buddy.s.breathAmt,
      tempo: buddy.s.tempo,
      trail: buddy.s.showTrail
    };
    onMotion = () => {
      const calm = mq.matches;
      buddy.s.bobAmt = calm ? 0 : base2.bob;
      buddy.s.breathAmt = calm ? base2.breath * 0.3 : base2.breath;
      buddy.s.tempo = calm ? base2.tempo * 0.8 : base2.tempo;
      buddy.s.showTrail = calm ? false : base2.trail;
    };
    mq.addEventListener?.("change", onMotion);
    onMotion();
  }
  let cssSize = size || 320;
  let raf = 0, last = 0, running = false;
  let disposed = false;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    if (!size) {
      const r = canvas.getBoundingClientRect();
      cssSize = Math.max(1, Math.min(r.width || 320, r.height || 320));
    } else {
      cssSize = size;
      canvas.style.width = cssSize + "px";
      canvas.style.height = cssSize + "px";
    }
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
  }
  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    const unit = cssSize / DESIGN * dpr;
    surface.clear();
    ctx.setTransform(unit, 0, 0, unit, canvas.width / 2, canvas.height / 2);
    buddy.render(surface);
  }
  function frame(now) {
    if (disposed) return;
    const dt = last ? (now - last) / 1e3 : 1 / 60;
    last = now;
    buddy.update(dt);
    paint();
    raf = rAF(frame);
  }
  const rAF = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
  const cAF = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : null;
  function start() {
    if (!running && !disposed && rAF) {
      running = true;
      last = 0;
      raf = rAF(frame);
    }
  }
  function stop() {
    running = false;
    if (raf && cAF) cAF(raf);
    raf = 0;
  }
  let drag = null;
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    buddy.pointer(
      ((e.clientX - r.left) / r.width - 0.5) * 2,
      ((e.clientY - r.top) / r.height - 0.5) * 2,
      true
    );
    if (drag && dragToTurn) {
      buddy.turnBy((e.clientX - drag.x) * 0.012, (e.clientY - drag.y) * 6e-3);
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  };
  const onLeave = () => buddy.pointer(0, 0, false);
  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    if (e.pointerType !== "mouse") e.preventDefault();
  };
  const onUp = (e) => {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    drag = null;
    if (clickToPop && moved < 5) buddy.react("pop");
  };
  if (interactive) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown, { passive: false });
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  }
  const addedAttrs = [];
  const setIfAbsent = (k, v) => {
    if (canvas.hasAttribute(k)) return;
    canvas.setAttribute(k, v);
    addedAttrs.push(k);
  };
  setIfAbsent("role", "img");
  if (!canvas.hasAttribute("aria-labelledby"))
    setIfAbsent("aria-label", announcements.label ?? "Spelling buddy");
  const SAY = {
    hold: (ch) => `Letter ${ch}`,
    spell: (w) => `Spelling ${[...w].join(", ")}`,
    trace: (ch) => `Showing how to write ${ch}`,
    correct: null,
    wrong: null,
    ...announcements
  };
  let live = null, offAnnounce = [];
  if (announce && typeof document !== "undefined") {
    live = announce instanceof Element ? announce : document.createElement("span");
    if (live !== announce) {
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      live.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";
      if (typeof canvas.after === "function") canvas.after(live);
      else canvas.parentNode?.insertBefore(live, canvas.nextSibling);
    }
    const speak = (t) => {
      if (t && live.textContent !== t) live.textContent = t;
    };
    const on = (evt, fn) => {
      buddy.on(evt, fn);
      offAnnounce.push([evt, fn]);
    };
    let spelling = false;
    on("spell:start", (w) => {
      spelling = true;
      speak(SAY.spell?.(w));
    });
    on("spell:done", () => {
      spelling = false;
    });
    on("hold", (ch) => {
      if (!spelling) speak(SAY.hold?.(ch));
    });
    on("trace:start", (ch) => speak(SAY.trace?.(ch)));
    on("action:start", (a) => {
      if ((a === "correct" || a === "wrong") && SAY[a]) speak(SAY[a]());
    });
  }
  const ro = typeof ResizeObserver !== "undefined" && !size ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  window.addEventListener("resize", resize);
  resize();
  paint();
  if (autoStart) start();
  return {
    buddy,
    canvas,
    start,
    stop,
    resize,
    paint,
    /** Change a fixed size after mount (pass null to follow the element box). */
    setSize(next) {
      size = next;
      resize();
      paint();
    },
    /** The live region, if one was created — so a host can read or reuse it. */
    live,
    dispose() {
      disposed = true;
      stop();
      for (const [evt, fn] of offAnnounce) buddy.off?.(evt, fn);
      for (const k of addedAttrs) canvas.removeAttribute(k);
      if (live && live !== announce) live.remove?.();
      ro?.disconnect();
      mq?.removeEventListener?.("change", onMotion);
      window.removeEventListener("resize", resize);
      if (interactive) {
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
      }
    }
  };
}

// src/adapters/webcomponent.js
var _Element = null;
function getSpellingBuddyElement() {
  var _a;
  if (_Element) return _Element;
  if (typeof HTMLElement === "undefined")
    throw new Error("<spelling-buddy> requires a DOM. Import it only in the browser.");
  _Element = (_a = class extends HTMLElement {
    connectedCallback() {
      if (this._handle) return;
      const shadow = this.attachShadow({ mode: "open" });
      const size = Number(this.getAttribute("size")) || 240;
      shadow.innerHTML = `<style>
        :host{display:inline-block;line-height:0}
        canvas{display:block;touch-action:none}
      </style><canvas></canvas>`;
      const canvas = shadow.querySelector("canvas");
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      this._handle = mount(canvas, {
        theme: this.getAttribute("theme") || "ink",
        size,
        interactive: this.getAttribute("interactive") !== "false",
        idleActions: this.hasAttribute("idle"),
        expression: this.getAttribute("expression") || "happy"
      });
      const b = this._handle.buddy;
      b.on("action:end", (n2) => this.dispatchEvent(new CustomEvent("actionend", { detail: n2 })));
      b.on("spell:done", () => this.dispatchEvent(new CustomEvent("spelldone")));
      b.on("cue", (c) => this.dispatchEvent(new CustomEvent("cue", { detail: c })));
      b.on("trace:done", () => this.dispatchEvent(new CustomEvent("tracedone")));
      const p = this.getAttribute("phase");
      if (p) b.phase(p, {
        word: this.getAttribute("word") ?? void 0,
        letter: this.getAttribute("letter") ?? void 0
      });
      const a = this.getAttribute("action");
      if (a) b.react(a);
      const sp = this.getAttribute("spell");
      if (sp) b.spell(sp);
    }
    disconnectedCallback() {
      this._handle?.dispose();
      this._handle = null;
    }
    attributeChangedCallback(name, _old, val) {
      const b = this._handle?.buddy;
      if (!b || val == null) return;
      if (name === "theme") b.setTheme(val);
      if (name === "phase" || name === "word" || name === "letter" || name === "nonce") {
        const phase = this.getAttribute("phase");
        if (phase) b.phase(phase, {
          word: this.getAttribute("word") ?? void 0,
          letter: this.getAttribute("letter") ?? void 0,
          nonce: this.getAttribute("nonce") ?? void 0
        });
      }
      if (name === "expression") b.express(val);
      if (name === "action") b.react(val);
      if (name === "spell") b.spell(val);
      if (name === "size") {
        const n2 = Number(val) || 240;
        const c = this.shadowRoot.querySelector("canvas");
        c.style.width = n2 + "px";
        c.style.height = n2 + "px";
        this._handle.setSize(n2);
      }
    }
    get buddy() {
      return this._handle?.buddy ?? null;
    }
    express(n2) {
      this.buddy?.express(n2);
      return this;
    }
    react(n2) {
      this.buddy?.react(n2);
      return this;
    }
    spell(w, o) {
      this.buddy?.spell(w, o);
      return this;
    }
    hold(c) {
      this.buddy?.hold(c);
      return this;
    }
    face(y, p) {
      this.buddy?.face(y, p);
      return this;
    }
    say(t, o) {
      this.buddy?.say(t, o);
      return this;
    }
    sayLetters(w, o) {
      this.buddy?.sayLetters(w, o);
      return this;
    }
    viseme(v) {
      this.buddy?.viseme(v);
      return this;
    }
    trace(c, o) {
      this.buddy?.trace(c, o);
      return this;
    }
  }, __publicField(_a, "observedAttributes", [
    "theme",
    "size",
    "phase",
    "word",
    "letter",
    "nonce",
    "expression",
    "action",
    "spell",
    "interactive",
    "idle"
  ]), _a);
  return _Element;
}
function defineSpellingBuddy(tag = "spelling-buddy") {
  if (typeof customElements === "undefined") return null;
  if (!customElements.get(tag)) customElements.define(tag, getSpellingBuddyElement());
  return tag;
}

// src/core/surface-svg.js
var IDENT = [1, 0, 0, 1, 0, 0];
var mul = (m, n2) => [
  m[0] * n2[0] + m[2] * n2[1],
  m[1] * n2[0] + m[3] * n2[1],
  m[0] * n2[2] + m[2] * n2[3],
  m[1] * n2[2] + m[3] * n2[3],
  m[0] * n2[4] + m[2] * n2[5] + m[4],
  m[1] * n2[4] + m[3] * n2[5] + m[5]
];
var mTranslate = (x, y) => [1, 0, 0, 1, x, y];
var mScale = (x, y) => [x, 0, 0, y, 0, 0];
var mRotate = (a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, s, -s, c, 0, 0];
};
var n = (v) => Math.abs(v) < 1e-6 ? 0 : +v.toFixed(3);
var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function arcToCubics(out, cx, cy, rx, ry, rot, a0, a1, ccw) {
  let delta = a1 - a0;
  if (ccw) {
    if (delta > 0) delta -= Math.PI * 2;
  } else {
    if (delta < 0) delta += Math.PI * 2;
  }
  if (Math.abs(delta) > Math.PI * 2) delta = Math.sign(delta) * Math.PI * 2;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const at = (t2) => {
    const x = rx * Math.cos(t2), y = ry * Math.sin(t2);
    return [cx + x * cosR - y * sinR, cy + x * sinR + y * cosR];
  };
  const dAt = (t2) => {
    const x = -rx * Math.sin(t2), y = ry * Math.cos(t2);
    return [x * cosR - y * sinR, x * sinR + y * cosR];
  };
  const segs = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segs;
  const k = 4 / 3 * Math.tan(step / 4);
  let t = a0;
  const start = at(t);
  out.start = out.start || start;
  if (out.needMove) {
    out.d.push(`M${n(start[0])} ${n(start[1])}`);
    out.needMove = false;
  } else {
    out.d.push(`L${n(start[0])} ${n(start[1])}`);
  }
  for (let i = 0; i < segs; i++) {
    const t0 = t, t1 = t + step;
    const p0 = at(t0), p1 = at(t1);
    const d0 = dAt(t0), d1 = dAt(t1);
    out.d.push(
      `C${n(p0[0] + k * d0[0])} ${n(p0[1] + k * d0[1])} ${n(p1[0] - k * d1[0])} ${n(p1[1] - k * d1[1])} ${n(p1[0])} ${n(p1[1])}`
    );
    t = t1;
  }
  out.cur = at(t);
}
var SVGSurface = class {
  /**
   * `idPrefix` namespaces every id this document generates.
   *
   * Clip and gradient ids are handed out per document — `bc1`, `bg0` — which
   * is fine for a file opened on its own and wrong the moment two of them are
   * inlined into one page: the second document's `bc1` wins, and half of the
   * first one clips to the wrong shape. That is not hypothetical; it is what
   * happened to the contact sheets, where accessories vanished because every
   * cell resolved to the first cell's clip.
   *
   * Empty by default, so a single document is unchanged.
   */
  constructor({
    width = 320,
    height = 320,
    originCentre = true,
    background = null,
    idPrefix = ""
  } = {}) {
    this.kind = "svg";
    this.width = width;
    this.height = height;
    this.background = background;
    this.idPrefix = idPrefix;
    this._clipCache = /* @__PURE__ */ new Map();
    this.body = [];
    this.defs = [];
    this._clipId = 0;
    this._grads = /* @__PURE__ */ new Map();
    this.state = { m: originCentre ? mTranslate(width / 2, height / 2) : IDENT.slice(), a: 1 };
    this.stack = [];
    this._openGroups = 0;
    this._resetPath();
  }
  _resetPath() {
    this._p = { d: [], needMove: true, cur: null, start: null };
  }
  get _m() {
    return this.state.m;
  }
  save() {
    this.stack.push({ m: this.state.m.slice(), a: this.state.a, groups: this._openGroups });
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    while (this._openGroups > s.groups) {
      this.body.push("</g>");
      this._openGroups--;
    }
    this.state = { m: s.m, a: s.a };
  }
  translate(x, y) {
    this.state.m = mul(this.state.m, mTranslate(x, y));
  }
  rotate(a) {
    this.state.m = mul(this.state.m, mRotate(a));
  }
  scale(sx, sy) {
    this.state.m = mul(this.state.m, mScale(sx, sy === void 0 ? sx : sy));
  }
  alpha(mult) {
    this.state.a *= mult;
  }
  getAlpha() {
    return this.state.a;
  }
  begin() {
    this._resetPath();
  }
  move(x, y) {
    this._p.d.push(`M${n(x)} ${n(y)}`);
    this._p.needMove = false;
    this._p.cur = [x, y];
  }
  line(x, y) {
    if (this._p.needMove) this.move(x, y);
    else {
      this._p.d.push(`L${n(x)} ${n(y)}`);
      this._p.cur = [x, y];
    }
  }
  quad(cx, cy, x, y) {
    if (this._p.needMove) this.move(x, y);
    this._p.d.push(`Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`);
    this._p.cur = [x, y];
  }
  cubic(a, b, c, d, x, y) {
    if (this._p.needMove) this.move(x, y);
    this._p.d.push(`C${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(x)} ${n(y)}`);
    this._p.cur = [x, y];
  }
  close() {
    this._p.d.push("Z");
  }
  arc(cx, cy, r, a0, a1, ccw) {
    arcToCubics(this._p, cx, cy, r, r, 0, a0, a1, !!ccw);
  }
  ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2, ccw = false) {
    arcToCubics(this._p, cx, cy, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, a0, a1, !!ccw);
  }
  rect(x, y, w, h) {
    this._p.d.push(`M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`);
    this._p.needMove = false;
  }
  _attrs(extra = "") {
    const m = this._m;
    const t = `matrix(${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4])} ${n(m[5])})`;
    return ` transform="${t}"${extra}`;
  }
  /**
   * Resolve a paint to something an SVG attribute accepts.
   *
   * `gradientUnits="userSpaceOnUse"` with no gradientTransform: the element
   * referencing it already carries the absolute matrix, so the gradient's
   * coordinates land in exactly the space the path was authored in — which is
   * what makes it agree with the canvas backend.
   */
  _paint(p) {
    if (!isGradient(p)) return p;
    const key = paintKey(p);
    const hit = this._grads.get(key);
    if (hit) return `url(#${hit})`;
    const id = `${this.idPrefix}bg${this._grads.size}`;
    const stops = p.stops.map(([o, c]) => `<stop offset="${n(Math.min(1, Math.max(0, o)))}" stop-color="${c}"/>`).join("");
    this.defs.push(p.type === "radial" ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(Math.max(1e-4, p.r))}" fx="${n(p.fx ?? p.cx)}" fy="${n(p.fy ?? p.cy)}">${stops}</radialGradient>` : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(p.x0)}" y1="${n(p.y0)}" x2="${n(p.x1)}" y2="${n(p.y1)}">${stops}</linearGradient>`);
    this._grads.set(key, id);
    return `url(#${id})`;
  }
  fill(color, evenOdd = false) {
    if (!this._p.d.length) return;
    color = this._paint(color);
    const op = this.state.a < 0.999 ? ` fill-opacity="${n(this.state.a)}"` : "";
    const fr = evenOdd ? ' fill-rule="evenodd"' : "";
    this.body.push(`<path d="${this._p.d.join("")}" fill="${color}"${fr}${op}${this._attrs()}/>`);
  }
  stroke(color, width, cap = "round", join = "round") {
    if (!this._p.d.length) return;
    color = this._paint(color);
    const op = this.state.a < 0.999 ? ` stroke-opacity="${n(this.state.a)}"` : "";
    this.body.push(
      `<path d="${this._p.d.join("")}" fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${op}${this._attrs()}/>`
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
    const t = `matrix(${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4])} ${n(m[5])})`;
    const d = this._p.d.join("");
    const key = d + "|" + t;
    let id = this._clipCache.get(key);
    if (!id) {
      id = `${this.idPrefix}bc${++this._clipId}`;
      this._clipCache.set(key, id);
      this.defs.push(`<clipPath id="${id}"><path d="${d}" transform="${t}"/></clipPath>`);
    }
    this.body.push(`<g clip-path="url(#${id})">`);
    this._openGroups++;
  }
  text(str, x, y, o = {}) {
    const weight = o.weight ?? 700;
    const size = o.size ?? 16;
    const family = o.family ?? "system-ui, -apple-system, sans-serif";
    const anchor = { left: "start", center: "middle", right: "end" }[o.align ?? "center"];
    const dom = { top: "hanging", middle: "central", alphabetic: "auto", bottom: "text-top" }[o.baseline ?? "middle"] || "central";
    const op = this.state.a < 0.999 ? ` fill-opacity="${n(this.state.a)}"` : "";
    this.body.push(
      `<text x="${n(x)}" y="${n(y)}" fill="${o.color ?? "#000"}" font-family="${family}" font-size="${n(size)}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="${dom}"${op}${this._attrs()}>${esc(str)}</text>`
    );
  }
  clear() {
    this.body.length = 0;
    this.defs.length = 0;
    this._openGroups = 0;
    this.stack.length = 0;
  }
  /** Serialise to a complete standalone SVG document. */
  toString() {
    const tail = "</g>".repeat(this._openGroups);
    const bg = this.background ? `<rect width="${this.width}" height="${this.height}" fill="${this.background}"/>` : "";
    const defs = this.defs.length ? `<defs>${this.defs.join("")}</defs>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">${defs}${bg}${this.body.join("")}${tail}</svg>`;
  }
};

// src/export/svg.js
function toSVG(buddy, {
  width = DESIGN,
  height = DESIGN,
  background = null,
  padding = 0,
  idPrefix = ""
} = {}) {
  const s = new SVGSurface({ width, height, originCentre: true, background, idPrefix });
  const k = Math.min(width, height) / DESIGN * (1 - padding);
  s.scale(k, k);
  buddy.render(s);
  return s.toString();
}
function poseSVG(pose = {}, opts = {}) {
  const b = new Buddy({
    theme: opts.theme ?? "ink",
    /* Which build to pose. Per instance, so a sheet can hold two of them. */
    shape: opts.shape ?? "v1",
    seed: opts.seed ?? 1,
    expression: pose.expression ?? "happy",
    showHands: pose.hands === true,
    showTrail: false,
    autoLook: false
  });
  b.face(pose.yaw ?? 0, pose.pitch ?? 0);
  if (pose.roll) b.s.rollTarget = pose.roll * Math.PI / 180;
  if (pose.letter) {
    b.hold(pose.letter);
  }
  if (pose.hands === "l" || pose.hands === "r") b.s.hand[pose.hands].want = 1;
  if (pose.handLift) b.s.hand[pose.hands === "l" ? "l" : "r"].lift = pose.handLift;
  if (pose.handOut) b.s.hand[pose.hands === "l" ? "l" : "r"].out = pose.handOut;
  if (pose.expression) {
    b.s.expr = b.s.prevExpr = pose.expression;
  }
  b.settle();
  return toSVG(b, opts);
}
function idPrefixFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 5) + "-";
}
function turnaroundSVGs({ steps = 8, expression = "happy", ...opts } = {}) {
  return Array.from({ length: steps }, (_, i) => {
    const yaw = 360 / steps * i;
    const name = `turn-${Math.round(yaw)}`;
    return { name, yaw, svg: poseSVG({ expression, yaw }, { idPrefix: idPrefixFor(name), ...opts }) };
  });
}
function expressionSVGs(opts = {}) {
  return Buddy.expressions.map((name) => ({
    name: `expr-${name}`,
    expression: name,
    svg: poseSVG({ expression: name }, { idPrefix: idPrefixFor(`expr-${name}`), ...opts })
  }));
}
function sheetSVG(poses, {
  cols = 4,
  cell = 200,
  gap = 8,
  theme = "ink",
  label = true,
  background = "#FFFFFF",
  labelColor = "#5F667E"
} = {}) {
  const rows = Math.ceil(poses.length / cols);
  const labelH = label ? 26 : 0;
  const W = cols * cell + gap * (cols + 1);
  const H = rows * (cell + labelH) + gap * (rows + 1);
  const parts = poses.map((p, i) => {
    const cx = gap + i % cols * (cell + gap);
    const cy = gap + Math.floor(i / cols) * (cell + labelH + gap);
    const inner = poseSVG(p, { theme, width: cell, height: cell, padding: 0.12 });
    const body = inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const text = label ? `<text x="${cx + cell / 2}" y="${cy + cell + 15}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="${labelColor}">${p.label ?? p.expression ?? ""}</text>` : "";
    return `<g transform="translate(${cx} ${cy})">${body}</g>${text}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${background}"/>${parts.join("")}</svg>`;
}
function alphabetSVG({
  rows = [
    "ABCDEFGHIJKLM",
    "NOPQRSTUVWXYZ",
    "abcdefghijklm",
    "nopqrstuvwxyz",
    "0123456789",
    "'-.?!"
  ],
  cap = 78,
  cellW = 96,
  rowH = 150,
  pad = 24,
  ink = "#16161A",
  rule = "#4A90D9",
  background = "#FFFFFF"
} = {}) {
  const cols = Math.max(...rows.map((r) => [...r].length));
  const W = cols * cellW + pad * 2;
  const H = rows.length * rowH + pad * 2;
  const s = new SVGSurface({ width: W, height: H, originCentre: false, background });
  rows.forEach((row, r) => {
    const y0 = pad + r * rowH + rowH / 2;
    const chars = [...row];
    const deep = chars.some((c) => glyphBounds(c).bottom > METRICS.baseline + 1e-6);
    const guides = [[METRICS.cap, 0.22], [METRICS.xLine, 0.12], [METRICS.baseline, 0.5]];
    if (deep) guides.push([METRICS.descender, 0.12]);
    for (const [u, a] of guides) {
      s.save();
      s.alpha(a);
      s.begin();
      s.move(pad, y0 + u * cap);
      s.line(W - pad, y0 + u * cap);
      s.stroke(rule, 1);
      s.restore();
    }
    chars.forEach((ch, i) => {
      s.save();
      s.translate(pad + i * cellW + cellW / 2, y0);
      drawGlyph(s, ch, cap, ink, 0.145, true, "baseline");
      s.restore();
    });
  });
  return s.toString();
}
export {
  ACCESSORIES,
  ACCESSORY_META,
  ACCESSORY_NAMES,
  ACTIONS,
  ACTION_NAMES,
  AXES,
  BUILD_NAMES,
  Buddy,
  CAST,
  CAST_NAMES,
  CanvasSurface,
  DEFAULT_THEME,
  DESIGN,
  EARS,
  EAR_NAMES,
  EGG_STATES,
  EXPRESSIONS,
  EXPRESSION_NAMES,
  FRINGES,
  FRINGE_NAMES,
  G,
  GLYPHS,
  GLYPH_CHARS,
  LETTER_VISEMES,
  METRICS,
  OCCUPANCY,
  PASSES2 as PASSES,
  PHASES,
  PHASE_NAMES,
  ROLES,
  SHAPES,
  SHELL,
  SVGSurface,
  TAU,
  THEMES,
  TOKENS,
  VISEMES,
  VISEME_NAMES,
  VISIBILITY,
  alphabetSVG,
  applyPhase,
  applyShape,
  approach,
  blendViseme,
  checkLoadout,
  clamp,
  conflictsWith,
  crackPath,
  createGeometry,
  darken,
  defineProp,
  defineSpellingBuddy,
  deg,
  distance,
  drawAccessories,
  drawEgg,
  drawGlyph,
  drawTrace,
  drawViseme,
  drawWord,
  eggState,
  expressionSVGs,
  faceProject,
  flattenGlyph,
  formLight,
  getProp,
  getSpellingBuddyElement,
  glyph,
  glyphBounds,
  glyphPath,
  glyphWidth,
  idPrefixFor,
  identifyTrace,
  isGradient,
  lerp,
  lettersToVisemes,
  lidTransform,
  lighten,
  makeRandom,
  mix,
  mount,
  paintKey,
  palette,
  penAt,
  poseSVG,
  project,
  propConflicts,
  propIds,
  rad,
  render,
  resolveCharacter,
  resolveTheme,
  revealByLength,
  scoreTrace,
  shadeFor,
  sheen,
  sheetSVG,
  shellHalves,
  smooth,
  spring,
  toSVG,
  tooClose,
  turnaroundSVGs,
  vertical,
  wordToVisemes
};
