/**
 * Seeded random numbers for the starter songs. Every "random" choice (hi-hat
 * velocity, noise in a snare, the detune phase of a pad) comes from here, so a
 * song renders to the same samples every time it is made.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Uniform in [-1, 1): white noise. */
  bipolar(): number;
}

/** mulberry32: tiny, fast and good enough for audio noise and humanising. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    bipolar: () => next() * 2 - 1,
  };
}

/** FNV-1a: turns a name into a seed, so each sound gets its own stream. */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
