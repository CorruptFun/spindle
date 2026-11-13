import { describe, expect, it } from 'vitest';
import { PAD_COUNT } from '@/engine/sampler/types';
import { STEPS_PER_BAR, type DrumPattern } from '@/engine/sequencer/types';
import {
  clearLane,
  emptyPattern,
  isEmptyPattern,
  normalizePattern,
  patternsEqual,
  setStep,
  STEP_ACCENT,
  STEP_ON,
  toggleStep,
  withBars,
} from './pattern';

/** Freezes a pattern all the way down, so any write in the code under test throws. */
function frozen(pattern: DrumPattern): DrumPattern {
  for (const lane of pattern.lanes) Object.freeze(lane);
  Object.freeze(pattern.lanes);
  return Object.freeze(pattern);
}

function snapshot(pattern: DrumPattern): string {
  return JSON.stringify(pattern);
}

describe('constants', () => {
  it('has a normal hit below an accent', () => {
    expect(STEP_ON).toBe(0.8);
    expect(STEP_ACCENT).toBe(1);
  });
});

describe('emptyPattern', () => {
  it.each([1, 2] as const)('makes %i bar(s) of silence on every pad', (bars) => {
    const p = emptyPattern(bars);
    expect(p.bars).toBe(bars);
    expect(p.lanes).toHaveLength(PAD_COUNT);
    for (const lane of p.lanes) expect(lane).toEqual(new Array(bars * STEPS_PER_BAR).fill(0));
    expect(isEmptyPattern(p)).toBe(true);
  });

  it('does not share lanes between pads', () => {
    const p = emptyPattern(1);
    expect(p.lanes[0]).not.toBe(p.lanes[1]);
  });
});

describe('toggleStep', () => {
  it('cycles off, on, accent, off without touching the input', () => {
    const p0 = frozen(emptyPattern(1));
    const p1 = frozen(toggleStep(p0, 2, 5));
    const p2 = frozen(toggleStep(p1, 2, 5));
    const p3 = toggleStep(p2, 2, 5);
    expect(p1.lanes[2]![5]).toBe(STEP_ON);
    expect(p2.lanes[2]![5]).toBe(STEP_ACCENT);
    expect(p3.lanes[2]![5]).toBe(0);
    expect(isEmptyPattern(p0)).toBe(true);
    expect(patternsEqual(p3, p0)).toBe(true);
  });

  it('treats a soft hit as on, so the next tap accents it', () => {
    const ghost = frozen(setStep(emptyPattern(1), 0, 0, 0.3));
    expect(toggleStep(ghost, 0, 0).lanes[0]![0]).toBe(STEP_ACCENT);
  });

  it('changes only the one step and shares the untouched lanes', () => {
    const p0 = frozen(emptyPattern(2));
    const p1 = toggleStep(p0, 7, 31);
    expect(p1).not.toBe(p0);
    expect(p1.lanes.flat().filter((v) => v > 0)).toEqual([STEP_ON]);
    expect(p1.lanes[0]).toBe(p0.lanes[0]);
    expect(p1.lanes[7]).not.toBe(p0.lanes[7]);
  });

  it.each([
    [-1, 0],
    [PAD_COUNT, 0],
    [0.5, 0],
    [Number.NaN, 0],
    [0, -1],
    [0, 16],
    [0, 2.5],
    [0, Number.NaN],
    [0, Infinity],
  ])('returns the pattern unchanged for pad %s, step %s', (pad, step) => {
    const p = frozen(emptyPattern(1));
    expect(toggleStep(p, pad, step)).toBe(p);
  });
});

describe('setStep', () => {
  it('sets a velocity and clamps it to 0..1', () => {
    const p = frozen(emptyPattern(1));
    expect(setStep(p, 1, 3, 0.42).lanes[1]![3]).toBe(0.42);
    expect(setStep(p, 1, 3, 7).lanes[1]![3]).toBe(1);
    expect(setStep(p, 1, 3, Infinity).lanes[1]![3]).toBe(1);
    const on = frozen(setStep(p, 1, 3, 1));
    expect(setStep(on, 1, 3, -2).lanes[1]![3]).toBe(0);
    expect(setStep(on, 1, 3, Number.NaN).lanes[1]![3]).toBe(0);
  });

  it('returns the same pattern when nothing changes or the target is out of range', () => {
    const p = frozen(emptyPattern(1));
    expect(setStep(p, 0, 0, 0)).toBe(p);
    expect(setStep(p, 8, 0, 1)).toBe(p);
    expect(setStep(p, 0, 16, 1)).toBe(p);
    expect(setStep(p, -1, -1, 1)).toBe(p);
  });

  it('leaves the input as it was', () => {
    const p = frozen(emptyPattern(2));
    const before = snapshot(p);
    setStep(p, 4, 20, 1);
    expect(snapshot(p)).toBe(before);
  });
});

describe('clearLane', () => {
  it('silences one pad and leaves the others', () => {
    let p = emptyPattern(1);
    p = setStep(p, 3, 0, 1);
    p = setStep(p, 3, 8, 0.5);
    p = frozen(setStep(p, 4, 2, 1));
    const cleared = clearLane(p, 3);
    expect(cleared.lanes[3]).toEqual(new Array(16).fill(0));
    expect(cleared.lanes[4]![2]).toBe(1);
    expect(cleared.lanes[4]).toBe(p.lanes[4]);
    expect(p.lanes[3]![0]).toBe(1);
  });

  it('returns the pattern unchanged for an empty lane or a bad pad', () => {
    const p = frozen(setStep(emptyPattern(1), 0, 0, 1));
    expect(clearLane(p, 1)).toBe(p);
    expect(clearLane(p, -1)).toBe(p);
    expect(clearLane(p, PAD_COUNT)).toBe(p);
    expect(clearLane(p, 0.5)).toBe(p);
  });
});

describe('withBars', () => {
  it('repeats bar one when going from one bar to two', () => {
    const p = frozen(setStep(setStep(emptyPattern(1), 0, 0, 1), 3, 15, 0.5));
    const two = withBars(p, 2);
    expect(two.bars).toBe(2);
    for (const lane of two.lanes) {
      expect(lane).toHaveLength(32);
      expect(lane.slice(16)).toEqual(lane.slice(0, 16));
    }
    expect(two.lanes[0]![16]).toBe(1);
    expect(two.lanes[3]![31]).toBe(0.5);
  });

  it('keeps bar one when going from two bars to one', () => {
    const p = frozen(setStep(setStep(emptyPattern(2), 0, 0, 1), 0, 20, 1));
    const one = withBars(p, 1);
    expect(one.bars).toBe(1);
    expect(one.lanes[0]).toEqual([1, ...new Array(15).fill(0)]);
    expect(one.lanes.every((l) => l.length === 16)).toBe(true);
  });

  it('returns the same pattern when the length does not change', () => {
    const p = frozen(emptyPattern(2));
    expect(withBars(p, 2)).toBe(p);
  });
});

describe('isEmptyPattern and patternsEqual', () => {
  it('tells an empty loop from one with a single soft hit', () => {
    expect(isEmptyPattern(setStep(emptyPattern(1), 7, 15, 0.01))).toBe(false);
  });

  it('compares by value', () => {
    const a = setStep(emptyPattern(1), 2, 2, 0.5);
    const b = setStep(emptyPattern(1), 2, 2, 0.5);
    expect(a).not.toBe(b);
    expect(patternsEqual(a, b)).toBe(true);
    expect(patternsEqual(a, setStep(b, 2, 2, 0.6))).toBe(false);
    expect(patternsEqual(emptyPattern(1), emptyPattern(2))).toBe(false);
    expect(patternsEqual(withBars(a, 2), withBars(b, 2))).toBe(true);
  });
});

describe('normalizePattern', () => {
  it('passes a valid pattern through as an equal copy', () => {
    const p = frozen(setStep(emptyPattern(2), 5, 30, 0.65));
    const n = normalizePattern(p);
    expect(n).not.toBeNull();
    expect(patternsEqual(n!, p)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'pattern'],
    ['an array', [[1, 0]]],
    ['an object without lanes', { bars: 1 }],
    ['lanes that are not a list', { bars: 1, lanes: 'XXXX' }],
    ['lanes that are an object', { bars: 2, lanes: { 0: [1] } }],
  ])('gives up on %s', (_, value) => {
    expect(normalizePattern(value)).toBeNull();
  });

  it('fills in missing lanes and steps, and drops extra ones', () => {
    const n = normalizePattern({ bars: 1, lanes: [[1, 0.5], [], ...new Array(12).fill([1])] })!;
    expect(n.bars).toBe(1);
    expect(n.lanes).toHaveLength(PAD_COUNT);
    expect(n.lanes.every((l) => l.length === 16)).toBe(true);
    expect(n.lanes[0]!.slice(0, 3)).toEqual([1, 0.5, 0]);
    expect(n.lanes[1]).toEqual(new Array(16).fill(0));

    const long = normalizePattern({ bars: 1, lanes: [new Array(40).fill(1)] })!;
    expect(long.lanes[0]).toEqual(new Array(16).fill(1));
  });

  it('clamps values and turns anything that is not a number into silence', () => {
    const n = normalizePattern({
      bars: 1,
      lanes: [[-1, 2, Number.NaN, Infinity, -Infinity, '1', null, true, {}, 0.25, 1e300, -0]],
    })!;
    expect(n.lanes[0]!.slice(0, 12)).toEqual([0, 1, 0, 1, 0, 0, 0, 0, 0, 0.25, 1, 0]);
    expect(Object.is(n.lanes[0]![11], -0)).toBe(false);
  });

  it('treats a lane that is not a list as silent', () => {
    const n = normalizePattern({ bars: 1, lanes: [5, 'x', null, { length: 16 }] })!;
    expect(isEmptyPattern(n)).toBe(true);
  });

  it('works out the length from the lanes when bars is missing or wrong', () => {
    expect(normalizePattern({ lanes: [new Array(16).fill(1)] })!.bars).toBe(1);
    expect(normalizePattern({ bars: 3, lanes: [new Array(32).fill(1)] })!.bars).toBe(2);
    expect(normalizePattern({ bars: '2', lanes: [] })!.bars).toBe(1);
    const fromLong = normalizePattern({ bars: 1.5, lanes: [[], new Array(20).fill(0.5)] })!;
    expect(fromLong.bars).toBe(2);
    expect(fromLong.lanes[1]!.slice(18)).toEqual([0.5, 0.5, ...new Array(12).fill(0)]);
  });

  it('copes with a huge input without reading all of it', () => {
    const hugeLane = new Array(1_000_000).fill(0.5);
    const lanes = new Array(10_000).fill(hugeLane);
    const start = performance.now();
    const n = normalizePattern({ bars: 2, lanes })!;
    expect(performance.now() - start).toBeLessThan(50);
    expect(n.lanes).toHaveLength(PAD_COUNT);
    expect(n.lanes.every((l) => l.length === 32 && l.every((v) => v === 0.5))).toBe(true);
  });

  it('never changes what it was given', () => {
    const input = { bars: 1, lanes: [[2, -1]] };
    normalizePattern(input);
    expect(input).toEqual({ bars: 1, lanes: [[2, -1]] });
  });
});
