/**
 * spelling-buddy — type declarations.
 */

export type ExpressionName =
  | 'happy' | 'excited' | 'thinking' | 'surprised'
  | 'proud' | 'sleepy' | 'confused' | 'dizzy' | 'content';

export type ActionName =
  | 'correct' | 'wrong' | 'nod'
  | 'turnaround' | 'peek' | 'lookAround'
  | 'jump' | 'wave' | 'dance' | 'dizzy' | 'sleep' | 'think' | 'pop';

export type ThemeName = 'ink' | 'blue' | 'cream' | 'indigo';

export type VisemeName =
  | 'rest' | 'MBP' | 'AI' | 'E' | 'O' | 'U' | 'WQ' | 'FV' | 'L' | 'etc';

export interface Viseme {
  /** mouth width */          w: number;
  /** opening height */       h: number;
  /** 1 circular, 0 lens */   round: number;
  /** 0..1 upper teeth */     teeth: number;
  /** 0..1 tongue visible */  tongue: number;
  /** vertical offset */      lift: number;
}

/** A viseme name, or [name, seconds]. */
export type VisemeStep = VisemeName | [VisemeName, number];

export interface Theme {
  name: string;
  body: string;
  bodyDeep: string;
  hand: string;
  face: string;
  feature: string;
  spark: string;
  /** What anything WORN is painted in — kept in the palette so a worn thing
   *  can never land on a body of the same colour. */
  accent: string;
  blush: string | null;
  shadow: string;
  correct: string;
  wrong: string;
  /** Tint for the un-traced part of a letter. */
  ghost: string;
  confetti: string[];
}

export type ThemeInput = ThemeName | (Partial<Theme> & { extends?: ThemeName });

export interface BuddyOptions {
  theme?: ThemeInput;
  /** Seed for the internal PRNG. Same seed ⇒ identical output. */
  seed?: number;
  expression?: ExpressionName;
  scale?: number;
  bobAmt?: number;
  breathAmt?: number;
  tempo?: number;
  blinkEvery?: number;
  autoLook?: boolean;
  showShadow?: boolean;
  showSparks?: boolean;
  showBlush?: boolean;
  showHands?: boolean;
  showTrail?: boolean;
  /** Play look-around / think spontaneously while idle. */
  idleActions?: boolean;
  idleEvery?: [number, number];
}

export interface Surface {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  scale(sx: number, sy?: number): void;
  alpha(mult: number): void;
  getAlpha(): number;
  begin(): void;
  move(x: number, y: number): void;
  line(x: number, y: number): void;
  quad(cx: number, cy: number, x: number, y: number): void;
  cubic(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(cx: number, cy: number, rx: number, ry: number, rot?: number, a0?: number, a1?: number, ccw?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
  close(): void;
  fill(color: string, evenOdd?: boolean): void;
  stroke(color: string, width: number, cap?: string, join?: string): void;
  clip(evenOdd?: boolean): void;
  text(str: string, x: number, y: number, o?: Record<string, unknown>): void;
  clear(): void;
}

export type BuddyEvent =
  | 'expression' | 'action:start' | 'action:end'
  | 'hold' | 'spell:start' | 'spell:letter' | 'spell:done' | 'theme'
  | 'speech:start' | 'speech:end'
  | 'trace:start' | 'trace:done' | 'traceWord:done'
  | 'cue';

/** What the learner is doing. The character's behaviour follows from it. */
export type PhaseName = 'idle' | 'typing' | 'correct' | 'wrong' | 'stuck' | 'teaching';

export interface PhaseOptions {
  /** the word being worked on — what `stuck` spells out */
  word?: string;
  /** the letter to form — what `teaching` traces */
  letter?: string;
  /** change it to replay the same phase */
  nonce?: string | number;
  /** replay the same phase now */
  force?: boolean;
  /** `stuck`: articulate the letter names (default true) */
  speak?: boolean;
  /** `teaching`: passed through to trace()/traceWord() */
  trace?: { duration?: number; hold?: number; gap?: number };
}

export interface PhaseSpec {
  steady?: boolean;
  expression?: ExpressionName;
  action?: ActionName;
  autoLook?: boolean;
  then?: PhaseName;
  run?: (buddy: Buddy, opts: PhaseOptions) => void;
}

export const PHASES: Record<PhaseName, PhaseSpec>;
export const PHASE_NAMES: PhaseName[];
export function applyPhase(buddy: Buddy, name: PhaseName, opts?: PhaseOptions): boolean;

export class Buddy {
  constructor(options?: BuddyOptions);

  readonly options: BuddyOptions;
  theme: Theme;
  /** Raw mutable state. Stable, but prefer the methods. */
  s: Record<string, any>;

  express(name: ExpressionName): this;
  react(name: ActionName): this;
  face(yawDeg?: number, pitchDeg?: number): this;
  hold(ch: string | null): this;
  spell(word: string, opts?: {
    interval?: number;
    speak?: boolean;
    /** default true; false when the rig spells a word the learner could not */
    celebrate?: boolean;
  }): this;

  /**
   * Set the lesson phase — one call instead of a choreography.
   * Idempotent, so it is safe to call from a render.
   */
  phase(name: PhaseName, opts?: PhaseOptions): this;
  readonly currentPhase: PhaseName | null;

  /** Wear accessories. They live in the head's frame, so they turn with it —
   *  passing behind the skull rather than fading out. */
  wear(items: AccessoryInput | AccessoryInput[] | null): this;
  readonly wearing: AccessoryName[];


  /* speech */
  /** Hold one viseme. `null` or 'rest' closes the mouth. */
  viseme(name: VisemeName | null): this;
  /** Play an explicit viseme timeline. */
  sayVisemes(seq: VisemeStep[], opts?: { dur?: number; tail?: boolean }): this;
  /** Approximate lip-sync from spelling. Use sayVisemes() for exactness. */
  say(text: string, opts?: { rate?: number }): this;
  /** Articulate letter NAMES ("bee", "see") — exact. */
  sayLetters(word: string, opts?: { rate?: number; gap?: number }): this;
  stopSpeaking(): this;
  /** Bind to a Web Speech utterance so the mouth follows real audio. */
  attachSpeech(utterance: SpeechSynthesisUtterance): SpeechSynthesisUtterance;
  readonly speaking: boolean;

  /* tracing */
  /** Show how a letter is formed, stroke by stroke. */
  trace(ch: string, opts?: { duration?: number; hold?: number }): this;
  traceWord(word: string, opts?: { duration?: number; gap?: number }): this;
  stopTrace(): this;
  readonly tracing: boolean;

  /** Emit a named audio cue. Also called internally at meaningful beats. */
  cue(name: string, detail?: unknown): this;
  cancelSpell(): this;
  setTheme(theme: ThemeInput): this;
  pointer(x: number, y: number, inside?: boolean): this;
  turnBy(dYaw: number, dPitch?: number): this;
  reset(): this;
  settle(): this;

  on(evt: BuddyEvent, fn: (arg?: any) => void): this;
  off(evt: BuddyEvent, fn: (arg?: any) => void): this;

  update(dt: number): void;
  render(surface: Surface): void;
  step(seconds: number, hz?: number): this;

  readonly busy: boolean;
  readonly expression: ExpressionName;
  readonly action: ActionName | null;
  readonly yawDeg: number;
  readonly pitchDeg: number;

  static readonly visemes: VisemeName[];
  static readonly phases: PhaseName[];
  static readonly accessories: AccessoryName[];
  static readonly glyphs: string[];
  static readonly expressions: ExpressionName[];
  static readonly actions: ActionName[];
  static readonly designSize: number;
}

export interface MountOptions extends BuddyOptions {
  buddy?: Buddy;
  size?: number | null;
  interactive?: boolean;
  dragToTurn?: boolean;
  clickToPop?: boolean;
  autoStart?: boolean;
  maxDPR?: number;
  alpha?: boolean;
  /** Read prefers-reduced-motion and damp the idle oscillators. Default true. */
  respectReducedMotion?: boolean;
  accessories?: AccessoryInput | AccessoryInput[];
  /**
   * Create an off-screen `aria-live` region and announce the moments that
   * carry information. `true` (default) makes one; pass your own element to
   * use it instead; `false` to opt out entirely.
   */
  announce?: boolean | Element;
  /** Override the announcement text. `null` for a key silences it. */
  announcements?: {
    label?: string;
    hold?:  ((ch: string) => string) | null;
    spell?: ((word: string) => string) | null;
    trace?: ((ch: string) => string) | null;
    /** off by default — most hosts show their own status text */
    correct?: (() => string) | null;
    wrong?:   (() => string) | null;
  };
}

export interface MountHandleExtras {
  /** Change a fixed size after mount (null follows the element box). */
  setSize(next: number | null): void;
  /** The live region, if one was created. */
  live: Element | null;
}

export interface MountHandle extends MountHandleExtras {
  buddy: Buddy;
  canvas: HTMLCanvasElement;
  start(): void;
  stop(): void;
  resize(): void;
  paint(): void;
  dispose(): void;
}

export function mount(canvas: HTMLCanvasElement | string, opts?: MountOptions): MountHandle;

export class CanvasSurface implements Surface {
  constructor(ctx: CanvasRenderingContext2D);
  kind: 'canvas';
  [k: string]: any;
}

export class SVGSurface implements Surface {
  constructor(opts?: { width?: number; height?: number; originCentre?: boolean; background?: string | null });
  kind: 'svg';
  toString(): string;
  [k: string]: any;
}

/* ------------------------------------------------------------- SVG export */
export interface Pose {
  expression?: ExpressionName;
  yaw?: number;
  pitch?: number;
  roll?: number;
  hands?: boolean | 'l' | 'r';
  handLift?: number;
  handOut?: number;
  letter?: string;
  label?: string;
}

export interface SVGOptions {
  theme?: ThemeInput;
  seed?: number;
  width?: number;
  height?: number;
  background?: string | null;
  padding?: number;
}

export function toSVG(buddy: Buddy, opts?: SVGOptions): string;
export function poseSVG(pose?: Pose, opts?: SVGOptions): string;
export function turnaroundSVGs(opts?: SVGOptions & { steps?: number; expression?: ExpressionName }): Array<{ name: string; yaw: number; svg: string }>;
export function expressionSVGs(opts?: SVGOptions): Array<{ name: string; expression: ExpressionName; svg: string }>;
export function sheetSVG(poses: Pose[], opts?: { cols?: number; cell?: number; gap?: number; theme?: ThemeInput; label?: boolean; background?: string; labelColor?: string }): string;

/** A specimen sheet of the whole glyph set on ruled paper. */
export function alphabetSVG(opts?: {
  rows?: string[]; cap?: number; cellW?: number; rowH?: number; pad?: number;
  ink?: string; rule?: string; background?: string;
}): string;

/* ------------------------------------------------------------- accessories */
export type AccessoryName = 'glasses' | 'bow' | 'flower' | 'cap' | 'headphones' | 'crown';
export type AccessoryInput = AccessoryName | { name: AccessoryName; color?: string; centre?: string };

export const ACCESSORY_NAMES: AccessoryName[];

/* ------------------------------------------------------------ web component */
export function defineSpellingBuddy(tag?: string): string | null;
export function getSpellingBuddyElement(): CustomElementConstructor;

/* ----------------------------------------------------------------- theming */
export const THEMES: Record<ThemeName, Theme>;
export const TOKENS: Record<'canvas' | 'ink' | 'green' | 'blue' | 'cream', string>;
export const DEFAULT_THEME: ThemeName;
export function resolveTheme(theme?: ThemeInput): Theme;

export const EXPRESSION_NAMES: ExpressionName[];
export const VISEMES: Record<VisemeName, Viseme>;
export const VISEME_NAMES: VisemeName[];
export const LETTER_VISEMES: Record<string, VisemeName[]>;
export function blendViseme(a: VisemeName, b: VisemeName, t: number): Viseme;
export function drawViseme(surface: Surface, theme: Theme, v: Viseme): void;
export function wordToVisemes(word: string): VisemeName[];
export function lettersToVisemes(word: string): VisemeName[];

/* ------------------------------------------------------------- alphabet */
export type GlyphCommand =
  | ['M', number, number]
  | ['L', number, number]
  | ['Q', number, number, number, number]
  | ['C', number, number, number, number, number, number];

/** Monoline strokes in cap-height units: y = -0.5 at the cap, +0.5 on the baseline. */
export const GLYPHS: Record<string, GlyphCommand[][]>;
export const GLYPH_CHARS: string[];

/** Vertical metrics, in cap-height units. */
export const METRICS: {
  cap: number; baseline: number; middle: number;
  /** x-height as a fraction of the cap height */ xHeight: number;
  /** y of the x-line — the top of a lowercase o */ xLine: number;
  /** y of the descender line */ descender: number;
  ascender: number;
};

/** Exact match first, falling back to the capital: `glyph('a')` is not an 'A'. */
export function glyph(ch: string): GlyphCommand[][] | null;
export function glyphBounds(ch: string): { min: number; max: number; top: number; bottom: number };
export function glyphWidth(ch: string): number;

export type GlyphAlign = 'baseline' | 'ink';

export function drawGlyph(
  surface: Surface, ch: string, cap: number, color: string,
  weight?: number, centred?: boolean, align?: GlyphAlign
): boolean;

export function drawWord(
  surface: Surface, text: string, cap: number, color: string,
  weight?: number, tracking?: number
): void;

/* -------------------------------------------------------------- tracing */
export interface PenPoint { x: number; y: number; stroke: number; into: number; penUp: boolean; }
export interface FlatStroke { pts: number[][]; cum: number[]; len: number; }

export function flattenGlyph(ch: string): { strokes: FlatStroke[]; len: number };
export function glyphPath(ch: string): { strokes: FlatStroke[]; len: number };
export function penAt(ch: string, u: number, opts?: { liftFraction?: number }): PenPoint | null;
export type TraceVerdict = 'great' | 'good' | 'close' | 'again' | 'none';
export type TraceHint = 'finish' | 'stay-on' | 'direction';

export interface TraceScore {
  /** 0→1 overall */            score: number;
  /** how close to the line */  accuracy: number;
  /** per-stroke, averaged */   coverage: number;
  /** written the right way */  direction: number;
  verdict: TraceVerdict;
  /** the weakest component */  hint: TraceHint;
  strokesHit: number;
  strokes: number;

  /* Present only when `diagnose: true`. */
  /** their marks, mirrored, fit the target — they wrote it backwards */
  reversed?: boolean;
  /** what the mirrored attempt scored */
  mirrorScore?: number;
  /** the letter they appear to have drawn instead, or null */
  looksLike?: string | null;
  looksLikeScore?: number;
}

/**
 * Grade a traced path. `input` is one path per pen-down (preferred) or a
 * single flat path, in cap-height units centred on the letter.
 */
export function scoreTrace(
  ch: string,
  input: number[][] | number[][][],
  opts?: {
    tolerance?: number;
    /** also work out whether it was reversed, and what letter it looks like.
     *  Walks the character set — call it on submit, not on every move. */
    diagnose?: boolean;
    /** restrict the `looksLike` search (default: A–Z a–z 0–9) */
    candidates?: string[];
  }
): TraceScore;

/** What letter does this trace look like? Ranked, best first. */
export function identifyTrace(
  input: number[][] | number[][][],
  opts?: { candidates?: string[]; tolerance?: number; top?: number }
): (TraceScore & { ch: string })[];

export function drawTrace(
  surface: Surface, ch: string, cap: number, u: number,
  colors: { ghost?: string | null; ink: string }, weight?: number
): { x: number; y: number; penUp: boolean } | null;
export const ACTION_NAMES: ActionName[];
export const DESIGN: number;
