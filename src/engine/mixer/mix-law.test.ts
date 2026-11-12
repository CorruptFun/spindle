import { describe, expect, it } from 'vitest';
import { channelFaderGain, crossfadeGainFor, LIMITER, limiterMakeupGain } from './mix-law';

describe('crossfadeGainFor', () => {
  it('puts A and C on the left and B and D on the right', () => {
    for (const curve of ['blend', 'cut'] as const) {
      expect(crossfadeGainFor('A', 0, curve)).toBeCloseTo(1);
      expect(crossfadeGainFor('C', 0, curve)).toBeCloseTo(1);
      expect(crossfadeGainFor('B', 0, curve)).toBeCloseTo(0);
      expect(crossfadeGainFor('D', 0, curve)).toBeCloseTo(0);

      expect(crossfadeGainFor('A', 1, curve)).toBeCloseTo(0);
      expect(crossfadeGainFor('C', 1, curve)).toBeCloseTo(0);
      expect(crossfadeGainFor('B', 1, curve)).toBeCloseTo(1);
      expect(crossfadeGainFor('D', 1, curve)).toBeCloseTo(1);
    }
  });

  it('blend is equal power at the centre', () => {
    expect(crossfadeGainFor('A', 0.5, 'blend')).toBeCloseTo(Math.SQRT1_2);
    expect(crossfadeGainFor('B', 0.5, 'blend')).toBeCloseTo(Math.SQRT1_2);
  });

  it('cut keeps both sides fully open at the centre', () => {
    expect(crossfadeGainFor('A', 0.5, 'cut')).toBe(1);
    expect(crossfadeGainFor('B', 0.5, 'cut')).toBe(1);
  });

  it('clamps out-of-range positions', () => {
    expect(crossfadeGainFor('B', 3, 'blend')).toBeCloseTo(1);
    expect(crossfadeGainFor('A', -3, 'blend')).toBeCloseTo(1);
  });
});

describe('channelFaderGain', () => {
  it('is silent at the bottom and unity at the top', () => {
    expect(channelFaderGain(0)).toBe(0);
    expect(channelFaderGain(1)).toBe(1);
  });

  it('clamps out-of-range travel', () => {
    expect(channelFaderGain(-1)).toBe(0);
    expect(channelFaderGain(2)).toBe(1);
  });
});

describe('limiterMakeupGain', () => {
  it('is the boost a browser compressor adds for the limiter settings', () => {
    // Measured in Chrome: a 0.7071 signal came out of the limiter at 0.8063.
    expect(limiterMakeupGain(LIMITER.thresholdDb, LIMITER.ratio)).toBeCloseTo(0.8063 / 0.7071, 3);
  });

  it('is unity when the curve takes nothing off a full-scale signal', () => {
    expect(limiterMakeupGain(0, 20)).toBeCloseTo(1, 9);
    expect(limiterMakeupGain(-12, 1)).toBeCloseTo(1, 9);
  });
});
