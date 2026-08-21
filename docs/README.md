# spelling-buddy documentation

A procedural 2.5D character rig for Canvas2D and SVG. No image assets, no
runtime dependencies — the character is math.

**Adding the character to pages of an existing app?** Read
[`AGENTS.md`](../AGENTS.md) — the whole contract in one screen — and copy a
whole component from [`RECIPES.md`](../RECIPES.md). Everything below is for
building new things rather than using the existing one.
[`llms.txt`](../llms.txt) indexes both.

## Contents

| | |
|---|---|
| [1 · Getting started](./01-getting-started.md) | install, first buddy, sizing, cleanup, performance |
| [2 · API reference](./02-api.md) | every option, method, event, and adapter |
| [3 · Expressions & animations](./03-animations.md) | the full catalog, plus adding your own |
| [4 · Theming](./04-theming.md) | brand tokens, custom palettes, the one rule |
| [5 · Integration recipes](./05-integration.md) | wiring it into a real lesson flow |
| [6 · Asset export](./06-export.md) | SVG, PNG, sprite sheets, GIF, CI diffing |
| [7 · Architecture](./07-architecture.md) | how the turn, the springs, and the two backends work |
| [8 · Troubleshooting](./08-troubleshooting.md) | real failure modes and fixes |
| [9 · Speech & visemes](./09-speech.md) | mouth shapes, letter names, lip-sync |
| [10 · Tracing & cues](./10-tracing.md) | letter formation, trace scoring, audio hooks |

**[`examples/lesson.html`](../examples/lesson.html)** — the whole loop working, in ~180 lines.

Prefer to click rather than read? **`docs/index.html`** is a live version of all
of this — every example runs in the page, including an interactive explainer for
the sphere projection.

## The 30-second version

```js
import { mount } from 'spelling-buddy'

const { buddy } = mount('#buddy', { theme: 'ink', size: 240 })

buddy.express('thinking')   // states  — persist until changed
buddy.react('correct')      // events  — play once, then restore
buddy.spell('CAT')          // domain  — letter cards, articulated, then celebrate
buddy.sayLetters('CAT')     // speech  — mouth shapes only
buddy.trace('A')            // teach   — how the letter is formed
```

**Expressions are states. Actions are events.** Set an expression when your UI
enters a mode; fire an action when something happens. That one distinction
covers most integration questions.
