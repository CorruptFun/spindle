/** Sixteen steps to the bar: four beats, each cut in four. */
export const STEPS_PER_BAR = 16;
export const STEPS_PER_BEAT = 4;

export const MIN_BPM = 60;
export const MAX_BPM = 180;
/** 0 is dead straight; at 0.6 every second sixteenth is very late. */
export const MAX_SWING = 0.6;

export type PatternBars = 1 | 2;

/**
 * One drum loop. `lanes[pad][step]` is how hard that pad is hit on that step:
 * 0 is not at all, anything up to 1 is a hit of that strength. There is one
 * lane per pad and `bars * STEPS_PER_BAR` steps in each. Patterns are never
 * changed in place: an edit makes a new one.
 */
export interface DrumPattern {
  readonly bars: PatternBars;
  readonly lanes: readonly (readonly number[])[];
}

export function patternSteps(pattern: DrumPattern): number {
  return pattern.bars * STEPS_PER_BAR;
}

/** A hit recorded into the loop: the loop with the hit in it, and where it landed. */
export interface RecordedHit {
  readonly pattern: DrumPattern;
  /** Index of the step within the loop. */
  readonly step: number;
}

/** Everything the rest of the app may do to the sequencer. */
export interface SequencerControl {
  /** Start from the top of the loop, or stop. Stopping also silences the pads. */
  start(): void;
  stop(): void;
  readonly playing: boolean;

  readonly bpm: number;
  /** Clamped to MIN_BPM..MAX_BPM. Changing tempo while playing must not jump or stutter. */
  setTempo(bpm: number): void;

  readonly swing: number;
  /** Clamped to 0..MAX_SWING. */
  setSwing(amount: number): void;

  /** The loop being played, including anything recorded into it. */
  readonly pattern: DrumPattern;

  /**
   * Change the loop.
   * - `'now'` (the default): keep the playhead where it is and carry on with
   *   the new pattern. This is how an edit to the current loop is applied.
   * - `'next-bar'`: while playing, wait for the next bar line so a different
   *   loop comes in on the beat. When stopped it applies at once.
   */
  setPattern(pattern: DrumPattern, when?: 'now' | 'next-bar'): void;
  /** A `'next-bar'` change is waiting for its bar line. */
  readonly changePending: boolean;

  /**
   * A finger hit `pad` just now while recording. Writes the hit into the
   * nearest step of the loop (wrapping at the end) and makes sure the sequencer
   * does not immediately play that same hit a second time. Returns the new
   * pattern and the step the hit went to, or null when the sequencer is
   * stopped or there is no such pad.
   */
  recordHit(pad: number, velocity: number): RecordedHit | null;

  /**
   * A click on every beat while playing, higher on the first beat of the bar.
   * Something to play along to while recording: an empty loop gives no beat.
   */
  setClick(on: boolean): void;

  /**
   * Where the playhead is, in steps: 0 up to (not including) the pattern's
   * length, fractional. -1 when stopped. Cheap enough to call every frame.
   */
  stepPosition(): number;

  /** Called on the main thread at each bar line while playing (close to, not exactly at, the beat). */
  onBar: (() => void) | null;

  dispose(): void;
}
