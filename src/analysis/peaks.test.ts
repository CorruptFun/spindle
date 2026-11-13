import { describe, expect, it } from 'vitest';
import type { PcmAudio } from '@/engine/core/types';
import { computePeaks, DEFAULT_PEAK_BUCKETS } from './peaks';

const RATE = 48_000;

function audio(...channels: Float32Array[]): PcmAudio {
  return { sampleRate: RATE, channels };
}

describe('computePeaks', () => {
  it('gives the default number of slices and the track length', () => {
    const result = computePeaks(audio(new Float32Array(RATE * 2)));
    expect(result.peaks.length).toBe(DEFAULT_PEAK_BUCKETS);
    expect(result.durationSec).toBe(2);
  });

  it('shows silence as zero everywhere', () => {
    const { peaks } = computePeaks(audio(new Float32Array(10_000), new Float32Array(10_000)), 50);
    expect(Array.from(peaks).every((p) => p === 0)).toBe(true);
  });

  it('follows a ramp: each slice keeps its loudest (last) sample', () => {
    const frames = 1000;
    const ramp = new Float32Array(frames).map((_, i) => -(i + 1) / frames);
    const { peaks } = computePeaks(audio(ramp), 10);
    // Slice b covers frames b*100 .. b*100+99, whose loudest is (b+1)*100 / 1000.
    for (let b = 0; b < 10; b++) expect(peaks[b]).toBeCloseTo((b + 1) / 10, 6);
  });

  it('combines left and right by taking the louder of the two', () => {
    const left = new Float32Array(400).fill(0.2);
    const right = new Float32Array(400).fill(0.2);
    right[50] = -0.9;
    left[350] = 0.7;
    const mono = computePeaks(audio(left), 4).peaks;
    const stereo = computePeaks(audio(left, right), 4).peaks;
    expect(Array.from(mono)).toEqual([0.2, 0.2, 0.2, 0.7].map((p) => expect.closeTo(p, 6)));
    expect(stereo[0]).toBeCloseTo(0.9, 6);
    expect(stereo[1]).toBeCloseTo(0.2, 6);
    expect(stereo[3]).toBeCloseTo(0.7, 6);
  });

  it('puts a single spike in the slice that holds it', () => {
    const frames = 60_000;
    const samples = new Float32Array(frames);
    const at = 37_123;
    samples[at] = 0.5;
    const buckets = 600;
    const { peaks } = computePeaks(audio(samples), buckets);
    const expected = Math.floor((at * buckets) / frames);
    peaks.forEach((p, b) => expect(p).toBe(b === expected ? 0.5 : 0));
  });

  it('treats NaN as silence and caps anything louder than full scale', () => {
    const samples = new Float32Array([NaN, NaN, 0.3, NaN, 4, -Infinity, NaN, NaN]);
    const { peaks } = computePeaks(audio(samples), 4);
    expect(Array.from(peaks)).toEqual([0, expect.closeTo(0.3, 6), 1, 0]);
    expect(Array.from(peaks).some(Number.isNaN)).toBe(false);
  });

  it('gives zeros and no duration for empty audio', () => {
    for (const empty of [audio(), audio(new Float32Array(0), new Float32Array(0))]) {
      const result = computePeaks(empty, 8);
      expect(Array.from(result.peaks)).toEqual(new Array<number>(8).fill(0));
      expect(result.durationSec).toBe(0);
    }
  });

  it('shows the frame under each slice when there are more slices than frames', () => {
    const samples = new Float32Array([0.1, 0.4, 0.8]);
    const { peaks } = computePeaks(audio(samples), 6);
    expect(Array.from(peaks).map((p) => Number(p.toFixed(3)))).toEqual([
      0.1, 0.1, 0.4, 0.4, 0.8, 0.8,
    ]);
  });

  it('falls back to the default slice count for a nonsense count', () => {
    expect(computePeaks(audio(new Float32Array(10)), 0).peaks.length).toBe(DEFAULT_PEAK_BUCKETS);
    expect(computePeaks(audio(new Float32Array(10)), NaN).peaks.length).toBe(DEFAULT_PEAK_BUCKETS);
    expect(computePeaks(audio(new Float32Array(10)), 7.9).peaks.length).toBe(7);
  });

  it('summarises a 12-minute stereo track quickly', () => {
    const frames = 12 * 60 * RATE; // 34.56 million frames
    const left = new Float32Array(frames).fill(0.25);
    const right = new Float32Array(frames).fill(-0.25);
    left[frames - 1] = 0.75;
    computePeaks(audio(left.subarray(0, RATE), right.subarray(0, RATE))); // warm up

    const started = performance.now();
    const { peaks } = computePeaks(audio(left, right));
    const elapsedMs = performance.now() - started;

    expect(peaks[0]).toBe(0.25);
    expect(peaks[DEFAULT_PEAK_BUCKETS - 1]).toBe(0.75);
    // The target is well under 200 ms on a laptop; the limit is generous for slow CI machines.
    expect(elapsedMs).toBeLessThan(1000);
  });
});
