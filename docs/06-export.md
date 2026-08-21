# Asset export

Every asset comes out of the same rig that runs at runtime, so exported art can
never drift from what ships.

---

## CLI

```bash
npx spelling-buddy sheet                       # one SVG character sheet
npx spelling-buddy alphabet                    # A–Z a–z 0–9 on ruled paper
npx spelling-buddy svg    --out assets/svg     # per-pose SVGs
npx spelling-buddy png    --size 512           # rasterised stills
npx spelling-buddy frames --action correct     # numbered PNG sequence
npx spelling-buddy sprite --action correct     # sprite-sheet PNG
npx spelling-buddy gif    --action wave        # animated GIF
```

| Flag | Applies to | Default |
|---|---|---|
| `--out` | all | varies per command |
| `--theme` | all | `ink` |
| `--size` | `png`, `frames` | `512` |
| `--steps` | `svg` | `8` turnaround steps |
| `--action` | `frames`, `sprite`, `gif` | `correct` |
| `--fps` | `frames`, `sprite`, `gif` | `30` (`sprite`: 15) |
| `--cols`, `--cell` | `sprite` | `8`, `160` |

`svg`, `sheet` and `alphabet` have **zero dependencies**. `png` / `frames` / `sprite` need
`sharp`; `gif` also needs `ffmpeg`. Each fails with a plain message, not a stack
trace, if a tool is missing.

---

## Programmatic

```js
import { toSVG, poseSVG, sheetSVG, alphabetSVG, turnaroundSVGs, expressionSVGs } from 'spelling-buddy'
```

### `alphabetSVG(opts)`

A specimen sheet of the whole glyph set on ruled paper — cap line, x-line,
baseline, descender.

```js
alphabetSVG()
alphabetSVG({ rows: ['abcdefg'], cap: 120, ink: '#1478C9' })
```

This is the artifact to look at after touching a glyph. Every mis-set
x-height and every letter that fails to sit on the baseline is obvious here in
one glance, and invisible in a unit test.

### `poseSVG(pose, opts)`

Render one pose from scratch — no live rig needed.

```js
poseSVG({ expression: 'proud', yaw: 45 })
poseSVG({ expression: 'thinking', yaw: -32, hands: 'r', handLift: -0.22, handOut: -0.5 })
poseSVG({ expression: 'proud', letter: 'A', hands: 'r', handLift: 0.8 })
```

**Pose fields:** `expression`, `yaw`, `pitch`, `roll` (degrees), `hands`
(`true` for both, `'l'` or `'r'` for one), `handLift`, `handOut`, `letter`, `label`.

**Options:** `theme`, `seed`, `width`, `height`, `background`, `padding`.

### `toSVG(buddy, opts)`

Snapshot a live rig — exactly what's on screen right now.

```js
const svg = toSVG(buddy, { width: 512, height: 512 })
```

Call `buddy.settle()` first if you want a clean pose rather than a moment
mid-bob.

### `sheetSVG(poses, opts)`

Compose a labelled grid into one SVG.

```js
sheetSVG(
  Buddy.expressions.map(e => ({ expression: e, label: e })),
  { cols: 4, cell: 200, theme: 'ink' }
)
```

### Batch helpers

```js
turnaroundSVGs({ steps: 12 })   // [{ name, yaw, svg }, …]
expressionSVGs({ theme: 'blue' })
```

---

## Raster (Node)

```js
import { actionFrames, svgToPng, spriteSheet, encodeVideo } from 'spelling-buddy/export'

const frames = actionFrames('correct', { fps: 30, theme: 'ink' })
const pngs   = await Promise.all(frames.map(f => svgToPng(f.svg, { width: 256 })))
await writeFile('sprite.png', await spriteSheet(pngs, { cell: 128, cols: 8 }))
```

`actionFrames` steps the rig at a fixed timestep and captures SVG per frame. It
returns `[{ t, svg }]`, so you can rasterise at any resolution afterwards
without re-running the animation.

---

## Determinism

Frames come from a **seeded PRNG** advanced at a **fixed timestep**. Export twice
and you get byte-identical output.

```js
poseSVG({ expression: 'happy' }, { seed: 7 }) === poseSVG({ expression: 'happy' }, { seed: 7 })
```

Which means generated assets are safe to commit and safe to diff in CI:

```yaml
- run: npx spelling-buddy svg --out assets/svg
- run: git diff --exit-code assets/    # fails if the rig changed the art
```

That check is worth having. It turns "someone tweaked the eye radius" from a
thing you notice in production into a failing build.

---

## Why SVG and not PNG

The exported SVG is **real vector geometry** — arcs converted to cubic Béziers,
the way any vector tool stores them. Not a traced raster.

- ~3 KB per pose
- opens and edits in Figma, Illustrator, Inkscape
- scales infinitely; no `@2x`/`@3x` set to maintain
- inlines into HTML for a zero-request first paint

Reach for PNG when you need a raster specifically: an OG image, an app icon, a
context that can't render SVG.

---

## Common pipelines

**Marketing stills**

```bash
npx spelling-buddy png --size 1024 --theme ink --out marketing/
```

**Loading spinner as inline SVG**

```js
document.querySelector('#loader').innerHTML =
  poseSVG({ expression: 'thinking', yaw: -20 }, { width: 64, height: 64 })
```

**Email / notification image** — GIF, since animation in email means GIF:

```bash
npx spelling-buddy gif --action wave --fps 20 --width 200 --out email/hello.gif
```

**Native app assets** — export the sprite sheet and drive it from your engine's
animation system:

```bash
npx spelling-buddy sprite --action correct --cols 8 --cell 256
```

You lose the deformation and interpolation, but if the target can't run JS
that's the trade.
