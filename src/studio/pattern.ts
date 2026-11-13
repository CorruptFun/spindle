/**
 * Edits to a drum loop. Every function is pure: it returns a new pattern (or
 * the same one when nothing changes) and never touches the one passed in, so
 * the screen can compare old and new by reference and undo is just keeping
 * the old one.
 */

import { PAD_COUNT } from '@/engine/sampler/types';
import { patternSteps, STEPS_PER_BAR } from '@/engine/sequencer/types';
import type { DrumPattern, PatternBars } from './types';

/** A normal hit. Leaves headroom above it for an accent. */
export const STEP_ON = 0.8;
/** A loud hit. */
export const STEP_ACCENT = 1;

export function emptyPattern(bars: PatternBars): DrumPattern {
  const steps = bars * STEPS_PER_BAR;
  return {
    bars,
    lanes: Array.from({ length: PAD_COUNT }, () => new Array<number>(steps).fill(0)),
  };
}

function isIndex(value: number, length: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < length;
}

function clampVelocity(value: number): number {
  // NaN is not a hit.
  if (!(value > 0)) return 0;
  return Math.min(1, value);
}

/**
 * One tap on a step: off, then on, then accented, then off again. A softer
 * hit (a ghost note from a factory loop or a recording) counts as on, so the
 * next tap accents it.
 */
export function toggleStep(pattern: DrumPattern, pad: number, step: number): DrumPattern {
  const value = pattern.lanes[pad]?.[step];
  if (value === undefined || !isIndex(step, patternSteps(pattern))) return pattern;
  const next = value <= 0 ? STEP_ON : value < STEP_ACCENT ? STEP_ACCENT : 0;
  return setStep(pattern, pad, step, next);
}

export function setStep(
  pattern: DrumPattern,
  pad: number,
  step: number,
  velocity: number,
): DrumPattern {
  if (!isIndex(pad, PAD_COUNT) || !isIndex(step, patternSteps(pattern))) return pattern;
  const lane = pattern.lanes[pad];
  if (!lane) return pattern;
  const value = clampVelocity(velocity);
  if (lane[step] === value) return pattern;
  const changed = lane.slice();
  changed[step] = value;
  return { bars: pattern.bars, lanes: pattern.lanes.map((l, i) => (i === pad ? changed : l)) };
}

export function clearLane(pattern: DrumPattern, pad: number): DrumPattern {
  if (!isIndex(pad, PAD_COUNT)) return pattern;
  const lane = pattern.lanes[pad];
  if (!lane || lane.every((v) => v === 0)) return pattern;
  const cleared = new Array<number>(lane.length).fill(0);
  return { bars: pattern.bars, lanes: pattern.lanes.map((l, i) => (i === pad ? cleared : l)) };
}

/** Going to two bars repeats bar one; going to one bar keeps bar one. */
export function withBars(pattern: DrumPattern, bars: PatternBars): DrumPattern {
  if (pattern.bars === bars) return pattern;
  const lanes =
    bars === 2
      ? pattern.lanes.map((lane) => [...lane, ...lane])
      : pattern.lanes.map((lane) => lane.slice(0, STEPS_PER_BAR));
  return { bars, lanes };
}

export function isEmptyPattern(pattern: DrumPattern): boolean {
  return pattern.lanes.every((lane) => lane.every((v) => v === 0));
}

export function patternsEqual(a: DrumPattern, b: DrumPattern): boolean {
  if (a === b) return true;
  if (a.bars !== b.bars || a.lanes.length !== b.lanes.length) return false;
  return a.lanes.every((lane, pad) => {
    const other = b.lanes[pad];
    return (
      other !== undefined && lane.length === other.length && lane.every((v, i) => v === other[i])
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Turns anything (a saved loop from an older version, a hand-edited file) into
 * a pattern the sequencer can play: PAD_COUNT lanes of exactly the right
 * length, every value a number in 0..1. Missing lanes and steps are silent,
 * extra ones are dropped. Returns null only when there is nothing shaped like
 * a pattern at all: not an object, or no `lanes` list.
 *
 * Reads at most PAD_COUNT lanes and at most one pattern's worth of steps from
 * each, so a huge input costs no more than a normal one.
 */
export function normalizePattern(value: unknown): DrumPattern | null {
  if (!isRecord(value)) return null;
  const rawLanes = value['lanes'];
  if (!Array.isArray(rawLanes)) return null;

  let bars: PatternBars;
  if (value['bars'] === 1 || value['bars'] === 2) {
    bars = value['bars'];
  } else {
    // No usable bar count: go by the longest lane, as that is what was written.
    let longest = 0;
    for (let pad = 0; pad < PAD_COUNT; pad++) {
      const lane: unknown = rawLanes[pad];
      if (Array.isArray(lane)) longest = Math.max(longest, lane.length);
    }
    bars = longest > STEPS_PER_BAR ? 2 : 1;
  }

  const steps = bars * STEPS_PER_BAR;
  const lanes: number[][] = [];
  for (let pad = 0; pad < PAD_COUNT; pad++) {
    const lane: unknown = rawLanes[pad];
    const out = new Array<number>(steps).fill(0);
    if (Array.isArray(lane)) {
      const n = Math.min(steps, lane.length);
      for (let step = 0; step < n; step++) {
        const v: unknown = lane[step];
        if (typeof v === 'number') out[step] = clampVelocity(v);
      }
    }
    lanes.push(out);
  }
  return { bars, lanes };
}
