# Recipes

Whole working components. **Copy one and change the data** — do not assemble a
page out of fragments from several of them, because the fragments that matter
are the ones that look like boilerplate: the cleanup, the single mount, the
phase that is deliberately never reset.

Everything here assumes the wrapper is in place:

```bash
mkdir -p src/components/buddy
cp node_modules/spelling-buddy/integrations/nextjs/Buddy.tsx src/components/buddy/
cp node_modules/spelling-buddy/integrations/nextjs/index.ts  src/components/buddy/
```

Read [`AGENTS.md`](./AGENTS.md) first — it is one screen and it is the contract.
Verify what you wrote with:

```bash
node node_modules/spelling-buddy/scripts/check-usage.mjs src
```

Every recipe below passes that check. `scripts/check-recipes.mjs` in this
repository extracts the code from this file and runs it through the same
linter, plus a check that every API it names actually exists — so a recipe
cannot rot into referring to a method that has been renamed.

---

## 1 · A spelling test

The whole loop. Note what is **not** here: no timer clearing `correct`, no
`useEffect` re-mounting the rig, no colour anywhere.

```tsx
// src/app/spell/page.tsx
'use client';

import { useState } from 'react';
import { Buddy, type Phase } from '@/components/buddy';

const WORDS = ['CAT', 'DOG', 'SUN', 'TREE', 'HOUSE'];

export default function SpellingTest() {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [attempts, setAttempts] = useState(0);

  const word = WORDS[i];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (answer.trim().toUpperCase() === word) {
      setPhase('correct');
      setTimeout(() => { setI(n => (n + 1) % WORDS.length); setAnswer(''); }, 1600);
    } else {
      // `nonce` is what replays `wrong` on a second wrong answer. Without it
      // the second attempt sets a phase that is already set, and the character
      // does nothing — which reads as the app not having noticed.
      setAttempts(n => n + 1);
      setPhase('wrong');
    }
  }

  return (
    <main>
      <Buddy
        phase={phase}
        word={word}
        nonce={phase === 'wrong' ? attempts : undefined}
        size={220}
      />

      <p>Spell: <strong>{word}</strong></p>

      <form onSubmit={submit}>
        <input
          value={answer}
          onChange={e => {
            setAnswer(e.target.value);
            // Back to `typing` on the first keystroke. `correct` and `wrong`
            // return to their own steady phase by themselves — this is not
            // resetting them, it is describing what the learner is doing now.
            if (phase !== 'typing') setPhase('typing');
          }}
          autoComplete="off"
        />
        <button type="submit">Check</button>
      </form>

      <button type="button" onClick={() => setPhase('stuck')}>
        Show me
      </button>
    </main>
  );
}
```

`phase="stuck"` reads `word` and spells it out letter by letter. Passing `word`
does not spell it — the phase does, and reads `word` to know what.

---

## 2 · A letter grid

Twenty-six cards and **one** character. This is the recipe most likely to be
got wrong, because one rig per card looks tidy in JSX and quietly starts
twenty-six animation loops on a page aimed at six-year-olds' hardware.

```tsx
// src/app/letters/page.tsx
'use client';

import { useState } from 'react';
import { Buddy, type Phase } from '@/components/buddy';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LetterGrid() {
  const [letter, setLetter] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  return (
    <main>
      {/* ONE character, outside the grid, for the whole page. */}
      <Buddy phase={phase} letter={letter ?? undefined} size={200} />

      <ul>
        {LETTERS.map(ch => (
          <li key={ch}>
            <button
              type="button"
              aria-pressed={letter === ch}
              onClick={() => { setLetter(ch); setPhase('teaching'); }}
            >
              {ch}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

Selecting the same letter twice deliberately does nothing: `teaching` with the
same `letter` is the same phase. To replay it on a second tap, add
`nonce={taps}` and bump `taps` in the handler.

---

## 3 · Teaching one letter

A page about a single letter — the character forms it, then the learner tries.
This is recipe 2 with the grid removed, and it is here because it is the one
that tempts people into `buddy.trace('g')` from a page.

```tsx
// src/app/letters/[letter]/page.tsx
'use client';

import { useState } from 'react';
import { Buddy, type Phase } from '@/components/buddy';

export default function TeachLetter({ params }: { params: { letter: string } }) {
  const letter = params.letter.toUpperCase();
  const [phase, setPhase] = useState<Phase>('idle');
  const [plays, setPlays] = useState(0);

  return (
    <main>
      <Buddy phase={phase} letter={letter} nonce={plays} size={240} />

      <h1>{letter}</h1>

      <button
        type="button"
        onClick={() => { setPhase('teaching'); setPlays(n => n + 1); }}
      >
        Show me how
      </button>
    </main>
  );
}
```

---

## 4 · A scored finger-trace pad

The one recipe that reaches past `phase`, because scoring a traced letter is
not something the six phases cover — and therefore the one recipe that lives
**inside** `src/components/buddy/`. That is not a formality: the linter allows
rig-level API there and nowhere else, precisely so this kind of code has one
home instead of being copied into pages.

The letter the learner traces is the same geometry the character draws, so
grading is a comparison rather than a heuristic.

```tsx
// src/components/buddy/TracePad.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasSurface, drawGlyph, glyphBounds, scoreTrace, METRICS } from 'spelling-buddy';

type Result = ReturnType<typeof scoreTrace>;

export default function TracePad({
  letter,
  onResult,
}: {
  letter: string;
  onResult?: (r: Result) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<[number, number][][]>([]);
  const drawing = useRef<[number, number][] | null>(null);
  const [, force] = useState(0);
  const repaint = () => force(n => n + 1);

  useEffect(() => { strokes.current = []; repaint(); }, [letter]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = el.getBoundingClientRect();
    el.width = Math.round(r.width * dpr);
    el.height = Math.round(r.height * dpr);

    const cap = Math.min(r.height * 0.62, r.width * 0.5);
    const cx = r.width / 2, cy = r.height / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);

    /* The same ruled paper the character writes on — cap line, x-line,
       baseline, and the descender line only when the letter reaches it. */
    const gb = glyphBounds(letter);
    const rules: [number, string][] = [
      [METRICS.cap, '#EDEDF2'], [METRICS.xLine, '#F4F4F8'], [METRICS.baseline, '#EDEDF2'],
    ];
    if (gb.bottom > METRICS.baseline + 1e-6) rules.push([METRICS.descender, '#F4F4F8']);
    ctx.lineWidth = 1;
    for (const [u, colour] of rules) {
      ctx.strokeStyle = colour;
      const y = cy + u * cap;
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(r.width - 20, y); ctx.stroke();
    }

    // the target letter, in ghost
    ctx.save();
    ctx.translate(cx, cy);
    drawGlyph(new CanvasSurface(ctx), letter, cap, 'rgba(22,22,26,0.11)');
    ctx.restore();

    // what they have drawn
    ctx.strokeStyle = '#16161A';
    ctx.lineWidth = cap * 0.13;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const st of strokes.current) {
      if (st.length < 2) continue;
      ctx.beginPath();
      st.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
  });

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function grade() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cap = Math.min(r.height * 0.62, r.width * 0.5);
    const cx = r.width / 2, cy = r.height / 2;

    const paths = strokes.current
      .filter(s => s.length > 1)
      .map(s => s.map(([x, y]) => [(x - cx) / cap, (y - cy) / cap] as [number, number]));
    if (!paths.length) return;

    /* `diagnose` walks the whole character set, so it belongs on the Done
       button and not on every pointermove. It buys the two things a bare score
       cannot say: that the letter was written backwards, and which letter was
       written instead. A reversal is a different problem from a bad trace —
       the child knows the letter, they wrote its mirror. */
    onResult?.(scoreTrace(letter, paths, { diagnose: true }));
  }

  return (
    <div>
      <canvas
        ref={ref}
        style={{ width: '100%', height: 260, display: 'block', touchAction: 'none' }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = [pos(e)];
          strokes.current.push(drawing.current);
          repaint();
        }}
        onPointerMove={e => {
          if (!drawing.current) return;
          drawing.current.push(pos(e));
          repaint();
        }}
        onPointerUp={() => { drawing.current = null; }}
      />
      <button type="button" onClick={() => { strokes.current = []; repaint(); }}>Clear</button>
      <button type="button" onClick={grade}>Done</button>
    </div>
  );
}
```

Wire it to the character from a page using only phases:

```tsx
// src/app/trace/page.tsx
'use client';

import { useState } from 'react';
import { Buddy, type Phase } from '@/components/buddy';
import TracePad from '@/components/buddy/TracePad';

export default function TracePage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [plays, setPlays] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const letter = 'G';

  return (
    <main>
      <Buddy phase={phase} letter={letter} nonce={plays} size={220} />

      <button type="button" onClick={() => { setPhase('teaching'); setPlays(n => n + 1); }}>
        Show me how
      </button>

      <TracePad
        letter={letter}
        onResult={r => {
          setVerdict(r.verdict);
          setPhase(r.score >= 0.48 ? 'correct' : 'wrong');
        }}
      />

      {verdict ? <p>{verdict}</p> : null}
    </main>
  );
}
```

`scoreTrace` returns `score`, `accuracy`, `coverage`, `direction`, `verdict`
(`great` · `good` · `close` · `again`), `hint` (`finish` · `stay-on` ·
`direction`), `strokesHit`, and — with `diagnose` — `reversed`, `mirrorScore`,
`looksLike` and `looksLikeScore`.

**Do not write the feedback sentences here.** Copy comes from the founder;
`verdict` and `hint` are the two axes it is written against.

---

## Notes that apply to all of them

**Reduced motion** is already handled: `mount()` reads
`prefers-reduced-motion` and damps the idle oscillators. Nothing to add per
page.

**The accessible name** is deliberately unset. The character has no product
name yet, so `ariaLabel` is a slot for copy that has been signed off, not a
place to invent a string.

**Server components.** Every recipe starts with `'use client'` because the
character mounts to a canvas. Keep the client boundary at the page shell or
lower; the data fetching above it can stay on the server.

**Suspense and route changes.** The wrapper disposes its rig on unmount,
including React StrictMode's double-invoke in development. If you see two
characters or a leaked animation loop, something is mounting the rig outside
the wrapper.
