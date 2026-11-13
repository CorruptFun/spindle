import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from './rng';

const take = (seed: number, count: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
};

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it('gives a different sequence for a different seed', () => {
    expect(take(42, 10)).not.toEqual(take(43, 10));
  });

  it('stays in range and spreads evenly', () => {
    const values = take(7, 10000);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('maps to ranges and to noise', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const r = rng.range(2, 3);
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThan(3);
      const b = rng.bipolar();
      expect(b).toBeGreaterThanOrEqual(-1);
      expect(b).toBeLessThan(1);
    }
  });
});

describe('seedFromString', () => {
  it('is stable and tells names apart', () => {
    expect(seedFromString('kick')).toBe(seedFromString('kick'));
    expect(seedFromString('kick')).not.toBe(seedFromString('snare'));
    expect(Number.isInteger(seedFromString('anything'))).toBe(true);
    expect(seedFromString('anything')).toBeGreaterThanOrEqual(0);
  });
});
