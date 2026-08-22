# The asset system — a plan

**Status: steps 1–3 done; step 5 started (28 of 75 props).**

| step | state |
|---|---|
| 1 · four blockers | done — per-instance geometry, seven render passes, per-shape outlines, SVG id namespacing |
| 2 · the prop framework | done — `src/props/`: registry, frames, shapes, materials, compiler |
| 3 · port the existing six | done — byte-identical to the hand-written drawings across 216 renders; snapshots unmoved |
| 4 · cast axes and the twelve | not started |
| 5 · props in slot batches | head-side (14) and headwear (14) done; 47 to go |
| 6 · the egg | not started |
| 7 · export, manifest, `--check` | not started |

Scope, in the founder's words: *"you only build the system. i will use it
wherever i want. you do not need to care for hosting nor collection, nothing.
you are just the asset provider."*

So this library produces **characters, props, an egg, and files**. It owns no
state, no economy, no persistence, no screens. Two decisions already taken:
the cast is **one creature, many looks** (the silhouette stays; fringe, ears
and palette vary), and delivery is **both** — every prop procedural in the
library *and* exported as SVG + PNG with a manifest, so a file can be dropped
anywhere without running the rig.

Reviewed with Codex against the actual source. Where it found something I had
missed, it says so.

---

## 0. Four blockers, before any of this scales

None of these matter at six accessories and one character. All of them are
load-bearing at seventy-five and twelve, and every one is cheaper to fix now
than after the catalogue exists.

1. **`applyShape` mutates a module-global `G`.** Two characters cannot render
   concurrently — a page with Pip and Momo side by side draws one of them with
   the other's proportions. Geometry has to become per-instance
   (`createGeometry(shape)`, frozen, owning its own half-width table) with the
   global kept as a deprecated alias. *This is the prerequisite for a cast
   existing at all.*
2. **The renderer has four accessory placements** — `back`, body, face,
   `front`. Held items, neck items, back items and face-underlays need their
   own passes, and z-order must come from the registry rather than from the
   order the caller happened to list things in.
3. **The contour pass strokes every fill.** I added that to give six
   accessories an outline cheaply, and it is wrong at scale: a lens, a gem, a
   pom-pom centre or a book page gets a body-weight line around it. It has to
   become explicit per art node — `outline: 'outer' | 'stroke' | 'none'`.
4. **SVG clip and gradient ids restart per document.** Two exported assets
   inlined into one page collide. This bug has already bitten once, in the
   contact sheets. Exported files need an id namespace derived from the asset
   id.

**Nothing else in this plan should start before these four are done.**

---

## 1. The cast — one creature, many looks

### The axes

| axis | values |
|---|---|
| fringe | `smooth` · `soft-3` · `soft-5` · `center-tuft` · `side-left` · `side-right` · `curtain` |
| ears | `none` · `nub` · `round` · `point` · `flop` |
| build | `classic` · `cuddle` (today's kawaii) · `sprout` (taller, narrower) |
| palette | the eighteen skins |

Fringe, ears and build are **geometry** and must leave the theme. Today
`theme.hairline` and `theme.ears` conflate palette with shape, which is why a
cast cannot be expressed in the current model: you cannot have two characters
with the same colours and different ears.

### Twelve named characters

Twelve is enough to feel like a cast and few enough that each one can be
looked at. A starting set, one per palette family:

| | build | fringe | ears | palette |
|---|---|---|---|---|
| Pip | classic | center-tuft | round | oat |
| Momo | cuddle | soft-5 | flop | strawberry |
| Lumi | sprout | side-left | nub | sky |
| Vivi | cuddle | curtain | point | lavender |
| Tavi | classic | soft-3 | none | apricot |
| Nox | sprout | smooth | point | inkling |
| Coco | cuddle | center-tuft | round | coral |
| Nori | classic | side-right | nub | teal |
| Bram | sprout | curtain | round | plum |
| Sunny | cuddle | soft-5 | none | amber |
| Mika | classic | side-left | flop | snow |
| Zuzu | sprout | soft-3 | point | indigo |

### The rules that stop them being one drawing in twelve colours

- Every pair differs on **at least two non-colour axes**.
- The cast must survive a **monochrome edge-map sheet** — silhouettes and hair
  only, no fill. If two are indistinguishable there, they are the same
  character.
- **Accessories are never identity.** Every character has to read bare; a
  character who is only recognisable in their hat is not a character.
- Build differences stay within about ±8%. Beyond that they stop being family.

---

## 2. The props — 75, not 100

Seventy-five real items beats a hundred padded with recolours. Parameterised
items (`alphabet-card` with a letter, `letter-tile`) count once.

| slot | n | items |
|---|---|---|
| headwear | 14 | cap · crown · beanie · pom-pom hat · party hat · graduation cap · sun hat · rain hat · chef hat · explorer hat · pirate hat · wizard hat · hard hat · tiara |
| head-side | 14 | bow · flower · star clip · heart clip · moon clip · rainbow clip · lightning clip · apple clip · pencil clip · rosette · pom-pom clip · butterfly clip · leaf sprig · ribbon |
| face | 8 | glasses · round · square · sun · heart · star · safety goggles · monocle |
| ears | 5 | headphones · earmuffs · headset mic · ear defenders · hearing aids |
| neck & front | 10 | bow tie · necktie · scarf · bandana · medal · name badge · alphabet lanyard · ruff collar · rainbow collar · apron |
| held | 20 | pencil · crayon · marker · paintbrush · chalk · ruler · pointer · magnifier · closed book · open book · flashcards · clipboard · alphabet card · number card · letter tile · puzzle piece · building block · abacus · globe · trophy |
| back | 4 | backpack · library bag · cape · rolled poster |

Roughly a third are one shared primitive with different numbers (every clip,
every glasses variant, most held items). The hard ones are the volumes:
anything that wraps the skull (all fourteen hats), anything paired across the
head (ear gear), anything with two hands and self-occlusion (open book, abacus,
globe).

### Traps — deliberately not shipping

Eye patch, opaque visor, superhero mask — they destroy eye-based expression.
Fake nose, moustache, pacifier — they fight the visemes. Full wig — duplicates
the fringe axis. Animal-ear headbands — four ears. Helmets and hoods — erase
the family silhouette. Wings and tails — a new species, which is the opposite
of the decision taken. Full outfits — there is no torso; they become body
decals. Text signs and name tags — fonts, localisation, and `<text>` in
exported SVG, which this rig has an invariant against. Weapons, uniforms,
religious dress, branded sportswear. Tiny dangling jewellery — illegible at
48px. And recolours or mirrors counted as new assets.

---

## 3. How a prop is authored

Six hand-written `draw()` functions of 20–60 lines each do not become
seventy-five. But a JSON scene language is the other failure — a
general-purpose renderer nobody can debug. The middle is a **typed builder**:
a registry entry that declares what the thing *is*, with an escape hatch to
imperative drawing for the dozen items that need it.

```js
defineProp({
  id: 'star-clip',
  kind: 'wearable',
  slot: 'head.side',
  occupies: ['skull.left'],
  frame: headBillboard({ at: [-0.52, -0.66, 0.53], radius: 1.02,
                         orient: 'head-up', minFacing: 0.55, roll: -0.12 }),
  art: group([
    star({ outer: 18, inner: 8, points: 5, fill: 'accent', outline: 'outer' }),
    ellipse({ rx: 4, ry: 4, fill: 'accentDeep' }),
  ]),
  checks: { visibility: 'localized', minReadableSize: 48, contrastAgainst: 'body' },
})
```

The compiler owns projection, which pass to draw in, foreshortening, squash,
outline and palette — the four things that took several attempts each to get
right on the existing six, and which no item author should have to know.

Helpers to build first: `headAnchor` `headBillboard` `headRing` `headBand`
`headDome` `headHoop`, the 2D shapes (`path` `ellipse` `roundedRect` `star`
`heart` `rosette` `repeat` `mirror`), the rig frames (`eyePair` `faceAnchor`
`earPair` `collarRing` `handGrip` `backAnchor`), and the behaviours
(`clipToHead` `foreshortenAcross` `paired` `splitAtDepth`).

Target: **no more than 10–15 custom renderers out of 75**. Custom items still
declare occupancy, materials, passes and checks — the escape hatch is for the
drawing, not for the metadata.

Colours become **material roles** (`accent` `accentDeep` `accentLight`
`neutral` `ink` `lens`), never raw hex from a caller, and never `theme.correct`
or `theme.wrong` — green means "you got it right" and a green hat spends that
meaning.

---

## 4. Slots, conflicts, order

Three separate concepts, which the current single "accessory" idea conflates:

- **slot** — the user-facing category
- **frame** — which projection it lives in (`head` `face` `ear` `collar` `hand` `back`)
- **occupies** — physical footprint, for conflicts

That is what settles glasses versus cap: both are wearable, but glasses are
`frame: face` (they follow the face's wrap and visibility) and a cap is
`frame: head` (it follows the skull's true rotation). Getting that wrong is how
an earcup ends up in the middle of a face.

Occupancy tokens: `skull.top` `skull.band` `skull.left` `skull.right`
`face.eyes` `ear.left` `ear.right` `neck.ring` `chest.*` `back` `hand.left`
`hand.right`. Cap and crown both take `skull.top + skull.band`, so they
conflict; bow takes `skull.left`, so cap + bow is fine.

At most **three worn + one held**, one item per hand, two-handed props take
both. A conflicting loadout is first-listed-wins at runtime and a **hard error
in export and tests** — a release asset must never be silently generated with a
crown inside a cap.

Twelve render passes, ordered by the registry rather than by the caller:
rear external → head rear → body → body front → face patch → face features →
head front → face front → held rear → hands → held front → particles.

---

## 5. Keeping seventy-five items honest

The existing generic invariants already run per accessory and carry over. What
changes at this size:

**Visibility becomes a declared policy, not one rule.** Today every accessory
must be visible at every angle, which is right for a crown and wrong for a hair
clip — forcing a clip to show through the skull makes it float. Four policies:
`circumferential` (bands, hats), `localized` (clips, flowers), `face` (glasses,
follows the face's own visibility), `paired` (at least the near one shows).

**New generic checks:** registry validity and unique ids · finite geometry at
every angle, pitch and build · Canvas/SVG parity per primitive family ·
nothing clipped by the export stage · minimum readable area and stroke at 48px
· attachment distance under yaw, pitch, jump and squash · horizon continuity
sampled at half a degree · eyewear never covers both pupils or the mouth ·
contrast against whichever surface it actually sits on · unique SVG ids across
inlined assets.

**Snapshots by archetype, not by item.** Seventy-five items × eight angles is
not a snapshot suite, it is a wall nobody reads. About eighteen goldens — one
per geometry archetype (billboard, pair, ring, dome, hoop, collar, one-hand,
two-hand, back) × flat and outlined — plus seven human-review contact sheets,
one per slot, at 0/45/90/180° and minimum size. The release export then
compares checksums for every generated file, which is where per-item exactness
belongs.

Compatibility sweeps come from occupancy metadata — not all 75².

---

## 6. Export and the manifest

**Composites, not overlays.** A cap exported on its own cannot be laid over a
separate head later: its rear half and the skull's occlusion of it are missing.
Every published asset is a whole character wearing the thing.

```
assets/v1/
  manifest.json
  svg/characters/<character>/<character>__happy__y000__p000.svg
  svg/props/<prop>/<character>__<prop>__happy__y045__p000.svg
  png/256/…  png/512/…
  animations/hatch/<character>/…
  sheets/…
```

Eight yaw angles (0–315 in 45° steps), pitch 0 in the release pack, PNG at 256
and 512 RGBA on a fixed square stage with 8% padding — **not trimmed**, because
changing bounds per asset makes every UI that uses them jitter. Optional
`--trim` records bounds and pivot in the manifest instead. SVG is the
high-resolution source; sprite sheets are for actions, turnarounds and the
hatch only, each with a JSON of cell size, frame count and duration.

Published by default: all 75 props on one canonical character × 8 angles, plus
12 bare characters × 8 angles. The full cross-product is a CLI flag, not a
committed folder.

`manifest.json` carries the schema and collection versions, the rig version and
a **source digest**, the coordinate system, then per prop its slot, frame,
occupancy, conflicts, materials, visibility policy and minimum size — and per
file its path, hash, bytes, dimensions, content bounds, pivot, grip points, and
which character/prop/expression/angle produced it.

**Anti-drift:** the registry is the only source for runtime, types, export and
manifest; no timestamps in deterministic files; `collection --check`
regenerates into a temp directory and fails on any changed file. Exported
assets are never hand-edited.

---

## 7. The egg

Kept from the earlier plan: the shell is the character's own silhouette
(so the hatch reads as *"it was in there all along"*), crack is a number the
caller owns, crack geometry is seeded and therefore identical everywhere, the
halves are real paths on springs, shards are geometry shared by both backends.

What the review changed:

- **Four rig states** — `closed`, `wobbling`, `cracked`, `opening`. Everything
  about earning, shelves and ownership leaves the plan with the product layer.
- **`crack` is not spring-driven.** It is caller state, set directly. Only
  `open` and the halves' transforms need springs.
- **Draw one whole shell while merely cracked**, and swap to two halves only
  when opening starts — with an overlapped seam at `open = 0`, or antialiasing
  opens a hairline down the middle.
- **The crack must be x-monotone**, non-self-intersecting, and meet the sampled
  shell boundary exactly at both ends; reveal it **by arc length**, not by
  vertex count. Short seeded branches for readability, which do not split the
  shell.
- **Its randomness needs its own stateless substream** — an egg must not
  consume the blink and particle RNG, or hatching changes when the character
  blinks.
- **The shell needs thickness**, an inner colour and a bottom lip. Without them
  the opening reads as torn paper rather than as a shell.
- **The top hinges before it detaches.** A free spring from frame one looks
  like the lid teleports.
- **Particles currently draw last, always in front.** Shards need real depth,
  or the invariant has to be honest about it: no shard before separation, and
  the shard layer sorts with everything else.
- `1.35×` fits a bare body — not long ears, not a hat. Hatch bare, clip the
  hidden character to the shell interior, and decide how ears emerge.
- `hatch()` below `crack: 1` should complete the remaining crack in the first
  15% of the action rather than snapping.

Export poses: crack at 0/.25/.5/.75/1, opening at 0/.25/.5/.75/1, plus the
hatch sprite sheet.

**Four to six days**, after geometry is per-instance — not the two I first
estimated.

---

## 8. Order of work

| | what | why it is here |
|---|---|---|
| 1 | per-instance geometry, render passes, explicit outlines, SVG id namespacing | nothing else is safe until this is done |
| 2 | the prop framework: registry, primitives, frames, materials, compiler | the thing that makes 75 possible |
| 3 | port the existing six onto it | proves the framework against known-good drawings |
| 4 | cast axes — fringes, ears, builds — and the twelve | the character side of the same framework |
| 5 | props in slot batches, ~10 at a time, each batch reviewed on a sheet | the bulk of the work |
| 6 | the egg | independent of the catalogue; can run in parallel |
| 7 | export, manifest, `collection --check` | last, because it locks whatever exists |

Steps 1–3 are two to three weeks of real work. Step 5 is the long tail and is
the only part that parallelises cleanly.

---

## 9. What not to do

Do not write seventy-five more `draw()` functions. Do not build a
general-purpose scene language instead. Do not let cast geometry mutate a
global. Do not keep fringe, ears and proportions inside the theme. Do not let
caller order decide z-order. Do not use the face's wrap cheat for skull
hardware, or fade props at the horizon — both are bugs this project already
fixed once. Do not keep the stroke-every-fill contour proxy. Do not let pages
pass raw prop colours. Do not export wearable cut-outs meant to be composited
onto a static head. Do not commit the full cross-product. Do not count
recolours or mirrors as assets. Do not put text, emoji or fonts inside a
procedural prop. Do not give a named character a signature prop they need in
order to be recognisable. And do not let collection, economy or persistence
decisions back into the rig — that was the whole point of the scope
correction.
