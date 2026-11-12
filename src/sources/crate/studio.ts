/**
 * The desk a song is written on: a stereo loop exactly as long as the song,
 * plus a reverb send and an echo send. Anything placed near the end that rings
 * past the last bar wraps round onto the first, which is what makes the loop
 * seamless (the "tail folded back onto the start").
 */

import { addWrapped } from './dsp';
import type { Stereo } from './instruments';
import type { Rng } from './rng';
import { createRng, seedFromString } from './rng';
import { loopFrames, stepFrame } from './sequence';

export interface Placement {
  /** Linear gain, default 1. */
  readonly gain?: number;
  /** -1 left to 1 right, default centre. */
  readonly pan?: number;
  /** Send level to the room, default 0. */
  readonly verb?: number;
  /** Send level to the echo, default 0. */
  readonly echo?: number;
}

export class Studio {
  readonly sampleRate: number;
  readonly bpm: number;
  readonly frames: number;
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly verbSend: Float32Array;
  readonly echoSend: Float32Array;
  private readonly sounds = new Map<string, Float32Array | Stereo>();
  private readonly seedPrefix: string;

  constructor(sampleRate: number, bpm: number, bars: number, seedPrefix: string) {
    this.sampleRate = sampleRate;
    this.bpm = bpm;
    this.seedPrefix = seedPrefix;
    this.frames = loopFrames(bars, bpm, sampleRate);
    this.left = new Float32Array(this.frames);
    this.right = new Float32Array(this.frames);
    this.verbSend = new Float32Array(this.frames);
    this.echoSend = new Float32Array(this.frames);
  }

  /** A random stream for one named purpose, independent of call order elsewhere. */
  rng(name: string): Rng {
    return createRng(seedFromString(`${this.seedPrefix}/${name}`));
  }

  /** Renders a sound once per key and reuses it; the factory gets its own seeded noise. */
  sound<T extends Float32Array | Stereo>(key: string, make: (rng: Rng) => T): T {
    const cached = this.sounds.get(key);
    if (cached) return cached as T;
    const made = make(createRng(seedFromString(key)));
    this.sounds.set(key, made);
    return made;
  }

  /** Places a mono sound at a step (sixteenth notes from the loop start; fractions allowed). */
  play(sound: Float32Array, step: number, placement: Placement = {}): void {
    const start = stepFrame(step, this.bpm, this.sampleRate);
    const gain = placement.gain ?? 1;
    const [gl, gr] = panGains(placement.pan ?? 0);
    addWrapped(this.left, sound, start, gain * gl);
    addWrapped(this.right, sound, start, gain * gr);
    if (placement.verb) addWrapped(this.verbSend, sound, start, gain * placement.verb);
    if (placement.echo) addWrapped(this.echoSend, sound, start, gain * placement.echo);
  }

  playStereo(sound: Stereo, step: number, placement: Placement = {}): void {
    const start = stepFrame(step, this.bpm, this.sampleRate);
    const gain = placement.gain ?? 1;
    addWrapped(this.left, sound.left, start, gain);
    addWrapped(this.right, sound.right, start, gain);
    for (const channel of [sound.left, sound.right]) {
      if (placement.verb) addWrapped(this.verbSend, channel, start, gain * placement.verb * 0.5);
      if (placement.echo) addWrapped(this.echoSend, channel, start, gain * placement.echo * 0.5);
    }
  }

  /** Seconds in a number of steps, for sizing held notes. */
  stepsToSec(steps: number): number {
    return (steps * 60) / (this.bpm * 4);
  }
}

/** Equal-power pan, normalised so the centre is unity on both sides. */
function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2];
}
