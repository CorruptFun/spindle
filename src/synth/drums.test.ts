import { describe, expect, it } from 'vitest';
import {
  boomKick,
  clave,
  conga,
  cowbell,
  fadeIn,
  crackSnare,
  machineClap,
  maracas,
  metalHat,
  punchKick,
  rimshot,
  snap,
  snappySnare,
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
  longBoomKick: (seed) => boomKick(RATE, createRng(seed), 0.6, 1.45),
  snappySnare: (seed) => snappySnare(RATE, createRng(seed)),
  machineClap: (seed) => machineClap(RATE, createRng(seed)),
  closedMetalHat: () => metalHat(RATE, 0.045),
  openMetalHat: () => metalHat(RATE, 0.25),
  maracas: (seed) => maracas(RATE, createRng(seed)),
  clave: () => clave(RATE),
};

/** How long a sound stays above a hundredth of its own peak, in seconds. */
function ringSec(x: Float32Array): number {
  const floor = peak([x]) / 100;
  let last = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]!) > floor) last = i;
  return last / RATE;
}

/** Times per second the wave crosses zero going up: its pitch, for a single clear tone. */
function risingCrossingsPerSec(x: Float32Array, seconds: number): number {
  const n = Math.round(seconds * RATE);
  let count = 0;
  for (let i = 1; i < n; i++) if (x[i - 1]! <= 0 && x[i]! > 0) count += 1;
  return count / seconds;
}

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

  it('the 808 kick booms on longer than the dusty one, at the same pitch', () => {
    const long = boomKick(RATE, createRng(1), 0.6, 1.45);
    const dusty = boomKick(RATE, createRng(1));
    expect(ringSec(long)).toBeGreaterThan(ringSec(dusty) + 0.2);
    // Deep: about 46 cycles a second once the first thump has passed.
    const tail = long.subarray(Math.round(0.3 * RATE), Math.round(0.8 * RATE));
    expect(risingCrossingsPerSec(tail, 0.5)).toBeGreaterThan(42);
    expect(risingCrossingsPerSec(tail, 0.5)).toBeLessThan(50);
  });

  it('the open metal hat rings several times longer than the closed one', () => {
    expect(ringSec(metalHat(RATE, 0.25))).toBeGreaterThan(4 * ringSec(metalHat(RATE, 0.045)));
  });

  it('the metal hat is all hiss, below the harsh top octave, with nothing left down low', () => {
    const hat = metalHat(RATE, 0.25);
    // Where the sound sits: the hiss of a cymbal, not the whistle above it.
    const pitch = risingCrossingsPerSec(hat, 0.1);
    expect(pitch).toBeGreaterThan(5000);
    expect(pitch).toBeLessThan(9000);
    // Smooth the hat hard: what is left is its low end, and there should be next to none.
    const low = soften(Float32Array.from(hat), RATE, 800);
    expect(peak([low])).toBeLessThan(0.05 * peak([hat]));
  });

  it('the metal hat does not start on a click: its loudest moment is not its first', () => {
    const hat = metalHat(RATE, 0.045);
    const first = hat.subarray(0, Math.round(0.001 * RATE));
    expect(peak([first])).toBeLessThan(peak([hat]));
  });

  it('the maracas stay below the harsh top octave too', () => {
    expect(risingCrossingsPerSec(maracas(RATE, createRng(1)), 0.05)).toBeLessThan(10000);
  });

  it('the clave is one clear tone at about 2500 cycles a second', () => {
    const pitch = risingCrossingsPerSec(clave(RATE), 0.1);
    expect(pitch).toBeGreaterThan(2450);
    expect(pitch).toBeLessThan(2550);
  });

  it('the maracas are over in a moment', () => {
    expect(ringSec(maracas(RATE, createRng(1)))).toBeLessThan(0.13);
  });

  it('the machine clap has a tail the plain slaps do not: it is still sounding after 150 ms', () => {
    const x = machineClap(RATE, createRng(1));
    const late = x.subarray(Math.round(0.15 * RATE), Math.round(0.2 * RATE));
    expect(peak([late])).toBeGreaterThan(0.03 * peak([x]));
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
