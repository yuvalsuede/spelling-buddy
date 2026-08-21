# spelling-buddy — for agents

Read this file, not `docs/`. The docs are for people; this is the whole
contract in one screen.

## The only import

```tsx
import { Buddy } from '@/components/buddy'

<Buddy phase={status} word={word} />
```

Copy `integrations/nextjs/{Buddy.tsx,index.ts}` into `src/components/buddy/`
once, per app. After that, pages import from `@/components/buddy` and nothing
else. Never import `spelling-buddy` from a page.

## The one prop

`phase` says what the **learner** is doing. The character's behaviour follows
from it. There are six, and they are the whole vocabulary:

| phase | when | needs |
|---|---|---|
| `idle` | nothing is happening | — |
| `typing` | they are entering an answer | — |
| `correct` | they got it right | — |
| `wrong` | they got it wrong | — |
| `stuck` | show them the answer | `word` |
| `teaching` | show them how a letter is formed | `letter` |

`correct` and `wrong` are momentary — they play and then return to `idle` and
`typing` by themselves. **Do not reset them.** Do not set a timer to clear
them.

Setting the same phase twice does nothing. To replay one deliberately — a
second wrong answer with no typing in between — bump `nonce`:

```tsx
<Buddy phase="wrong" nonce={attempts} />
```

`word` and `letter` are **context, not triggers**. Passing `word` does not
spell it; `phase="stuck"` does, and reads `word` to know what.

## Do not

- **Do not pass `theme`, a colour, or a style prop.** The palette is Brand
  System v4.1 and is fixed in the wrapper deliberately. There is no correct
  reason for a page to override it.
- **Do not mount more than one per page.** A 26-letter grid gets ONE character,
  not one per card. Each instance is its own animation loop.
- **Do not call `express`, `react`, `spell`, `trace`, or any other method from
  a page.** If a page needs behaviour the six phases do not cover, add a phase
  to the wrapper so every page gets it. A page that choreographs by hand is a
  page that will drift from the other nineteen.
- **Do not add the character to a page that has not been through the
  page-by-page redesign queue.**
- **Do not write your own accessible label or announcement strings.** Copy
  comes from the founder. The wrapper takes `ariaLabel` — leave it unset rather
  than inventing one.

## Verify what you wrote

```bash
node node_modules/spelling-buddy/scripts/check-usage.mjs src
```

Exits non-zero and prints `file:line` for every violation of the list above.
Run it before you claim a page is done.

## Complete examples

[`RECIPES.md`](./RECIPES.md) has whole working components — a spelling test, a
letter-practice page, a scored finger-trace pad. Copy one and change the data;
do not assemble from fragments.

## The index

[`llms.txt`](./llms.txt) lists every file in the repository worth reading and
what each one is for — start there if you are looking for something this page
does not cover.

## If you need more than phases

Everything below `phase` is rig-level and is documented in
[`docs/02-api.md`](./docs/02-api.md) and `types/index.d.ts`. It exists for
building new things, not for pages. If you find yourself reaching for it inside
a page, the answer is a new phase in the wrapper.
