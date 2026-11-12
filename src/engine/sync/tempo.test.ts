import { describe, expect, it } from 'vitest';
import {
  beatDurationSec,
  nearestBeatSec,
  pitchPercentToRate,
  rateForBpm,
  rateToPitchPercent,
  semitonesToRatio,
} from './tempo';

describe('tempo', () => {
  it('gives half a second per beat at 120 BPM', () => {
    expect(beatDurationSec(120)).toBe(0.5);
  });

  it('finds the rate that matches one tempo to another', () => {
    expect(rateForBpm(120, 126)).toBeCloseTo(1.05, 9);
    expect(rateForBpm(128, 128)).toBe(1);
  });

  it('converts between the tempo fader and playback rate', () => {
    expect(pitchPercentToRate(4)).toBeCloseTo(1.04, 9);
    expect(rateToPitchPercent(0.94)).toBeCloseTo(-6, 9);
    expect(rateToPitchPercent(pitchPercentToRate(-8))).toBeCloseTo(-8, 9);
  });

  it('doubles the frequency for an octave', () => {
    expect(semitonesToRatio(12)).toBeCloseTo(2, 9);
    expect(semitonesToRatio(-12)).toBeCloseTo(0.5, 9);
    expect(semitonesToRatio(0)).toBe(1);
  });
});

describe('nearestBeatSec', () => {
  it('snaps to the closest beat', () => {
    expect(nearestBeatSec(1.2, 120)).toBeCloseTo(1.0, 9);
    expect(nearestBeatSec(1.3, 120)).toBeCloseTo(1.5, 9);
  });

  it('respects a grid that does not start at zero', () => {
    expect(nearestBeatSec(1.2, 120, 0.1)).toBeCloseTo(1.1, 9);
    expect(nearestBeatSec(0.05, 120, 0.1)).toBeCloseTo(0.1, 9);
  });
});
