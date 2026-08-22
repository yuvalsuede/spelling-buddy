# Troubleshooting

Real failure modes, most of them hit during development.

---

### The hands never appear

Almost always a colour problem, not a geometry one.

Hands orbit just outside the silhouette but pass **in front of the body** during
turns and raised poses. If `theme.hand` equals `theme.body`, they render
perfectly and are invisible.

```js
theme: { extends: 'ink', body: '#0B2A4A', hand: '#082138' }   // one step off
```

Second possibility: hands are opt-in. `showHands` defaults to `false` and
animations request them per-frame. Calling `buddy.s.hand.r.lift = 1` on its own
does nothing — you also need visibility:

```js
buddy.s.hand.r.want = 1     // animations set this every tick
buddy.s.hand.r.lift = 0.8
```

---

### Nothing renders / blank canvas

- The canvas has no CSS size. `mount()` measures the element; a canvas with no
  layout size measures 0. Set `width`/`height` in CSS, or pass `size`.
- You mounted before the element was in the DOM.
- You disposed the handle and kept using `buddy`. `update()` still runs, but
  nothing paints.

---

### The character is blurry

`mount()` handles device-pixel-ratio. If you're driving your own loop, you must
scale the backing store yourself:

```js
const dpr = window.devicePixelRatio || 1
canvas.width  = cssSize * dpr
canvas.height = cssSize * dpr
ctx.setTransform(unit * dpr, 0, 0, unit * dpr, canvas.width / 2, canvas.height / 2)
```

`unit = cssSize / 320` — the design space is 320×320.

---

### It jumps across the screen after a tab switch

Shouldn't happen: `update()` clamps `dt` to 1/20 s. If you're calling `update()`
yourself with a raw timestamp delta, clamp it:

```js
buddy.update(Math.min(dt, 1 / 20))
```

---

### Exported SVG has empty faces

Fixed in 1.0. If you've modified `surface-svg.js`, see
[the clipping subtlety](./07-architecture.md#the-clipping-subtlety) — putting
`clip-path` on a shape that also carries a `transform` applies the matrix twice
and clips everything away.

---

### Exported PNG/GIF fails

```
PNG export needs `sharp`.
```

`sharp` is an optional dependency:

```bash
npm i sharp
```

GIF additionally needs `ffmpeg` on `PATH`. The SVG exporter needs neither and
covers most cases.

---

### Two buddies blink in unison

They share the default seed. Give each its own:

```js
rigs.forEach((c, i) => mount(c, { seed: i + 1 }))
```

---

### Expressions look wrong in profile

They shouldn't — expressions draw into the projected frame and foreshorten
automatically. If you added a custom expression and it looks flat, you're
probably drawing at absolute coordinates instead of using the frame:

```js
// wrong — ignores the projection
EXPRESSIONS.mine = (s, T, F, S) => {
  s.begin(); s.ellipse(-20, 4, 7, 9); s.fill(T.feature)
}

// right — F.eyeL carries projected position and foreshortening
EXPRESSIONS.mine = (s, T, F, S) => {
  s.save()
  s.translate(F.eyeL.x, F.eyeL.y)
  s.scale(Math.max(0.04, F.eyeL.fx), F.eyeL.fy)
  s.begin(); s.ellipse(0, 0, 7, 9); s.fill(T.feature)
  s.restore()
}
```

Guard `fx` with a floor — it reaches 0 at exact profile, and a zero scale
collapses the path.

---

### The face is invisible on my custom theme

The character is a light face inside a darker head, and on a pale body the two
close up: what renders is a blank egg with a pair of eyes floating on it. The
face has not gone anywhere — there is nothing to say where it ends.

Two ways out, and the invariant in `scripts/visual.mjs` accepts either: keep
about forty points of channel-sum separation between `face` and `body`, or give
the theme an `outline`. A drawn edge does the same job, which is why the kawaii
skins can be as pale as they like.

```js
// invisible
{ body: '#EEF1F7', face: '#FFFFFF' }
// either of these reads
{ body: '#D9E0EC', face: '#FFFFFF' }
{ body: '#EEF1F7', face: '#FFFFFF', outline: '#4B3C38', outlineW: 3.25 }
```

---

### The face looks flat, or the side view looks wrong

Check you have not turned the face model off. Three options control it and all
three are on by default — `faceLean: 2`, `faceForm: 1`, `profile: true`. With
`faceLean: 0` the patch is an upright oval that slides across the head, which
is the drawing the rig shipped with and is still available on purpose. See
[How the face turns](./02-api.md#how-the-face-turns).

---

### `npm run demo` prints a URL that 404s

Almost certainly something else is already serving that port. Node listens on
every interface by default, and macOS will let a second process bind
`*:5173` while a first one holds `[::1]:5173` — both servers start, both print
the same link, and `localhost` resolves to the IPv6 address first, so the other
application answers.

The server binds the loopback address explicitly and prints `127.0.0.1` for
exactly this reason. If the port is genuinely taken it now says so and exits;
pass another:

```bash
node scripts/serve.mjs 5188
```

---

### A custom action leaves the rig in a broken pose

You assigned positions instead of targets, or skipped `end()`.

```js
// wrong
tick(B) { B.s.yaw = 1.2 }              // fights the spring every frame

// right
start(B) { B.s.yawTarget = 1.2 }
end(B)   { B.s.yawTarget = 0 }
```

Anything you change in `start`/`tick` must be restored in `end`, because
`react()` calls `end()` when interrupting.

---

### The mouth doesn't move when I call `say()`

- Check `buddy.speaking` right after the call. If it's `false`, the word
  sanitised to nothing — `say()` strips non-letters.
- Something may be calling `stopSpeaking()` — `cancelSpell()` does, and so does
  an `end`/`error` event on an attached utterance.
- At sizes under ~64px the shapes are there but small. Verify at 200px first.

### Lip-sync drifts out of time with the audio

`attachSpeech` relies on the `boundary` event, which some engines emit late,
sparsely, or not at all. Where it isn't emitted the mouth stays closed by design
— a still mouth reads better than a wrong one.

For tight sync, drive the timeline yourself from timings you control:

```js
audio.addEventListener('play', () => buddy.sayVisemes(myTimeline))
audio.addEventListener('ended', () => buddy.stopSpeaking())
```

### The mouth looks mushy / everything blurs together

Lower the crossfade:

```js
buddy.s.speech.blendFor = 0.04   // crisper (default 0.055)
```

Also check you aren't feeding very short durations — below about 60 ms per
viseme the blend never completes and every shape reads as an average.

---

### `spell()` doesn't fire my callback

Register listeners before calling it:

```js
buddy.on('spell:letter', ch => speak(ch))
buddy.spell('CAT')
```

Also check the word survives sanitising — `spell()` keeps every character that
has a glyph (`A–Z`, `a–z`, `0–9`, `' - . ? !`) and drops the rest. Case is
**not** changed: `spell('cat')` spells in lowercase.

---

### React: the animation resets on every render

You're passing `action` as a value that changes identity each render, or
remounting the component. `<SpellingBuddy>` mounts the rig once and applies prop
changes through the API — but if its `key` changes, React unmounts it.

For events, prefer the imperative ref:

```jsx
const ref = useRef()
<SpellingBuddy ref={ref} />
// ...
ref.current.react('correct')
```

---

### SSR crashes with "HTMLElement is not defined"

The main entry is SSR-safe and the Web Component class is built lazily, so this
shouldn't occur in 1.0. If you're importing `mount` and calling it at module
scope, guard it:

```js
if (typeof window !== 'undefined') mount('#buddy')
```

---

### It feels stiff / lifeless

Usually one of:

- `bobAmt` or `breathAmt` set to 0 without intending it.
- `blinkEvery` very high. Blinking is most of what makes it read as alive.
- No idle behaviour on a screen with long pauses — try `idleActions: true`.
- Everything is `express()` and nothing is `react()`. Expressions are static
  poses; the motion comes from actions.

---

### It feels too busy

- `idleActions: true` on a screen that needs focus. Turn it off during input.
- Firing `correct` on every keystroke instead of on submit.
- `dance` used for ordinary successes — save it for streaks.

---

## Catching visual bugs before they ship

`npm test` runs three suites. `scripts/test.mjs` checks behaviour;
`scripts/visual.mjs` checks what actually gets drawn; `scripts/check-recipes.mjs`
checks that the documentation is still true. The second exists because every
visual bug in this project's history passed the behavioural suite cleanly.

**Invariants**, each one a bug that shipped:

| Check | The bug it catches |
|---|---|
| no `<text>` / `font-family` / `dominant-baseline` in output | exported letters rendered from a host font, and sat at the top of the card |
| `theme.hand` differs measurably from `theme.body` | hands drew perfectly and were invisible |
| `theme.accent` differs measurably from `theme.body` | a gold cap on the gold skin — worn, rendered, and reading as a haircut |
| no letter glyph overlaps the face hole during `spell()` | flying letters parked on the eyes and mouth |
| spark opacity is continuous through the terminator | sparks popped as they crossed z = 0 |
| every stroke runs the way a hand writes it | half the alphabet was drawn bottom-to-top |
| the face is never a visible sliver | between 78° and 90° the face was a six-pixel pale column at a third opacity — a scratch on the lens |
| each accessory is worn at every angle | the cap vanished from behind, leaving the button off the top of its own hat |
| each accessory turns continuously | worn things faded out mid-turn instead of passing behind the head |
| each accessory reaches the back pass | a decal on the lens can only ever be in front of the character |
| at profile, the far side of a mirrored pair is behind the head | an earcup pinned in head space sat over the middle of the face |
| no NaN at any yaw | degenerate geometry |
| `theme.face` reads against `theme.body`, or the theme has a contour | a pale skin rendered as a blank egg with two eyes floating on it |
| the leading half of the face compresses and the trailing half does not | the patch was squashed affinely, so the fringe stayed evenly spread on a head that was foreshortening — the sticker reading, in one measurement |
| the face never fades to a blank egg while the profile is on, and never narrows by a jump on the way there | it thinned to a sliver at 75° and widened again at 90°; a turn that dips in legibility reads as a glitch |
| at profile the nose is face-coloured, and the face reaches the leading edge without crossing it | a dark lump growing out of a scalp, and a hairline of body trapped between the face's contour and the head's |
| the whorl and the face are never on screen together | a back view with a face stuck to the edge of it |
| a worn thing on an outlined skin carries the contour too | a hat with no line on a body that has one reads as pasted on |
| the registry refuses a raw colour, an unknown footprint, an empty one | a prop that could not be recoloured and could not be kept out of the feedback palette |
| a prop cannot be painted the correct-answer green | a green hat spends the only colour in the product that carries a meaning |
| a conflicting loadout is refused | a release asset generated with a crown inside a cap |
| holding something puts a hand out, through the constructor as well as `wear()` | every held prop drew beside an invisible hand |
| a held thing moves by the same amount the grip moved | checked against the renderer's own hand formula, not against the frame — asking the frame where the hand is and then checking the prop agrees proves nothing |
| a held thing passes behind the character | otherwise it hovers over the back of the head |
| the built bundle contains the whole catalogue | `"sideEffects": false` let the bundler drop all 75 props; source and tests were green and the shipped file had none |

**Snapshots** lock the exact geometry of 86 poses — every expression, the full
turnaround, all eighteen themes, letter cards, visemes and actions. Any change
to the drawn output fails the build:

```bash
npm run test:visual                    # verify
npm run snapshot                       # re-record after an intentional change
node scripts/visual.mjs --fill         # record only poses never recorded
```

`--fill` is the one to reach for after adding a theme. A blanket re-record
re-bakes whatever the current machine prints, and that is how a float digit
that differs between hosts hides instead of getting fixed.

Review a snapshot diff the way you'd review a code diff. If you didn't mean to
change the art, you just caught a regression.

**An invariant that passes against the code it describes is worse than none.**
Twice in this project a check went green against a bug it was written for. Before
trusting a new one, break the code on purpose and watch it fail.

---

## Looking at the whole matrix

An invariant catches what you thought to ask about. For anything visual, also
look:

```bash
npm run sweep        # contact sheets in tests/sweep/
```

Every accessory, every pairing, a full 360°, both pitch extremes and every
skin. Every accessory defect this project has had was invisible at the two
angles that get checked by hand and obvious on one sheet — a cap that turned
into a button from behind, an earcup floating over a face, a crown that
disappeared at three-quarter view, and a slot cut across the hat whenever the
head tipped. The sheet also found a face bug nobody had reported.

If you change anything about how the character is drawn, generate the sheets
and look at them before deciding you are finished.

---

### The character wears nothing, but only in the built bundle

Source is fine, tests are green, `npm run demo` is fine — and a page loading
`dist/spelling-buddy.global.js` can wear nothing at all. `propIds()` returns
an empty array.

The catalogue registers itself by calling `defineProp` at module scope. A
bundler is entitled to treat that as dead code when the package swears it is
pure, and `"sideEffects": false` in `package.json` is exactly that promise. The
prop files get dropped and nothing anywhere says so.

`package.json` lists the catalogue as having side effects, and `npm run build`
asserts the built bundle has as many props as the source does — against the
built file, because that is the only artifact where the failure exists.

### An accessory floats, or vanishes when the head turns

It is anchored in the wrong space. Anything worn on the skull lives in the
**head's** frame — `headPoint()` in `src/core/accessories.js` — and is rotated
by the real yaw and pitch. Two specific traps:

- **Do not use `project()`.** That is the face's projection and it cheats
  features inward so eyes never overhang the body edge. Applied to hardware it
  drags an earcup into the middle of the face at profile.
- **Do not fade across the terminator.** Solid objects do not dissolve; they
  pass behind. Draw each part in the `back` pass or the `front` pass by its own
  depth, and split closed shapes at the horizon so the halves share an edge.

---

## Getting more detail

```js
console.log(buddy.s)          // full rig state
console.log(buddy.action, buddy.expression, buddy.yawDeg)
```

To see the projection itself, render the SVG of a turned pose and inspect the
path data:

```js
console.log(poseSVG({ yaw: 60, expression: 'happy' }))
```

---

### A perfect trace scores badly on B, P or j

Fixed. It was real: `drawGlyph` and `drawTrace` centre a letter on its ink,
while the scoring geometry used raw authored coordinates. For `B`, `P` and `j`
those sit 0.11 cap-units apart — most of a stroke width — so a pixel-perfect
trace of a `B` scored 0.37 and the child was told to try again.

Both spaces are now the ink-centred one, and the mapping in the docs is the one
that works. If you were compensating with your own offset, remove it.

---

### `scoreTrace` says "close" but the child drew a different letter

That is what `{ diagnose: true }` is for — see
[Tracing](./10-tracing.md#reversals-and-what-they-actually-drew). The score
measures *tracing quality*; it is not a letter classifier, and for confusable
pairs it cannot be one. `looksLike` and `reversed` answer that question
directly.
