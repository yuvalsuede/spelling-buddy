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
function formLight(r, { lit = 0.13, dark = 0.26, cx = -0.34, cy = -0.4 } = {}) {
  return {
    type: "radial",
    cx: cx * r,
    cy: cy * r,
    r: r * 1.62,
    stops: [
      [0, `rgba(255,255,255,${lit})`],
      [0.42, "rgba(255,255,255,0)"],
      [1, `rgba(0,0,0,${dark})`]
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
  /** Inverted: a pale character with ink features. */
  snow: skin("snow", "#EEF1F7", {
    face: "#FFFFFF",
    feature: TOKENS.ink,
    hand: "#E1E6F0",
    spark: TOKENS.blue,
    blush: "rgba(240,150,165,0.60)"
  })
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
  // eye arc radius
  eyeW: 12,
  // eye stroke weight
  mouthDY: 31,
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
function project(sx, sy, R2, yaw, pitch, useWrap = true) {
  const lon = Math.asin(clamp(sx / R2, -1, 1)) + yaw;
  const lat = Math.asin(clamp(sy / R2, -1, 1)) + pitch;
  const cl = Math.cos(lat);
  const wx = useWrap ? 1 - WRAP_X * Math.abs(Math.sin(yaw)) : 1;
  const wy = useWrap ? 1 - WRAP_Y * Math.abs(Math.sin(pitch)) : 1;
  return {
    x: R2 * Math.sin(lon) * cl * wx,
    y: R2 * Math.sin(lat) * wy,
    z: R2 * Math.cos(lon) * cl,
    fx: Math.cos(lon),
    fy: Math.cos(lat)
  };
}
function faceProject(sx, sy, yaw, pitch) {
  const aW = project(0, G.faceCY, G.Rf, yaw, pitch, true);
  const a0 = project(0, G.faceCY, G.Rf, yaw, pitch, false);
  const q = project(sx, sy, G.Rf, yaw, pitch, false);
  return { x: q.x + (aW.x - a0.x), y: q.y + (aW.y - a0.y), z: q.z, fx: q.fx, fy: q.fy };
}
function silhouettePath(s, rx = G.R, ry = G.RY, ox = 0, oy = 0) {
  s.begin();
  silhouetteSub(s, rx, ry, ox, oy);
}
function silhouetteSub(s, rx = G.R, ry = G.RY, ox = 0, oy = 0) {
  const t = G.blob;
  if (t <= 0) {
    s.ellipse(ox, oy, rx, ry);
    return;
  }
  const top = 1 - 0.3 * t;
  const low = G.blobLow * t;
  const base2 = 1 - 0.18 * t;
  const yw = oy + ry * low;
  s.move(ox, oy - ry);
  s.cubic(ox + rx * 0.62 * top, oy - ry, ox + rx, oy - ry * 0.42, ox + rx, yw);
  s.cubic(ox + rx, oy + ry * 0.7, ox + rx * base2 * 0.66, oy + ry, ox, oy + ry);
  s.cubic(ox - rx * base2 * 0.66, oy + ry, ox - rx, oy + ry * 0.7, ox - rx, yw);
  s.cubic(ox - rx, oy - ry * 0.42, ox - rx * 0.62 * top, oy - ry, ox, oy - ry);
  s.close();
}
var TURN_BULGE = 15;
function headRegion(s, S, k = 1) {
  const sy = Math.sin(S.yaw);
  const bulge = Math.abs(sy) * TURN_BULGE;
  s.begin();
  silhouetteSub(s, G.R * k, G.RY * k);
  if (bulge > 0.6) {
    silhouetteSub(
      s,
      G.R * 0.93 * k,
      G.RY * 0.95 * k,
      -Math.sign(sy) * bulge * 0.85,
      2 - S.pitch * 10
    );
  }
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
  const { yaw, pitch } = S;
  const lx = S.look.x * 4.5, ly = S.look.y * 3.5;
  const hole = faceProject(0, G.faceCY, yaw, pitch);
  const n2 = project(0, G.faceCY, G.Rf, yaw, pitch, false);
  const fore = Math.abs(n2.z) / G.Rf;
  const eL = faceProject(-G.eyeDX, G.faceCY + G.eyeDY, yaw, pitch);
  const eR = faceProject(G.eyeDX, G.faceCY + G.eyeDY, yaw, pitch);
  const mo = faceProject(0, G.faceCY + G.mouthDY, yaw, pitch);
  const vis = smooth(0.13, 0.28, hole.z / G.Rf);
  const eye = (p, dx, dy) => ({
    x: p.x + dx,
    y: p.y + dy,
    fx: Math.max(0.2, Math.abs(p.fx)),
    fy: Math.abs(p.fy),
    a: smooth(-0.05, 0.22, p.z / G.Rf)
  });
  return {
    vis,
    hole: {
      x: hole.x,
      y: hole.y,
      /* rx runs ALONG the outward direction and carries all the foreshortening;
               ry runs across it and never shortens, because a hole turning away gets
               narrower, not smaller.
      
               Floored, not free: left to the projection the patch keeps narrowing to
               a hairline, and the last few degrees before profile are a pale scratch
               rather than a face. Held at a legible width, it fades out as a small
               lens instead — which is what the fade is for. */
      rx: G.faceRX * Math.max(0.24, Math.abs(hole.fx)),
      ry: G.faceRY * Math.max(0.04, Math.abs(hole.fy)),
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
var pArcUp = (s, T2) => {
  s.begin();
  s.arc(0, 0, G.eyeR, Math.PI * 1.02, Math.PI * 1.98);
  s.stroke(T2.feature, G.eyeW);
};
var pDot = (s, T2, rx = G.eyeR * 0.58, ry = G.eyeR * 0.72) => {
  s.begin();
  s.ellipse(0, 0, rx, ry);
  s.fill(T2.feature);
  if (T2.gloss) {
    s.begin();
    s.ellipse(-rx * 0.34, -ry * 0.38, rx * 0.3, ry * 0.26);
    s.fill(T2.gloss);
    s.begin();
    s.ellipse(rx * 0.3, ry * 0.3, rx * 0.16, ry * 0.14);
    s.fill(T2.gloss);
  }
};
var pWink = (s, T2, flip) => {
  const r = G.eyeR * 0.62;
  s.save();
  s.scale(flip ? -1 : 1, 1);
  s.begin();
  s.move(-r, -r * 1.3);
  s.line(r * 0.85, 0);
  s.line(-r, r * 1.3);
  s.stroke(T2.feature, G.eyeW * 0.85);
  s.restore();
};
var pStar = (s, T2, r = G.eyeR) => {
  s.begin();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.44 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.close();
  s.fill(T2.feature);
};
var pSpiral = (s, T2, spin) => {
  s.begin();
  for (let i = 0; i <= 56; i++) {
    const t = i / 56, a = t * Math.PI * 4 + spin, r = t * G.eyeR * 0.9;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.line(x, y) : s.move(x, y);
  }
  s.stroke(T2.feature, 3.8);
};
var pLid = (s, T2) => {
  const r = G.eyeR;
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
    withEye(s, F.eyeL, S.blink, (x) => pDot(x, T2));
    withEye(s, F.eyeR, S.blink, (x) => pDot(x, T2));
    mouth(s, T2, F, S, 30, Math.max(S.talk, 0.55), "smile");
  },
  excited(s, T2, F, S) {
    withEye(s, F.eyeL, 0, (x) => pWink(x, T2, false));
    withEye(s, F.eyeR, 0, (x) => pWink(x, T2, true));
    mouth(s, T2, F, S, 30, Math.max(S.talk, 0.85), "grin");
  },
  thinking(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => {
      x.translate(-2.5, -5);
      pDot(x, T2, G.eyeR * 0.5, G.eyeR * 0.62);
    });
    withEye(s, F.eyeR, S.blink, (x) => {
      x.translate(-2.5, -5);
      pDot(x, T2, G.eyeR * 0.5, G.eyeR * 0.62);
    });
    brow(s, T2, F.eyeL, -2, -28, -0.07);
    brow(s, T2, F.eyeR, 0, -31, -0.13);
    mouth(s, T2, F, S, 22, Math.max(S.talk, 0.45), "wave");
  },
  surprised(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pDot(x, T2, G.eyeR * 0.68, G.eyeR * 0.84));
    withEye(s, F.eyeR, S.blink, (x) => pDot(x, T2, G.eyeR * 0.68, G.eyeR * 0.84));
    brow(s, T2, F.eyeL, 0, -28, -0.1, 12);
    brow(s, T2, F.eyeR, 0, -28, 0.1, 12);
    mouth(s, T2, F, S, 22, Math.max(S.talk, 0.9), "o");
  },
  proud(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink * 0.4, (x) => pStar(x, T2));
    withEye(s, F.eyeR, S.blink * 0.4, (x) => pStar(x, T2));
    mouth(s, T2, F, S, 34, Math.max(S.talk, 0.7), "grin");
  },
  sleepy(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pLid(x, T2));
    withEye(s, F.eyeR, S.blink, (x) => pLid(x, T2));
    mouth(s, T2, F, S, 16, 0.42, "o");
  },
  confused(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pDot(x, T2, G.eyeR * 0.42, G.eyeR * 0.52));
    withEye(s, F.eyeR, S.blink, (x) => pDot(x, T2, G.eyeR * 0.66, G.eyeR * 0.82));
    brow(s, T2, F.eyeL, 0, -21, 0.2, 11);
    brow(s, T2, F.eyeR, 0, -31, -0.12, 12);
    mouth(s, T2, F, S, 24, 1, "wave");
  },
  dizzy(s, T2, F, S) {
    withEye(s, F.eyeL, 0, (x) => pSpiral(x, T2, S.t * 4));
    withEye(s, F.eyeR, 0, (x) => pSpiral(x, T2, -S.t * 4));
    mouth(s, T2, F, S, 26, 0.7, "wave");
  },
  /* Closed happy arcs and a ω mouth: the most affectionate face in the set,
     which is why it is `content` and not the default. */
  content(s, T2, F, S) {
    withEye(s, F.eyeL, S.blink, (x) => pArcUp(x, T2));
    withEye(s, F.eyeR, S.blink, (x) => pArcUp(x, T2));
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
    const R2 = this.random;
    for (let i = 0; i < count; i++) {
      const spread = o.spread ?? 0.6;
      const a = o.angle !== void 0 ? o.angle + R2.range(-spread, spread) : R2.range(0, Math.PI * 2);
      const sp = R2.range(o.spdMin ?? 90, o.spdMax ?? 260);
      this.list.push({
        type,
        x: (o.x ?? 0) + R2.range(-14, 14),
        y: (o.y ?? 0) + R2.range(-14, 14),
        vx: Math.cos(a) * sp + (o.vx ?? 0),
        vy: Math.sin(a) * sp + (o.vy ?? 0),
        rot: R2.range(0, Math.PI * 2),
        vrot: R2.range(-9, 9),
        size: R2.range(o.sizeMin ?? 5, o.sizeMax ?? 11),
        life: 0,
        ttl: R2.range(o.ttlMin ?? 0.9, o.ttlMax ?? 1.7),
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

// src/core/accessories.js
function headPoint(X2, Y, Z, S, k = 1) {
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  const cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
  const x1 = X2 * cy + Z * sy;
  const z1 = -X2 * sy + Z * cy;
  const y2 = Y * cp + z1 * sp;
  const z2 = -Y * sp + z1 * cp;
  return { x: x1 * G.R * k, y: y2 * G.RY * k, z: z2 * G.R * k };
}
var loop = (n2, f) => Array.from({ length: n2 }, (_, i) => f(i / n2 * Math.PI * 2, i));
var span = (n2, a0, a1, f) => Array.from({ length: n2 }, (_, i) => f(a0 + (a1 - a0) * i / (n2 - 1), i));
function ring(u, S, n2 = 64, k = 1) {
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
var path = (s, pts, close = true) => {
  s.begin();
  pts.forEach((p, i) => i ? s.line(p.x, p.y) : s.move(p.x, p.y));
  if (close) s.close();
};
function domePath(s, ring2) {
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
  s.begin();
  s.move(-G.R * 1.7, -G.RY * 2);
  lower.forEach((p) => s.line(p.x, p.y));
  s.line(G.R * 1.7, -G.RY * 2);
  s.close();
}
function upVector(S) {
  const t = headPoint(0, -1, 0, S);
  const m = Math.hypot(t.x, t.y) || 1;
  return { x: t.x / m, y: t.y / m };
}
var tint = (T2, o) => o.color || T2.accent || "#FFC94A";
var FRONT = "front";
var WORN = { lit: 0.16, dark: 0.17 };
var ACCESSORIES = {
  /* ------------------------------------------------------------- glasses */
  glasses: {
    /* The one accessory that belongs to the FACE rather than the skull, so it
       uses the face's own frame and inherits its wrap and its visibility. Rims
       that stayed put while the eyes slid away would read as a mask floating
       in front of the character. */
    draw(s, S, T2, o = {}, where) {
      if (where !== FRONT) return;
      const F = S._face;
      if (!F || F.vis <= 0.01) return;
      const col = o.color || T2.feature;
      const r = G.eyeR * 1.35;
      s.save();
      s.alpha(F.vis * 0.95);
      s.begin();
      s.move(F.eyeL.x + r * F.eyeL.fx * 0.9, F.eyeL.y);
      s.line(F.eyeR.x - r * F.eyeR.fx * 0.9, F.eyeR.y);
      s.stroke(col, 4);
      for (const e of [F.eyeL, F.eyeR]) {
        if (e.a <= 0.02) continue;
        s.save();
        s.alpha(e.a);
        s.begin();
        s.ellipse(e.x, e.y, r * Math.max(0.06, e.fx), r * e.fy);
        s.stroke(col, 4.4);
        s.restore();
      }
      s.restore();
    }
  },
  /* ----------------------------------------------------------------- bow */
  bow: {
    draw(s, S, T2, o = {}, where) {
      const p = headPoint(-0.44, -0.7, 0.5, S, 1.02);
      if (p.z >= 0 !== (where === FRONT)) return;
      const col = tint(T2, o), knot = o.knot || darken(col, 0.14), R2 = 26;
      const k = Math.max(0.52, Math.abs(p.z) / G.R);
      const up = upVector(S);
      s.save();
      s.translate(p.x, p.y);
      s.rotate(Math.atan2(up.x, -up.y) - 0.24);
      s.scale(k, 1);
      for (const side of [-1, 1]) {
        s.begin();
        s.move(0, 0);
        s.cubic(side * R2 * 0.55, -R2 * 0.72, side * R2 * 1.3, -R2 * 0.6, side * R2 * 1.22, -R2 * 0.05);
        s.cubic(side * R2 * 1.16, R2 * 0.52, side * R2 * 0.5, R2 * 0.62, 0, 0);
        s.close();
        s.fill(col);
      }
      for (const side of [-1, 1]) {
        s.begin();
        s.move(side * R2 * 0.14, R2 * 0.1);
        s.cubic(side * R2 * 0.44, R2 * 0.62, side * R2 * 0.52, R2 * 0.95, side * R2 * 0.3, R2 * 1.1);
        s.cubic(side * R2 * 0.2, R2 * 0.8, side * R2 * 0.04, R2 * 0.55, 0, R2 * 0.16);
        s.close();
        s.fill(col);
      }
      s.begin();
      s.ellipse(0, 0, R2 * 0.26, R2 * 0.3);
      s.fill(knot);
      s.restore();
    }
  },
  /* -------------------------------------------------------------- flower */
  flower: {
    draw(s, S, T2, o = {}, where) {
      const p = headPoint(-0.5, -0.64, 0.55, S, 1.02);
      if (p.z >= 0 !== (where === FRONT)) return;
      const col = o.color || "#F26D8B", R2 = 16;
      const k = Math.max(0.55, Math.abs(p.z) / G.R);
      const up = upVector(S);
      s.save();
      s.translate(p.x, p.y);
      s.rotate(Math.atan2(up.x, -up.y));
      s.scale(k, 1);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 - Math.PI / 2;
        s.begin();
        s.ellipse(Math.cos(a) * R2, Math.sin(a) * R2, R2 * 0.72, R2 * 0.72);
        s.fill(col);
      }
      s.begin();
      s.ellipse(0, 0, R2 * 0.6, R2 * 0.6);
      s.fill(o.centre || "#FFD97A");
      s.restore();
    }
  },
  /* ----------------------------------------------------------------- cap */
  cap: {
    draw(s, S, T2, o = {}, where) {
      const col = tint(T2, o);
      const band = o.band || darken(col, 0.18);
      const U = -0.4;
      const rim = ring(U, S, 64, 1.006);
      const rr = Math.sqrt(1 - U * U);
      const B2 = 0.82, Z0 = 0.32, A = Math.sqrt(rr * rr - Z0 * Z0), TILT = 0.4;
      const yAt = (Z) => U + 0.04 + TILT * Math.max(0, Z - Z0);
      const peak = [
        ...span(40, 0, Math.PI, (t) => {
          const Z = Z0 + B2 * Math.sin(t);
          return headPoint(A * Math.cos(t), yAt(Z), Z, S, 1);
        }),
        /* and straight back across the hinge. Following the head's curve here
           instead looks more careful and is worse: it makes the peak
           non-planar, the horizon no longer cuts it along a straight line, and
           the near half — closed off with a chord — swells into a yellow shelf
           standing across the head at three-quarter-from-behind. The hinge is
           under the dome at every angle, so nothing is lost by keeping the
           peak flat. */
        ...span(12, 1, -1, (u) => headPoint(A * u, yAt(Z0), Z0, S, 1))
      ];
      const half = splitDepth(peak);
      const edge = o.brim || darken(col, 0.1);
      if (where !== FRONT) {
        for (const run of half.far) {
          path(s, run);
          s.fill(edge);
        }
        return;
      }
      s.save();
      headRegion(s, S, 1.006);
      s.clip();
      domePath(s, rim);
      s.fill(col);
      domePath(s, rim);
      s.fill(formLight(G.R, WORN));
      for (const run of splitDepth(rim).near) {
        path(s, run, false);
        s.stroke(band, 11, "butt", "round");
      }
      s.restore();
      const btn = headPoint(0, -1, 0, S, 0.9);
      if (btn.z > -G.R * 0.5) {
        s.begin();
        s.ellipse(btn.x, btn.y, 7.5, 6.5);
        s.fill(band);
      }
      for (const run of half.near) {
        path(s, run);
        s.fill(col);
        path(s, run);
        s.fill(formLight(G.R, WORN));
      }
    }
  },
  /* ---------------------------------------------------------- headphones */
  headphones: {
    draw(s, S, T2, o = {}, where) {
      const col = tint(T2, o);
      const pad = o.pad || darken(col, 0.2);
      const E = 0.38;
      const hoop = span(48, E, Math.PI - E, (a) => headPoint(
        Math.cos(a) * 1.03,
        -Math.sin(a) * 1.03,
        -0.05 - 0.3 * Math.sin(a),
        S
      ));
      const w = 9 + 13 * Math.abs(Math.sin(S.yaw));
      const hs = splitDepth(hoop, false);
      for (const run of where === FRONT ? hs.near : hs.far) {
        path(s, run, false);
        s.stroke(col, w, "round", "round");
        path(s, run, false);
        s.stroke(formLight(G.R, WORN), w, "round", "round");
      }
      for (const side of [-1, 1]) {
        const p = headPoint(side * 1, -0.1, 0, S, 1);
        if (p.z >= 0 !== (where === FRONT)) continue;
        const face = Math.abs(p.z) / G.R;
        const rx = 8 + 15 * face;
        s.save();
        s.begin();
        s.ellipse(p.x, p.y, rx, 25);
        s.fill(col);
        s.begin();
        s.ellipse(p.x, p.y, rx, 25);
        s.fill(formLight(G.R, WORN));
        s.begin();
        s.ellipse(p.x, p.y, rx * 0.58, 15);
        s.fill(pad);
        s.restore();
      }
    }
  },
  /* --------------------------------------------------------------- crown */
  crown: {
    draw(s, S, T2, o = {}, where) {
      const col = tint(T2, o);
      const gem = o.gem || "#E2664F";
      const N = 24, U = -0.7, K = 1.02;
      const lo = ring(U, S, N, K);
      const hi = ring(U - 0.09, S, N, K);
      const up = upVector(S);
      const near = where === FRONT;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const mid = (lo[i].z + lo[j].z) / 2;
        if (mid >= 0 !== near) continue;
        path(s, [lo[i], lo[j], hi[j], hi[i]]);
        s.fill(col);
        path(s, [lo[i], lo[j], hi[j], hi[i]]);
        s.fill(formLight(G.R, WORN));
      }
      const H = 42;
      for (let i = 0; i < N; i += 3) {
        const a = hi[(i - 1 + N) % N], b = hi[i], c = hi[(i + 1) % N];
        if (b.z >= 0 !== near) continue;
        const h = H * (0.62 + 0.38 * Math.abs(b.z) / G.R);
        const tip = { x: b.x + up.x * h, y: b.y + up.y * h };
        path(s, [a, tip, c]);
        s.fill(col);
        path(s, [a, tip, c]);
        s.fill(formLight(G.R, WORN));
      }
      const f = headPoint(0, U - 0.045, Math.sqrt(1 - U * U), S, K);
      if (near && f.z > G.R * 0.25) {
        s.begin();
        s.ellipse(f.x, f.y, 5.2, 5.2);
        s.fill(gem);
      }
    }
  }
};
var ACCESSORY_NAMES = Object.keys(ACCESSORIES);
function drawAccessories(s, S, T2, where) {
  const list = S.accessories;
  if (!list || !list.length) return;
  for (const item of list) {
    const name = typeof item === "string" ? item : item.name;
    const a = ACCESSORIES[name];
    if (!a) continue;
    s.save();
    a.draw(s, S, T2, typeof item === "string" ? {} : item, where);
    s.restore();
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
function bodyPaint(T2) {
  const sh = T2.shade && T2.shade.body;
  if (!sh) return T2.body;
  return vertical(sh.top, sh.bottom, -G.RY, G.RY, sh.mid);
}
function earShade(T2) {
  const sh = T2.shade && T2.shade.body;
  if (!sh) return darken(T2.body, 0.11);
  return vertical(
    darken(sh.top, 0.11),
    darken(sh.bottom, 0.11),
    -G.RY,
    G.RY,
    sh.mid ? darken(sh.mid, 0.11) : void 0
  );
}
function earShapes(s, S, T2, each) {
  if (!T2.ears) return;
  for (const side of [-1, 1]) {
    const p = project(side * G.earSX, G.earSY, G.R, S.yaw, S.pitch);
    const k = 0.62 + 0.38 * Math.abs(p.fx);
    const out = Math.sign(p.x) || side;
    const x = out * Math.max(Math.abs(p.x), G.R * 0.86);
    each(x, p.y, G.earR * k, G.earR * G.earRY, side * G.earTilt);
  }
}
function drawBody(s, S, T2) {
  const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
  const paint = bodyPaint(T2);
  const bulge = Math.abs(sy) * 15;
  const hasBulge = bulge > 0.6;
  const shape = (rx, ry, ox = 0, oy = 0) => silhouettePath(s, rx, ry, ox, oy);
  const feet = (each) => {
    if (!G.footR) return;
    for (const side of [-1, 1]) each(side * G.footDX, G.RY - G.footDY, G.footR * 1.25, G.footR);
  };
  const bulgePath = () => {
    shape(G.R * 0.93, G.RY * 0.95, -Math.sign(sy) * bulge * 0.85, 2 - S.pitch * 10);
  };
  const headPath = () => shape(G.R, G.RY);
  if (T2.outline) {
    const w = T2.outlineW * 2;
    earShapes(s, S, T2, (x, y, rx, ry, tilt) => {
      s.begin();
      s.ellipse(x, y, rx, ry, tilt);
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
    headPath();
    s.stroke(T2.outline, w, "round", "round");
  }
  const earPaint = T2.ears === true ? paint : T2.ears === "darker" ? earShade(T2) : T2.ears;
  earShapes(s, S, T2, (x, y, rx, ry, tilt) => {
    s.begin();
    s.ellipse(x, y, rx, ry, tilt);
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
  headPath();
  s.fill(paint);
  if (T2.form !== false) {
    s.begin();
    silhouetteSub(s, G.R, G.RY);
    if (hasBulge) {
      silhouetteSub(
        s,
        G.R * 0.93,
        G.RY * 0.95,
        -Math.sign(sy) * bulge * 0.85,
        2 - S.pitch * 10
      );
    }
    earShapes(s, S, T2, (x, y, rx, ry, tilt) => s.ellipse(x, y, rx, ry, tilt));
    feet((x, y, rx, ry) => s.ellipse(x, y, rx, ry));
    s.fill(formLight(G.R, { lit: 0.13 * (T2.formLit ?? 1), dark: 0.26 * (T2.formDark ?? 1) }));
  }
  if (T2.shade && T2.shade.sheen) {
    s.save();
    s.alpha(T2.shade.sheen);
    headPath();
    s.fill(sheen(
      -G.R * 0.28,
      -G.RY * 0.34,
      G.R * 1.15,
      T2.shade.sheenColor || "#FFFFFF",
      "rgba(255,255,255,0)"
    ));
    s.restore();
  }
  const backness = smooth(0.3, -0.45, cy);
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
function facePatchPath(s, F, T2) {
  const { x, y, rx, ry } = F.hole;
  const bumps = T2.hairline || 0;
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
function drawFace(s, S, T2) {
  const F = S._face || faceFrame(S);
  if (F.vis <= 0.01) return F;
  s.save();
  s.alpha(F.vis);
  s.save();
  headRegion(s, S, 0.985);
  s.clip();
  if (T2.face) {
    facePatchPath(s, F, T2);
    if (T2.outline) s.stroke(T2.outline, T2.outlineW * 2, "round", "round");
    facePatchPath(s, F, T2);
    s.fill(T2.shade && T2.shade.face ? vertical(
      T2.shade.face.top,
      T2.shade.face.bottom,
      F.hole.y - F.hole.ry,
      F.hole.y + F.hole.ry
    ) : T2.face);
    if (T2.recess !== false) {
      const d = 0.1 + 0.24 * (1 - (F.hole.fore ?? 1));
      s.save();
      facePatchPath(s, F, T2);
      s.clip();
      facePatchPath(s, F, T2);
      s.fill({
        type: "radial",
        cx: F.hole.x - F.hole.rx * 0.5,
        cy: F.hole.y - F.hole.ry * 0.62,
        r: F.hole.ry * 1.85,
        stops: [[0, `rgba(0,0,0,${d})`], [0.6, "rgba(0,0,0,0)"]]
      });
      s.restore();
    }
  }
  if (S.showBlush && T2.blush) {
    s.save();
    s.alpha(0.7);
    if (T2.face) {
      facePatchPath(s, F, T2);
      s.clip();
    }
    for (const sx of [-(G.eyeDX + 15), G.eyeDX + 15]) {
      const b = faceProject(sx, G.faceCY + G.eyeDY + 7, S.yaw, S.pitch);
      if (b.z <= 0) continue;
      s.save();
      s.translate(b.x, b.y);
      s.scale(Math.abs(b.fx), Math.abs(b.fy));
      s.begin();
      s.ellipse(0, 0, 11.5, 7);
      s.fill(T2.blush);
      s.restore();
    }
    s.restore();
  }
  s.save();
  if (T2.face) facePatchPath(s, F, T2);
  else silhouettePath(s, G.R * 0.98, G.RY * 0.98);
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
  const sgn = side === "l" ? -1 : 1;
  const h = S.hand[side];
  return project(
    sgn * (G.handSX + h.out * 22),
    G.handSY - h.lift * G.handLift,
    G.Rh,
    S.yaw,
    S.pitch
  );
}
function drawHand(s, S, T2, side, p) {
  const h = S.hand[side];
  if (h.show <= 0.01) return;
  const sgn = side === "l" ? -1 : 1;
  const R2 = G.handR;
  const sq = clamp(0.55 + Math.abs(p.fx) * 0.45, 0.4, 1);
  s.save();
  s.alpha(clamp(h.show, 0, 1));
  s.translate(p.x, p.y);
  s.rotate(h.swing * sgn);
  s.scale(sgn * sq, 1);
  const thumb = () => {
    s.begin();
    s.ellipse(-R2 * 0.82, -R2 * 0.32, R2 * 0.38, R2 * 0.3, -0.62);
  };
  const palm = () => {
    s.begin();
    s.ellipse(0, 0, R2 * 0.86, R2 * 1.02);
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
  if (!S.showSparks) return;
  G.sparks.forEach((sp, i) => {
    const lon = sp.a + S.yaw;
    const z = Math.cos(lon);
    if (z < 0 !== far) return;
    const phase = S.t * 3.1 * S.tempo - i * 0.5;
    const pulse = 1 + Math.sin(phase) * 0.14 + S.sparkPop * 0.55;
    const depth = 0.78 + 0.22 * z;
    const depthFade = lerp(0.42, 0.92, smooth(-0.3, 0.3, z));
    const mirror = Math.tanh(z * 3.2);
    s.save();
    s.alpha(depthFade * clamp(0.7 + S.sparkPop * 0.3, 0, 1));
    s.translate(
      G.Rs * Math.sin(lon) * depth,
      sp.y + Math.sin(phase * 0.7) * 3 - S.sparkPop * 10 - S.pitch * 30
    );
    s.rotate(sp.rot * mirror + S.sparkPop * 0.3);
    s.begin();
    s.ellipse(0, 0, sp.rx * pulse * Math.max(0.35, Math.abs(z) * 0.5 + 0.5), sp.ry * pulse);
    s.fill(T2.spark);
    s.restore();
  });
}
function drawHeldLetter(s, S, T2) {
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
  const tr = S.trace;
  if (!tr.active || !tr.ch) return;
  s.save();
  s.translate(G.trace.x, G.trace.y);
  const halfW = G.trace.cap * 0.62;
  const cap = G.trace.cap;
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
  s.translate(G.trace.x, G.trace.y);
  const pen = drawTrace(
    s,
    tr.ch,
    G.trace.cap,
    tr.u,
    { ghost: T2.ghost, ink: T2.body }
  );
  s.restore();
  if (pen && !pen.penUp && tr.u < 1) {
    s.save();
    s.translate(G.trace.x + pen.x, G.trace.y + pen.y);
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
      G.ground,
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
    S.trail.forEach((g, i) => {
      if (g.speed < 0.6) return;
      const k = (i + 1) / S.trail.length;
      s.save();
      s.alpha(0.16 * k * clamp(g.speed, 0, 1));
      s.translate(g.x, g.y);
      s.rotate(g.roll);
      s.begin();
      s.ellipse(0, 0, G.R * 0.97, G.RY * 0.97);
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
  drawAccessories(s, S, T2, "back");
  drawBody(s, S, T2);
  drawFace(s, S, T2);
  drawAccessories(s, S, T2, "front");
  if (pL.z >= 0) drawHand(s, S, T2, "l", pL);
  if (pR.z >= 0) drawHand(s, S, T2, "r", pR);
  drawSparks(s, S, T2, false);
  drawHeldLetter(s, S, T2);
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
  idleActions: false,
  // play look-around / think spontaneously
  idleEvery: [9, 20]
  // seconds between spontaneous idles
};
var Buddy = class {
  constructor(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    this.options = o;
    this.theme = resolveTheme(o.theme);
    this.random = makeRandom(o.seed);
    this._beats = /* @__PURE__ */ new Set();
    this._listeners = {};
    this._spellQueue = null;
    this._traceQueue = null;
    this.s = this._freshState(o);
  }
  _freshState(o) {
    return {
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
        l: { lift: 0, swing: 0, out: 0, show: 0, want: 0 },
        r: { lift: 0, swing: 0, out: 0, show: 0, want: 0 }
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
      h.lift = approach(h.lift, 0, 0.02, dt);
      h.swing = approach(h.swing, 0, 0.02, dt);
      h.out = approach(h.out, 0, 0.02, dt);
      h.want = Math.max(0, h.want - dt * 2.2);
      h.show = approach(h.show, S.showHands ? 1 : clamp(h.want, 0, 1), 1e-7, dt);
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
  constructor({ width = 320, height = 320, originCentre = true, background = null } = {}) {
    this.kind = "svg";
    this.width = width;
    this.height = height;
    this.background = background;
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
    const id = `bg${this._grads.size}`;
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
    const id = `bc${++this._clipId}`;
    const t = `matrix(${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4])} ${n(m[5])})`;
    this.defs.push(`<clipPath id="${id}"><path d="${this._p.d.join("")}" transform="${t}"/></clipPath>`);
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
function toSVG(buddy, { width = DESIGN, height = DESIGN, background = null, padding = 0 } = {}) {
  const s = new SVGSurface({ width, height, originCentre: true, background });
  const k = Math.min(width, height) / DESIGN * (1 - padding);
  s.scale(k, k);
  buddy.render(s);
  return s.toString();
}
function poseSVG(pose = {}, opts = {}) {
  const b = new Buddy({
    theme: opts.theme ?? "ink",
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
function turnaroundSVGs({ steps = 8, expression = "happy", ...opts } = {}) {
  return Array.from({ length: steps }, (_, i) => {
    const yaw = 360 / steps * i;
    return { name: `turn-${Math.round(yaw)}`, yaw, svg: poseSVG({ expression, yaw }, opts) };
  });
}
function expressionSVGs(opts = {}) {
  return Buddy.expressions.map((name) => ({
    name: `expr-${name}`,
    expression: name,
    svg: poseSVG({ expression: name }, opts)
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
  ACCESSORY_NAMES,
  ACTIONS,
  ACTION_NAMES,
  Buddy,
  CanvasSurface,
  DEFAULT_THEME,
  DESIGN,
  EXPRESSIONS,
  EXPRESSION_NAMES,
  G,
  GLYPHS,
  GLYPH_CHARS,
  LETTER_VISEMES,
  METRICS,
  PHASES,
  PHASE_NAMES,
  SVGSurface,
  TAU,
  THEMES,
  TOKENS,
  VISEMES,
  VISEME_NAMES,
  alphabetSVG,
  applyPhase,
  approach,
  blendViseme,
  clamp,
  darken,
  defineSpellingBuddy,
  deg,
  drawAccessories,
  drawGlyph,
  drawTrace,
  drawViseme,
  drawWord,
  expressionSVGs,
  faceProject,
  flattenGlyph,
  formLight,
  getSpellingBuddyElement,
  glyph,
  glyphBounds,
  glyphPath,
  glyphWidth,
  identifyTrace,
  isGradient,
  lerp,
  lettersToVisemes,
  lighten,
  makeRandom,
  mix,
  mount,
  paintKey,
  penAt,
  poseSVG,
  project,
  rad,
  render,
  resolveTheme,
  scoreTrace,
  shadeFor,
  sheen,
  sheetSVG,
  smooth,
  spring,
  toSVG,
  turnaroundSVGs,
  vertical,
  wordToVisemes
};
