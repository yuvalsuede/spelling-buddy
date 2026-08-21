# Theming

No colour is hard-coded in the drawing code. Every fill reads from a theme
object, so re-skinning is a one-line swap and a brand change never touches the
rig.

```js
mount('#buddy', { theme: 'ink' })
buddy.setTheme('blue')          // live swap, no rebuild
```

---

## Built-in themes

| Name | Body | Notes |
|---|---|---|
| `ink` | `#16161A` | **Default.** The action colour on white canvas. |
| `blue` | `#1478C9` | Selection blue. Softer, more "assistant". |
| `cream` | `#16161A` | Ink character on a warm editorial field. |
| `indigo` | `#4A56D8` | The original exploration colour. |

---

## Brand System v4.1

The default theme maps the brand tokens onto the character deliberately:

| Token | Value | Where it lands |
|---|---|---|
| canvas | `#FFFFFF` | the face's negative space |
| ink | `#16161A` | the body and all features — the character *is* the action colour |
| blue | `#1478C9` | the sparks (attention / selection) |
| green | `#2CB02B` | **feedback only** — appears on `correct`, never as decoration |
| cream | `#F6F1E7` | the `cream` theme's face field |

Green never appears in a resting pose. It shows up in the celebration stars and
confetti of the `correct` action and nowhere else, which is what keeps it
meaning "you got it right" rather than "this is a nice green colour".

Import the raw tokens if you need them elsewhere:

```js
import { TOKENS } from 'spelling-buddy'
TOKENS.green   // '#2CB02B'
```

---

## Theme slots

| Slot | What it colours |
|---|---|
| `body` | main silhouette |
| `bodyDeep` | back-of-head whorl (only visible past ~70° turn) |
| `hand` | hands — keep it **one step off `body`**, or hands vanish when they overlap the silhouette |
| `face` | the negative-space hole |
| `feature` | eyes, brows, mouth |
| `spark` | the three marks above the head |
| `blush` | cheeks — set `null` to disable |
| `shadow` | ground contact |
| `correct` / `wrong` | feedback accents |
| `confetti` | array of celebration particle colours |

---

## Custom themes

Override any slot. `extends` picks the base:

```js
mount('#buddy', {
  theme: {
    extends: 'ink',
    body: '#0B2A4A',
    hand: '#082138',      // one step darker than body
    spark: '#FFC94A',
  }
})
```

Or build one from scratch by supplying every slot. Register it globally if you
want it available by name:

```js
import { THEMES } from 'spelling-buddy'

THEMES.forest = {
  ...THEMES.ink,
  name: 'forest',
  body: '#1F3D2B', bodyDeep: '#2E5540', hand: '#193324',
  spark: '#8FD694', correct: '#2CB02B', wrong: '#C9713A',
  confetti: ['#8FD694', '#2CB02B', '#F0D9A8', '#1F3D2B'],
}

mount('#buddy', { theme: 'forest' })
```

---

## The one rule

**`hand` must differ visibly from `body`.**

Hands orbit on a sphere just outside the silhouette, but during turns and poses
they frequently pass in front of the body. Painted in the same colour they
disappear entirely — the shape is there, it's just invisible. One step darker
(or lighter) reads as "in front" without breaking the flat style.

This is not hypothetical; it's the bug that cost the most time during
development. The hand geometry was correct for three iterations while nothing
appeared on screen.

---

## Contrast and accessibility

- The character is decorative — it should never be the only carrier of meaning.
  Pair `correct`/`wrong` with text or an icon.
- `bodyDeep` needs enough separation from `body` to read at small sizes. On the
  `ink` theme it's `#3D3D49` against `#16161A`; less than that and the
  back-of-head detail disappears.
- If you're placing the buddy on a coloured background, `face` is the value
  that must contrast with `body`, not with the page.

---

## Per-instance themes

Each rig owns its theme, so you can show several at once:

```js
mount('#a', { theme: 'ink' })
mount('#b', { theme: 'blue' })
mount('#c', { theme: { extends: 'ink', body: '#7A3E9D' } })
```

Exporters take a theme too:

```js
poseSVG({ expression: 'proud' }, { theme: 'blue' })
```

```bash
npx spelling-buddy sheet --theme cream
```

---

## Shading

The character is shaded, not flat, and the shading is **derived from the body
colour** rather than authored per theme:

```js
shadeFor('#16161A')
// { body: { top: lighter, mid: '#16161A', bottom: darker },
//   sheen: 0.10,
//   face:  { top: '#FFFFFF', bottom: '#F1F1F5' } }
```

The brand colour is the **middle stop**, not the average of two approximations
of it. INK is *the* action colour in v4.1, so it has to actually be present in
the character, with the light above it and the shadow below.

That is also what keeps an override meaningful:

```js
mount('#buddy', { theme: { extends: 'ink', body: '#0B2A4A' } })
```

A new `body` with no `shade` of its own re-derives the gradient. Inheriting the
base theme's literal gradient would paint the old colour straight over the new
one — the override would appear to do nothing.

| slot | |
|---|---|
| `shade.body` | `{ top, mid, bottom }` — vertical gradient across the silhouette |
| `shade.sheen` | `0`–`1`, an off-centre highlight. Weak on purpose: nothing else in the rig implies a light source |
| `shade.face` | gradient inside the face hole |
| `gloss` | specular highlights on round eyes — set to `null` for flat eyes |

Drop `shade` entirely for a flat character:

```js
mount('#buddy', { theme: { extends: 'ink', shade: null } })
```

### Green stays feedback

Shading gives the character depth *within its own colour*. It is not a licence
to make the body green: v4.1 reserves green for progress and correct-answer
feedback, and a green character would be using the "you got it right" colour as
decoration.
