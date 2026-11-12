/** Pure audio maths shared by the engine, the UI and the tests. No Web Audio types here. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Decibels to linear gain. 0 dB is unity; every -6 dB roughly halves the level. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Linear gain to decibels. Silence is -Infinity. */
export function gainToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain);
}

/**
 * Travel of a volume fader (0 = bottom, 1 = top) to linear gain. Squaring the
 * travel approximates an audio taper: the top half of the fader covers about
 * 12 dB, which is where the ear wants the resolution.
 */
export function faderToGain(position: number): number {
  const p = clamp(position, 0, 1);
  return p * p;
}
