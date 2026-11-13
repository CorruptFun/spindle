/**
 * Pure maths for the pads: how hard a hit sounds and how its light fades.
 * No Web Audio types, so tests run without a browser.
 */
import { clamp } from '@/lib/audio-math';

/** How long a pad stays lit after a hit. */
export const GLOW_SEC = 0.2;

/**
 * Light of a pad `elapsedSec` after its hit: 1 at the hit, easing to 0 at
 * GLOW_SEC. The curve falls fast at first (a flash) and lingers softly. 0
 * before the hit, after the glow, and for anything that is not a number.
 */
export function glowLevel(elapsedSec: number): number {
  if (!(elapsedSec >= 0) || elapsedSec >= GLOW_SEC) return 0;
  const left = 1 - elapsedSec / GLOW_SEC;
  return left * left;
}

/**
 * The latest hit time that is not after `now`, or -Infinity if there is none.
 * Future hits are ignored so a scheduled hit does not light its pad early.
 */
export function latestHitAt(times: Float64Array, now: number): number {
  let latest = -Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i] ?? -Infinity;
    if (t <= now && t > latest) latest = t;
  }
  return latest;
}

/**
 * Hit strength (0..1) to gain. Squared, like a fader taper: a half-strength
 * hit is 12 dB down and a 0.7 ghost note about 6 dB down, so soft hits are
 * clearly softer while accents near 1 stay close together.
 */
export function velocityGain(velocity: number): number {
  if (!Number.isFinite(velocity)) return 0;
  const v = clamp(velocity, 0, 1);
  return v * v;
}
