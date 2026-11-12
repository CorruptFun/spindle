import { describe, expect, it } from 'vitest';
import {
  isMeterAtRest,
  METER_FLOOR_DB,
  METER_RELEASE_DB_PER_SEC,
  METER_REST,
  meterDb,
  meterPosition,
  PEAK_HOLD_SEC,
  PEAK_RELEASE_DB_PER_SEC,
  stepMeter,
  type MeterState,
} from './meter-ballistics';

/** Run the meter for `seconds` of silence (or a steady `peak`) in frames of `frameSec`. */
function run(state: MeterState, seconds: number, frameSec: number, peak = 0): MeterState {
  let next = state;
  const frames = Math.round(seconds / frameSec);
  for (let i = 0; i < frames; i++) next = stepMeter(next, peak, frameSec);
  return next;
}

describe('meterPosition', () => {
  it('maps full scale to the top and the floor to the bottom', () => {
    expect(meterPosition(1)).toBe(1);
    expect(meterPosition(10 ** (METER_FLOOR_DB / 20))).toBeCloseTo(0, 9);
  });

  it('is linear in decibels', () => {
    const halfwayDb = METER_FLOOR_DB / 2;
    expect(meterPosition(10 ** (halfwayDb / 20))).toBeCloseTo(0.5, 9);
  });

  it('clamps overs and treats silence and nonsense as the bottom', () => {
    expect(meterPosition(2)).toBe(1);
    expect(meterPosition(0)).toBe(0);
    expect(meterPosition(1e-9)).toBe(0);
    expect(meterPosition(Number.NaN)).toBe(0);
  });

  it('reads a negative sample by its size', () => {
    expect(meterPosition(-0.5)).toBe(meterPosition(0.5));
  });

  it('round-trips through meterDb', () => {
    expect(meterDb(meterPosition(0.25))).toBeCloseTo(20 * Math.log10(0.25), 9);
    expect(meterDb(0)).toBe(-Infinity);
  });
});

describe('stepMeter', () => {
  it('jumps straight up to a new peak', () => {
    const next = stepMeter(METER_REST, 1, 1 / 60);
    expect(next.level).toBe(1);
    expect(next.peak).toBe(1);
  });

  it('falls at the release rate', () => {
    const loud = stepMeter(METER_REST, 1, 0);
    const later = run(loud, 0.5, 1 / 100);
    const fallen = (METER_RELEASE_DB_PER_SEC * 0.5) / -METER_FLOOR_DB;
    expect(later.level).toBeCloseTo(1 - fallen, 9);
  });

  it('does not fall below what it is hearing', () => {
    const loud = stepMeter(METER_REST, 1, 0);
    const steady = run(loud, 3, 1 / 60, 0.5);
    expect(steady.level).toBeCloseTo(meterPosition(0.5), 9);
  });

  it('holds the peak mark, then lets it fall', () => {
    const loud = stepMeter(METER_REST, 1, 0);
    const held = run(loud, PEAK_HOLD_SEC - 0.1, 0.01);
    expect(held.peak).toBe(1);
    expect(held.level).toBeLessThan(1);

    const falling = run(held, 0.6, 0.01);
    const fallen = (PEAK_RELEASE_DB_PER_SEC * 0.5) / -METER_FLOOR_DB;
    expect(falling.peak).toBeCloseTo(1 - fallen, 6);
  });

  it('keeps the peak mark at or above the bar', () => {
    let state = stepMeter(METER_REST, 1, 0);
    for (let i = 0; i < 600; i++) {
      state = stepMeter(state, i % 37 === 0 ? 0.3 : 0, 1 / 60);
      expect(state.peak).toBeGreaterThanOrEqual(state.level);
    }
  });

  it('gives the same result at any frame rate', () => {
    const loud = stepMeter(METER_REST, 0.9, 0);
    // Durations that both frame sizes divide exactly, so only the frame size differs.
    for (const seconds of [0.3, 0.9, 1.4, 2.5]) {
      const slow = run(loud, seconds, 1 / 40);
      const fast = run(loud, seconds, 1 / 200);
      const once = stepMeter(loud, 0, seconds);
      expect(fast.level).toBeCloseTo(slow.level, 6);
      expect(fast.peak).toBeCloseTo(slow.peak, 6);
      expect(once.level).toBeCloseTo(slow.level, 6);
      expect(once.peak).toBeCloseTo(slow.peak, 6);
    }
  });

  it('comes to rest after enough silence', () => {
    const loud = stepMeter(METER_REST, 1, 0);
    expect(isMeterAtRest(loud)).toBe(false);
    expect(isMeterAtRest(run(loud, 6, 1 / 60))).toBe(true);
  });

  it('ignores a bad time step', () => {
    const loud = stepMeter(METER_REST, 1, 0);
    expect(stepMeter(loud, 0, Number.NaN)).toEqual(loud);
    expect(stepMeter(loud, 0, -1)).toEqual(loud);
  });
});
