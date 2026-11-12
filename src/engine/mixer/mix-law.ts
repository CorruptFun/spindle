import { dbToGain, faderToGain } from '@/lib/audio-math';
import type { DeckId } from '../core/types';
import { crossfaderGains, defaultCrossfaderSide } from './crossfader';
import type { CrossfaderCurve } from './crossfader';

/** The crossfader's gain for one deck, given which end of the fader that deck sits on. */
export function crossfadeGainFor(deck: DeckId, position: number, curve: CrossfaderCurve): number {
  return crossfaderGains(position, curve)[defaultCrossfaderSide(deck)];
}

/** A channel fader's travel (0..1, clamped) as linear gain. */
export function channelFaderGain(position: number): number {
  return faderToGain(position);
}

/** The master limiter: a hard-knee compressor just under full scale. */
export const LIMITER = {
  thresholdDb: -2,
  kneeDb: 0,
  ratio: 20,
  attackSec: 0.002,
  releaseSec: 0.2,
} as const;

/**
 * The gain a browser's DynamicsCompressorNode adds by itself. The node boosts
 * everything to make up for the level its curve takes off a full-scale signal
 * (to the power 0.6), which would make the whole mix about 1 dB louder than
 * the faders say. The mixer divides this back out so quiet passages are at
 * unity and the limited peaks keep some room below full scale.
 *
 * Holds for a hard knee (kneeDb 0), which is what LIMITER uses.
 */
export function limiterMakeupGain(thresholdDb: number, ratio: number): number {
  const fullScaleOutDb = thresholdDb + (0 - thresholdDb) / ratio;
  return (1 / dbToGain(fullScaleOutDb)) ** 0.6;
}
