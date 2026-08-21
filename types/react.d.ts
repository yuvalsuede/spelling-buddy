import type * as React from 'react';
import type { Buddy, BuddyOptions, ExpressionName, ActionName, ThemeInput, VisemeName,
              PhaseName, PhaseOptions } from './index';

export interface BuddyHandle {
  readonly buddy: Buddy | null;
  express(name: ExpressionName): void;
  react(name: ActionName): void;
  spell(word: string, opts?: { interval?: number }): void;
  hold(ch: string | null): void;
  face(yawDeg?: number, pitchDeg?: number): void;
  say(text: string, opts?: { rate?: number }): void;
  sayLetters(word: string, opts?: { rate?: number; gap?: number }): void;
  viseme(name: VisemeName | null): void;
  trace(ch: string, opts?: { duration?: number; hold?: number }): void;
  phase(name: PhaseName, opts?: PhaseOptions): void;
}

export interface UseBuddyResult extends BuddyHandle {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  ready: boolean;
}

export function useBuddy(options?: BuddyOptions & { size?: number }): UseBuddyResult;

export interface SpellingBuddyProps extends BuddyOptions {
  size?: number;
  theme?: ThemeInput;

  /**
   * The lesson-level prop. Prefer it: one value, the choreography lives in
   * the rig, and every page in the product behaves the same way.
   */
  phase?: PhaseName;
  /** Context for the phase — the word `stuck` spells out. Not a trigger. */
  word?: string;
  /** Context for the phase — the letter `teaching` traces. Not a trigger. */
  letter?: string;
  /** Bump to replay the same phase (two wrong answers in a row). */
  nonce?: string | number;

  /** Rig-level escape hatches, for what a phase does not cover. */
  expression?: ExpressionName;
  /** Setting this plays the action. Change the value to replay. */
  action?: ActionName;
  /** Setting this spells the word out, celebration and all. */
  spell?: string;
  onExpression?: (name: ExpressionName) => void;
  onActionEnd?: (name: ActionName) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const SpellingBuddy: React.ForwardRefExoticComponent<
  SpellingBuddyProps & React.RefAttributes<BuddyHandle>
>;

export default SpellingBuddy;
