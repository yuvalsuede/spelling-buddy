#!/usr/bin/env node
/**
 * Headless smoke + determinism tests. No test framework, no browser.
 */
import { Buddy, THEMES, poseSVG, toSVG, sheetSVG, penAt, glyphPath, scoreTrace, identifyTrace,
         GLYPHS, METRICS, glyph, glyphBounds,
         VISEMES, VISEME_NAMES, LETTER_VISEMES,
         wordToVisemes, lettersToVisemes, blendViseme } from '../src/index.js';
import { SVGSurface } from '../src/core/surface-svg.js';
import { mount } from '../src/adapters/mount.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✕ ${name} ${extra}`); }
};
const section = t => console.log(`\n${t}`);

/* ------------------------------------------------------------------ basics */
section('construction');
const b = new Buddy({ theme: 'ink', seed: 7 });
ok('constructs', b instanceof Buddy);
ok('exposes 9 expressions', Buddy.expressions.length === 9, `got ${Buddy.expressions.length}`);
ok('exposes 13 actions', Buddy.actions.length === 13, `got ${Buddy.actions.length}`);
ok('rejects unknown expression', (() => { try { b.express('nope'); return false; } catch { return true; } })());
ok('rejects unknown action', (() => { try { b.react('nope'); return false; } catch { return true; } })());

/* ------------------------------------------------------------ every pose */
section('every expression renders');
for (const e of Buddy.expressions) {
  const svg = poseSVG({ expression: e });
  ok(e, svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 800, `${svg.length} bytes`);
}

section('full turn renders');
for (let yaw = 0; yaw < 360; yaw += 30) {
  const svg = poseSVG({ yaw });
  ok(`yaw ${yaw}°`, svg.includes('<path') && svg.length > 400, `${svg.length} bytes`);
}

/* ----------------------------------------------------------- every action */
section('every action runs to completion');
for (const a of Buddy.actions) {
  const bb = new Buddy({ seed: 3 });
  bb.react(a);
  let guard = 0;
  while (bb.action && guard++ < 2000) bb.update(1 / 60);
  ok(a, bb.action === null && guard < 2000, `stopped after ${guard} frames`);
}

/* -------------------------------------------------------------- integrity */
section('numeric integrity after heavy use');
const c = new Buddy({ seed: 11, idleActions: true });
for (const a of Buddy.actions) { c.react(a); c.step(0.3); }
c.spell('CATERPILLAR');
c.step(12);
const finite = Object.entries(c.s)
  .filter(([, v]) => typeof v === 'number')
  .every(([, v]) => Number.isFinite(v));
ok('no NaN/Infinity leaked into state', finite);
ok('particles bounded', c.s.particles.count < 500, `${c.s.particles.count}`);
ok('trail bounded', c.s.trail.length <= 7, `${c.s.trail.length}`);

/* ----------------------------------------------------------- determinism */
section('determinism');
const runOnce = () => {
  const x = new Buddy({ seed: 42, autoLook: false });
  x.react('correct');
  x.step(1.0, 60);
  return toSVG(x);
};
const r1 = runOnce(), r2 = runOnce();
ok('same seed → byte-identical SVG', r1 === r2, `${r1.length} vs ${r2.length}`);

const other = (() => { const x = new Buddy({ seed: 43, autoLook: false }); x.react('correct'); x.step(1.0, 60); return toSVG(x); })();
ok('different seed → different output', other !== r1);

/* ---------------------------------------------------------------- themes */
section('themes');
for (const name of Object.keys(THEMES)) {
  const svg = poseSVG({ expression: 'happy' }, { theme: name });
  ok(name, svg.includes(THEMES[name].body), `body ${THEMES[name].body} not found`);
}
ok('partial override merges', (() => {
  const svg = poseSVG({}, { theme: { extends: 'ink', body: '#FF0000' } });
  return svg.includes('#FF0000');
})());

/* ------------------------------------------------------------- svg shape */
section('svg output');
const sheet = sheetSVG([{ expression: 'happy', label: 'a' }, { yaw: 90, label: 'b' }], { cols: 2 });
ok('sheet composes', sheet.startsWith('<svg') && sheet.includes('</svg>'));
ok('sheet has no nested <svg>', (sheet.match(/<svg/g) || []).length === 1);
ok('clip paths are defined before use', (() => {
  const one = poseSVG({ expression: 'happy' });
  const ids = [...one.matchAll(/clipPath id="(bc\d+)"/g)].map(m => m[1]);
  const uses = [...one.matchAll(/clip-path="url\(#(bc\d+)\)"/g)].map(m => m[1]);
  return uses.every(u => ids.includes(u));
})());
ok('no NaN in path data', !poseSVG({ yaw: 90, pitch: 30 }).includes('NaN'));

/* ---------------------------------------------------------------- visemes */
section('visemes');
ok('10 visemes', VISEME_NAMES.length === 10, `got ${VISEME_NAMES.length}`);
ok('all 26 letters mapped', Object.keys(LETTER_VISEMES).length === 26);
ok('every letter maps to known visemes',
   Object.values(LETTER_VISEMES).flat().every(v => VISEMES[v]),
   Object.values(LETTER_VISEMES).flat().filter(v => !VISEMES[v]).join(', '));
ok('word rules yield known visemes',
   ['cat','through','make','bubble','quick','rhythm','xylophone','a','',
    'straight','psychology'].every(w => wordToVisemes(w).every(v => VISEMES[v])));
ok('empty word is safe', wordToVisemes('').length === 1);
ok('digraphs beat singles', wordToVisemes('the')[0] === 'L');       // th → L, not t
ok('silent final e dropped', wordToVisemes('make').length === 3);   // m a k (not e)
ok('double consonant collapses', wordToVisemes('ball').length === wordToVisemes('bal').length);
ok('blend is continuous', (() => {
  const a = blendViseme('rest', 'AI', 0), m = blendViseme('rest', 'AI', 0.5), b = blendViseme('rest', 'AI', 1);
  return a.h === VISEMES.rest.h && b.h === VISEMES.AI.h && m.h > a.h && m.h < b.h;
})());
ok('rejects unknown viseme', (() => {
  const x = new Buddy(); try { x.viseme('nope'); return false; } catch { return true; }
})());

section('speech playback');
{
  const x = new Buddy({ seed: 5, autoLook: false });
  x.sayLetters('CAT');
  ok('speaking starts', x.speaking);
  let f = 0; while (x.speaking && f++ < 1200) x.update(1 / 60);
  ok('sayLetters terminates', !x.speaking && f < 1200, `${f} frames`);
  ok('mouth returns to rest', x.s.speech.next === 'rest');

  x.say('through');
  let g = 0; while (x.speaking && g++ < 1200) x.update(1 / 60);
  ok('say() terminates', !x.speaking && g < 1200, `${g} frames`);

  x.viseme('AI');
  x.step(2);
  ok('held viseme persists', x.speaking && x.s.speech.next === 'AI');
  x.stopSpeaking(); x.step(0.5);
  ok('stopSpeaking closes', !x.speaking);

  const y = new Buddy({ seed: 5 });
  y.spell('AB');
  let h = 0; while (y.busy && h++ < 2000) y.update(1 / 60);
  ok('spell drives speech and finishes', !y.busy && h < 2000, `${h} frames`);
}

section('viseme rendering');
for (const v of VISEME_NAMES) {
  const x = new Buddy({ autoLook: false });
  if (v !== 'rest') x.viseme(v);
  x.s.speech.active = true; x.s.speech.cur = x.s.speech.next = v; x.s.speech.blend = 1;
  x.settle();
  const svg = toSVG(x);
  ok(v, svg.includes('<path') && !svg.includes('NaN'), `${svg.length} bytes`);
}

/* ---------------------------------------------------------------- tracing */
section('alphabet');
{
  const missing = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789']
    .filter(c => !glyph(c));
  ok('upper, lower and digits all present', missing.length === 0, missing.join(''));

  /* The reason lowercase needed real metrics: without them every glyph gets
     centred in the cap box and an 'o' floats where an 'O' belongs. */
  ok('lowercase sits on the baseline', (() => {
    const o = glyphBounds('o'), O = glyphBounds('O');
    return Math.abs(o.bottom - O.bottom) < 0.02 && o.top > O.top + 0.2;
  })());
  /* Measured on the flattened outline, not on control points: a Bézier's
     handles sit outside the curve, so glyphBounds alone would call a
     well-behaved 's' too tall. */
  const inkTop = c => Math.min(...glyphPath(c).strokes.flatMap(s => s.pts.map(p => p[1])));
  const inkBottom = c => Math.max(...glyphPath(c).strokes.flatMap(s => s.pts.map(p => p[1])));
  ok('x-height letters agree with each other', (() => {
    const tops = [...'acemnorsuvwxz'].map(inkTop);
    return Math.max(...tops) - Math.min(...tops) < 0.03;
  })(), [...'acemnorsuvwxz'].map(c => `${c}${inkTop(c).toFixed(2)}`).join(' '));
  ok('every letter sits on the baseline', (() => {
    const bots = [...'acemnorsuvwxz'].map(inkBottom);
    return Math.max(...bots) - Math.min(...bots) < 0.02;
  })(), [...'acemnorsuvwxz'].map(c => `${c}${inkBottom(c).toFixed(2)}`).join(' '));
  ok('ascenders reach cap height', (() => {
    const tops = [...'bdfhklt'].map(c => glyphBounds(c).top);
    return Math.max(...tops) < METRICS.xLine - 0.08;
  })());
  ok('descenders drop below the baseline', (() => {
    const bots = [...'gjpqy'].map(c => glyphBounds(c).bottom);
    return Math.min(...bots) > METRICS.baseline + 0.15;
  })());
  ok('no lowercase letter is a copy of its capital', (() => {
    const same = [...'abcdefghijklmnopqrstuvwxyz']
      .filter(c => JSON.stringify(GLYPHS[c]) === JSON.stringify(GLYPHS[c.toUpperCase()]));
    return same.length === 0;
  })());

  /* Case must survive the whole pipeline. `hold('a')` quietly upgrading to
     'A' is exactly the bug that makes a lowercase lesson impossible. */
  ok('hold keeps case', (() => {
    const y = new Buddy(); y.hold('a'); return y.s.heldLetter === 'a';
  })());
  ok('trace keeps case', (() => {
    const y = new Buddy(); y.trace('g'); return y.s.trace.ch === 'g';
  })());
  ok('spell keeps case', (() => {
    const y = new Buddy(); y.spell('Cat');
    return y._spellQueue.letters.join('') === 'Cat';
  })());
  ok('spell accepts digits and drops what has no glyph', (() => {
    const y = new Buddy(); y.spell('7 up\u00A5');
    return y._spellQueue.letters.join('') === '7up';
  })());
  ok('lowercase and capital trace differently', (() => {
    const a = glyphPath('a'), A = glyphPath('A');
    return Math.abs(a.len - A.len) > 0.05;
  })());
  /* Ruled paper: cap line, x-line, baseline always; the descender rule only
     for letters that go below it. Counted by tracing at u=0, where the only
     ink on the page is the guides and the ghost. */
  const rules = ch => {
    const y = new Buddy({ seed: 1, autoLook: false, showTrail: false });
    y.trace(ch, { duration: 2.4 }); y.step(0);
    return (toSVG(y).match(/stroke-width="1\.6"/g) || []).length;
  };
  ok('three writing rules for an x-height letter', rules('o') === 3, `${rules('o')}`);
  ok('four writing rules for a descender', rules('g') === 4, `${rules('g')}`);
}

section('letter tracing');
{
  const x = new Buddy({ seed: 2, autoLook: false });
  x.trace('A');
  ok('tracing starts', x.tracing && x.busy);
  let f = 0; while (x.tracing && f++ < 900) x.update(1 / 60);
  ok('trace terminates', !x.tracing && f < 900, `${f} frames`);
  ok('head returns to centre', Math.abs(x.s.yawTarget) < 1e-6);

  ok('unknown character is a no-op', (() => {
    const y = new Buddy(); y.trace('%'); return !y.tracing;
  })());

  ok('stopTrace clears immediately', (() => {
    const y = new Buddy(); y.trace('B'); y.step(0.4); y.stopTrace();
    return !y.tracing && y.s.trace.ch === null;
  })());

  // every glyph must be traceable end to end
  const broken = [];
  for (const c of Buddy.glyphs) {
    const y = new Buddy({ seed: 1, autoLook: false });
    y.trace(c, { duration: 0.4, hold: 0 });
    let g = 0; while (y.tracing && g++ < 400) y.update(1 / 60);
    const svg = toSVG(y);
    if (y.tracing || svg.includes('NaN')) broken.push(c);
  }
  ok('every glyph traces cleanly', broken.length === 0, broken.join(' '));

  // the pen must actually travel, and cover the whole letter
  const pts = [];
  for (let u = 0; u <= 1.0001; u += 0.02) pts.push(penAt('A', u));
  const dist = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
  ok('pen traverses the letter', dist > 1.5, `path length ${dist.toFixed(2)} cap-units`);
  ok('pen lifts between strokes', pts.some(p => p.penUp));
  ok('pen ends at the last stroke', pts[pts.length - 1].stroke === glyphPath('A').strokes.length - 1);
}

section('drawn space === scored space');
{
  /* The bug this locks down: `drawGlyph`/`drawTrace` centre the letter on its
     ink, while the scoring geometry used raw authored coordinates. For B, P
     and j those are 0.11 cap-units apart — most of a stroke width — so a
     pixel-perfect trace of a B scored 0.37 and the child was told to try
     again. Every structural test passed while that shipped. */
  const perfect = ch => {
    const out = [[]];
    for (let u = 0; u <= 1.0001; u += 0.004) {
      const p = penAt(ch, u);
      if (!p) continue;
      if (p.penUp) { if (out[out.length - 1].length) out.push([]); continue; }
      out[out.length - 1].push([p.x, p.y]);
    }
    return out.filter(st => st.length > 1);
  };
  const weak = Buddy.glyphs
    .map(c => [c, scoreTrace(c, perfect(c))])
    .filter(([, r]) => r.verdict !== 'great')
    .map(([c, r]) => `${c}=${r.score.toFixed(2)}`);
  ok('a perfect trace of every glyph scores "great"', weak.length === 0, weak.join(' '));

  /* And the mapping the docs hand out has to be the one that works. */
  ok('the documented screen -> glyph mapping needs no fudge factor', (() => {
    const cap = 200, cx = 500, cy = 300;
    const toGlyph = (x, y) => [(x - cx) / cap, (y - cy) / cap];
    const screen = glyphPath('B').strokes.map(st =>
      st.pts.map(p => [cx + p[0] * cap, cy + p[1] * cap]));
    return scoreTrace('B', screen.map(st => st.map(p => toGlyph(p[0], p[1])))).verdict === 'great';
  })());
}

section('trace scoring');
{
  // sample the letter the way a finger would: one path per pen-down
  const segs = ch => {
    const out = [[]];
    for (let u = 0; u <= 1; u += 0.003) {
      const p = penAt(ch, u);
      if (p.penUp) { if (out[out.length - 1].length) out.push([]); }
      else out[out.length - 1].push([p.x, p.y]);
    }
    return out.filter(s => s.length > 1);
  };

  for (const ch of ['A', 'B', 'E', 'H', 'O', 'S', 'W']) {
    const r = scoreTrace(ch, segs(ch));
    ok(`perfect ${ch} scores great`, r.verdict === 'great' && r.score > 0.9,
       `${r.verdict} ${r.score.toFixed(2)}`);
  }

  const a = segs('A');
  const wobbly = a.map(p => p.map(([x, y], i) => [x + Math.sin(i * 0.7) * 0.025, y + Math.cos(i * 0.9) * 0.025]));
  ok('a wobbly trace still passes', scoreTrace('A', wobbly).score > 0.7);

  const missing = scoreTrace('A', [a[0]]);
  ok('skipping a stroke fails', missing.verdict === 'again' && missing.hint === 'finish',
     `${missing.verdict}/${missing.hint} cov ${missing.coverage.toFixed(2)}`);
  ok('and reports the strokes hit', missing.strokesHit === 1 && missing.strokes === 2);

  const back = scoreTrace('A', a.map(p => p.slice().reverse()));
  ok('backwards is penalised', back.score < 0.5 && back.hint === 'direction',
     `${back.score.toFixed(2)}/${back.hint}`);

  const rnd = Array.from({ length: 200 }, (_, i) => [Math.sin(i * 3.1) * 0.4, Math.cos(i * 2.3) * 0.45]);
  ok('random scribble fails', scoreTrace('A', rnd).verdict === 'again');

  ok('wrong letter fails', scoreTrace('A', segs('O')).verdict === 'again');
  ok('empty input is safe', scoreTrace('A', []).verdict === 'none');
  ok('single path accepted', scoreTrace('A', a.flat()).score > 0.5);
  ok('unknown glyph is safe', scoreTrace('%', a).verdict === 'none');
}

section('trace diagnosis');
{
  const seg = (ch, mirror) => {
    const out = [[]];
    for (let u = 0; u <= 1.0001; u += 0.004) {
      const p = penAt(ch, u);
      if (!p) continue;
      if (p.penUp) { if (out[out.length - 1].length) out.push([]); continue; }
      out[out.length - 1].push([mirror ? -p.x : p.x, p.y]);
    }
    return out.filter(st => st.length > 1);
  };

  /* Reversal is the single most common early-years handwriting error, and a
     bare score cannot tell it apart from "wrote a different letter". Mirroring
     the child's own marks and re-scoring against the same target settles it —
     with no table of mirror-pairs to maintain. */
  ok('a mirrored b is reported as reversed', (() => {
    const r = scoreTrace('b', seg('b', true), { diagnose: true });
    return r.reversed === true && r.verdict !== 'great';
  })());
  ok('drawing a d for a b is reported as reversed', (() => {
    const r = scoreTrace('b', seg('d'), { diagnose: true });
    return r.reversed === true && r.looksLike === 'd';
  })());
  ok('a correct trace is not reported as reversed', (() => {
    const r = scoreTrace('b', seg('b'), { diagnose: true });
    return r.reversed === false && r.looksLike === null && r.verdict === 'great';
  })());
  ok('reversal is caught for shapes with no mirror-letter', (() => {
    const r = scoreTrace('3', seg('3', true), { diagnose: true });
    return r.reversed === true;
  })());
  ok('a symmetric letter is never called reversed', (() => {
    const bad = [...'AHIMOTUVWXY0oxlvw'].filter(c =>
      scoreTrace(c, seg(c), { diagnose: true }).reversed);
    return bad.length === 0;
  })(), [...'AHIMOTUVWXY0oxlvw'].filter(c => scoreTrace(c, seg(c), { diagnose: true }).reversed).join(''));

  ok('identifyTrace names the letter that was drawn', (() => {
    const wrong = [...'AEGKQRSbfgkqrt2357'].filter(c => identifyTrace(seg(c), { top: 1 })[0].ch !== c);
    return wrong.length === 0;
  })(), [...'AEGKQRSbfgkqrt2357'].filter(c => identifyTrace(seg(c), { top: 1 })[0].ch !== c).join(''));
  ok('identifyTrace returns a ranked list', (() => {
    const r = identifyTrace(seg('E'), { top: 3 });
    return r.length === 3 && r[0].score >= r[1].score && r[1].score >= r[2].score;
  })());
  ok('identifyTrace on nothing is empty, not a crash', identifyTrace([]).length === 0);

  /* Cost is real — this walks the whole character set — so it must stay off
     unless asked for. */
  ok('diagnosis is opt-in', (() => {
    const r = scoreTrace('b', seg('d'));
    return r.reversed === undefined && r.looksLike === undefined;
  })());
}

section('word tracing');
{
  const x = new Buddy({ seed: 3, autoLook: false });
  let done = false;
  x.on('traceWord:done', () => { done = true; });
  x.traceWord('CAT', { duration: 0.3, gap: 0.05 });
  let f = 0; while (x.busy && f++ < 3000) x.update(1 / 60);
  ok('traceWord completes', done && !x.busy, `${f} frames`);
  ok('stopTrace clears the queue', (() => {
    const y = new Buddy(); y.traceWord('AB'); y.step(0.2); y.stopTrace(); y.step(0.5);
    return !y.busy;
  })());
}

section('audio cues');
{
  const seen = [];
  const x = new Buddy({ seed: 5, autoLook: false });
  x.on('cue', c => seen.push(c.name));
  x.react('correct'); x.step(1.6);
  x.react('wrong');   x.step(1.2);
  x.react('pop');     x.step(0.6);
  x.trace('A', { duration: 0.4, hold: 0 }); x.step(2.0);
  ok('cues fire for feedback', seen.includes('correct') && seen.includes('wrong'));
  ok('cues fire for micro-interactions', seen.includes('pop'));
  ok('cues fire per trace stroke', seen.filter(n => n === 'trace:stroke').length >= 2, seen.join(','));
  ok('every cue carries a name', seen.every(n => typeof n === 'string' && n.length));
}

/* --------------------------------------------------------- surface parity */
section('mount adapter and accessibility');
{
  /* A DOM small enough to be honest about: only the calls `mount` actually
     makes. It is not a browser, and it is not pretending to be — but "did we
     set role, create a live region, and take both away again on dispose" is a
     question about attribute calls, and this answers it without a browser. */
  const listeners = [];
  const el = (tag = 'span') => {
    const attrs = new Map();
    const node = {
      tagName: tag, style: {}, children: [], parentNode: null, _text: '',
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: k => (attrs.has(k) ? attrs.get(k) : null),
      hasAttribute: k => attrs.has(k),
      removeAttribute: k => attrs.delete(k),
      get textContent() { return node._text; },
      set textContent(v) { node._text = v; },
      addEventListener: (...a) => listeners.push(['add', tag, a[0]]),
      removeEventListener: (...a) => listeners.push(['remove', tag, a[0]]),
      after: n => { node.parentNode.children.push(n); n.parentNode = node.parentNode; },
      remove: () => {
        const i = node.parentNode?.children.indexOf(node) ?? -1;
        if (i >= 0) node.parentNode.children.splice(i, 1);
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
      getContext: () => ({ canvas: node, setTransform() {}, clearRect() {}, save() {}, restore() {},
                           beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {},
                           closePath() {}, fill() {}, stroke() {}, ellipse() {}, arc() {},
                           translate() {}, scale() {}, rotate() {}, clip() {},
                           set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {},
                           set lineCap(_) {}, set lineJoin(_) {}, set globalAlpha(_) {} }),
      _attrs: attrs,
    };
    return node;
  };

  const parent = el('div');
  const canvas = el('canvas');
  canvas.parentNode = parent;
  parent.children.push(canvas);

  const prevDoc = globalThis.document, prevWin = globalThis.window;
  globalThis.document = { createElement: el };
  globalThis.window = { devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.Element = Object; // `announce instanceof Element` must not throw

  let handle = null, threw = null;
  try {
    handle = mount(canvas, { size: 200, autoStart: false, interactive: false });
  } catch (e) { threw = e; }

  ok('mount() runs without a browser', threw === null, threw?.message ?? '');

  if (handle) {
    ok('the canvas gets an accessible role and name',
       canvas.getAttribute('role') === 'img' && canvas.getAttribute('aria-label') === 'Spelling buddy');
    ok('a polite live region is created beside the canvas',
       handle.live && handle.live.getAttribute('aria-live') === 'polite' &&
       parent.children.includes(handle.live));

    /* The word once, not letter by letter: at a 0.48s cadence a per-letter
       announcement overwrites itself before a reader finishes the last one. */
    handle.buddy.spell('cat');
    ok('spelling announces the whole word once', handle.live.textContent === 'Spelling c, a, t');
    for (let i = 0; i < 120; i++) handle.buddy.update(1 / 60);
    ok('spelling does not re-announce per letter', handle.live.textContent === 'Spelling c, a, t');

    handle.buddy.cancelSpell();
    handle.buddy.hold('g');
    ok('a single letter card is announced', handle.live.textContent === 'Letter g');
    handle.buddy.trace('B');
    ok('tracing is announced', handle.live.textContent === 'Showing how to write B');

    /* Feedback is off by default — nearly every host shows its own status
       text, and hearing "Correct" twice is worse than not hearing it. */
    handle.buddy.react('correct');
    ok('feedback is not announced unless asked for',
       handle.live.textContent === 'Showing how to write B');

    handle.dispose();
    ok('dispose removes the live region', !parent.children.includes(handle.live));
    ok('dispose removes the attributes it added',
       !canvas.hasAttribute('role') && !canvas.hasAttribute('aria-label'));
  }

  /* A host that has already labelled the canvas keeps its own label. */
  const owned = el('canvas');
  owned.parentNode = parent; parent.children.push(owned);
  owned.setAttribute('aria-label', 'Ruby the reading owl');
  const h2 = mount(owned, { size: 200, autoStart: false, interactive: false, announce: false });
  ok("mount does not overwrite the host's own label",
     owned.getAttribute('aria-label') === 'Ruby the reading owl');
  ok('announce:false creates no live region', h2.live === null);
  h2.dispose();
  ok('dispose leaves an attribute it did not add',
     owned.getAttribute('aria-label') === 'Ruby the reading owl');

  globalThis.document = prevDoc; globalThis.window = prevWin;
  delete globalThis.Element;
}

section('surface API parity');
const canvasMethods = ['save','restore','translate','rotate','scale','alpha','getAlpha','begin',
  'move','line','quad','cubic','arc','ellipse','rect','close','fill','stroke','clip','text','clear'];
const svgSurface = new SVGSurface({});
ok('SVGSurface implements the full Surface API',
   canvasMethods.every(m => typeof svgSurface[m] === 'function'),
   canvasMethods.filter(m => typeof svgSurface[m] !== 'function').join(', '));

/* -------------------------------------------------------------------- end */
console.log(`\n${fail === 0 ? '✓' : '✕'} ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
