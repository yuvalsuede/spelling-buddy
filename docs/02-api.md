# API reference

## Phases

The recommended surface. Everything below it is rig-level — `express`,
`react`, `spell`, `trace` are verbs about the character. That is the right API
for building something new and the wrong one for shipping page after page,
because every page ends up choreographing slightly differently and after twenty
of them the app has twenty personalities.

A phase is lesson-level. It says what the *learner* is doing; the choreography
lives in one place.

```js
buddy.phase('typing')
buddy.phase('stuck',    { word: 'cat' })
buddy.phase('teaching', { letter: 'g' })
```

| phase | the learner | the character |
|---|---|---|
| `idle` | nothing is happening | happy, eyes tracking |
| `typing` | entering an answer | thinking |
| `correct` | got it right | celebrates, then returns to `idle` |
| `wrong` | got it wrong | recoils, then returns to `typing` |
| `stuck` | needs the answer | spells `word` out — **without celebrating** |
| `teaching` | needs to see a letter formed | traces `letter`, or every letter of `word` |

Three things it handles that hand-written choreography usually doesn't:

**It is idempotent.** Setting the same phase twice does nothing, so it is safe
to call straight from a React render. A celebration that re-fires on every
render is the first bug anyone hits.

```js
buddy.phase('wrong', { nonce: attempts })   // change nonce to replay
buddy.phase('wrong', { force: true })       // or replay it now
```

**Momentary phases come back.** `correct` and `wrong` are events, not states,
so each names the steady phase to fall into when its animation ends. Firing the
celebration and leaving the character standing in it is the second bug anyone
hits.

**Entering a phase cancels the last one.** Moving from `teaching` to `typing`
stops the trace — otherwise a page that has moved on still has a letter drawing
itself in the corner.

### `stuck` does not celebrate

`spell()` on its own ends with a celebration, because normally the learner
earned it. When the rig spells a word *because the child could not*, cheering
congratulates the wrong party — so `stuck` passes `celebrate: false`. The same
option is available directly:

```js
buddy.spell('cat', { celebrate: false })
```

### In React

```jsx
<SpellingBuddy phase={status} word={word} letter={hint} nonce={attempts} />
```

`word` and `letter` are **context, not triggers** — changing them does nothing
by itself; the phase decides what they mean. To spell a word outright, use the
`spell` prop, which is the imperative escape hatch.

### As an attribute

```html
<spelling-buddy phase="teaching" letter="g"></spelling-buddy>
```

### Adding one

```js
import { PHASES } from 'spelling-buddy'

PHASES.reviewing = {
  steady: true,
  expression: 'content',
  autoLook: true,
}
```

A phase with `steady: true` persists. One without it needs `then` — the phase
to fall back into — and either an `action` or a `run(buddy, opts)` function.

---

## `mount(canvas, options)`

Attaches a rig to a `<canvas>` and starts it. Accepts an element or a selector.

```js
const handle = mount('#buddy', { theme: 'ink', size: 240 })
```

### Mount options

| Option | Type | Default | Notes |
|---|---|---|---|
| `size` | `number \| null` | `null` | Fixed CSS size. `null` follows the element's box. |
| `interactive` | `boolean` | `true` | Wire pointer events at all. |
| `dragToTurn` | `boolean` | `true` | Dragging rotates the head. |
| `clickToPop` | `boolean` | `true` | A click (not a drag) plays `pop`. |
| `autoStart` | `boolean` | `true` | Begin the loop immediately. |
| `maxDPR` | `number` | `3` | Cap device-pixel-ratio to bound fill cost. |
| `alpha` | `boolean` | `true` | Transparent canvas backing store. |
| `buddy` | `Buddy` | — | Reuse an existing rig instead of constructing one. |

Plus every [Buddy option](#buddy-options).

### Handle

| Member | |
|---|---|
| `buddy` | the `Buddy` instance |
| `canvas` | the element |
| `start()` / `stop()` | control the rAF loop |
| `resize()` | re-measure and re-scale |
| `paint()` | draw one frame immediately |
| `dispose()` | stop the loop and remove all listeners |

---

## `new Buddy(options)`

The rig itself. Owns state and time; knows nothing about canvases, DOM, or
frameworks. Use this directly when you want to drive rendering yourself.

### Buddy options

| Option | Type | Default | Notes |
|---|---|---|---|
| `theme` | `string \| object` | `'ink'` | Name or partial override. See [Theming](./04-theming.md). |
| `seed` | `number` | `1` | PRNG seed. Same seed ⇒ identical output. |
| `expression` | `string` | `'happy'` | Starting expression. |
| `autoLook` | `boolean` | `true` | Eyes and head follow the cursor while idle. |
| `idleActions` | `boolean` | `false` | Spontaneously play `lookAround` / `think` / `sleep`. |
| `idleEvery` | `[min,max]` | `[9,20]` | Seconds between spontaneous idles. |
| `showHands` | `boolean` | `false` | Force hands always visible. Animations request them as needed. |
| `showShadow` | `boolean` | `true` | Ground contact ellipse. |
| `showSparks` | `boolean` | `true` | The three marks above the head. |
| `showBlush` | `boolean` | `true` | Cheeks. |
| `showTrail` | `boolean` | `true` | Ghost silhouettes during fast motion. |
| `scale` | `number` | `1` | Overall size multiplier within the design box. |
| `tempo` | `number` | `1` | Global speed of idle oscillators. |
| `bobAmt` | `number` | `1` | Idle vertical bob amplitude. |
| `breathAmt` | `number` | `1` | Idle breathing amplitude. |
| `blinkEvery` | `number` | `3.2` | Mean seconds between blinks (jittered ±40%). |

Every one of these is also live-writable on `buddy.s`:

```js
buddy.s.tempo = 1.6
buddy.s.showSparks = false
```

---

## Methods

### `express(name)`
Set the facial expression. Cross-fades over 160 ms and adds a small squash pop.
Throws on an unknown name. Returns `this`.

### `react(name)`
Play a special animation. Interrupts anything currently running (the previous
action's `end()` is called first, so state never leaks). Returns `this`.

### `spell(word, { interval = 0.48 })`
Hold up each letter of `word` in turn, then play `correct`. Non-letters are
stripped. Driven by the rig's own clock, so it stays in sync at any timestep and
exports frame-accurately.

### `hold(ch | null)`
Show a single letter card. `hold(null)` clears it.

### `face(yawDeg, pitchDeg)`
Point the head. Disables `autoLook`. Springs animate to the target.

### `turnBy(dYaw, dPitch)`
Relative turn in **radians** — for drag gestures.

### `pointer(x, y, inside)`
Feed a normalised cursor position (`-1…1` on both axes). `mount()` does this
for you; call it manually if you're driving your own input.

### `setTheme(theme)`
Swap palette instantly. Name or partial override object.

### `settle()`
Snap every spring to its target and freeze the idle oscillators. This is what
turns *a moment* into *a pose* — use it before exporting a still, otherwise the
bob and breath cycle make two runs differ.

### `step(seconds, hz = 60)`
Advance by a fixed timestep without rendering. Deterministic. Used by exporters
to reach a precise point in an animation.

### `update(dt)` / `render(surface)`
The manual loop. `update` advances physics; `render` draws onto any
[Surface](./07-architecture.md#one-surface-two-backends).

### `reset()`
Return to a freshly-constructed state and re-seed the PRNG.

---

## Properties

| | |
|---|---|
| `buddy.expression` | current expression name |
| `buddy.action` | running action name, or `null` |
| `buddy.busy` | an action or a spell is in progress |
| `buddy.yawDeg` / `buddy.pitchDeg` | where the head is actually pointing |
| `buddy.theme` | the resolved theme object |
| `buddy.s` | raw mutable state — stable, but prefer the methods |

---

## Events

```js
buddy.on('action:start', name => …)
buddy.on('action:end',   name => …)
buddy.on('expression',   name => …)
buddy.on('spell:letter', ch   => …)
buddy.on('spell:done',   ()   => …)
buddy.on('theme',        name => …)
```

`spell:letter` is the hook for text-to-speech — see
[Integration](./05-integration.md#speaking-letters-aloud).

---

## Statics

```js
Buddy.expressions   // ['happy','excited','thinking','surprised','proud',
                    //  'sleepy','confused','dizzy','content']
Buddy.actions       // ['correct','wrong','nod','turnaround','peek','lookAround',
                    //  'jump','wave','dance','dizzy','sleep','think','pop']
Buddy.designSize    // 320
```

Use these to build UI rather than hard-coding lists — they stay correct when the
set grows.

---

## Glyphs

The alphabet is drawn from geometry, not a font — see
[Architecture](./07-architecture.md#the-alphabet-is-geometry-too).

```js
import { drawGlyph, drawWord, GLYPH_CHARS, glyphWidth, METRICS } from 'spelling-buddy'

drawGlyph(surface, 'A', 30, '#16161A')        // one letter, cap height 30
drawWord(surface, 'spell', 24, '#1478C9')     // a centred run
GLYPH_CHARS                                   // A–Z a–z 0–9 plus ' - . ? !
```

Unknown characters draw nothing rather than falling back to a font, which would
reintroduce the host-dependence the glyphs exist to remove.

### Case

`A–Z`, `a–z` and `0–9` are all real, separately drawn glyphs, and **case is
preserved everywhere** — `hold('a')`, `spell('cat')` and `trace('g')` show
lowercase. That matters because most early-years curricula teach lowercase
first; a rig that quietly upper-cases its input cannot be used for those
lessons at all.

`glyph(ch)` looks up exactly, then falls back to the capital, so a string that
happens to contain a character with no lowercase form still draws something.

### Metrics

Everything is measured in **cap-height units**: the cap line is `-0.5`, the
baseline `+0.5`.

```js
METRICS.xLine       // -0.12 — the top of a lowercase o
METRICS.baseline    //  0.5
METRICS.descender   //  0.78 — the bottom of a g
METRICS.xHeight     //  0.62 — as a fraction of the cap height
```

The x-height is large for a text face on purpose — round shapes read more
easily at small sizes — but deliberately not so large that ascenders vanish.
"Tall letters and short letters" is itself part of what is being taught, so
`b d f h k l t` have to look visibly taller than `a c e o`.

### Alignment

```js
drawGlyph(s, 'a', 30, ink, 0.145, true, 'baseline')   // default
drawGlyph(s, 'a', 30, ink, 0.145, true, 'ink')        // centre the visible mass
```

`baseline` is right for words and for tracing — an `o` sitting at the correct
height next to a `b` *is* the lesson. `ink` is right for a single letter alone
in a card, where a baseline-aligned `a` just looks like it has slipped to the
floor. The letter cards use `ink`; everything else uses `baseline`.

## React

```jsx
import { SpellingBuddy, useBuddy } from 'spelling-buddy/react'
```

### `<SpellingBuddy />`

| Prop | Notes |
|---|---|
| `size` | pixels, default `240` |
| `theme` | changing it re-themes in place |
| `expression` | controlled — setting it calls `express()` |
| `action` | setting it plays the action; change the value to replay |
| `word` | setting it calls `spell()` |
| `onExpression`, `onActionEnd` | callbacks |
| `style`, `className` | passed to the canvas |

Also accepts every Buddy option. Forwarding a ref gives you
`{ buddy, express, react, spell, hold, face }`.

```jsx
const ref = useRef()
<SpellingBuddy ref={ref} size={200} />
ref.current.react('correct')
```

> The component mounts the rig **once**. Option changes after mount are applied
> through the API rather than by rebuilding, so animation is never reset by an
> unrelated re-render.

### `useBuddy(options)`

Returns `{ canvasRef, ready, buddy, express, react, spell, hold, face }`. Use it
when you want to own the canvas element and its styling.

---

## Web Component

```js
import { defineSpellingBuddy } from 'spelling-buddy/element'
defineSpellingBuddy()               // registers <spelling-buddy>
defineSpellingBuddy('my-mascot')    // or a custom tag
```

```html
<spelling-buddy theme="ink" size="240" expression="happy" idle></spelling-buddy>
```

Attributes: `theme`, `size`, `expression`, `action`, `word`, `interactive`, `idle`.
Methods mirror the Buddy API. Emits `actionend` and `spelldone` as DOM
`CustomEvent`s.

Rendering happens in a shadow root, so page CSS can't reach in.

> `defineSpellingBuddy()` is a no-op outside a browser, and the element class is
> built lazily — importing this module during SSR or in tests will not throw.

---

## Accessibility

A canvas is a black box to assistive technology. That is fine while the
character is decorative — and not fine the moment it becomes the lesson.
`spell('cat')` and `trace('g')` are taught *only* here, so without this a
screen-reader user gets nothing at all.

`mount()` handles two things:

```html
<canvas role="img" aria-label="Spelling buddy"></canvas>
<span aria-live="polite" aria-atomic="true" class="visually-hidden"></span>
```

The live region is created next to the canvas and removed again on `dispose()`,
along with any attribute `mount` added — a canvas you had already labelled keeps
your label.

| Announced | Text |
|---|---|
| `spell(word)` | "Spelling c, a, t" |
| `hold(ch)` | "Letter g" |
| `trace(ch)` | "Showing how to write g" |

The word is announced **once**, not letter by letter: at a 0.48s cadence a
per-letter announcement overwrites itself before a reader finishes the previous
one, and the user hears only the final letter.

`correct` and `wrong` are **not** announced by default. Nearly every host shows
its own status text, and hearing "Correct" twice is worse than not hearing it.
Turn them on by supplying the strings.

```js
mount('#buddy', {
  announcements: {
    label:   'Ruby the reading owl',
    spell:   w  => `Ruby spells ${[...w].join(', ')}`,
    trace:   ch => `Ruby writes ${ch}`,
    correct: () => 'Correct',
    hold:    null,          // silence one
  },
})

mount('#buddy', { announce: false })            // no live region at all
mount('#buddy', { announce: myExistingStatus }) // use a region you already have
```

Motion is handled too: `prefers-reduced-motion: reduce` stops the idle bob,
damps the breath, and turns off the motion trail. Expressions and pose changes
are not "movement" in that sense, so they stay — the character still
communicates.

```js
mount('#buddy', { respectReducedMotion: false })   // if you handle it yourself
```

The character is not keyboard-focusable, deliberately: poking it plays a
squash-and-stretch and nothing else, so it is decorative interaction rather
than a control. If you give it a job, make the *button* the control.
