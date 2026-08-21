/**
 * Lesson phases — one prop instead of a script.
 *
 * The rest of the API is rig-level: `express`, `react`, `spell`, `trace` are
 * verbs about the character. That is the right surface for building something
 * new, and the wrong one for a team (or a set of agents) shipping page after
 * page, because every page ends up choreographing the character slightly
 * differently and after twenty of them the app has twenty personalities.
 *
 * A phase is lesson-level: it says what the *learner* is doing, and the
 * choreography lives here, once. Set `phase="typing"` and the character does
 * the same thing on every page in the product, because there is only one place
 * that decides what typing looks like.
 *
 *   idle      nothing is happening
 *   typing    they are entering an answer
 *   correct   they got it right
 *   wrong     they got it wrong
 *   stuck     they need the answer shown to them
 *   teaching  show them how a letter is formed
 *
 * Two of those are momentary — `correct` and `wrong` are events, not states —
 * so each names the steady phase to fall back into when its animation ends.
 * That is the part hosts consistently get wrong by hand: they fire the
 * celebration and then leave the character standing in it.
 */

export const PHASES = {
  idle: {
    steady: true,
    expression: 'happy',
    autoLook: true,
  },

  typing: {
    steady: true,
    expression: 'thinking',
    autoLook: true,
  },

  correct: {
    action: 'correct',
    then: 'idle',
  },

  wrong: {
    action: 'wrong',
    then: 'typing',
  },

  /* Showing them the answer. `word` spells it out letter by letter; without
     one there is nothing to show, so the character just visibly thinks rather
     than pretending to know something it was not given. */
  stuck: {
    then: 'typing',
    run(b, o) {
      if (o.word) b.spell(o.word, { speak: o.speak !== false, celebrate: false });
      else b.react('think');
    },
  },

  /* Letter formation. `letter` traces one; `word` traces each in turn. */
  teaching: {
    then: 'idle',
    run(b, o) {
      if (o.letter) b.trace(o.letter, o.trace);
      else if (o.word) b.traceWord(o.word, o.trace);
      else b.react('think');
    },
  },
};

export const PHASE_NAMES = Object.keys(PHASES);

/** The event that marks a non-steady phase as finished. */
const DONE_EVENT = {
  correct: 'action:end',
  wrong: 'action:end',
  stuck: 'spell:done',
  teaching: 'trace:done',
};

/**
 * Apply a phase to a rig.
 *
 * Idempotent by design: React re-renders far more often than the lesson
 * changes, and a celebration that re-fires on every render is the first bug
 * anyone hits. Pass `force` (or change `nonce` on the adapters) to replay the
 * same phase deliberately — two wrong answers in a row, for instance.
 */
export function applyPhase(buddy, name, opts = {}) {
  const spec = PHASES[name];
  if (!spec) return false;

  const cur = buddy._phase;
  if (cur && cur.name === name && !opts.force && cur.nonce === opts.nonce) return false;

  /* Entering a phase cancels the previous one's work. Without this, switching
     from `teaching` to `typing` leaves a letter drawing itself in the corner
     of a page that has moved on. */
  buddy.stopTrace();
  buddy.cancelSpell();

  buddy._phase = { name, nonce: opts.nonce, steady: !!spec.steady };
  if (spec.steady) buddy._phaseSteady = name;

  buddy.s.autoLook = spec.autoLook ?? false;
  if (spec.expression) buddy.express(spec.expression);
  if (spec.action) buddy.react(spec.action);
  if (spec.run) spec.run(buddy, opts);

  /* Fall back to a steady phase when the momentary one finishes. A phase
     change in the meantime wins — the listener checks it is still the one
     that armed itself. */
  const evt = spec.then && DONE_EVENT[name];
  if (evt) {
    const armed = buddy._phase;
    const back = () => {
      buddy.off(evt, back);
      if (buddy._phase !== armed) return;
      applyPhase(buddy, spec.then, { word: opts.word, letter: opts.letter });
    };
    buddy.on(evt, back);
  }
  return true;
}
