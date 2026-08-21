'use client';

/**
 * Next.js (App Router) wrapper — the only thing pages should import.
 *
 * Three jobs, all of which are easy to get wrong once per page instead of
 * once per app:
 *
 *   1. `'use client'` and a mount inside an effect, so nothing touches
 *      `document` during SSR.
 *   2. One rig per component instance, disposed on unmount — including
 *      React 18 StrictMode's double-invoke in dev, which leaks a rAF loop if
 *      the cleanup is wrong.
 *   3. The brand theme, not taken as a prop. If callers can pass a palette,
 *      eventually one of them will, on a page nobody reviews.
 *
 * It imports the core ESM entry rather than `spelling-buddy/react`, so the
 * package's `.jsx` adapter never reaches the bundler and `transpilePackages`
 * in next.config.js stays untouched.
 */

import { useEffect, useRef } from 'react';
import { mount } from 'spelling-buddy';
import type { Buddy as Rig, MountHandle } from 'spelling-buddy';

/** What the learner is doing. The character's behaviour follows from this. */
export type Phase =
  | 'idle'      // nothing is happening
  | 'typing'    // they are entering an answer
  | 'correct'   // they got it right
  | 'wrong'     // they got it wrong
  | 'stuck'     // show them the answer
  | 'teaching'; // show them how a letter is formed

export type BuddyProps = {
  phase?: Phase;
  /** The word being worked on — what `stuck` spells out. */
  word?: string;
  /** The letter to form — what `teaching` traces. */
  letter?: string;
  /** Bump to replay the same phase (two wrong answers in a row). */
  nonce?: string | number;
  size?: number;
  className?: string;
  /**
   * Accessible name. Provisional: the character has no product name yet, so
   * this is a placeholder rather than copy anyone signed off.
   */
  ariaLabel?: string;
  /** Escape hatch for the cases a phase does not cover. */
  onReady?: (rig: Rig) => void;
};

export default function Buddy({
  phase = 'idle',
  word,
  letter,
  nonce,
  size = 200,
  className,
  ariaLabel,
  onReady,
}: BuddyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MountHandle | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handle = mount(el, {
      theme: 'ink',              // Brand System v4.1. Deliberately not a prop.
      size,
      idleActions: false,
      ...(ariaLabel ? { announcements: { label: ariaLabel } } : {}),
    });
    handleRef.current = handle;
    readyRef.current?.(handle.buddy);

    return () => {
      handle.dispose();
      handleRef.current = null;
    };
    // Mount once. Size and phase are applied through the API below rather
    // than by rebuilding the rig, which would restart every animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { handleRef.current?.setSize(size); }, [size]);

  /* `phase()` is idempotent, so re-running this on any dependency change is
     free — and it covers the common case where `word` arrives one render
     after the phase that needs it. */
  useEffect(() => {
    handleRef.current?.buddy.phase(phase, { word, letter, nonce });
  }, [phase, word, letter, nonce]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size, display: 'block', touchAction: 'none' }}
    />
  );
}
