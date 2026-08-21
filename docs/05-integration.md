# Integration recipes

Practical wiring for a spelling app. Every snippet here is real API.

---

## The core loop

```js
import { mount } from 'spelling-buddy'

const { buddy } = mount('#buddy', { theme: 'ink', size: 200, idleActions: true })

const input = document.querySelector('#answer')

input.addEventListener('focus', () => buddy.express('thinking'))
input.addEventListener('blur',  () => !buddy.busy && buddy.express('happy'))

form.addEventListener('submit', e => {
  e.preventDefault()
  const right = input.value.trim().toUpperCase() === target
  buddy.react(right ? 'correct' : 'wrong')
})
```

`express` for modes, `react` for events. That's the whole pattern.

---

## Reacting while they type

Small, cheap feedback as the answer takes shape:

```js
input.addEventListener('input', () => {
  const typed = input.value.toUpperCase()
  const stillRight = target.startsWith(typed)

  if (!stillRight)                buddy.express('confused')
  else if (typed === target)      buddy.express('excited')   // they're there
  else if (typed.length)          buddy.express('thinking')
  else                            buddy.express('happy')
})
```

`express()` is a no-op when the name is unchanged, so calling it on every
keystroke is free.

---

## Speaking letters aloud

`spell()` emits an event per letter. Hook your TTS to it and the mouth flap
lines up with the audio:

```js
buddy.on('spell:letter', ch => speak(ch))
buddy.on('spell:done',   () => speak('That spells ' + word))

buddy.spell('CAT', { interval: 0.6 })   // slower for younger learners
```

`spell()` also articulates each letter name automatically as it holds the card
up. Pass `{ speak: false }` if you want the cards without the mouth.

For a word read aloud, bind the utterance and the mouth follows the audio:

```js
const utter = new SpeechSynthesisUtterance(word)
buddy.attachSpeech(utter)
speechSynthesis.speak(utter)
```

That forms real mouth shapes rather than flapping — see
[Speech & visemes](./09-speech.md).

---

## Showing how a letter is formed

```js
// wrong twice on the same word — show the shape
if (attempts >= 2) buddy.trace(word[errorIndex])
```

See [Tracing & cues](./10-tracing.md).

## Hints and attention

```js
// they've been idle 20 s on a hard word
buddy.react('lookAround')

// point at the input
buddy.face(-30, 10)

// show the first letter
buddy.hold(target[0])
setTimeout(() => buddy.hold(null), 2500)
```

---

## Streaks and rewards

```js
function onCorrect(streak) {
  if (streak >= 10)     buddy.react('dance')
  else if (streak >= 5) buddy.react('jump')
  else                  buddy.react('correct')
}
```

Reserve `dance` — if every success dances, nothing feels special.

---

## Session bookends

```js
// first load
buddy.react('wave')

// lesson complete
buddy.on('action:end', name => {
  if (name === 'dance') buddy.express('content')
})
buddy.react('dance')

// tab hidden for a while
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return
  if (awayFor() > 60_000) buddy.react('peek')
})
```

---

## React: a complete lesson component

```jsx
import { useRef, useState } from 'react'
import { SpellingBuddy } from 'spelling-buddy/react'

export function Lesson({ word }) {
  const buddy = useRef(null)
  const [value, setValue] = useState('')

  const expression =
    !value                        ? 'happy'
    : !word.startsWith(value)     ? 'confused'
    : value === word              ? 'excited'
    :                               'thinking'

  function check(e) {
    e.preventDefault()
    buddy.current.react(value === word ? 'correct' : 'wrong')
    setValue('')
  }

  return (
    <form onSubmit={check}>
      <SpellingBuddy ref={buddy} size={200} theme="ink" expression={expression} />
      <input value={value} onChange={e => setValue(e.target.value.toUpperCase())} />
      <button type="button" onClick={() => buddy.current.spell(word)}>
        Show me
      </button>
    </form>
  )
}
```

Note `expression` is derived from state (declarative) while `react` is called
imperatively on an event. Actions are events; modelling them as props means
re-firing on unrelated re-renders.

---

## Several on one page

Each rig is independent. A word list with a buddy per row is fine:

```js
document.querySelectorAll('.word-row canvas').forEach((c, i) => {
  const { buddy } = mount(c, { size: 48, seed: i, showBlush: false, showSparks: false })
  rigs.push(buddy)
})
```

Give each a different `seed` so they don't blink in unison — identical seeds
make a row of clones, which looks wrong immediately.

At 48px, turn off blush and sparks; they turn to mud below ~64px.

---

## Server-side rendering

The main entry is SSR-safe: it touches no DOM at import time, and the Web
Component class is built lazily. Render a static SVG on the server for instant
first paint, then hydrate:

```js
// server
import { poseSVG } from 'spelling-buddy'
res.send(`<div id="slot">${poseSVG({ expression: 'happy' }, { theme: 'ink' })}</div>`)

// client
import { mount } from 'spelling-buddy'
slot.innerHTML = '<canvas></canvas>'
mount(slot.querySelector('canvas'))
```

No layout shift, no blank frame, and the SVG is a few KB.

---

## Reduced motion

`mount()` reads `prefers-reduced-motion` and damps the idle oscillators
automatically — no wiring needed. It also follows live changes to the setting.

```js
mount('#buddy', { respectReducedMotion: false })   // opt out
```

Expressions and pose changes are left alone: they're state, not movement. Only
the bob, breath, tempo and motion trail are damped.

Consider swapping big actions for small ones too:

```js
const cheer = calm.matches ? 'nod' : 'correct'
buddy.react(cheer)
```

---

## Accessibility

The canvas is decorative. Mark it so, and put the real feedback in text:

```html
<canvas id="buddy" aria-hidden="true"></canvas>
<p role="status" aria-live="polite" id="feedback"></p>
```

```js
function feedback(right) {
  document.querySelector('#feedback').textContent = right ? 'Correct' : 'Try again'
  buddy.react(right ? 'correct' : 'wrong')
}
```

Never let the character be the only signal — colour and motion both fail for
some users.
