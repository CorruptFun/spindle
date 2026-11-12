import { describe, expect, it } from 'vitest';
import { clamp, dbToGain, faderToGain, gainToDb, lerp } from './audio-math';

describe('clamp / lerp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });

  it('interpolates between two values', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});

describe('decibels', () => {
  it('treats 0 dB as unity and -6 dB as about half', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(6)).toBeCloseTo(1.995, 3);
  });

  it('round-trips through gainToDb', () => {
    for (const db of [-48, -12, -3, 0, 6]) {
      expect(gainToDb(dbToGain(db))).toBeCloseTo(db, 9);
    }
  });

  it('reports silence as -Infinity', () => {
    expect(gainToDb(0)).toBe(-Infinity);
  });
});

describe('faderToGain', () => {
  it('is silent at the bottom and unity at the top', () => {
    expect(faderToGain(0)).toBe(0);
    expect(faderToGain(1)).toBe(1);
  });

  it('never decreases as the fader goes up, and ignores out-of-range travel', () => {
    let previous = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const gain = faderToGain(p);
      expect(gain).toBeGreaterThanOrEqual(previous);
      previous = gain;
    }
    expect(faderToGain(2)).toBe(1);
    expect(faderToGain(-1)).toBe(0);
  });
});
