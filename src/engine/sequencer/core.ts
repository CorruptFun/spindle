/**
 * The sequencer's timekeeping: which hits fall before a given time on the
 * audio clock. Plain maths with no Web Audio, timers or DOM, so tests drive it
 * directly; the Sequencer shell feeds it the clock and passes hits to the pads.
 *
 * Time model. Steps are counted from the start of play with an integer that
 * never wraps (the "absolute step"). A straight line maps time to that count:
 * `step = anchorStep + (time - anchorTime) / stepDuration`. A tempo change
 * starts a new line where the old one ends, so the count never jumps. Every
 * hit time is computed from the line, never accumulated, which is why
 * collecting in one call or in many small ones gives identical times.
 *
 * Swing delays every second sixteenth (odd steps) by
 * `swing * 0.5 * stepDuration`. At the largest swing (0.6) that is 0.3 of a
 * step, so swung steps never overtake the next one.
 *
 * Bar lines fall on every absolute step that is a multiple of STEPS_PER_BAR.
 * Loops are one or two bars long and always start on a bar line, so a step's
 * place in the loop and its place in the bar always agree.
 */
import { clamp } from '@/lib/audio-math';
import { MAX_BPM, MAX_SWING, MIN_BPM, STEPS_PER_BAR, STEPS_PER_BEAT, patternSteps } from './types';
import type { DrumPattern } from './types';

export const DEFAULT_BPM = 100;

/** Never emit more than this many steps in one call: a guard against a runaway clock. */
const MAX_STEPS_PER_COLLECT = 4096;

/** Receives one hit: which pad, how hard (0..1], and when on the audio clock. */
export type HitSink = (pad: number, velocity: number, time: number) => void;
/** Receives the time of a bar line as it is collected. */
export type BarSink = (time: number) => void;
/** Receives the time of every beat, and whether it is the first of its bar. Swing never moves a beat. */
export type BeatSink = (time: number, downbeat: boolean) => void;

export function stepDurationSec(bpm: number): number {
  return 60 / bpm / 4;
}

/** How late a step sounds because of swing. Even steps are never moved. */
export function swingDelaySec(step: number, swing: number, stepDuration: number): number {
  return step % 2 === 0 ? 0 : swing * 0.5 * stepDuration;
}

/** One straight piece of the time-to-step line. */
interface Segment {
  time: number;
  step: number;
  duration: number;
}

/** How absolute steps map to places in a loop: `index = (step - base) mod length`. */
interface LoopMap {
  /** First absolute step this map applies to. */
  from: number;
  base: number;
  length: number;
}

function mod(value: number, length: number): number {
  const r = ((value % length) + length) % length;
  // A tiny negative value can round up to exactly `length`.
  return r >= length ? 0 : r;
}

/** A copy of `pattern` with one step of one lane set. Short or missing lanes are padded with 0. */
export function withStep(
  pattern: DrumPattern,
  pad: number,
  step: number,
  velocity: number,
): DrumPattern {
  const steps = patternSteps(pattern);
  const lanes: (readonly number[])[] = pattern.lanes.slice();
  while (lanes.length <= pad) lanes.push([]);
  const lane: number[] = [];
  const old = lanes[pad] ?? [];
  for (let i = 0; i < Math.max(steps, old.length); i += 1) lane.push(old[i] ?? 0);
  lane[step] = velocity;
  lanes[pad] = lane;
  return { bars: pattern.bars, lanes };
}

export class SequencerCore {
  private bpmValue = DEFAULT_BPM;
  private swingValue = 0;
  private current: DrumPattern;
  private pending: DrumPattern | null = null;
  private playingValue = false;

  /** The line in force now, and the one before it (steps already scheduled may sit on it). */
  private segment: Segment = { time: 0, step: 0, duration: stepDurationSec(DEFAULT_BPM) };
  private previousSegment: Segment | null = null;

  private loop: LoopMap;
  private previousLoop: LoopMap | null = null;

  /** The first step not yet handed out. */
  private nextStep = 0;
  /** The furthest time collected so far. */
  private collectedUntil = -Infinity;
  /** Where the most recent bar-line pattern change landed. */
  private switchTime = -Infinity;
  /** Per pad, an absolute step that must not be played (a finger just played it). -1 = none. */
  private readonly suppressed: number[] = [];

  constructor(pattern: DrumPattern, bpm = DEFAULT_BPM, swing = 0) {
    this.current = pattern;
    this.loop = { from: 0, base: 0, length: patternSteps(pattern) };
    this.setTempo(bpm);
    this.setSwing(swing);
  }

  get bpm(): number {
    return this.bpmValue;
  }

  get swing(): number {
    return this.swingValue;
  }

  get pattern(): DrumPattern {
    return this.current;
  }

  get playing(): boolean {
    return this.playingValue;
  }

  /**
   * A bar-line change is still waiting. `now` matters because changes are
   * collected a little ahead: one already collected is pending until its bar
   * line actually arrives.
   */
  changePending(now: number): boolean {
    return this.pending !== null || (this.playingValue && now < this.switchTime);
  }

  /**
   * Clamped to MIN_BPM..MAX_BPM. While playing, the new spacing starts where
   * collection has reached (or at the next step, if that is earlier), so
   * nothing already handed out moves and no step is skipped or repeated.
   */
  setTempo(bpm: number): void {
    if (!Number.isFinite(bpm)) return;
    this.bpmValue = clamp(bpm, MIN_BPM, MAX_BPM);
    const duration = stepDurationSec(this.bpmValue);
    if (!this.playingValue) {
      this.segment = { time: this.segment.time, step: this.segment.step, duration };
      return;
    }
    const seg = this.segment;
    const at = Math.max(seg.time, Math.min(this.collectedUntil, this.gridTime(this.nextStep)));
    if (at > seg.time) {
      this.previousSegment = seg;
      this.segment = { time: at, step: seg.step + (at - seg.time) / seg.duration, duration };
    } else {
      this.segment = { time: seg.time, step: seg.step, duration };
    }
  }

  /** Clamped to 0..MAX_SWING. Applies to every step not yet handed out. */
  setSwing(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.swingValue = clamp(amount, 0, MAX_SWING);
  }

  /**
   * `'now'` carries on from the same place in the new loop (wrapped into it if
   * it is shorter) and cancels a change waiting for its bar line. `'next-bar'`
   * waits for the next bar line not yet collected, then starts the new loop
   * from its first step. When stopped, both apply at once.
   */
  setPattern(pattern: DrumPattern, when: 'now' | 'next-bar' = 'now'): void {
    if (when === 'next-bar' && this.playingValue) {
      this.pending = pattern;
      return;
    }
    this.pending = null;
    // A bar-line change already collected is superseded too.
    this.switchTime = -Infinity;
    const length = patternSteps(pattern);
    if (!this.playingValue) {
      this.current = pattern;
      this.loop = { from: 0, base: 0, length };
      this.previousLoop = null;
      return;
    }
    const index = mod(this.nextStep - this.loop.base, this.loop.length) % length;
    this.current = pattern;
    this.changeLoop({ from: this.nextStep, base: this.nextStep - index, length });
  }

  /** Begin at the top of the loop; the first step sounds at `firstStepTime`. */
  start(firstStepTime: number): void {
    if (this.pending) {
      this.current = this.pending;
      this.pending = null;
    }
    this.playingValue = true;
    this.segment = { time: firstStepTime, step: 0, duration: stepDurationSec(this.bpmValue) };
    this.previousSegment = null;
    this.loop = { from: 0, base: 0, length: patternSteps(this.current) };
    this.previousLoop = null;
    this.nextStep = 0;
    this.collectedUntil = -Infinity;
    this.switchTime = -Infinity;
    this.suppressed.fill(-1);
  }

  /** Stop. A change waiting for its bar line takes effect now. */
  stop(): void {
    this.playingValue = false;
    if (this.pending) {
      this.current = this.pending;
      this.pending = null;
    }
    this.loop = { from: 0, base: 0, length: patternSteps(this.current) };
    this.previousLoop = null;
    this.switchTime = -Infinity;
  }

  /**
   * Hand out every hit that sounds before `untilTime`, in time order, and every
   * bar line and beat among them. Each step is handed out exactly once.
   */
  collect(untilTime: number, emit: HitSink, bar?: BarSink, beat?: BeatSink): void {
    if (!this.playingValue || !Number.isFinite(untilTime)) return;
    for (let guard = 0; guard < MAX_STEPS_PER_COLLECT; guard += 1) {
      const step = this.nextStep;
      const grid = this.gridTime(step);
      const time = grid + swingDelaySec(step, this.swingValue, this.durationAt(step));
      if (!(time < untilTime)) break;

      if (step % STEPS_PER_BAR === 0) {
        if (this.pending) {
          const length = patternSteps(this.pending);
          this.current = this.pending;
          this.pending = null;
          this.changeLoop({ from: step, base: step, length });
          this.switchTime = grid;
        }
        bar?.(grid);
      }
      if (beat && step % STEPS_PER_BEAT === 0) beat(grid, step % STEPS_PER_BAR === 0);

      const index = mod(step - this.loop.base, this.loop.length);
      const lanes = this.current.lanes;
      for (let pad = 0; pad < lanes.length; pad += 1) {
        const velocity = lanes[pad]?.[index] ?? 0;
        if (!(velocity > 0)) continue;
        if (this.suppressed[pad] === step) {
          this.suppressed[pad] = -1;
          continue;
        }
        emit(pad, velocity, time);
      }
      this.nextStep = step + 1;
    }
    if (untilTime > this.collectedUntil) this.collectedUntil = untilTime;
  }

  /**
   * A finger hit `pad` at `now`. Writes it into the step that sounds nearest
   * to `now` (swing included; past the last step it wraps to step 0) and
   * returns the new pattern, which becomes the one playing. If that step has
   * not been handed out yet, this pad is skipped on it once, because the
   * person has just played it. Null when stopped.
   */
  recordHit(pad: number, velocity: number, now: number): DrumPattern | null {
    if (!this.playingValue) return null;
    if (!Number.isInteger(pad) || pad < 0 || !Number.isFinite(now)) return this.current;

    const around = Math.floor(this.stepAt(now));
    let best = Math.max(0, around - 1);
    let bestDistance = Infinity;
    for (let step = Math.max(0, around - 1); step <= Math.max(0, around + 2); step += 1) {
      const time =
        this.gridTime(step) + swingDelaySec(step, this.swingValue, this.durationAt(step));
      const distance = Math.abs(time - now);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = step;
      }
    }

    const index = mod(best - this.loop.base, this.loop.length);
    this.current = withStep(this.current, pad, index, velocity);
    if (best >= this.nextStep) {
      while (this.suppressed.length <= pad) this.suppressed.push(-1);
      this.suppressed[pad] = best;
    }
    return this.current;
  }

  /** The playhead in steps, 0 <= x < loop length, fractional. -1 when stopped. */
  stepPosition(now: number): number {
    if (!this.playingValue || !Number.isFinite(now)) return -1;
    const step = this.stepAt(now);
    if (step <= 0) return 0;
    const map = this.previousLoop && step < this.loop.from ? this.previousLoop : this.loop;
    return mod(step - map.base, map.length);
  }

  /** Grid (unswung) time of an absolute step. */
  private gridTime(step: number): number {
    const seg =
      this.previousSegment && step < this.segment.step ? this.previousSegment : this.segment;
    return seg.time + (step - seg.step) * seg.duration;
  }

  private durationAt(step: number): number {
    return this.previousSegment && step < this.segment.step
      ? this.previousSegment.duration
      : this.segment.duration;
  }

  /** Fractional absolute step at a time. */
  private stepAt(time: number): number {
    const seg =
      this.previousSegment && time < this.segment.time ? this.previousSegment : this.segment;
    return seg.step + (time - seg.time) / seg.duration;
  }

  private changeLoop(next: LoopMap): void {
    if (next.from > this.loop.from) this.previousLoop = this.loop;
    this.loop = next;
  }
}
