import type * as React from 'react';
import type { Buddy, BuddyOptions, ExpressionName, ActionName, ThemeInput, VisemeName } from './index';

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
}

export interface UseBuddyResult extends BuddyHandle {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  ready: boolean;
}

export function useBuddy(options?: BuddyOptions & { size?: number }): UseBuddyResult;

export interface SpellingBuddyProps extends BuddyOptions {
  size?: number;
  theme?: ThemeInput;
  /** Controlled expression — setting it calls express(). */
  expression?: ExpressionName;
  /** Setting this plays the action. Change the value to replay. */
  action?: ActionName;
  /** Setting this spells the word out. */
  word?: string;
  onExpression?: (name: ExpressionName) => void;
  onActionEnd?: (name: ActionName) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const SpellingBuddy: React.ForwardRefExoticComponent<
  SpellingBuddyProps & React.RefAttributes<BuddyHandle>
>;

export default SpellingBuddy;
