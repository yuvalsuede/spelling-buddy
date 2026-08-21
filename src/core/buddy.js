/**
 * Buddy — the character rig.
 *
 * Host-agnostic on purpose: it owns state and time, and knows how to draw
 * itself onto any Surface. It does not own a canvas, a render loop, or a
 * framework. Adapters supply those (see src/adapters/), and exporters drive
 * it with fixed timesteps to produce deterministic assets.
 */
import { clamp, lerp, spring, approach, makeRandom, deg, rad } from './math.js';
import { resolveTheme } from './theme.js';
import { EXPRESSIONS, EXPRESSION_NAMES } from './expressions.js';
import { ACTIONS, ACTION_NAMES } from './actions.js';
import { Particles } from './particles.js';
import { render } from './renderer.js';
import { DESIGN } from './geometry.js';
import { VISEMES, VISEME_NAMES, wordToVisemes, lettersToVisemes } from './visemes.js';
import { penAt } from './trace.js';
import { glyphBounds, glyph, GLYPHS } from './glyphs.js';
import { applyPhase, PHASE_NAMES } from './phases.js';
import { ACCESSORY_NAMES } from './accessories.js';
import { G } from './geometry.js';

const DEFAULTS = {
  theme: 'ink',
  seed: 1,
  expression: 'happy',
  scale: 1,
  bobAmt: 1,
  breathAmt: 1,
  tempo: 1,
  blinkEvery: 3.2,
  autoLook: true,
  showShadow: true,
  showSparks: true,
  showBlush: true,
  showHands: false,     // hands appear on demand; animations request them
  showTrail: true,
  /* EXPERIMENT — not settled. 0 = the face patch is drawn upright, which is
     what shipped. 1 = it leans to the ellipse a round face actually projects
     to, fringe kept screen-up. 2 = the same lean with the fringe banked into
     it. Compared side by side before one of them becomes the only one. */
  faceLean: 0,
  /* EXPERIMENT — the world light run across the face patch, 0 = off. */
  faceForm: 0,
  /* EXPERIMENT — brow/nose/chin break the leading edge as the head turns. */
  profile: false,
  idleActions: false,   // play look-around / think spontaneously
  idleEvery: [9, 20],   // seconds between spontaneous idles
};

export class Buddy {
  constructor(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    this.options = o;
    this.theme = resolveTheme(o.theme);
    this.random = makeRandom(o.seed);
    this._beats = new Set();
    this._listeners = {};
    this._spellQueue = null;
    this._traceQueue = null;
    this.s = this._freshState(o);
  }

  _freshState(o) {
    return {
      // tunables
      scale: o.scale, bobAmt: o.bobAmt, breathAmt: o.breathAmt,
      tempo: o.tempo, blinkEvery: o.blinkEvery, autoLook: o.autoLook,
      showShadow: o.showShadow, showSparks: o.showSparks,
      showBlush: o.showBlush, showHands: o.showHands, showTrail: o.showTrail,
      faceLean: o.faceLean ?? 0,
      faceForm: o.faceForm ?? 0,
      profile: o.profile ?? false,

      t: 0,

      // orientation (radians, spring driven)
      yaw: 0, yawV: 0, yawTarget: 0,
      pitch: 0, pitchV: 0, pitchTarget: 0,
      roll: 0, rollV: 0, rollTarget: 0,

      // body
      offX: 0, offY: 0, offVX: 0, offVY: 0,
      squashX: 1, squashY: 1, squashVX: 0, squashVY: 0,
      hover: 0,

      // face
      blink: 0, blinkPhase: 0, blinkTimer: 2,
      look: { x: 0, y: 0 }, talk: 0,
      expr: o.expression, prevExpr: o.expression, xfade: 1,

      hand: { l: { lift: 0, swing: 0, out: 0, show: 0, want: 0 },
              r: { lift: 0, swing: 0, out: 0, show: 0, want: 0 } },

      sparkPop: 0, heldLetter: null, letterPop: 0,

      /* speech: a viseme timeline. `cur`→`next` blend continuously, which is
         what separates articulation from a flapping jaw. */
      speech: { active: false, cur: 'rest', next: 'rest', blend: 1,
                queue: [], hold: 0, blendFor: 0.055 },

      particles: new Particles(this.random),
      trail: [],
      accessories: o.accessories ? (Array.isArray(o.accessories) ? o.accessories : [o.accessories]) : [],

      /* letter tracing: the character stands aside and watches a letter draw
         itself, stroke by stroke, in the order you'd write it. */
      trace: { ch: null, u: 0, t: 0, dur: 2.4, active: false, hold: 0,
               penX: 0, penY: 0, penUp: false },
      shiftX: 0, autoScale: 1,

      pointer: { x: 0, y: 0, inside: false },
      action: null, actionT: 0,
      idleTimer: 6,
    };
  }

  /* ------------------------------------------------------------ public API */

  /** Set a facial expression, cross-fading from the current one. */
  express(name) {
    if (!EXPRESSIONS[name]) throw new Error(`Unknown expression "${name}". Available: ${EXPRESSION_NAMES.join(', ')}`);
    const S = this.s;
    if (name === S.expr) return this;
    S.prevExpr = S.expr; S.expr = name; S.xfade = 0;
    S.squashVX = 1.4; S.squashVY = -1.4;
    this._emit('expression', name);
    return this;
  }

  /** Play a special animation. Interrupts whatever is running. */
  react(name) {
    if (!ACTIONS[name]) throw new Error(`Unknown action "${name}". Available: ${ACTION_NAMES.join(', ')}`);
    const S = this.s;
    if (S.action) ACTIONS[S.action].end(this);
    this._beats.clear();
    S.action = name; S.actionT = 0;
    ACTIONS[name].start(this);
    this._emit('action:start', name);
    return this;
  }

  /** Point the head. Degrees. Disables cursor tracking. */
  face(yawDeg = 0, pitchDeg = 0) {
    this.s.autoLook = false;
    this.s.yawTarget = deg(yawDeg);
    this.s.pitchTarget = deg(pitchDeg);
    return this;
  }

  /**
   * Set the lesson phase — one call instead of a choreography.
   *
   *   buddy.phase('typing')
   *   buddy.phase('stuck',    { word: 'cat' })
   *   buddy.phase('teaching', { letter: 'g' })
   *
   * Idempotent: setting the same phase twice does nothing, so it is safe to
   * call from a render. Pass `{ force: true }` to replay it.
   */
  phase(name, opts = {}) { applyPhase(this, name, opts); return this; }

  /** The current phase name, or null if phases are not being used. */
  get currentPhase() { return this._phase ? this._phase.name : null; }

  /** Hold up a single letter card. */
  hold(ch) {
    const S = this.s;
    S.heldLetter = ch == null ? null : String(ch).slice(0, 1);
    if (S.heldLetter) {
      this._emit('hold', S.heldLetter);
      S.letterPop = 1;
      S.hand.r.lift = 0.8; S.hand.r.want = 1;
      S.squashVX = 2.2; S.squashVY = -2.2;
      this.express('proud');
    }
    return this;
  }

  /**
   * Spell a word: hold up each letter in turn, then celebrate.
   * Driven by the rig's own clock, so it stays in sync under any timestep
   * and can be exported frame-accurately.
   */
  spell(word, { interval = 0.48, speak = true, celebrate = true } = {}) {
    /* Case is preserved: a lesson that teaches lowercase must be able to
       show lowercase. Anything without a glyph (spaces, punctuation) drops. */
    const w = [...String(word || '')].filter(c => glyph(c)).join('');
    if (!w) return this;
    this._spellQueue = { letters: w.split(''), i: 0, next: 0, interval, speak, celebrate, said: [] };
    this.express('happy');
    this._emit('spell:start', w);
    return this;
  }

  /**
   * Trace a letter: show how it is formed, stroke by stroke.
   *
   * The character steps aside, watches the pen, and points. Stroke order and
   * direction come straight from the glyph geometry — the same coordinates
   * that draw the letter also describe how to write it.
   */
  trace(ch, { duration = 2.4, hold = 0.7 } = {}) {
    const c = String(ch || '').slice(0, 1);
    if (!glyph(c)) return this;
    const t = this.s.trace;
    t.ch = c; t.u = 0; t.t = 0; t.dur = duration; t.hold = hold; t.active = true;
    this.express('content');
    this.cue('trace:start', c);
    this._emit('trace:start', c);
    return this;
  }

  /** Trace every letter of a word in turn. */
  traceWord(word, { duration = 2.0, gap = 0.35 } = {}) {
    const w = [...String(word || '')].filter(c => glyph(c));
    if (!w.length) return this;
    this._traceQueue = { letters: w, i: 0, duration, gap, wait: 0 };
    return this;
  }

  stopTrace() {
    this._traceQueue = null;
    const t = this.s.trace;
    if (!t.active) return this;
    t.active = false; t.ch = null;
    this.s.yawTarget = 0; this.s.pitchTarget = 0;
    return this;
  }

  get tracing() { return this.s.trace.active; }

  cancelSpell() { this._spellQueue = null; this.s.heldLetter = null; this.stopSpeaking(); return this; }

  setTheme(theme) { this.theme = resolveTheme(theme); this._emit('theme', this.theme.name); return this; }

  /* ------------------------------------------------------------- speech */

  /** Hold a single viseme. Pass `null` or 'rest' to close the mouth. */
  viseme(name) {
    const sp = this.s.speech;
    if (!name || name === 'rest') return this.stopSpeaking();
    if (!VISEMES[name]) throw new Error(`Unknown viseme "${name}". Available: ${VISEME_NAMES.join(', ')}`);
    sp.active = true; sp.queue.length = 0;
    sp.cur = sp.next; sp.next = name; sp.blend = 0; sp.hold = Infinity;
    return this;
  }

  /**
   * Play an explicit viseme timeline.
   * @param {Array<string|[string, number]>} seq  names, or [name, seconds]
   */
  sayVisemes(seq, { dur = 0.09, tail = true } = {}) {
    const sp = this.s.speech;
    sp.queue = seq.map(v => (Array.isArray(v) ? { v: v[0], d: v[1] } : { v, d: dur }));
    if (tail) sp.queue.push({ v: 'rest', d: 0.12 });
    if (!sp.queue.length) return this.stopSpeaking();
    sp.active = true; sp.hold = 0; sp.blend = 1;
    this._emit('speech:start');
    return this;
  }

  /**
   * Speak a written word. Approximate — English spelling is not phonetic, and
   * lip-sync only needs plausible movement in the right rhythm. Use
   * `sayVisemes()` when you need exactness.
   */
  say(text, { rate = 1 } = {}) {
    return this.sayVisemes(wordToVisemes(text), { dur: 0.09 / rate });
  }

  /** Articulate letter NAMES — "bee", "see". Exact: there are only 26. */
  sayLetters(word, { rate = 1, gap = 0.09 } = {}) {
    const seq = [];
    for (const ch of String(word || '').toUpperCase().replace(/[^A-Z]/g, '')) {
      for (const v of lettersToVisemes(ch)) seq.push([v, 0.11 / rate]);
      seq.push(['rest', gap / rate]);
    }
    return this.sayVisemes(seq, { tail: false });
  }

  /** Close the mouth and drop any pending timeline. */
  stopSpeaking() {
    const sp = this.s.speech;
    sp.queue.length = 0;
    sp.cur = sp.next; sp.next = 'rest'; sp.blend = 0; sp.hold = 0.12;
    sp.closing = true;
    return this;
  }

  /**
   * Bind to a Web Speech utterance so the mouth follows real audio.
   * `boundary` fires per word in most engines; where it doesn't, the mouth
   * simply stays closed rather than desyncing.
   */
  attachSpeech(utterance) {
    utterance.addEventListener('boundary', e => {
      if (e.name && e.name !== 'word') return;
      const word = String(utterance.text).slice(e.charIndex).split(/\s+/)[0];
      if (word) this.say(word, { rate: utterance.rate || 1 });
    });
    utterance.addEventListener('end', () => this.stopSpeaking());
    utterance.addEventListener('error', () => this.stopSpeaking());
    return utterance;
  }

  get speaking() { return this.s.speech.active; }

  /** Feed normalised pointer position (-1..1 on both axes). */
  pointer(x, y, inside = true) {
    const p = this.s.pointer;
    p.x = x; p.y = y; p.inside = inside;
    return this;
  }

  /** Manual turn, e.g. from a drag gesture. Radians, relative. */
  turnBy(dYaw, dPitch = 0) {
    this.s.autoLook = false;
    this.s.yawTarget += dYaw;
    this.s.pitchTarget = clamp(this.s.pitchTarget + dPitch, -0.55, 0.55);
    return this;
  }

  reset() { this.random.reseed(this.options.seed); this._beats.clear(); this._spellQueue = null; this._traceQueue = null; this._phase = null; this._phaseSteady = null; this.s = this._freshState(this.options); return this; }

  on(evt, fn) { (this._listeners[evt] ||= []).push(fn); return this; }
  /** Remove one listener. Adapters need this to unsubscribe on dispose. */
  off(evt, fn) {
    const l = this._listeners[evt];
    if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
    return this;
  }
  _emit(evt, arg) { (this._listeners[evt] || []).forEach(f => f(arg)); }

  get busy()       { return this.s.action !== null || this._spellQueue !== null || this.s.trace.active || this._traceQueue !== null; }

  /**
   * Named audio cue. The rig makes no sound itself — it just says when
   * something worth hearing happened, so a host can attach audio without
   * reverse-engineering animation timings.
   */
  cue(name, detail) { this._emit('cue', { name, detail, t: this.s.t }); return this; }
  get expression() { return this.s.expr; }
  get action()     { return this.s.action; }
  get yawDeg()     { return rad(this.s.yaw); }
  get pitchDeg()   { return rad(this.s.pitch); }

  /* ------------------------------------------------- helpers used by actions */
  emit(type, n, o = {}) { this.s.particles.emit(type, n, { color: this.theme.confetti[(this.random() * this.theme.confetti.length) | 0], ...o }); }
  once(at, fn, p) { if (p >= at && !this._beats.has(at)) { this._beats.add(at); fn(); } }
  /** 0 → 1 → 0 envelope: ramps up by `inAt`, holds, ramps down after `outAt`. */
  ramp(p, inAt, outAt) {
    const up = clamp(p / inAt, 0, 1);
    const dn = 1 - clamp((p - outAt) / (1 - outAt), 0, 1);
    return up * up * (3 - 2 * up) * dn;
  }

  /* -------------------------------------------------------------- the loop */
  update(dt) {
    const S = this.s;
    dt = Math.min(dt, 1 / 20);        // a backgrounded tab must not explode the springs
    S.t += dt * S.tempo;

    /* blink — jittered, never metronomic */
    S.blinkTimer -= dt;
    if (S.blinkTimer <= 0) {
      S.blinkTimer = S.blinkEvery * (0.6 + this.random() * 0.8);
      S.blinkPhase = 1e-3;
    }
    if (S.blinkPhase > 0) {
      S.blinkPhase += dt / 0.16;
      if (S.blinkPhase >= 1) { S.blinkPhase = 0; S.blink = 0; }
      else S.blink = Math.sin(S.blinkPhase * Math.PI);
    }

    if (S.xfade < 1) S.xfade = clamp(S.xfade + dt / 0.16, 0, 1);

    /* orientation — softer springs than the body, so turns carry weight */
    [S.yaw,   S.yawV]   = spring(S.yaw,   S.yawV,   S.yawTarget,   dt, 120, 14);
    [S.pitch, S.pitchV] = spring(S.pitch, S.pitchV, S.pitchTarget, dt, 150, 15);
    [S.roll,  S.rollV]  = spring(S.roll,  S.rollV,  S.rollTarget,  dt, 150, 14);

    /* body */
    [S.squashX, S.squashVX] = spring(S.squashX, S.squashVX, 1, dt);
    [S.squashY, S.squashVY] = spring(S.squashY, S.squashVY, 1, dt);
    [S.offX, S.offVX] = spring(S.offX, S.offVX, 0, dt, 150, 13);
    [S.offY, S.offVY] = spring(S.offY, S.offVY, 0, dt, 150, 13);

    /* hands drift home; animations top up `want` each tick */
    for (const k of ['l', 'r']) {
      const h = S.hand[k];
      h.lift  = approach(h.lift,  0, 0.02, dt);
      h.swing = approach(h.swing, 0, 0.02, dt);
      h.out   = approach(h.out,   0, 0.02, dt);
      h.want  = Math.max(0, h.want - dt * 2.2);
      h.show  = approach(h.show, S.showHands ? 1 : clamp(h.want, 0, 1), 1e-7, dt);
    }

    S.sparkPop  = Math.max(0, S.sparkPop  - dt * 2.2);
    S.talk      = Math.max(0, S.talk      - dt * 1.6);
    S.letterPop = Math.max(0, S.letterPop - dt * 3.2);
    S.hover     = approach(S.hover, 0, 0.02, dt);

    /* cursor tracking: eyes always, head a little, only when idle */
    const tx = S.pointer.inside ? clamp(S.pointer.x, -1, 1) : 0;
    const ty = S.pointer.inside ? clamp(S.pointer.y, -1, 1) : 0;
    S.look.x = approach(S.look.x, tx * 0.6, 0.001, dt);
    S.look.y = approach(S.look.y, ty * 0.6, 0.001, dt);
    if (S.autoLook && !S.action) {
      S.yawTarget   = approach(S.yawTarget,   tx * 0.42, 0.06, dt);
      S.pitchTarget = approach(S.pitchTarget, ty * 0.20, 0.06, dt);
    }

    /* trail history for fast-motion ghosting */
    const speed = Math.min(1, (Math.abs(S.offVX) + Math.abs(S.offVY)) / 420 + Math.abs(S.yawV) / 9);
    S.trail.push({
      x: S.offX,
      y: S.offY - (Math.sin(S.t * 1.9 * S.tempo) * 5 * S.bobAmt + S.hover),
      roll: S.roll, speed,
    });
    if (S.trail.length > 7) S.trail.shift();

    S.particles.update(dt);
    this._tickTrace(dt);
    this._tickSpeech(dt);
    this._tickSpell(dt);
    this._tickAction(dt);
    this._tickIdle(dt);
  }

  _tickAction(dt) {
    const S = this.s;
    if (!S.action) return;
    const a = ACTIONS[S.action];
    S.actionT += dt;
    const p = S.actionT / a.dur;
    if (p >= 1) {
      const name = S.action;
      a.end(this);
      S.action = null; S.actionT = 0; this._beats.clear();
      this._emit('action:end', name);
      return;
    }
    a.tick(this, p, dt);
  }

  _tickTrace(dt) {
    const S = this.s, tr = S.trace;

    // walk a queued word, one letter at a time
    const q = this._traceQueue;
    if (q && !tr.active) {
      q.wait -= dt;
      if (q.wait <= 0) {
        if (q.i >= q.letters.length) { this._traceQueue = null; this._emit('traceWord:done'); }
        else { q.wait = q.gap; this.trace(q.letters[q.i++], { duration: q.duration }); }
      }
    }

    const want = tr.active ? G.trace.shift : 0;
    S.shiftX    = approach(S.shiftX, want, 0.02, dt);
    S.autoScale = approach(S.autoScale, tr.active ? G.trace.scale : 1, 0.02, dt);
    if (!tr.active) return;

    tr.t += dt;
    const prevStroke = tr.stroke;
    tr.u = clamp(tr.t / tr.dur, 0, 1);

    const pen = penAt(tr.ch, tr.u);
    if (pen) {
      const b = glyphBounds(tr.ch);
      tr.penX = G.trace.x + (pen.x - (b.min + b.max) / 2) * G.trace.cap;
      tr.penY = G.trace.y + pen.y * G.trace.cap;
      tr.penUp = pen.penUp;
      if (pen.stroke !== prevStroke) { tr.stroke = pen.stroke; this.cue('trace:stroke', pen.stroke); }

      // watch the pen, and point at it
      const dx = (tr.penX - S.shiftX) / 150, dy = tr.penY / 220;
      S.yawTarget   = clamp(dx * 0.55, -0.7, 0.7);
      S.pitchTarget = clamp(dy * 0.45, -0.3, 0.35);
      S.look.x = clamp(dx, -1, 1);
      S.look.y = clamp(dy * 1.6, -1, 1);
      S.hand.r.want = 1; S.hand.r.lift = 0.42; S.hand.r.out = 0.55;
    }

    if (tr.u >= 1) {
      tr.hold -= dt;
      if (tr.hold <= 0) {
        tr.active = false; tr.ch = null; tr.stroke = undefined;
        S.yawTarget = 0; S.pitchTarget = 0;
        this.cue('trace:done');
        this._emit('trace:done');
        this.react('nod');
      }
    }
  }

  _tickSpeech(dt) {
    const sp = this.s.speech;
    if (!sp.active) return;

    if (sp.blend < 1) sp.blend = Math.min(1, sp.blend + dt / sp.blendFor);

    if (sp.hold === Infinity) return;          // holding one viseme
    sp.hold -= dt;
    if (sp.hold > 0) return;

    const nextSeg = sp.queue.shift();
    if (!nextSeg) {
      if (sp.closing || sp.next === 'rest') { sp.active = false; sp.closing = false; this._emit('speech:end'); }
      else this.stopSpeaking();
      return;
    }
    sp.cur = sp.next;
    sp.next = nextSeg.v;
    sp.blend = 0;
    sp.hold = nextSeg.d;
  }

  _tickSpell(dt) {
    const q = this._spellQueue;
    if (!q) return;
    q.next -= dt;
    if (q.next > 0) return;
    const S = this.s;
    if (q.i >= q.letters.length) {
      this._spellQueue = null;
      S.heldLetter = null;
      this._letterBurst(q.said);
      /* The celebration belongs to the learner, not to the character. When the
         rig spells a word *because the child could not*, cheering is the wrong
         note — it congratulates the wrong party. */
      if (q.celebrate) this.react('correct');
      this._emit('spell:done');
      return;
    }
    const ch = q.letters[q.i++];
    S.heldLetter = ch; S.letterPop = 1;
    if (q.speak) this.sayLetters(ch, { rate: 0.48 / q.interval });
    q.said.push(ch);
    S.squashVX = 1.8; S.squashVY = -1.8;
    S.yawTarget = q.i % 2 ? -0.22 : 0.22;
    S.hand.r.want = 1; S.hand.r.lift = 0.8;
    this.cue('letter', ch);
    this._emit('spell:letter', ch);
    q.next = q.interval;
  }

  /**
   * Throw the finished word outward as a flourish.
   *
   * Fanned upward and outward from above the crown, never from the centre —
   * a glyph that starts on the face sits on top of the eyes and mouth for its
   * whole lifetime, because particles draw last.
   */
  _letterBurst(letters) {
    const n = letters.length;
    if (!n) return;
    const half = Math.max(1, Math.floor((n - 1) / 2));
    letters.forEach((ch, i) => {
      /* Every letter gets a guaranteed sideways component. Fanning evenly
         around vertical sends the middle letter of an odd-length word straight
         up — and straight back down through the face, which is the bug this
         burst was built to avoid in the first place. Alternating sides with a
         minimum angle off vertical means nothing can fall back onto the head. */
      const side = i % 2 === 0 ? -1 : 1;
      const mag = 0.62 + (Math.floor(i / 2) / half) * 0.48;
      const a = -Math.PI / 2 + side * mag;
      const sp = this.random.range(250, 330);
      this.s.particles.emit('letter', 1, {
        x: Math.cos(a) * 38, y: -108 + Math.sin(a) * 10,
        angle: a, spread: 0.08,
        spdMin: sp, spdMax: sp + 40,
        grav: 520, drag: 0.987,
        sizeMin: 11, sizeMax: 11,
        ttlMin: 1.05, ttlMax: 1.3,
        char: ch, color: this.theme.body,
      });
    });
  }

  _tickIdle(dt) {
    if (!this.options.idleActions) return;
    const S = this.s;
    if (S.action || this._spellQueue) { S.idleTimer = this.random.range(...this.options.idleEvery); return; }
    S.idleTimer -= dt;
    if (S.idleTimer <= 0) {
      S.idleTimer = this.random.range(...this.options.idleEvery);
      const pool = ACTION_NAMES.filter(n => ACTIONS[n].tags?.includes('idle'));
      this.react(pool[(this.random() * pool.length) | 0]);
    }
  }

  /**
   * Snap every spring to its target and freeze the idle oscillators.
   *
   * Exporters need a pose, not a moment: without this, a "yaw 45°" sprite
   * would capture whatever the spring happened to be doing, and the bob/breath
   * cycle would make two runs differ by a pixel.
   */
  settle() {
    const S = this.s;
    S.t = 0;
    S.yaw = S.yawTarget; S.yawV = 0;
    S.pitch = S.pitchTarget; S.pitchV = 0;
    S.roll = S.rollTarget; S.rollV = 0;
    S.offX = S.offY = S.offVX = S.offVY = 0;
    S.squashX = S.squashY = 1; S.squashVX = S.squashVY = 0;
    S.hover = 0; S.blink = 0; S.blinkPhase = 0; S.xfade = 1;
    S.trail.length = 0;
    S.speech.blend = 1;
    S.shiftX = S.trace.active ? G.trace.shift : 0;
    S.autoScale = S.trace.active ? G.trace.scale : 1;
    for (const k of ['l', 'r']) S.hand[k].show = S.showHands || S.hand[k].want > 0 ? 1 : 0;
    return this;
  }

  /** Draw the current frame onto any Surface. */
  render(surface) { render(surface, this.s, this.theme); }

  /**
   * Accessories worn on the head. Names, or `{ name, color }` objects.
   *
   *   buddy.wear('glasses')
   *   buddy.wear(['bow', { name: 'glasses', color: '#1478C9' }])
   *   buddy.wear(null)
   */
  wear(items) {
    this.s.accessories = items == null ? [] : (Array.isArray(items) ? items : [items]);
    return this;
  }
  get wearing() { return this.s.accessories.map(a => (typeof a === 'string' ? a : a.name)); }

  /**
   * Advance by a fixed timestep without rendering. Used by exporters to reach
   * a precise moment in an animation deterministically.
   */
  step(seconds, hz = 60) {
    const dt = 1 / hz;
    let left = seconds;
    while (left > 1e-9) { this.update(Math.min(dt, left)); left -= dt; }
    return this;
  }

  static get visemes()     { return VISEME_NAMES; }
  static get phases()      { return PHASE_NAMES.slice(); }
  static get accessories() { return ACCESSORY_NAMES.slice(); }
  static get glyphs()      { return Object.keys(GLYPHS); }
  static get expressions() { return EXPRESSION_NAMES; }
  static get actions()     { return ACTION_NAMES; }
  static get designSize()  { return DESIGN; }
}
