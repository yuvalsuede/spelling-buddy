# Expressions & animations

Two kinds of thing, and the distinction is load-bearing:

- **Expressions** are *states*. They persist until you change them. Set one when
  your UI enters a mode.
- **Actions** are *events*. They play once over a fixed duration, then restore.
  Fire one when something happens.

---

## Expressions

`buddy.express(name)` — cross-fades over 160 ms.

| Name | Reads as | Use it for |
|---|---|---|
| `happy` | ∩ ∩ closed arcs | the resting default |
| `excited` | `>< ><` squeezed shut | anticipation, "go on!" |
| `thinking` | dots glancing up, brows raised | while the learner is typing |
| `surprised` | wide dots, small O | an unexpected input |
| `proud` | ★ ★ star eyes, smile | after a success |
| `sleepy` | heavy droopy lids | idle timeout, "still there?" |
| `confused` | mismatched eyes, one brow up | a wrong answer, a re-prompt |
| `dizzy` | spinning spirals | after `dizzy`, comic failure |
| `content` | ∪ ∪ soft arcs, smile | calm neutral, end of a session |

All nine work at **any head angle** — they're drawn into the projected face
frame, so they foreshorten correctly in profile rather than being flat overlays.

---

## Actions

`buddy.react(name)`.

### Feedback

| Action | Duration | What happens |
|---|---|---|
| `correct` | 1.5 s | Jumps, arms up, confetti and green stars, lands on `happy`. |
| `wrong` | 1.1 s | Recoils side to side, a sweat drop, settles into `thinking`. |
| `nod` | 0.9 s | Two affirming nods. Doesn't change expression. |

### Turn

| Action | Duration | |
|---|---|---|
| `turnaround` | 2.2 s | Full 360°. Shows the back of the head. |
| `peek` | 2.6 s | Turns away, glances back over its shoulder, comes back surprised. |
| `lookAround` | 2.8 s | Scans left, right, up. Good for "waiting for input". |

### Physical

| Action | Duration | |
|---|---|---|
| `jump` | 1.25 s | Anticipation crouch, launch, hang, landing squash. |
| `dizzy` | 3.0 s | Two full spins, wobbles down, ends `confused`. |

### Social

| Action | Duration | |
|---|---|---|
| `wave` | 2.0 s | Raises a hand and waves. Good for first load. |
| `dance` | 3.4 s | Sways, bobs, both arms, sparkles. Streak rewards. |

### Idle

| Action | Duration | |
|---|---|---|
| `sleep` | 4.0 s | Droops, tilts, emits `z`s. |
| `think` | 2.6 s | Turns away, hand to chin, thought sparkles. |

### Micro

| Action | Duration | |
|---|---|---|
| `pop` | 0.55 s | A quick squash-and-stretch. Fires on click by default. |

---

## Interruption

`react()` interrupts cleanly. The running action's `end()` is called first, so
orientation targets and hand state are always restored — you can fire actions on
every keystroke without accumulating drift.

```js
buddy.react('nod')
buddy.react('correct')   // nod ends properly; correct starts from a clean pose
```

Guard on `busy` if you'd rather not interrupt:

```js
if (!buddy.busy) buddy.react('lookAround')
```

---

## Idle behaviour

```js
mount('#buddy', { idleActions: true, idleEvery: [12, 25] })
```

Every 12–25 s of inactivity the rig plays a random action tagged `idle`
(`lookAround`, `think`, `sleep`). It never fires while another action or a spell
is running. Cheap way to keep a character from feeling like a static image
during long pauses.

---

## Head control

Independent of expression and actions:

```js
buddy.face(45, -10)      // degrees: yaw, pitch. Turns off cursor tracking.
buddy.turnBy(0.2, 0)     // radians, relative — for drag gestures
buddy.s.autoLook = true  // hand control back to the cursor
```

Yaw is unbounded — pass `540` for one and a half turns. Pitch is clamped to
about ±32° because the face leaves the silhouette beyond that.

---

## Tuning motion

```js
buddy.s.tempo      = 1.4    // everything faster
buddy.s.bobAmt     = 0      // stop the idle float
buddy.s.breathAmt  = 0.4    // subtler breathing
buddy.s.blinkEvery = 6      // blink less often
```

For `prefers-reduced-motion`:

```js
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
if (calm) Object.assign(buddy.s, { bobAmt: 0, breathAmt: 0.3, showTrail: false, tempo: 0.8 })
```

Expressions still read fine with all motion off — they're pose changes, not
movement.

---

## Adding your own

Expressions and actions are plain data. To add an expression, add a function to
`EXPRESSIONS` that draws into the projected frame:

```js
import { EXPRESSIONS } from 'spelling-buddy'

EXPRESSIONS.wink = (s, T, F, S) => {
  // s = Surface, T = theme, F = face frame, S = rig state
  // F.eyeL / F.eyeR carry projected position + foreshortening
}
```

To add an action, add a timeline:

```js
import { ACTIONS } from 'spelling-buddy'

ACTIONS.bounceTwice = {
  dur: 1.2,
  tags: ['physical'],
  start(B) { B.express('excited'); B.s.offVY = -180 },
  tick(B, p) { B.once(0.5, () => { B.s.offVY = -140 }, p) },
  end(B) { B.express('happy') },
}
```

Because both live in the shared registry, anything you add appears at runtime,
in `Buddy.expressions` / `Buddy.actions`, **and** in every exported asset — SVG,
sprite sheet, GIF. See [Architecture](./07-architecture.md).

Two rules for actions that keep them composable:

1. Never assign positions directly. Set spring **targets** (`yawTarget`) or
   inject **velocity** (`offVY`, `squashVY`). That's what makes hand-authored
   beats and physical settling coexist.
2. Restore whatever you changed in `end()`.
