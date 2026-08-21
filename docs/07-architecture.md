# Architecture

Three ideas hold the whole thing up. Everything else is detail.

---

## 1. The character is math

There are no images. Every shape is an arc, an ellipse, or a Bézier curve
evaluated per frame from about fifteen geometry constants:

```js
G = {
  R: 100, RY: 104,           // body
  Rf: 96,                    // sphere the face lives on
  faceRX: 56, faceRY: 58,    // the negative-space hole
  eyeDX: 20, eyeR: 13, ...
}
```

This is the decision everything else depends on. Because the character is
generated rather than drawn, it can **deform** — squash, stretch, turn, blend
between expressions — none of which a sprite can do. It also means one source of
truth produces both the runtime and every exported asset.

The cost is that soft shading, grain, and painterly texture are off the table.
Flat vector is not just an aesthetic choice here; it's the style that this
technique can render exactly.

---

## 2. Features live on a sphere

The turn is real 3D, not sprite swapping.

Each facial feature is given a position on the surface of a sphere of radius
`Rf`. `yaw` and `pitch` rotate it; an orthographic projection returns the 2D
position **and** the local foreshortening factors:

```js
function project(sx, sy, R, yaw, pitch) {
  const lon = Math.asin(sx / R) + yaw      // longitude after turning
  const lat = Math.asin(sy / R) + pitch    // latitude after tilting
  return {
    x:  R * Math.sin(lon) * Math.cos(lat),
    y:  R * Math.sin(lat),
    z:  R * Math.cos(lon) * Math.cos(lat), // >0 = near hemisphere
    fx: Math.cos(lon),                     // horizontal squeeze
    fy: Math.cos(lat),                     // vertical squeeze
  }
}
```

Expression code never sees an angle. It receives a frame of projected positions
and scale factors and draws into it, so a new expression costs nothing in
projection logic and automatically works at every head angle.

Features with `z < 0` are on the far hemisphere and fade out across the
terminator rather than popping.

### Two frames, and why they must stay different

That projection **cheats**. A true orthographic one slides features all the way
out to the silhouette, where they overhang the body edge and look broken, so
`WRAP_X` pulls the travel in — no effect head-on, about 45% pull-back at full
profile. Foreshortening is not cheated, so the squash stays honest while the
translation stays inside the shape.

Anything **worn** uses a different frame: `headPoint()` in
`src/core/accessories.js`, a real rotation with no cheat. A cap and a face are
attached to the same skull but they are not attached in the same way — the face
is painted on and may be nudged, the hat sits on the outline and the outline
does not cheat. Sharing one frame between them is not a simplification; it puts
an earcup in the middle of the face at profile.

The second consequence is depth. Features **fade** across the terminator
because they are marks on a surface. Worn things **sort**: each part draws in
the back pass or the front pass by its own depth, and closed shapes are split
at the horizon so the two halves share an exact edge. Fading a solid object
makes it dissolve mid-turn; sorting it makes it pass behind the head, which is
what it is actually doing.

### The wrap cheat

A physically true projection slides features all the way out to the silhouette,
where they overhang the body edge and look broken. Animators solve this by
pulling the travel inward. So does this rig:

```js
const wrap = 1 - 0.45 * Math.abs(Math.sin(yaw))   // 45% pull-back at full profile
```

The important part is **what doesn't get cheated**. Foreshortening still comes
from the real angle, so the squash stays physically correct. Only the
translation is stylised.

### Group anchoring

The first version applied `wrap` per feature. That squeezed the eyes together on
top of the genuine perspective compression, crowding them into a blob near
profile.

The fix: apply the cheat only to the face group's **anchor point**, then lay
features out around it using the honest, uncheated projection.

```js
function faceProject(sx, sy, yaw, pitch) {
  const aW = project(0, faceCY, Rf, yaw, pitch, /* wrap */ true)
  const a0 = project(0, faceCY, Rf, yaw, pitch, /* wrap */ false)
  const q  = project(sx, sy,    Rf, yaw, pitch, /* wrap */ false)
  return { x: q.x + (aW.x - a0.x), y: q.y + (aW.y - a0.y), z: q.z, fx: q.fx, fy: q.fy }
}
```

Travel is stylised; internal spacing stays honest. Near profile you get the
correct read — the near eye compressed, the far eye a sliver at the edge — with
the whole face still inside the silhouette.

---

## 3. Springs, not tweens

Every impulse is injected as **velocity** into a damped spring rather than
played as an eased keyframe.

```js
function spring(pos, vel, target, dt, k = 190, d = 15) {
  vel += ((target - pos) * k - vel * d) * dt
  return [pos + vel * dt, vel]
}
```

Eased tweens arrive and stop. Springs overshoot and settle. That difference is
most of what reads as *weight*.

Actions therefore follow two rules:

1. Never assign a position. Set a spring **target** (`yawTarget`) or inject
   **velocity** (`offVY`, `squashVY`).
2. Restore what you changed in `end()`.

Which is why interrupting an action mid-flight never leaves the rig in a broken
pose, and why hand-authored beats and physical settling don't fight.

Orientation springs are deliberately softer (`k=120, d=14`) than the body's
(`k=190, d=15`) so turns carry more weight than pops.

---

## One Surface, two backends

The rig never touches a `CanvasRenderingContext2D`. It draws against a narrow
interface:

```
save restore translate rotate scale alpha
begin move line quad cubic arc ellipse rect close
fill stroke clip text clear
```

`CanvasSurface` forwards those to Canvas2D. `SVGSurface` accumulates path data,
converting arcs to cubic Béziers and baking transforms as matrices. Neither
knows anything about the character.

```js
render(surface, state, theme)     // the only rendering entry point
```

Two deliberate differences from raw Canvas2D:

- `fill(color)` / `stroke(color, width)` take paint as **arguments** instead of
  reading mutable `fillStyle` state. Stateless paint makes the SVG backend
  trivial and removes a class of "forgot to reset the style" bugs.
- `alpha(x)` **multiplies** rather than assigns, so nested groups compose.

The payoff: add an expression once and it appears at runtime, in exported SVG,
in the sprite sheet, and in the GIF. The demo page renders both backends side by
side every frame — divergence is visible immediately.

### The clipping subtlety

Worth knowing if you extend the SVG backend. Shapes carry their absolute CTM as
a `transform`, and SVG resolves `clip-path` in the user space established
*after* that transform. Putting `clip-path` on the shape itself applies the
matrix twice and clips everything away — which is exactly the bug that made
every exported face come out empty.

The fix: clipping opens a plain untransformed `<g>` in root space, and the
`clipPath` geometry carries the absolute matrix. Both then live in the same
coordinate system, and nesting groups gives intersection semantics identical to
canvas.

---

## The alphabet is geometry too

The rig originally drew letters with `<text>`. That broke twice in production:
librsvg ignores `dominant-baseline`, so exported cards disagreed with the live
canvas, and any font-based letter is a dependency on whatever the host machine
happens to have installed. The letters are now paths, authored the same way as
the character.

Each glyph is a list of **monoline strokes** in cap-height units — the cap line
is `-0.5`, the baseline `+0.5` — written in the order and direction a hand
writes them. Two things fall out of that for free:

- **Tracing.** A monoline path *is* the pen's centreline, so the coordinates
  that draw an "A" also describe how to write one. A filled-outline font cannot
  tell you that: an outline describes the edge of the ink, not the path through
  it.
- **Scoring.** The same polylines a learner's finger is compared against are the
  ones that get drawn, so a trace can never be graded against a different shape
  than the one shown.

### Vertical metrics

Uppercase alone needed only one horizontal: everything filled the cap box. The
moment lowercase exists that stops being true, and the glyphs need real
metrics:

```
cap        -0.5     ── b d f h k l t
x-line     -0.12    ── a c e o
baseline    0.5     ──
descender   0.78    ── g j p q y
```

x-height is 0.62 of the cap — big, because round shapes read more easily at
small sizes, but not so big that ascenders disappear. "Tall letters and short
letters" is itself something the app teaches, so `b` has to look taller than
`o`.

The consequence worth knowing about: `drawGlyph` has two vertical alignments.
`baseline` puts every glyph on the writing line, which is what words and
tracing need. `ink` centres the visible mass instead, which is what a single
letter alone in a card needs — a baseline-aligned lowercase `a` in a card looks
like it has slipped to the floor. Both come out of the same geometry; only the
translate differs.

The tracing panel draws its rules from the same numbers, and shows the
descender rule only for letters that actually go below it.

---

## Paint is data

`fill()` and `stroke()` take their paint as an argument rather than reading
mutable context state — that is what lets one set of drawing calls feed both
backends. A colour string was enough while everything was flat. Shading needs
gradients, and a gradient has to mean *exactly* the same thing on canvas and in
exported SVG, or the two outputs drift — which is the one failure this whole
architecture exists to prevent.

So a paint is either a CSS colour or a plain object:

```js
{ type: 'linear', x0, y0, x1, y1, stops: [[0, '#3B3B3F'], [0.55, '#16161A'], [1, '#0F0F12']] }
{ type: 'radial', cx, cy, r, fx, fy, stops: [...] }
```

Coordinates are in the **current user space**, the same space as the path being
filled. Canvas gets that for free — gradient coordinates are baked through the
CTM at creation. The SVG backend emits `gradientUnits="userSpaceOnUse"` on an
element that already carries the same absolute matrix, which resolves to the
same place. Verified by rendering both and comparing, not by reasoning about it.

Being plain data has two more consequences worth having: a paint can be hashed,
so identical gradients are emitted once into `<defs>` and reused; and it stays
snapshot-able, so a shading change shows up as a failing geometry test like any
other edit.

Cost, measured over 600 frames of `dance`: 0.080 → 0.095 ms/frame.

---

## Determinism

The rig owns its clock and its randomness:

- All randomness goes through a seeded mulberry32 PRNG.
- `step(seconds, hz)` advances by a fixed timestep without rendering.
- `settle()` snaps springs to targets and freezes idle oscillators, turning *a
  moment* into *a pose*.

Same seed plus same timestep gives byte-identical output, which is what makes
generated assets safe to commit and diff in CI.

---

## Module map

```
src/core/
  math.js            lerp, clamp, smooth, seeded PRNG, spring
  geometry.js        constants, project(), faceProject()
  theme.js           brand tokens and palettes
  surface-canvas.js  Canvas2D backend
  surface-svg.js     SVG backend (matrices, arc→Bézier, clip groups)
  expressions.js     face frame + eye primitives + 9 expressions
  accessories.js     worn things, in the head's own frame
  glyphs.js          the alphabet as monoline strokes + metrics
  trace.js           flatten, pen position, trace scoring
  particles.js       confetti, stars, sparkles, zzz, drops, letters
  actions.js         13 animation timelines
  renderer.js        pure (surface, state, theme) → draw calls
  phases.js          the six lesson phases
  buddy.js           state, clock, public API

src/adapters/        mount / react / webcomponent
src/export/          svg (no deps), raster (sharp), cli
```

`renderer.js` holds no state of its own. That's what makes deterministic export
possible: hand it a Surface and a frozen state object and you get that exact
frame, on canvas or as SVG, now or in a build step.
