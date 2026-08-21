# Speech & visemes

The character can articulate — form actual mouth shapes for sounds, not just
flap open and shut. For a spelling app this is the difference between a mascot
that reacts and one that *teaches*: a learner can watch the mouth make the
sound.

---

## The idea

A viseme is the visible shape of a phoneme. A sprite-based character needs one
drawn mouth per viseme and snaps between them. Here a viseme is a small
**parameter set**:

```js
AI: { w: 29, h: 26, round: 0.75, teeth: 0.34, tongue: 0, lift: 0 }
```

| Field | |
|---|---|
| `w` | mouth width |
| `h` | opening height |
| `round` | 1 = circular corners, 0 = pointed lens |
| `teeth` | 0–1 upper teeth showing |
| `tongue` | 0–1 tongue visible (L, TH) |
| `lift` | vertical offset — FV tucks the lower lip up |

Because they're numbers, any two blend continuously. The mouth *travels*
through the shapes instead of cutting between them, which is what reads as
speech rather than as a jaw hinge.

---

## The set

Ten shapes — the classic Preston Blair grouping, the smallest set that still
reads as speech.

| Viseme | Sounds | Shape |
|---|---|---|
| `rest` | silence | closed, narrow |
| `MBP` | m b p | closed, wide — lips pressed |
| `AI` | ah, eye | wide open, teeth |
| `E` | eh, ee | wide and flat, teeth |
| `O` | oh | rounded oval |
| `U` | oo | small round |
| `WQ` | w, qu | tight round |
| `FV` | f v | narrow, teeth on lip |
| `L` | l, th | open, tongue visible |
| `etc` | c d g k n r s t z | neutral mid-open |

---

## Speaking

### Letter names — exact

```js
buddy.sayLetters('CAT')      // "see" "ay" "tee"
```

Spelling apps say letter *names*, not letter sounds, and there are only 26 of
them — so this is a lookup table, not a guess. `C` → `['etc', 'E']`, `B` →
`['MBP', 'E']`, and so on for all 26.

### Words — approximate

```js
buddy.say('through')         // → L etc O
buddy.say('make')            // → MBP AI etc   (silent final e dropped)
```

Full grapheme-to-phoneme for English needs a pronunciation dictionary. Lip-sync
doesn't: it needs plausible movement in the right rhythm, and nobody can tell a
near-miss viseme from an exact one at speaking speed.

The rules handle digraphs (`th` `sh` `ch` `ph` `qu` `ough` `igh`), vowel pairs,
doubled consonants, and silent final `e` — and get the visually distinctive
consonants right (`m/b/p`, `f/v`, `w`, `l`), which is where the eye actually
looks.

### Exact control

When approximate isn't good enough, supply the sequence yourself:

```js
buddy.sayVisemes(['MBP', 'AI', 'etc'])                    // even timing
buddy.sayVisemes([['MBP', 0.08], ['AI', 0.22], ['etc', 0.1]])  // per-step timing
```

### A single shape

```js
buddy.viseme('O')      // hold it
buddy.viseme(null)     // close
buddy.stopSpeaking()   // close and drop any pending timeline
```

---

## Syncing to real audio

`spell()` articulates each letter automatically as it holds up the card:

```js
buddy.spell('CAT')                      // cards + articulation
buddy.spell('CAT', { speak: false })    // cards only
```

For Web Speech, bind the utterance and the mouth follows the audio:

```js
const utter = new SpeechSynthesisUtterance('cat')
buddy.attachSpeech(utter)
speechSynthesis.speak(utter)
```

`attachSpeech` listens for `boundary` events (which fire per word in most
engines) and drives `say()` for each word, then closes the mouth on `end`.
Where an engine doesn't emit `boundary`, the mouth simply stays closed rather
than desyncing — a still mouth reads better than a wrong one.

For an audio file you control, drive it from your own timings:

```js
audio.addEventListener('play', () => buddy.sayVisemes(timeline))
audio.addEventListener('ended', () => buddy.stopSpeaking())
```

---

## Events

```js
buddy.on('speech:start', () => …)
buddy.on('speech:end',   () => …)
buddy.speaking            // boolean
```

---

## How it interacts with expressions

While speech is active the viseme system owns the mouth completely. Eyes and
brows stay under the expression's control, so "speaking while proud" reads
correctly:

```js
buddy.express('proud')
buddy.sayLetters('A')      // star eyes, articulating mouth
```

When speech ends the mouth returns to whatever the expression specifies.

---

## Tuning

```js
buddy.sayLetters('CAT', { rate: 0.7 })     // slower, for younger learners
buddy.say('cat', { rate: 1.4 })            // faster
buddy.sayLetters('CAT', { gap: 0.2 })      // longer pause between letters
buddy.s.speech.blendFor = 0.08             // softer transitions (default 0.055)
```

`blendFor` is the crossfade time between shapes. Lower is crisper and more
percussive; higher is softer and more mumbled. 0.04–0.08 is the useful range.

---

## Adding or changing a viseme

```js
import { VISEMES, LETTER_VISEMES } from 'spelling-buddy'

// a wider "ee"
VISEMES.EE = { w: 34, h: 12, round: 0.4, teeth: 0.6, tongue: 0, lift: 0 }

// British "zed" instead of American "zee"
LETTER_VISEMES.Z = ['etc', 'E', 'etc']
```

Both are plain objects in a shared registry, so changes apply at runtime **and**
to every exported asset.

---

## Scale note

Teeth and tongue are small details — they read at roughly 120px and above. Below
that the silhouette of the mouth is doing all the work, which is fine: the open
/ round / wide / closed distinction is what carries meaning at small sizes.
