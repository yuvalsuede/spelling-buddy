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
`WRAP_X` pulls the travel in — no effect head-on, a little over half of it
pulled back at full profile. Foreshortening is not cheated, so the squash stays honest while the
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
const wrap = 1 - 0.54 * Math.abs(Math.sin(yaw))   // ~half the travel at full profile
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

### The patch is a surface, not a shape

The features were projected from the start. The pale patch they sit in was not:
it was an upright oval, squashed across screen-x by the same foreshortening
factor. That is an affine map, and **an affine map preserves relative
spacing** — so the fringe scallops stayed evenly spread while the outline
beside them foreshortened progressively. Two parts of the same head
disagreeing about how far it has turned is not a detail; it is the whole
sticker reading, and no amount of work inside the patch fixes it.

The patch is now built face-on — a circle with the fringe across the top,
exactly the shape drawn at rest — and every point of it goes through the same
projection the eyes use. Three consequences fall out that were previously drawn
by hand or not at all: the oval **leans** (the face sits low, so the direction
pointing out of it points out *and* down), the fringe **banks** with it, and the
far scallops **crowd** while the near ones spread.

It is placed as a geodesic **cap**, not as a longitude/latitude patch:

```js
capPoint(u, v, yaw, pitch)   // roll the offset onto the sphere along a great circle
```

`project` treats surface x and y as longitude and latitude, which is right for
a small feature and wrong for a patch this size — the bottom of the face sits
near the pole of the face sphere, and a lon/lat patch pinches to a point there.
The face came out with a tail on it. A cap has no pole in its construction.

Sampled rather than curved, because the projection is not affine: a Bézier
pushed through it is no longer the same Bézier, and mapping its control points
would be an approximation dressed up as a curve. Sixty-four samples, smoothed
back into quadratics through their midpoints on the way out.

### The profile

A 43° cap is still half visible at ninety degrees. Fading the face out at the
limb leaves a plain egg with a hair whorl on it — a back view arriving early,
and the reason a side view read as a mistake rather than as a pose.

In the last thirty degrees of turn (`profileAmount`, and it is gated on the
face being on *this* side of the limb — `|sin yaw|` alone is symmetric about
ninety degrees and will happily grow a nose on the back of a skull):

- Brow, bridge, nose, notch and chin become one offset curve added to the
  leading edge, sampled off the same half-width table the face is fitted
  against, so the bump starts exactly on the outline however the egg is shaped.
- The rim rule **inverts**. Head-on, a face flush with the outline is the
  sticker failure. At the limb, a face that is *not* cut by the outline floats
  as a lens on the side of the head — what belongs there is a crescent, the far
  half hidden by the head itself. The anchor walks out onto the outline, the
  clip cuts the rest, and the clip's inset tapers to zero so the face's contour
  and the head's coincide instead of trapping a hairline of body between them.
- The nose is inside that clip, so the face fills it. At profile the nose *is*
  face; in the body colour it is a lump growing out of a scalp.
- The whorl waits for the face to leave, because a whorl and a nose on screen
  together read as a back view with a face stuck to the edge of it.

And the face lags the head — `faceYaw`, `facePitch` — at about a fifth. The
visible face at ninety degrees is physically a sliver: correct, and unreadable
at the sizes this renders at. Every hand-drawn turnaround cheats it. The cheat
is on the foreshortening only; travel still goes all the way to the edge, so
the head reads as fully turned while the face stays legible.

### Proportions are data

```js
applyShape('kawaii')   // eighteen numbers, and the half-width table rebuilt
```

The rig is about fifteen constants, so a different build of the same character
is a table rather than a fork. `applyShape` mutates the shared `G` and rebuilds
the sampled half-width table the face is fitted against — a build-wide choice,
made once before mounting.

---

### Form

Nothing else in the rig implies a light source, so for a long time nothing
implied a surface either: at three-quarter view the character was a flat disc
sliding a white patch across itself. Two gradients fix it — a three-stop radial
over the silhouette, and a clipped one inside the face patch that gives the
hole a lip. Both come from `formLight()` in `paint.js`, so there is exactly one
light and everything worn can borrow it.

The mid stop is the load-bearing one. With two stops the terminator starts at
the highlight and the result reads as a swipe of paint; with three it reads as
a ball.

The same light runs across the face patch as well, at lower strength and
backing off where the profile takes over. A shaded head with an unshaded face
is the sticker problem at the centre of the drawing: the face comes out
brightest on the away side as often as not, which is the one thing a surface on
a sphere cannot do.

### What a sampled outline costs, and what it does not

A sampled patch is written into the file several times a frame — as the
contour, as the fill, and as the clip the features are cut to — so the first
version of this took one expression from 5.9 kB to 22 kB of SVG. Three fixes,
none of which touch the drawing:

- **64 samples, smoothed to quadratics** through their midpoints: half the
  commands of a polyline at the same fidelity.
- **One clip definition per distinct shape.** The patch is clipped to four
  times in a frame — the recess, the form light, the blush, the features — and
  each of those used to write the whole path into the defs again.
- **A fill that is already clipped covers its clip** rather than repeating the
  path. The clip is the shape; the fill only has to be bigger than it.

9.1 kB. Worth knowing before adding the next sampled thing.

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
