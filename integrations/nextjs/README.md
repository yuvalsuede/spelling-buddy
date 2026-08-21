# Next.js (App Router)

A ~90-line wrapper so pages import one component and cannot get the
choreography wrong.

## Install

```bash
npm install github:yuvalsuede/spelling-buddy#v1.0.0
```

Copy `Buddy.tsx` and `index.ts` into `src/components/buddy/`. That folder is
yours — it is where the brand theme, the accessible name and any
product-specific behaviour live, so the rig can be upgraded without touching a
single page.

## Use

```tsx
import { Buddy } from '@/components/buddy'

<Buddy phase={status} word={word} />
```

| phase | what the learner is doing |
|---|---|
| `idle` | nothing is happening |
| `typing` | entering an answer |
| `correct` | got it right |
| `wrong` | got it wrong |
| `stuck` | needs the answer shown — pass `word` |
| `teaching` | needs to see a letter formed — pass `letter` |

`correct` and `wrong` are momentary: they play, then fall back to `idle` and
`typing` on their own. You do not have to reset them.

Setting the same phase twice does nothing, so it is safe to drive straight from
render state. To replay one deliberately — a second wrong answer with no typing
in between — bump `nonce`.

```tsx
<Buddy phase="wrong" nonce={attempts} />
```

## Why not import `spelling-buddy/react` directly

Three reasons, all of which cost one page each if you skip the wrapper:

- The package's React adapter is `.jsx`, so importing it would mean adding the
  package to `transpilePackages` in `next.config.js` — an app-wide change. The
  wrapper imports the core ESM entry instead.
- `theme` is not a prop here. If pages can pass a palette, one of them
  eventually will, on a page nobody reviews.
- Mount/dispose has to survive React 18 StrictMode's double-invoke in dev, or
  you leak a `requestAnimationFrame` loop per navigation.

## For the agents working in this repo

Paste into `CLAUDE.md` / `AGENTS.md`:

```md
## The spelling character

Import from `@/components/buddy`. Never import `spelling-buddy` directly.

    import { Buddy } from '@/components/buddy'
    <Buddy phase={status} word={word} />

`phase` is one of: idle · typing · correct · wrong · stuck · teaching.
`stuck` needs `word`; `teaching` needs `letter`. `correct` and `wrong` are
momentary — they return to a resting phase by themselves, do not reset them.
To replay a phase (a second wrong answer), bump `nonce`.

Do NOT:
- pass a `theme`, a colour, or any style prop — the palette is Brand System
  v4.1 and is fixed in the wrapper on purpose
- mount more than one per page (a letter grid gets ONE, not one per card)
- call the imperative API (`express`, `react`, `spell`, `trace`) from a page —
  if a page needs behaviour `phase` does not cover, add a phase to the wrapper
  so every page gets it
- add the character to a page that has not been through the page-by-page
  redesign queue
```
