import { describe, expect, it } from 'vitest';
import { peakOf } from './levels';

describe('peakOf', () => {
  it('is 0 for an empty array', () => {
    expect(peakOf(new Float32Array(0))).toBe(0);
  });

  it('is 0 for silence', () => {
    expect(peakOf(new Float32Array(64))).toBe(0);
  });

  it('finds a positive peak', () => {
    expect(peakOf(Float32Array.of(0.1, 0.5, 0.25))).toBeCloseTo(0.5);
  });

  it('ignores sign', () => {
    expect(peakOf(Float32Array.of(0.1, -0.75, 0.25))).toBeCloseTo(0.75);
  });

  it('is not poisoned by NaN', () => {
    expect(peakOf(Float32Array.of(NaN, 0.5, NaN))).toBeCloseTo(0.5);
    expect(peakOf(Float32Array.of(NaN, NaN))).toBe(0);
  });

  it('passes through values above full scale', () => {
    expect(peakOf(Float32Array.of(-1.5))).toBeCloseTo(1.5);
  });
});
