import { describe, expect, it } from 'vitest';
import {
  boomKick,
  conga,
  cowbell,
  fadeIn,
  crackSnare,
  punchKick,
  rimshot,
  snap,
  soften,
  softKick,
  tapSnare,
} from './drums';
import { peak } from './dsp';
import { createRng } from './rng';

const RATE = 44100;

const VOICES: Record<string, (seed: number) => Float32Array> = {
  boomKick: (seed) => boomKick(RATE, createRng(seed)),
  punchKick: (seed) => punchKick(RATE, createRng(seed)),
  softKick: () => softKick(RATE),
  crackSnare: (seed) => crackSnare(RATE, createRng(seed)),
  tapSnare: (seed) => tapSnare(RATE, createRng(seed)),
  snap: (seed) => snap(RATE, createRng(seed)),
  conga: (seed) => conga(RATE, createRng(seed), 290),
  rimshot: (seed) => rimshot(RATE, createRng(seed)),
  cowbell: () => cowbell(RATE),
};

/** Mean absolute difference between neighbouring samples: a rough measure of brightness. */
function brightness(x: Float32Array): number {
  let sum = 0;
  for (let i = 1; i < x.length; i++) sum += Math.abs(x[i]! - x[i - 1]!);
  return sum / (x.length - 1);
}

describe('drum voices', () => {
  for (const [name, render] of Object.entries(VOICES)) {
    it(`${name}: finite, audible, within full scale, at most 1.5 s, ends on silence`, () => {
      const x = render(1);
      expect(x.every(Number.isFinite)).toBe(true);
      expect(x.length).toBeLessThanOrEqual(1.5 * RATE);
      const max = peak([x]);
      expect(max).toBeGreaterThan(0.05);
      expect(max).toBeLessThanOrEqual(1.2);
      expect(Math.abs(x[x.length - 1]!)).toBe(0);
      // Starts on a ramp, not a step.
      expect(Math.abs(x[0]!)).toBeLessThan(0.01);
    });

    it(`${name}: same seed, same samples`, () => {
      expect(render(7)).toEqual(render(7));
    });
  }

  it('the long kick rings much longer than the club kick', () => {
    expect(boomKick(RATE, createRng(1)).length).toBeGreaterThan(
      2 * punchKick(RATE, createRng(1)).length,
    );
  });

  it('the soft kick has no click: it is darker than the club kick', () => {
    const soft = softKick(RATE);
    const punch = punchKick(RATE, createRng(1));
    expect(brightness(soft) / peak([soft])).toBeLessThan(brightness(punch) / peak([punch]));
  });
});

describe('soften', () => {
  it('takes the top off, works in place, and ends on silence', () => {
    const noise = createRng(3);
    const x = Float32Array.from({ length: RATE / 10 }, () => noise.bipolar());
    const before = brightness(x);
    const out = soften(x, RATE, 3000);
    expect(out).toBe(x);
    expect(brightness(out)).toBeLessThan(before * 0.5);
    expect(Math.abs(out[out.length - 1]!)).toBe(0);
  });
});

describe('fadeIn', () => {
  it('ramps the start up from silence and leaves the rest alone', () => {
    const x = new Float32Array(10).fill(1);
    fadeIn(x, 4);
    expect([...x]).toEqual([0, 0.25, 0.5, 0.75, 1, 1, 1, 1, 1, 1]);
  });
});
