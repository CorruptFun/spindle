import { describe, expect, it } from 'vitest';
import { GLOW_SEC, glowLevel, latestHitAt, velocityGain } from './glow';

describe('glowLevel', () => {
  it('is 1 at the hit and decays to 0', () => {
    expect(glowLevel(0)).toBe(1);
    let previous = 1;
    for (let t = 0.01; t < GLOW_SEC; t += 0.01) {
      const level = glowLevel(t);
      expect(level).toBeLessThan(previous);
      expect(level).toBeGreaterThan(0);
      previous = level;
    }
    expect(glowLevel(GLOW_SEC)).toBe(0);
    expect(glowLevel(5)).toBe(0);
  });

  it('is 0 before the hit and for anything that is not a number', () => {
    expect(glowLevel(-0.001)).toBe(0);
    expect(glowLevel(Number.NaN)).toBe(0);
    expect(glowLevel(Infinity)).toBe(0);
    expect(glowLevel(-Infinity)).toBe(0);
  });

  it('is never negative and never NaN', () => {
    for (let t = -1; t < 1; t += 0.0013) {
      const level = glowLevel(t);
      expect(Number.isNaN(level)).toBe(false);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });
});

describe('latestHitAt', () => {
  it('ignores hits still in the future', () => {
    const times = new Float64Array([-Infinity, 1, 2.5, 4]);
    expect(latestHitAt(times, 0.5)).toBe(-Infinity);
    expect(latestHitAt(times, 3)).toBe(2.5);
    expect(latestHitAt(times, 4)).toBe(4);
  });

  it('lights a pad only once a scheduled hit arrives', () => {
    const times = new Float64Array(8).fill(-Infinity);
    times[0] = 10;
    const at = (now: number) => glowLevel(now - latestHitAt(times, now));
    expect(at(9.99)).toBe(0);
    expect(at(10)).toBe(1);
    expect(at(10.1)).toBeGreaterThan(0);
    expect(at(10.1)).toBeLessThan(1);
    expect(at(11)).toBe(0);
  });

  it('gives 0 light, not NaN, with no hits at all', () => {
    const times = new Float64Array(4).fill(-Infinity);
    expect(glowLevel(3 - latestHitAt(times, 3))).toBe(0);
  });
});

describe('velocityGain', () => {
  it('is full at 1 and silent at 0', () => {
    expect(velocityGain(1)).toBe(1);
    expect(velocityGain(0)).toBe(0);
  });

  it('makes a half-strength hit about 12 dB softer', () => {
    expect(20 * Math.log10(velocityGain(0.5))).toBeCloseTo(-12.04, 1);
  });

  it('clamps and refuses nonsense', () => {
    expect(velocityGain(2)).toBe(1);
    expect(velocityGain(-1)).toBe(0);
    expect(velocityGain(Number.NaN)).toBe(0);
  });
});
