# Eggs, and the thing that lives afterwards — a plan

**Status: plan, not code.** Nothing here is built. Decisions marked
**[decide]** are yours; everything else follows from three you have already
made: this is a pet that *lives*, an egg hatches a **skin from the set**, and
cracking is driven **programmatically** so the product picks what breaks it.

---

## 0. The one thing to get right first

A virtual pet for six-year-olds is a mechanic with a sharp edge on it. The
classic Tamagotchi loop works by **guilt**: come back or it suffers. That is a
manipulation pattern, it is aimed here at children, and it would be the single
most damaging thing this feature could ship with.

So, stated up front as a constraint rather than a preference:

- **Nothing decays.** The buddy is never hungry, never sick, never dying, never
  sad *because you left*. Its worst state is asleep.
- **The streak raises the ceiling, never lowers the floor.** Practice makes it
  brighter, livelier, better dressed. Absence makes it *quieter* — asleep, still
  yours, exactly where you left it.
- **No timers the child can lose.** No "hatches in 4 hours, come back". The egg
  opens because they did something, not because a clock ran out.
- **No purchase, no gacha, no duplicates-to-trade.** Eggs are earned by
  practising, and a skin you already have never comes out of one.

That still leaves a genuinely warm loop: a thing that is *theirs*, that
remembers them, and that visibly grew because they turned up. Everything below
assumes those four rules.

---

## 1. What the child experiences

1. They earn an egg. It appears — small, still, on the shelf or beside the
   lesson.
2. It **stirs**. A wobble, a tick from inside, at rest, without being asked.
3. Something they do cracks it — a tap, a correct answer, finishing a list.
   The crack spreads a little further each time and **stays** between sessions.
4. It opens. The top tips off, a buddy climbs out, blinks, and looks at them.
5. That buddy is **theirs from then on** — it is the character in their lessons,
   it remembers its name, and it is in the nest with the others they have
   hatched.

Steps 2–4 are rig work. Step 5 is product work, and it is where the value is:
the hatch is a lovely thirty seconds, the *belonging* is what brings them back.

---

## 2. The rig layer — `spelling-buddy`

### The shell is the character's own silhouette

The head is already an egg (`blob: 0.28`). The shell is `silhouetteSub` at
about 1.35× with a slightly heavier blob, which means the hatch reads as
**"it was in there all along"** rather than as two unrelated drawings. No new
shape language, no assets, and it inherits the contour and the form light for
free on the kawaii skins.

### Cracking is one number

```js
buddy.egg(0.4)        // 0 = whole · 1 = about to open
buddy.hatch()         // plays the opening, then the buddy is out
```

`crack` is a value the product owns. The rig never decides when to crack —
taps, correct answers, a lesson finishing and a timer are all the same input,
which is what you asked for.

The crack line itself is a **seeded jagged polyline** across the shell:
deterministic per egg, so the same egg cracks the same way on every device and
after every reload, and a snapshot test can lock it. Progress reveals it from
the middle outward; at 1.0 it has reached both edges and the shell is two
pieces held together by nothing.

### The pieces

The two halves are real paths, so at hatch the top can tip, slide and fall with
the same spring machinery the body uses — no keyframes. Shell fragments become
a new particle type (`shard`), which is a dozen lines beside `confetti`, `star`
and `sparkle`.

### The state it adds

```js
S.egg = { crack: 0, open: 0, wobble: 0, seed: 1, skin: 'strawberry' }
```

Five numbers, spring-driven like everything else. `null` when there is no egg,
which is the default, so nothing existing changes.

### The action

`ACTIONS.hatch` — about 2.4s: shell rocks twice · a beat of stillness · the top
lifts and tips · shards · the buddy rises with a squash-and-stretch overshoot ·
blinks · `express('surprised')` → `express('happy')` · one `correct`-scale
sparkle burst. Cues fire at each beat (`egg:tick`, `egg:crack`, `egg:open`,
`egg:out`) so sound can hang off them without the rig knowing about audio.

### Egg colour foreshadows the skin

`EGGS` is derived from `THEMES` — a strawberry egg is the strawberry skin's body
colour, paler, with the same contour. Nothing new to draw and no palette to keep
in sync. Speckles are `theme.accent` at low alpha. **[decide]** whether the
colour is a *promise* (the child can tell what is coming) or a *tease* (close
but not identical, so the reveal still surprises).

### How it gets verified, in this repo's terms

Invariants, each mutation-tested:

- the buddy is **never** visible through the shell below `open`
- the two halves never leave a gap the background shows through, at any crack value
- the crack is monotonic in its parameter — no jump between 0.49 and 0.51
- a shard is never drawn in front of the shell it came from
- the same seed cracks identically twice

Snapshots at crack 0 / 0.33 / 0.66 / 1 and mid-hatch, per skin family, plus a
sweep sheet — because every visual bug this project has had was invisible at the
two angles anyone checks by hand.

**Rig estimate: ~2 days.** It is one new module, one action, one particle type,
and about 60 lines of tests.

---

## 3. The pet layer — SpellingJoy

The rig stays stateless. The product owns everything below.

### What a pet is

```
pet = {
  id, ownerId,
  skin,               // which of the eighteen
  wearing,            // an accessory, or none
  name,               // the child names it — see [decide]
  hatchedAt,
  lastSeenAt,
  streak,             // days practised in a row
  wordsLearned,       // lifetime, drives growth
}
```

### What it maps to on screen

The rig already has nine expressions and thirteen actions. The pet's state is a
*function* over them — no new art:

| pet state | comes from | shows as |
|---|---|---|
| awake and pleased | practised today | `happy`, idle actions on |
| proud | streak ≥ 3, or a personal best | `proud`, occasional `dance` |
| curious | new lesson, first visit of the day | `lookAround`, `peek` |
| dozing | away a while | `sleepy`, slow bob, no idle actions |
| delighted | you came back | wakes, `jump`, `wave` |

Note what is missing: nothing for hunger, nothing for neglect.

### Storage **[decide]**

Two options, and they are not equal:

- **On the account.** Follows the child across devices, survives a cleared
  browser, and is the only version that works for a class where the teacher sees
  the room. Needs a table and an endpoint.
- **In `localStorage`.** Ships in an afternoon, and loses the pet the first time
  a school wipes a browser profile — which for a thing framed as *yours* is
  worse than not having it.

Recommendation: on the account, with `localStorage` as the pre-login case that
migrates on sign-up.

### Earning eggs **[decide]**

The rate is the whole economy, and it is a product question rather than a
technical one. A starting proposal: **one egg per completed word list**, and a
skin never repeats until all eighteen are out. That gives about eighteen hatches
of runway, and after that eggs can hatch accessories instead.

### Where it lives on screen **[decide]**

- Beside the lesson (the buddy is already there — the egg sits next to it and
  cracks as answers land), or
- a separate **nest** screen the child visits, which makes hatching an occasion
  but adds a route, a layout and copy.

Both are real; the first is much less work and keeps the reward next to the
effort that earned it.

---

## 4. Order of work

| | what | where | rough |
|---|---|---|---|
| 1 | shell, crack, `buddy.egg(t)` | rig | 1 day |
| 2 | `hatch` action, shards, cues | rig | 1 day |
| 3 | invariants, snapshots, sweep | rig | half a day |
| 4 | pet model + persistence | product | 2 days |
| 5 | state → expression mapping | product | half a day |
| 6 | earning + the crack driver | product | 1 day |
| 7 | the nest / collection view | product | 2 days |

Steps 1–3 are shippable on their own: an egg that hatches is a good reward
animation even before anything remembers it.

---

## 5. Open questions

1. **Naming.** Does the child name their buddy? It is the single strongest
   ownership cue there is — and it is user-generated text on a children's
   product, so it needs a filter, a length cap, and a decision about whether a
   teacher ever sees it.
2. **One pet or many?** A collection of eighteen is a lovely gallery and a
   diluted relationship. A single pet that changes skin as it grows is a
   stronger bond and a smaller feature.
3. **Does the pet appear in lessons, or only in the nest?** If it replaces the
   lesson buddy, every screenshot in the product becomes per-child.
4. **Classroom implications.** If one child hatches nine and another two, that
   is visible. Worth deciding deliberately rather than discovering.
