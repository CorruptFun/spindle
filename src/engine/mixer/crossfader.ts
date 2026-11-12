import { clamp } from '@/lib/audio-math';
import type { DeckId } from '../core/types';

/**
 * `blend` keeps the loudness steady across the whole travel (long, smooth mixes).
 * `cut` opens each side almost immediately (scratching and quick cuts).
 */
export type CrossfaderCurve = 'blend' | 'cut';

export interface CrossfaderGains {
  /** Gain for the side assigned to A (the left end). */
  readonly a: number;
  /** Gain for the side assigned to B (the right end). */
  readonly b: number;
}

export type CrossfaderSide = keyof CrossfaderGains;

/** Share of the travel, at each end, over which the `cut` curve opens. */
const CUT_EDGE = 0.05;

/**
 * Gains for both sides of the crossfader.
 * @param position 0 = hard left (only A), 0.5 = centre, 1 = hard right (only B).
 */
export function crossfaderGains(
  position: number,
  curve: CrossfaderCurve = 'blend',
): CrossfaderGains {
  const x = clamp(position, 0, 1);

  if (curve === 'cut') {
    return {
      a: clamp((1 - x) / CUT_EDGE, 0, 1),
      b: clamp(x / CUT_EDGE, 0, 1),
    };
  }

  // Equal power: a² + b² = 1 everywhere, so the centre does not dip or bump.
  return {
    a: Math.cos((x * Math.PI) / 2),
    b: Math.sin((x * Math.PI) / 2),
  };
}

/** Where each deck sits until the DJ reassigns it: A and C on the left, B and D on the right. */
export function defaultCrossfaderSide(deck: DeckId): CrossfaderSide {
  return deck === 'A' || deck === 'C' ? 'a' : 'b';
}
