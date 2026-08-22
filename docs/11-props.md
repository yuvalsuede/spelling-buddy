# 11 · Props

Seventy-five items across seven slots. All procedural — the same arcs and
Béziers the character is drawn from, no images anywhere — and all *worn*
rather than pasted on: each one rides the head's own rotation, passes behind
the body instead of fading, and narrows across the turn only on the axis that
actually foreshortens.

```js
buddy.wear('cap')
buddy.wear(['cap', 'glasses', 'bow'])
buddy.wear([{ name: 'cap', color: '#4A73C4' }, 'pencil'])
buddy.wear(null)                       // take everything off
buddy.wearing                          // ['cap', 'pencil']
```

`mount()` and the constructor take the same thing:

```js
mount('#buddy', { accessories: ['crown', 'glasses'] })
new Buddy({ accessories: 'party-hat' })
```

---

## The catalogue

| Slot | n | Items |
|---|---|---|
| `head.top` | 14 | cap · crown · beanie · pompom-hat · party-hat · wizard-hat · sun-hat · rain-hat · explorer-hat · pirate-hat · hard-hat · chef-hat · graduation-cap · tiara |
| `head.side` | 14 | bow · flower · star-clip · heart-clip · moon-clip · rainbow-clip · lightning-clip · apple-clip · pencil-clip · rosette · pompom-clip · butterfly-clip · leaf-sprig · ribbon |
| `face` | 8 | glasses · round-glasses · square-glasses · heart-glasses · star-glasses · sun-glasses · safety-goggles · monocle |
| `ears` | 5 | headphones · earmuffs · ear-defenders · headset-mic · hearing-aids |
| `neck` | 10 | bow-tie · necktie · scarf · bandana · medal · name-badge · lanyard · ruff-collar · rainbow-collar · apron |
| `hand` | 20 | pencil · crayon · marker · paintbrush · chalk · ruler · pointer · magnifier · clipboard · closed-book · open-book · flashcards · alphabet-card · number-card · letter-tile · puzzle-piece · building-block · abacus · globe · trophy |
| `back` | 4 | backpack · library-bag · cape · rolled-poster |

`Buddy.accessories` returns every id. `docs/index.html` renders the whole
catalogue live, which is the only version of this table that cannot go stale.

---

## What clashes with what

Each prop declares a **footprint** — the parts of the character it physically
occupies — and two props conflict exactly when they share one. There is no
hand-written table of pairs: a cap and a crown clash because both need
`skull.top`; a bow does not, because it only needs `skull.left`.

```js
import { conflictsWith, checkLoadout } from 'spelling-buddy'

conflictsWith('cap')                     // ['crown', …]
checkLoadout(['cap', 'crown'])           // ['cap and crown both need skull.top']
checkLoadout(['cap', 'bow', 'pencil'])   // []
```

Tokens: `skull.top` `skull.band` `skull.left` `skull.right` `skull.back`
`face.eyes` `face.mouth` `ear.left` `ear.right` `neck.ring` `chest.front`
`back` `hand.left` `hand.right`.

At most **three worn and one held**, one item per hand. A conflicting loadout
is first-listed-wins at runtime — a page must never crash over a hat — and a
hard error in export and in tests, because a release asset must never be
silently generated with a crown inside a cap.

Occupancy is doing real work rather than describing the drawing: hearing aids
take only `ear.left`/`ear.right` and leave `skull.band` free, so they can be
worn with a cap. Headphones take the band too, so they cannot.

---

## Holding something

Hands rest hidden — this character has no arms until it needs them. Wearing a
held prop puts the hand out and *keeps* it out, and the prop rides the live
hand, so it goes with a wave and passes behind the body when the hand does.

```js
buddy.wear('pencil')       // one hand, up and a little out
buddy.wear('open-book')    // both hands, low and wide
```

Two-handed items ask for a lower, wider grip on purpose: the midpoint of two
*raised* hands is level with the eyes, and a book held there is a book held
across the character's own face.

Two items carry a letter, drawn from the rig's own procedural glyph set:

```js
buddy.wear([{ name: 'alphabet-card', letter: 'K' }])
buddy.wear([{ name: 'letter-tile', letter: 'q' }])
```

That is not text in the SVG sense — no font, no `<text>`, nothing to localise.
It is the same Bézier outlines `trace()` teaches, and because the letter is a
parameter, `alphabet-card` is one asset however many letters it can show.

---

## Recolouring

A prop never names a colour. It names a **material role**, and the role
resolves against the character's theme and whatever the caller passed in —
which is why half the catalogue's variety is one prop in six palettes.

```js
buddy.wear([{ name: 'cap', color: '#4A73C4' }])
buddy.wear([{ name: 'cap', band: '#1D3E7A' }])   // legacy per-prop option names
```

| Role | |
|---|---|
| `accent` | the item's own colour — what a recolour changes |
| `accentDeep` `accentLight` | its shadow and lit sides: bands, brims, highlights |
| `neutral` `neutralDeep` | straps, stems, string — not the item's identity colour |
| `ink` | the character's feature colour: rims, drawn lines |
| `lens` `gem` `white` | glass, the one contrasting spot, plain white |

Some items carry their own default and ignore the theme's accent — a flower is
pink whatever the character's accent is, because a flower that recolours with
the skin stops being a flower and becomes a blob.

**The feedback colours are reserved.** Green means "you got that right". A prop
that asks for `theme.correct` gets something else back. A green hat spends the
only colour in the product that carries a meaning, and after that a correct
answer is just another green thing on the screen.

---

## Writing your own

A prop is a declaration, not a drawing. It says where it lives (a **frame**),
what it is made of (a **shape tree**), and what it covers. The compiler owns
projection, depth sorting, foreshortening, clipping to the head's real outline,
the form light and the contour pass — the things that each took several
attempts to get right on the six accessories that predate the framework, and
which no item author should have to know.

```js
import { defineProp } from 'spelling-buddy'
import { headBillboard } from 'spelling-buddy/src/props/frames.js'
import { group, star, circle } from 'spelling-buddy/src/props/shapes.js'

defineProp({
  id: 'comet-clip',
  kind: 'wearable',                 // or 'held'
  slot: 'head.side',
  occupies: ['skull.left'],
  passes: ['headRear', 'headFront'],
  z: 40,
  defaults: { accent: '#8FD3E8' },
  checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body' },
  parts: [{
    frame: headBillboard({ at: [-0.46, -0.68, 0.52], radius: 1.02, minFacing: 0.54 }),
    art: group([
      star({ outer: 26, inner: 11, points: 4, fill: 'accent' }),
      circle({ r: 6, fill: 'accentLight', outline: 'none' }),
    ]),
  }],
})
```

`defineProp` validates on the way in — an unknown footprint token, a pass that
does not exist, a raw hex where a role belongs, a part with no frame. A
registry that can hold a broken entry is a registry that will hold several.

### Frames

| Frame | What the turn does to it |
|---|---|
| `headBillboard` | flat art stuck to a point on the skull — clips, bows, badges. Most of the catalogue |
| `headRing` `headBand` | a solid band; or the near half of one, stroked |
| `headDome` `headCone` | a crown clipped to the head; a cone or truncated cone for a tall hat |
| `headDisc` `headPlate` | a brim wider than the head; a flat board |
| `headHoop` `headSpikes` `ringStuds` | an arch over the crown; a crown's points; beads threaded on a ring |
| `earPair` `facePlane` | both ears, sorted separately; the face's own frame, for eyewear |
| `handGrip` `bothHands` | the live hand; and the span between two of them |
| `headAnchor` | a point that rides the surface without billboarding — a button, a jewel |

### Shapes

`group` `ellipse` `circle` `roundedRect` `star` `heart` `rosette` `polygon`
`path` `line` `ring` `repeat` `mirror` `around` `custom`.

Every shape declares whether it is part of the silhouette:

```js
star({ outer: 26, fill: 'accent' })                  // outline: 'outer' (default)
circle({ r: 6, fill: 'gem', outline: 'none' })       // an interior detail
```

`'outer'` is traced by the contour pass; `'none'` is left alone. That one flag
is the difference between a gem and a gem with a line drawn round it, and at
small sizes it is the whole look.

### Passes

Twelve draw slots, ordered by the registry rather than by the order a caller
listed things in. `wear(['cap','crown'])` and `wear(['crown','cap'])` are the
same character wearing the same two things, and they draw identically.

`rearExternal` → `headRear` → *body* → `bodyFront` → *face* → `headFront` →
`faceFront` → `heldRear` → *hands* → `heldFront`.

A part may pin itself to one named pass and say which depth half it wants
there. Held things need that: their far half belongs behind the whole
character, their near half behind one hand, and two of those passes present the
same back/front answer.

---

## The four rules the frames enforce

Each one shipped as a bug before it became a rule.

**Worn things use a true rotation, never the face's wrap cheat.** The cheat
pulls features inward so eyes never overhang the body edge. Applied to hardware
it drags an earcup into the middle of the face at profile.

**Depth sorts; it does not fade.** A prop faded across the terminator dissolves
mid-turn. Solid objects do not dissolve — they pass behind.

**Foreshorten the axis that foreshortens, and stop before the shape stops
reading.** Scaling both axes shrinks a bow to a speck at three-quarter view.

**A solid built from many segments is outlined as one shape.** Stroke each
segment separately and a cone comes out as a fan of radial lines, and a brim
gets a chord straight across it where it crosses the horizon.

---

## Two things about this character in particular

**There is no torso.** Head and body are one egg, and the face patch reaches
89% of the way down it. So neckwear sits across the bottom of the chin and
draws *after* the face — there is nothing below the face to put a collar on.
A back prop is deliberately made wider than the body so it peeks past both
edges, because an item nobody can see until the character turns round is not a
prop, it is a surprise.

**A pale prop on a pale skin is invisible.** The same rule the themes have:
either forty points of separation, or a contour. Six of the skins carry one;
on the flat skins, check the item against the body colour it will actually sit
on.
