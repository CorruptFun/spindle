import { describe, expect, it } from 'vitest';
import { crossfaderGains, defaultCrossfaderSide } from './crossfader';

describe('crossfaderGains', () => {
  it('plays only A at hard left and only B at hard right', () => {
    for (const curve of ['blend', 'cut'] as const) {
      const left = crossfaderGains(0, curve);
      const right = crossfaderGains(1, curve);
      expect(left.a).toBeCloseTo(1, 9);
      expect(left.b).toBeCloseTo(0, 9);
      expect(right.a).toBeCloseTo(0, 9);
      expect(right.b).toBeCloseTo(1, 9);
    }
  });

  it('keeps total power constant on the blend curve', () => {
    for (let x = 0; x <= 1.0001; x += 0.1) {
      const { a, b } = crossfaderGains(x, 'blend');
      expect(a * a + b * b).toBeCloseTo(1, 9);
    }
  });

  it('has both sides fully open across the middle of the cut curve', () => {
    for (const x of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      expect(crossfaderGains(x, 'cut')).toEqual({ a: 1, b: 1 });
    }
  });

  it('treats out-of-range positions as the nearest end', () => {
    expect(crossfaderGains(-3)).toEqual(crossfaderGains(0));
    expect(crossfaderGains(7)).toEqual(crossfaderGains(1));
  });
});

describe('defaultCrossfaderSide', () => {
  it('puts A and C on the left, B and D on the right', () => {
    expect(defaultCrossfaderSide('A')).toBe('a');
    expect(defaultCrossfaderSide('C')).toBe('a');
    expect(defaultCrossfaderSide('B')).toBe('b');
    expect(defaultCrossfaderSide('D')).toBe('b');
  });
});
