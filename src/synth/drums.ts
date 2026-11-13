/**
 * Drum voices for the Studio kits that the starter songs do not use: a long
 * 808-style kick, a tight club kick, a soft toy kick, a cracking snare, a
 * light snare, a finger snap, a conga, a rimshot and a cowbell, plus a filter
 * for taking the edge off any one-shot.
 *
 * Same voicing rule as instruments.ts: every attack is a short ramp rather
 * than a step, noise is kept below the harsh top octave, and every sound
 * fades to silence instead of stopping dead.
 */

import { fadeOut, onePoleCoef, Osc, Svf, TAU } from './dsp';
import type { Rng } from './rng';

function buffer(sampleRate: number, seconds: number): Float32Array {
  return new Float32Array(Math.max(1, Math.round(seconds * sampleRate)));
}

/** Soft saturation normalised so full scale stays full scale. */
function warmth(x: number, drive: number): number {
  return Math.tanh(drive * x) / Math.tanh(drive);
}

function ramp(t: number, attackSec: number): number {
  return Math.min(1, t / attackSec);
}

/**
 * Darkens a one-shot in place with a two-pole low-pass (two one-poles in a
 * row): the "dusty" sound of a sampled record, and a gentler top end for kids.
 */
export function soften(samples: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const coef = onePoleCoef(cutoffHz, sampleRate);
  let a = 0;
  let b = 0;
  for (let i = 0; i < samples.length; i++) {
    a += coef * (samples[i]! - a);
    b += coef * (a - b);
    samples[i] = b;
  }
  // The filter can leave a little energy in the last samples; end on silence.
  fadeOut(samples, Math.round(0.005 * sampleRate));
  return samples;
}

/**
 * Linear fade over the first `frames` samples, in place. For a one-shot that
 * starts on a non-zero sample, which would click every time it is triggered.
 */
export function fadeIn(samples: Float32Array, frames: number): Float32Array {
  const n = Math.min(frames, samples.length);
  for (let i = 0; i < n; i++) samples[i] = samples[i]! * (i / n);
  return samples;
}

/**
 * 808-style long kick: a sine that drops from about 115 Hz to a deep 46 Hz and
 * rings. Driven a little, so its harmonics carry it on small speakers that
 * cannot play the fundamental.
 */
export function boomKick(sampleRate: number, rng: Rng, decaySec = 0.42): Float32Array {
  const out = buffer(sampleRate, 1.1);
  const clickCoef = onePoleCoef(1800, sampleRate);
  let phase = 0;
  let click = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const freq = 46 + 70 * Math.exp(-t / 0.045);
    phase += (TAU * freq) / sampleRate;
    click += clickCoef * (rng.bipolar() - click);
    const body = Math.sin(phase) * Math.exp(-t / decaySec);
    out[i] = warmth((body + click * 0.2 * Math.exp(-t / 0.003)) * ramp(t, 0.002), 2);
  }
  fadeOut(out, Math.round(0.08 * sampleRate));
  return out;
}

/** Tight club kick: a fast pitch sweep for the punch and a short body. */
export function punchKick(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.4);
  const clickCoef = onePoleCoef(3000, sampleRate);
  let phase = 0;
  let click = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const freq = 52 + 150 * Math.exp(-t / 0.022);
    phase += (TAU * freq) / sampleRate;
    click += clickCoef * (rng.bipolar() - click);
    const body = Math.sin(phase) * Math.exp(-t / 0.15);
    out[i] = warmth((body + click * 0.3 * Math.exp(-t / 0.004)) * ramp(t, 0.0015), 1.6);
  }
  fadeOut(out, Math.round(0.05 * sampleRate));
  return out;
}

/** A soft, round "bonk" with no click at all: a kick for small ears. */
export function softKick(sampleRate: number): Float32Array {
  const out = buffer(sampleRate, 0.35);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const freq = 68 + 70 * Math.exp(-t / 0.03);
    phase += (TAU * freq) / sampleRate;
    out[i] = Math.sin(phase) * Math.exp(-t / 0.13) * ramp(t, 0.003);
  }
  fadeOut(out, Math.round(0.05 * sampleRate));
  return out;
}

/**
 * Cracking hip-hop snare: a high, short drum tone, a snap of mid noise at the
 * front, and a darker rattle behind it.
 */
export function crackSnare(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.4);
  const hp = new Svf(sampleRate, 1800, 0.7);
  const crack = new Svf(sampleRate, 3000, 1.2);
  const lp = onePoleCoef(6500, sampleRate);
  let noise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const white = rng.bipolar();
    hp.process(white);
    crack.process(white);
    noise += lp * (hp.high - noise);
    const body =
      (Math.sin(TAU * 215 * t) + 0.45 * Math.sin(TAU * 370 * t)) * Math.exp(-t / 0.045) * 0.7;
    const snap = crack.band * 1.6 * Math.exp(-t / 0.008);
    out[i] = (body + snap + noise * Math.exp(-t / 0.12)) * ramp(t, 0.001) * 0.55;
  }
  fadeOut(out, Math.round(0.04 * sampleRate));
  return out;
}

/** A light, bright snare: mostly a tuned "pop" with a short brush of noise. */
export function tapSnare(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.3);
  const bp = new Svf(sampleRate, 2600, 0.8);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    bp.process(rng.bipolar());
    const body = (Math.sin(TAU * 300 * t) + 0.3 * Math.sin(TAU * 510 * t)) * Math.exp(-t / 0.05);
    out[i] = (body * 0.6 + bp.band * 0.9 * Math.exp(-t / 0.06)) * ramp(t, 0.001);
  }
  fadeOut(out, Math.round(0.04 * sampleRate));
  return out;
}

/** A finger snap: two quick clicks of mid noise and a little woody tone. */
export function snap(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.25);
  const bp = new Svf(sampleRate, 2200, 1.6);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    bp.process(rng.bipolar());
    let env = Math.exp(-t / 0.03);
    if (t >= 0.006) env += 0.6 * Math.exp(-(t - 0.006) / 0.05);
    const tone = Math.sin(TAU * 1250 * t) * Math.exp(-t / 0.02) * 0.4;
    out[i] = (bp.band * 1.8 * env + tone) * ramp(t, 0.0008) * 0.65;
  }
  fadeOut(out, Math.round(0.04 * sampleRate));
  return out;
}

/**
 * A hand drum (conga or bongo, by pitch): a tuned skin with a small upward
 * bend at the strike, a quieter overtone, and a slap of soft noise.
 */
export function conga(sampleRate: number, rng: Rng, freq: number): Float32Array {
  const out = buffer(sampleRate, 0.45);
  const lp = onePoleCoef(2500, sampleRate);
  let phase = 0;
  let noise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    phase += (TAU * freq * (1 + 0.12 * Math.exp(-t / 0.012))) / sampleRate;
    noise += lp * (rng.bipolar() - noise);
    const skin = Math.sin(phase) * Math.exp(-t / 0.14);
    const overtone = 0.25 * Math.sin(1.58 * phase) * Math.exp(-t / 0.05);
    out[i] = (skin + overtone + noise * 0.5 * Math.exp(-t / 0.006)) * ramp(t, 0.001) * 0.75;
  }
  fadeOut(out, Math.round(0.05 * sampleRate));
  return out;
}

/** Rimshot: the stick across the rim. A woody knock with a short bright ring. */
export function rimshot(sampleRate: number, rng: Rng): Float32Array {
  const out = buffer(sampleRate, 0.16);
  const bp = new Svf(sampleRate, 2800, 1.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    bp.process(rng.bipolar());
    const knock = Math.sin(TAU * 480 * t) * Math.exp(-t / 0.025);
    const ring = 0.45 * Math.sin(TAU * 1650 * t) * Math.exp(-t / 0.012);
    out[i] = (knock + ring + bp.band * 0.8 * Math.exp(-t / 0.004)) * ramp(t, 0.0008) * 0.7;
  }
  fadeOut(out, Math.round(0.03 * sampleRate));
  return out;
}

/**
 * Cowbell in the drum-machine style: two square waves a sixth apart through a
 * band-pass, with a quick drop and a short ring.
 */
export function cowbell(sampleRate: number): Float32Array {
  const out = buffer(sampleRate, 0.5);
  const a = new Osc(560, sampleRate);
  const b = new Osc(835, sampleRate);
  const bp = new Svf(sampleRate, 1100, 1.4);
  const lp = onePoleCoef(4000, sampleRate);
  let tone = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    bp.process((a.square() + b.square()) * 0.5);
    tone += lp * (bp.band - tone);
    const env = 0.6 * Math.exp(-t / 0.018) + 0.4 * Math.exp(-t / 0.13);
    out[i] = tone * env * ramp(t, 0.001);
  }
  fadeOut(out, Math.round(0.05 * sampleRate));
  return out;
}
