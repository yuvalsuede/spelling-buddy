/**
 * React adapter.
 *
 * `useBuddy` gives you the ref plus an imperative handle; `<SpellingBuddy/>`
 * is the batteries-included component. Both mount exactly one rig per canvas
 * and tear it down properly on unmount — no leaked rAF loops in StrictMode.
 */
import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { mount } from './mount.js';

export function useBuddy(options = {}) {
  const canvasRef = useRef(null);
  const handleRef = useRef(null);
  const [ready, setReady] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!canvasRef.current) return;
    const h = mount(canvasRef.current, optsRef.current);
    handleRef.current = h;
    setReady(true);
    return () => { h.dispose(); handleRef.current = null; setReady(false); };
    // Intentionally mount-once: option changes are applied through the API
    // below rather than by rebuilding the rig, which would reset animation.
  }, []);

  const express = useCallback(n => handleRef.current?.buddy.express(n), []);
  const react   = useCallback(n => handleRef.current?.buddy.react(n), []);
  const spell   = useCallback((w, o) => handleRef.current?.buddy.spell(w, o), []);
  const hold    = useCallback(c => handleRef.current?.buddy.hold(c), []);
  const face    = useCallback((y, p) => handleRef.current?.buddy.face(y, p), []);
  const say     = useCallback((t, o) => handleRef.current?.buddy.say(t, o), []);
  const sayLetters = useCallback((w, o) => handleRef.current?.buddy.sayLetters(w, o), []);
  const viseme  = useCallback(v => handleRef.current?.buddy.viseme(v), []);
  const trace   = useCallback((c, o) => handleRef.current?.buddy.trace(c, o), []);
  const phase   = useCallback((n, o) => handleRef.current?.buddy.phase(n, o), []);

  return { canvasRef, ready, express, react, spell, hold, face, say, sayLetters, viseme, trace, phase,
           get buddy() { return handleRef.current?.buddy ?? null; } };
}

export const SpellingBuddy = forwardRef(function SpellingBuddy(props, ref) {
  const {
    size = 240,
    theme = 'ink',
    /* The lesson-level prop. Prefer this: it is one value, the choreography
       lives in the rig, and every page in the product behaves the same. */
    phase,
    /* Context for the phase — the word being spelled, the letter being
       taught. Changing them does not by itself do anything; the phase
       decides what they mean. */
    word,
    letter,
    /* Bump to replay the same phase (two wrong answers in a row). */
    nonce,
    /* Rig-level escape hatches, for the cases a phase does not cover. */
    expression,
    action,
    spell,
    onExpression,
    onActionEnd,
    style,
    className,
    ...rest
  } = props;

  const canvasRef = useRef(null);
  const handleRef = useRef(null);

  useEffect(() => {
    const h = mount(canvasRef.current, { theme, size, ...rest });
    handleRef.current = h;
    if (onExpression) h.buddy.on('expression', onExpression);
    if (onActionEnd)  h.buddy.on('action:end', onActionEnd);
    return () => h.dispose();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (theme) handleRef.current?.buddy.setTheme(theme); }, [theme]);

  /* `phase` is applied on every render rather than only when it changes:
     `applyPhase` is idempotent, so this costs nothing and it survives the
     case where `word` arrives a render after the phase does. */
  useEffect(() => {
    if (phase) handleRef.current?.buddy.phase(phase, { word, letter, nonce });
  }, [phase, word, letter, nonce]);

  useEffect(() => { if (expression) handleRef.current?.buddy.express(expression); }, [expression]);
  useEffect(() => { if (action)     handleRef.current?.buddy.react(action); }, [action]);
  useEffect(() => { if (spell)      handleRef.current?.buddy.spell(spell); }, [spell]);

  useImperativeHandle(ref, () => ({
    get buddy() { return handleRef.current?.buddy ?? null; },
    express: n => handleRef.current?.buddy.express(n),
    react:   n => handleRef.current?.buddy.react(n),
    spell:   (w, o) => handleRef.current?.buddy.spell(w, o),
    hold:    c => handleRef.current?.buddy.hold(c),
    face:    (y, p) => handleRef.current?.buddy.face(y, p),
    say:     (t, o) => handleRef.current?.buddy.say(t, o),
    sayLetters: (w, o) => handleRef.current?.buddy.sayLetters(w, o),
    viseme:  v => handleRef.current?.buddy.viseme(v),
    trace:   (c, o) => handleRef.current?.buddy.trace(c, o),
    phase:   (n, o) => handleRef.current?.buddy.phase(n, o),
  }), []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size, display: 'block', touchAction: 'none', ...style }}
    />
  );
});

export default SpellingBuddy;
