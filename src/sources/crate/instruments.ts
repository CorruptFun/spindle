/**
 * The starter songs' instruments, each rendered once into a small buffer and
 * then placed on the timeline as many times as the song needs it.
 *
 * Voicing rule for the whole crate: warm, round and soft-edged. Kicks have a
 * short attack ramp instead of a click, hats are filtered below the harsh top
 * octave, and every one-shot fades out instead of stopping dead.
 */

import { fadeOut, onePoleCoef, Osc, Svf, TAU } from './dsp';
import type { Rng } from './rng';

export interface Stereo {
  readonly left: Float32Array;
  readonly right: Float32Array;
}

function buffer(sampleRate: number, seconds: number): Float32Array {
  return new Float32Array(Math.max(1, Math.round(seconds * sampleRate)));
}

/** Soft saturation normalised so full scale stays full scale. */
function warmth(x: number, drive: number): number {
  return Math.tanh(drive * x) / Math.tanh(drive);
}

/** Linear attack, then hold, then a linear release after `holdSec`. */
function gate(t: number, attackSec: number, holdSec: number, releaseSec: number): number {
  if (t < attackSec) return t / attackSec;
  if (t < holdSec) return 1;
  return Math.max(0, 1 - (t - holdSec) / releaseSec);
}

// ---------------------------------------------------------------- drums

export function kick(sampleRate: number, rng: Rng, tune = 1): Float32Array {
  const out = buffer(sampleRate, 0.5);
  const clickCoef = onePoleCoef(2500, sampleRate);
  let phase = 0;
  let click = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const freq = (47 + 115 * Math.exp(-t / 0.032)) * tune;
    phase += (TAU * freq) / sampleRate;
    click += clickCoef * (rng.bipolar() - click);
    const body = Math.sin(phase) * Math.exp(-t / 0.24);
    const attack = Math.min(1, t / 0.0015);
    out[i] = warmth((body + click * 0.25 * Math.exp(-t / 0.004)) * attack, 1.4);
  }
  fadeOut(out, Math.round(0.03 * sampleRate));
  return out;
}

export function snare(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.32);
  const hp = new Svf(sampleRate, 1400, 0.6);
  const lp = onePoleCoef(7000, sampleRate);
  let noise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    hp.process(rng.bipolar());
    noise += lp * (hp.high - noise);
    const body =
      (Math.sin(TAU * 185 * t) + 0.5 * Math.sin(TAU * 330 * t)) * Math.exp(-t / 0.055) * 0.6;
    const attack = Math.min(1, t / 0.001);
    out[i] = (body + noise * Math.exp(-t / 0.1) * 0.9) * attack;
  }
  fadeOut(out, Math.round(0.03 * sampleRate));
  return out;
}

export function clap(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.35);
  const bp = new Svf(sampleRate, 1300, 1.1);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    bp.process(rng.bipolar());
    // Three quick slaps then a short tail: what makes a clap read as hands.
    let env = 0;
    for (const offset of [0, 0.011, 0.022]) {
      if (t >= offset) env += Math.exp(-(t - offset) / 0.005);
    }
    if (t >= 0.03) env += 0.8 * Math.exp(-(t - 0.03) / 0.1);
    out[i] = bp.band * env * 1.6;
  }
  fadeOut(out, Math.round(0.03 * sampleRate));
  return out;
}

/** `decaySec` 0.03 for a closed hat, about 0.2 for an open one. */
export function hat(sampleRate: number, rng: Rng, decaySec: number): Float32Array {
  const out = buffer(sampleRate, decaySec * 6);
  const hp = new Svf(sampleRate, 7000, 0.8);
  const lp = onePoleCoef(11000, sampleRate);
  let tone = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    hp.process(rng.bipolar());
    tone += lp * (hp.high - tone);
    out[i] = tone * Math.exp(-t / decaySec) * Math.min(1, t / 0.0005);
  }
  fadeOut(out, Math.round(0.01 * sampleRate));
  return out;
}

export function shaker(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.18);
  const bp = new Svf(sampleRate, 5500, 1.4);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    bp.process(rng.bipolar());
    const env = t < 0.008 ? t / 0.008 : Math.exp(-(t - 0.008) / 0.045);
    out[i] = bp.band * env * 1.5;
  }
  fadeOut(out, Math.round(0.02 * sampleRate));
  return out;
}

/** A round, pitched drum for fills. */
export function tom(sampleRate: number, rng: Rng, freq: number): Float32Array {
  const out = buffer(sampleRate, 0.55);
  const lp = onePoleCoef(3000, sampleRate);
  let phase = 0;
  let noise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    phase += (TAU * freq * (1 + 0.5 * Math.exp(-t / 0.04))) / sampleRate;
    noise += lp * (rng.bipolar() - noise);
    const attack = Math.min(1, t / 0.0015);
    out[i] = (Math.sin(phase) * Math.exp(-t / 0.2) + noise * 0.3 * Math.exp(-t / 0.01)) * attack;
  }
  fadeOut(out, Math.round(0.03 * sampleRate));
  return out;
}

/** A wooden "tock", tuned to A, for light backbeats. */
export function woodblock(sampleRate: number): Float32Array {
  const out = buffer(sampleRate, 0.15);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.0008);
    out[i] =
      (Math.sin(TAU * 880 * t) * Math.exp(-t / 0.03) +
        0.3 * Math.sin(TAU * 2640 * t) * Math.exp(-t / 0.012)) *
      attack;
  }
  fadeOut(out, Math.round(0.02 * sampleRate));
  return out;
}

// ---------------------------------------------------------------- bass

const ROUND_TABLE_SIZE = 2048;

/**
 * One cycle of the round bass wave. The shape never changes from note to note,
 * so it is drawn once and read back at any pitch.
 */
const ROUND_TABLE = (() => {
  const table = new Float32Array(ROUND_TABLE_SIZE + 1);
  for (let i = 0; i <= ROUND_TABLE_SIZE; i++) {
    const p = (TAU * i) / ROUND_TABLE_SIZE;
    const tone = Math.sin(p) + 0.22 * Math.sin(2 * p) + 0.08 * Math.sin(3 * p);
    table[i] = warmth(tone * 0.8, 1.2);
  }
  return table;
})();

/** Clean, round bass: a sine with a touch of second and third harmonic. */
export function roundBass(sampleRate: number, freq: number, holdSec: number): Float32Array {
  const release = 0.08;
  const out = buffer(sampleRate, holdSec + release);
  const inc = (freq * ROUND_TABLE_SIZE) / sampleRate;
  let pos = 0;
  for (let i = 0; i < out.length; i++) {
    const index = Math.floor(pos);
    const frac = pos - index;
    const a = ROUND_TABLE[index]!;
    const wave = a + (ROUND_TABLE[index + 1]! - a) * frac;
    out[i] = wave * gate(i / sampleRate, 0.006, holdSec, release);
    pos += inc;
    if (pos >= ROUND_TABLE_SIZE) pos -= ROUND_TABLE_SIZE;
  }
  return out;
}

/** Short and springy, for the off-beat house bass. */
export function bounceBass(sampleRate: number, freq: number, holdSec: number): Float32Array {
  const release = 0.04;
  const out = buffer(sampleRate, holdSec + release);
  const saw = new Osc(freq, sampleRate);
  const sub = new Osc(freq, sampleRate);
  const lp = new Svf(sampleRate, 2000, 1.4);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    if (i % 16 === 0) lp.set(280 + 2000 * Math.exp(-t / 0.06), 1.4);
    const body = lp.process(saw.saw()) * 0.75 + sub.sine() * 0.45;
    const amp = (0.65 + 0.35 * Math.exp(-t / 0.12)) * gate(t, 0.003, holdSec, release);
    out[i] = warmth(body * amp, 1.3);
  }
  return out;
}

/** Thick and warm, for the breakbeat: two detuned saws and a sine, gently driven. */
export function fatBass(sampleRate: number, freq: number, holdSec: number): Float32Array {
  const release = 0.07;
  const out = buffer(sampleRate, holdSec + release);
  const detune = 2 ** (6 / 1200);
  const a = new Osc(freq * detune, sampleRate);
  const b = new Osc(freq / detune, sampleRate, 0.37);
  const sub = new Osc(freq, sampleRate);
  const lp = new Svf(sampleRate, 1000, 0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    if (i % 16 === 0) lp.set(380 + 800 * Math.exp(-t / 0.18), 0.9);
    const body = lp.process((a.saw() + b.saw()) * 0.5) * 0.85 + sub.sine() * 0.5;
    out[i] = warmth(body, 1.8) * gate(t, 0.005, holdSec, release);
  }
  return out;
}

// ---------------------------------------------------------------- melodic

/**
 * Plucked string (Karplus-Strong): a burst of soft noise circulating in a
 * delay one period long, losing a little top end each time round.
 */
export function pluck(sampleRate: number, rng: Rng, freq: number): Float32Array {
  const decaySec = 1.1;
  // Kept short of the full decay: past half a second the string is 25 dB down
  // and buried under the next notes of the arpeggio, so it only costs mixing time.
  const out = buffer(sampleRate, 0.5);
  // Averaging two neighbours delays by half a sample; the rest is fractional.
  const delay = sampleRate / freq - 0.5;
  const whole = Math.floor(delay);
  const frac = delay - whole;
  const loss = 0.001 ** (1 / (decaySec * freq));
  const burst = Math.ceil(sampleRate / freq);
  const soften = onePoleCoef(Math.min(freq * 6, sampleRate * 0.4), sampleRate);
  const excitation = new Float32Array(burst);
  let smooth = 0;
  let mean = 0;
  for (let i = 0; i < burst; i++) {
    smooth += soften * (rng.bipolar() - smooth);
    excitation[i] = smooth;
    mean += smooth / burst;
  }
  const read = (i: number): number => (i >= 0 ? out[i]! : 0);
  for (let i = 0; i < out.length; i++) {
    const back = i - whole;
    const d0 = read(back) * (1 - frac) + read(back - 1) * frac;
    const d1 = read(back - 1) * (1 - frac) + read(back - 2) * frac;
    const input = i < burst ? excitation[i]! - mean : 0;
    out[i] = input + loss * 0.5 * (d0 + d1);
  }
  fadeOut(out, Math.round(0.12 * sampleRate));
  // Karplus-Strong output level depends on pitch; bring it to a steady level.
  // A 1 ms ramp softens the pick so a note never starts on a step.
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]!));
  const ramp = Math.round(0.001 * sampleRate);
  for (let i = 0; i < out.length; i++) {
    out[i] = (out[i]! / (max || 1)) * 0.8 * Math.min(1, (i + 1) / ramp);
  }
  return out;
}

/** A soft mallet (marimba-like): the fundamental plus a fast-fading fourth partial. */
export function mallet(sampleRate: number, freq: number): Float32Array {
  const out = buffer(sampleRate, 1.4);
  // Envelopes by per-sample multiplication: same curve as exp(), far cheaper.
  const slow = Math.exp(-1 / (0.4 * sampleRate));
  const fast = Math.exp(-1 / (0.05 * sampleRate));
  let envSlow = 1;
  let envFast = 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.002);
    out[i] =
      (Math.sin(TAU * freq * t) * envSlow + 0.3 * Math.sin(TAU * 4 * freq * t) * envFast) *
      attack *
      0.8;
    envSlow *= slow;
    envFast *= fast;
  }
  fadeOut(out, Math.round(0.1 * sampleRate));
  return out;
}

/** A soft, breathy whistle for slow tunes; vibrato arrives only on held notes. */
export function whistle(sampleRate: number, freq: number, holdSec: number): Float32Array {
  const release = 0.15;
  const out = buffer(sampleRate, holdSec + release);
  let phase = 0;
  let vibrato = 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    // A 5 Hz wobble changes slowly; updating it every 16 samples is plenty.
    if (i % 16 === 0) {
      const depth = 0.004 * Math.min(1, Math.max(0, (t - 0.25) / 0.3));
      vibrato = 1 + depth * Math.sin(TAU * 5 * t);
    }
    phase += (TAU * freq * vibrato) / sampleRate;
    const tone = Math.sin(phase) + 0.12 * Math.sin(2 * phase);
    out[i] = tone * gate(t, 0.04, holdSec, release) * 0.6;
  }
  return out;
}

/**
 * Electric piano chord (two-operator FM), voices spread a little across the
 * stereo field. Rendered once per chord, left ringing; `held` cuts it to length.
 */
export function electricPiano(sampleRate: number, freqs: readonly number[]): Stereo {
  const left = buffer(sampleRate, 1.2);
  const right = buffer(sampleRate, 1.2);
  freqs.forEach((freq, voice) => {
    const pan = freqs.length > 1 ? (voice / (freqs.length - 1)) * 0.8 - 0.4 : 0;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    const indexDecay = Math.exp(-1 / (0.3 * sampleRate));
    const ampDecay = Math.exp(-1 / (1.4 * sampleRate));
    let index = 1.1;
    let amp = 0.35;
    for (let i = 0; i < left.length; i++) {
      const t = i / sampleRate;
      const phase = TAU * freq * t;
      const v = Math.sin(phase + (index + 0.2) * Math.sin(phase)) * amp * Math.min(1, t / 0.003);
      left[i] = left[i]! + v * gl;
      right[i] = right[i]! + v * gr;
      index *= indexDecay;
      amp *= ampDecay;
    }
  });
  return { left, right };
}

/** A copy of a ringing sound, held for `holdSec` and then released, like lifting a key. */
export function held(
  sound: Stereo,
  sampleRate: number,
  holdSec: number,
  releaseSec = 0.25,
): Stereo {
  const length = Math.min(sound.left.length, Math.round((holdSec + releaseSec) * sampleRate));
  const left = sound.left.slice(0, length);
  const right = sound.right.slice(0, length);
  const start = Math.round(holdSec * sampleRate);
  for (let i = start; i < length; i++) {
    const g = Math.max(0, 1 - (i - start) / (length - start));
    left[i] = left[i]! * g;
    right[i] = right[i]! * g;
  }
  return { left, right };
}

/**
 * Warm pad: one saw per voice per side, detuned the opposite way on each side,
 * so the chorus happens in the air between the speakers. Low-passed, slow to
 * rise and to fall.
 */
export function pad(
  sampleRate: number,
  rng: Rng,
  freqs: readonly number[],
  holdSec: number,
): Stereo {
  const release = 0.9;
  const length = Math.round((holdSec + release) * sampleRate);
  const channels = [new Float32Array(length), new Float32Array(length)];
  channels.forEach((out, ch) => {
    const oscs = freqs.map(
      (freq, voice) =>
        new Osc(freq * 2 ** (((ch === 0 ? 1 : -1) * (5 + voice)) / 1200), sampleRate, rng.next()),
    );
    const lp = new Svf(sampleRate, 900, 0.6);
    const level = 0.5 / Math.sqrt(oscs.length);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      if (i % 32 === 0) lp.set(900 + 900 * Math.min(1, t / 0.6), 0.6);
      let sum = 0;
      for (const osc of oscs) sum += osc.saw();
      out[i] = lp.process(sum * level) * gate(t, 0.35, holdSec, release);
    }
  });
  return { left: channels[0]!, right: channels[1]! };
}

/** A short chord stab with a closing filter: the house "organ" hit, kept mellow. */
export function stab(sampleRate: number, freqs: readonly number[]): Float32Array {
  const out = buffer(sampleRate, 0.45);
  const oscs = freqs.map((freq) => new Osc(freq, sampleRate));
  const subs = freqs.map((freq) => new Osc(freq * 2, sampleRate));
  const lp = new Svf(sampleRate, 3000, 0.9);
  const level = 0.6 / Math.sqrt(freqs.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    if (i % 16 === 0) lp.set(500 + 2600 * Math.exp(-t / 0.07), 0.9);
    let sum = 0;
    for (const osc of oscs) sum += osc.square() * 0.6;
    for (const osc of subs) sum += osc.sine() * 0.3;
    out[i] = lp.process(sum * level) * Math.exp(-t / 0.16) * Math.min(1, t / 0.002);
  }
  fadeOut(out, Math.round(0.04 * sampleRate));
  return out;
}
