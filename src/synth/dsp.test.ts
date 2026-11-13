import { describe, expect, it } from 'vitest';
import { addWrapped, masterLoop, Osc, peak, rms } from './dsp';

describe('addWrapped', () => {
  it('folds what runs past the end back onto the start', () => {
    const dest = new Float32Array(5);
    addWrapped(dest, Float32Array.of(1, 2, 3), 3, 2);
    expect([...dest]).toEqual([6, 0, 0, 2, 4]);
  });

  it('wraps negative starts too', () => {
    const dest = new Float32Array(4);
    addWrapped(dest, Float32Array.of(1, 1), -1, 1);
    expect([...dest]).toEqual([1, 0, 0, 1]);
  });
});

describe('Osc', () => {
  it('keeps its saw inside full scale', () => {
    const osc = new Osc(441, 44100);
    let max = 0;
    for (let i = 0; i < 4410; i++) max = Math.max(max, Math.abs(osc.saw()));
    expect(max).toBeLessThanOrEqual(1.0001);
  });
});

describe('masterLoop', () => {
  const rate = 8000;

  it('reaches the target loudness when there is headroom', () => {
    const left = Float32Array.from({ length: rate }, (_, i) => 0.1 * Math.sin(i * 0.05));
    const right = left.slice();
    const report = masterLoop(left, right, rate, { targetRms: 0.2, ceiling: 0.88 });
    expect(rms([left, right])).toBeCloseTo(0.2, 3);
    expect(report.minLimiterGain).toBe(1);
  });

  it('holds the ceiling on spiky material and still lands near the target', () => {
    const left = new Float32Array(rate * 2);
    for (let i = 0; i < left.length; i++) {
      left[i] = 0.05 * Math.sin(i * 0.07) + (i % 2000 < 40 ? 0.9 : 0);
    }
    const right = left.slice();
    const report = masterLoop(left, right, rate, { targetRms: 0.25, ceiling: 0.88 });
    expect(peak([left, right])).toBeLessThanOrEqual(0.88);
    expect(report.minLimiterGain).toBeLessThan(1);
    expect(rms([left, right])).toBeGreaterThan(0.24);
  });
});
