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

### The kawaii set

Six skins that carry a **contour**, and in which the contour — not a field of
near-black — is the darkest value in the drawing. Pair them with the `kawaii`
proportions (see [Proportions](#proportions)) or use them on their own.

| Name | Body | Contour |
|---|---|---|
| `oat` | `#DCC4AE` | `#4B3C38` |
| `strawberry` | `#F0B8C5` | `#563844` |
| `sky` | `#A9D5EB` | `#334A59` |
| `lavender` | `#C5B9E8` | `#433B59` |
| `apricot` | `#F0C08F` | `#594033` |
| `inkling` | `#34323B` | `#16161A` |

```js
mount('#buddy', { theme: 'oat', shape: 'kawaii' })
```

The line is three weights and never four: the body's, the face patch's at
ninety per cent of it, and worn things at sixty. The face's own edge at body
weight turns the patch into a ring, and a light disc inside a heavy ring reads
as a finger hole no matter how good the face inside it is.

---

## Proportions

The rig is about fifteen numbers, so a different build of the same character is
a table of numbers rather than a fork of the drawing code.

```js
import { SHAPES, createGeometry } from 'spelling-buddy'

mount('#a', { shape: 'v1' })       // what shipped: taller egg, round eyes, wide smile
mount('#b', { shape: 'kawaii' })   // squat and bottom-heavy, tall eyes, small high mouth
mount('#c', { shape: { shape: 'kawaii', eyeRY: 24 } })   // a preset with overrides

SHAPES.kawaii.eyeRY                // 20.5
createGeometry('kawaii').halfWidthAt   // its own sampled silhouette
```

**A build belongs to a character, not to the page.** Each buddy owns a frozen
geometry carrying its own half-width table — the sampled silhouette the face is
fitted against, which has to be of *this* egg. Two characters with different
builds render correctly in the same frame.

`applyShape(name)` still exists and still mutates the shared `G`, for callers
written against it before this was per-instance. A character built with its own
geometry ignores it.

| | `v1` | `kawaii` |
|---|---|---|
| body | 100 × 104 | 104 × 96 |
| egg | `blob 0.28` | `blob 0.34`, sitting lower |
| face hole | 66 × 67 at y 26 | 70 × 62 at y 24 |
| resting eye | 9.3 × 11.5, 23 apart | 15 × 20.5, 28 apart |
| mouth | width 30 at y 31 | width 22 at y 27 |
| cheeks | 11.5 × 7 | 15 × 8.5, set lower and wider |

Every non-resting eye — surprised, thinking, confused — is a multiple of the
**resting** eye rather than of `eyeR`, so a build with big eyes does not end up
with a surprised face whose eyes are smaller than its happy one.

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
| `accent` | anything **worn** — cap, band, crown, bow. Keep it well clear of `body`: a cap the same colour as the head is not a cap, it is a haircut |
| `outline` | the contour, drawn under every fill. `null` for a flat skin |
| `outlineW` | its weight on the body. `outlineFaceW` for the face patch, `outlineWornW` for anything worn |
| `blushA` | how much of the cheek lands. The theme's blush colour carries no alpha of its own |
| `form` | set `false` to opt out of the form light entirely and draw flat |
| `formLit` / `formDark` | multipliers on the highlight and the terminator. Default 1 |
| `blush` | cheeks — set `null` to disable |
| `shadow` | ground contact |
| `correct` / `wrong` | feedback accents |
| `confetti` | array of celebration particle colours |

---

## The form light

One light for the whole character, fixed in world space. It is what makes the
silhouette a sphere rather than a disc, and it is why the face reads as a hole
in something instead of a shape printed on it — a hollow has a shaded lip and a
decal does not.

Fixed, never attached to the turn: a highlight that swings with the yaw reads
as a moving lamp, and the whole point is to give the face a form to travel
*across*. Anything worn takes the same light at about two-thirds strength, so a
hat cannot end up flat on a shaded head.

```js
mount('#buddy', { theme: { extends: 'ink', form: false } })   // flat, as before
mount('#buddy', { theme: { extends: 'coral', formDark: 0.6 } })  // softer terminator
```

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

---

## Shape treatment

Optional slots that add character without adding a drawn line. All are off by
default, so nothing existing changes shape.

| slot | |
|---|---|
| `outline` | contour colour, or `null` |
| `outlineW` | contour width (default `5`) |
| `ears` | `'darker'` for a tonal step, `true` for the body paint, or a colour |
| `hairline` | number of scallops across the top of the face patch (`0` = plain oval) |
| `tongue` | fill inside an open mouth |

```js
mount('#buddy', {
  theme: {
    extends: 'ink',
    outline: '#0A2F4E', body: '#3A9BE6',
    ears: true, hairline: 3, tongue: '#E0607A',
    face: '#F2FAFF', feature: '#0A2F4E',
  },
})
```

Three implementation notes worth knowing, because each was a bug first:

**Separation without a line.** `ears: 'darker'` steps the ear tone down from
the body gradient rather than drawing a contour around it. An ear the same
colour as the head disappears into it at the front; a tonal step separates them
the way depth does, and unlike a line it needs no special handling where the
two shapes meet. `outline` still exists for a deliberately sticker-like look,
and when it is set the whole silhouette is stroked before any of it is filled —
stroke and fill each piece in turn and the head's contour runs straight across
the ears.

**Ears are never allowed inside the silhouette.** They sit on the same sphere
as everything else, so the turn carries them for free, but an ear is a lump on
the side of a head rather than a decal printed on it: let the projection carry
it inward and it simply disappears under the face halfway through a turn.

**One function builds the face patch, and both the fill and the feature clip
use it.** Otherwise the features get clipped to a different shape than the one
that was drawn, which is invisible until an eye reaches the hairline.
