# Getting started

## Install

```bash
npm install spelling-buddy
```

No build step? Use the prebuilt bundle:

```html
<script src="node_modules/spelling-buddy/dist/spelling-buddy.global.js"></script>
<script>
  const { buddy } = SpellingBuddy.mount('#buddy')
</script>
```

There are no runtime dependencies. `sharp` is an *optional* dependency used only
by the PNG/GIF exporters; skip it and the SVG exporter still works.

---

## Your first buddy

```html
<canvas id="buddy" style="width:240px;height:240px"></canvas>
```

```js
import { mount } from 'spelling-buddy'

const { buddy } = mount('#buddy', { theme: 'ink', size: 240 })
```

That's it — the character is now breathing, blinking, and tracking the cursor.
`mount()` handles the render loop, device-pixel-ratio scaling, resizing, and
pointer events for you.

---

## Making it do things

Three verbs cover almost everything:

```js
buddy.express('thinking')   // a facial expression — persists until changed
buddy.react('correct')      // a timed animation — plays once, then restores
buddy.spell('CAT')          // domain behaviour — holds up each letter, celebrates
```

**Expressions** are states. **Actions** are events. That distinction matters when
you wire it to app logic: set an expression when your UI enters a mode, fire an
action when something *happens*.

```js
// state → expression
input.addEventListener('focus', () => buddy.express('thinking'))
input.addEventListener('blur',  () => buddy.express('happy'))

// event → action
function submit(answer) {
  buddy.react(answer === target ? 'correct' : 'wrong')
}
```

---

## Sizing

The character is authored in a 320×320 design space and scaled at draw time, so
it looks identical at any size. Set the size in CSS or pass `size`:

```js
mount('#buddy', { size: 96 })            // fixed 96px
mount('#buddy', { size: null })          // follow the element's CSS box
```

With `size: null` the rig watches the element with a `ResizeObserver` and
re-renders on change — good for responsive layouts.

Practical minimums: the full face reads down to about **48px**. Below that, turn
off the small details:

```js
mount('#buddy', { size: 32, showBlush: false, showSparks: false, showShadow: false })
```

---

## Cleaning up

`mount()` returns a handle. Always dispose it when the host element goes away,
or you leak a `requestAnimationFrame` loop:

```js
const handle = mount('#buddy')
// ...later
handle.dispose()
```

The React adapter and Web Component do this for you.

---

## Performance notes

- One rig costs roughly **0.3 ms/frame** — a few dozen path fills. A dozen on
  screen at once is fine.
- `update()` clamps its delta time to 1/20 s, so a backgrounded tab won't launch
  the character across the screen when it resumes.
- Call `handle.stop()` when the character scrolls out of view and `start()` when
  it comes back if you want to be frugal:

```js
new IntersectionObserver(([e]) => e.isIntersecting ? handle.start() : handle.stop())
  .observe(canvas)
```

- Reduced motion is handled for you. `mount()` reads
  `prefers-reduced-motion` and damps the idle oscillators, following live
  changes to the setting. Opt out with `{ respectReducedMotion: false }`.

---

## Next

- [Animations catalog](./03-animations.md) — every expression and action
- [Integration recipes](./05-integration.md) — wiring it to a real lesson flow
- [API reference](./02-api.md)
