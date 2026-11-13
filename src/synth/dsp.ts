/**
 * Small DSP building blocks for the starter songs: oscillators, a filter, a
 * reverb, an echo, and the master stage. Plain loops over typed arrays, so a
 * song renders the same in every browser, in a worker, and in Node tests.
 *
 * Effects that run over the whole song are "loop-aware": they warm up on the
 * end of the loop before processing its start, so their tails wrap round and
 * the seam is as smooth as any other bar.
 */

export const TAU = Math.PI * 2;

/** Wraps a possibly negative index into [0, length). */
function wrap(index: number, length: number): number {
  const r = index % length;
  return r < 0 ? r + length : r;
}

/** PolyBLEP residual: rounds off the jump in a saw or square so it does not alias. */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** A phase accumulator with band-limited waveforms. */
export class Osc {
  phase: number;
  inc: number;

  constructor(freq: number, sampleRate: number, phase = 0) {
    this.phase = phase;
    this.inc = freq / sampleRate;
  }

  saw(): number {
    const t = this.phase;
    const value = 2 * t - 1 - polyBlep(t, this.inc);
    this.advance();
    return value;
  }

  square(): number {
    const t = this.phase;
    const value = (t < 0.5 ? 1 : -1) + polyBlep(t, this.inc) - polyBlep((t + 0.5) % 1, this.inc);
    this.advance();
    return value;
  }

  sine(): number {
    const value = Math.sin(TAU * this.phase);
    this.advance();
    return value;
  }

  private advance(): void {
    this.phase += this.inc;
    if (this.phase >= 1) this.phase -= 1;
  }
}

/** State-variable filter (trapezoidal, stable when the cutoff moves). */
export class Svf {
  low = 0;
  band = 0;
  high = 0;
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;
  private readonly sampleRate: number;

  constructor(sampleRate: number, cutoff: number, q = 0.707) {
    this.sampleRate = sampleRate;
    this.set(cutoff, q);
  }

  set(cutoff: number, q: number): void {
    const fc = Math.min(Math.max(cutoff, 10), this.sampleRate * 0.45);
    const g = Math.tan((Math.PI * fc) / this.sampleRate);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  /** Runs one sample; returns the low-pass output, the others are on the fields. */
  process(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = x - this.k * v1 - v2;
    return v2;
  }
}

/** Coefficient for a one-pole smoother `y += a * (x - y)` at a corner frequency. */
export function onePoleCoef(cutoff: number, sampleRate: number): number {
  return 1 - Math.exp((-TAU * cutoff) / sampleRate);
}

/** Linear fade over the last `frames` samples, so a one-shot never ends on a click. */
export function fadeOut(buffer: Float32Array, frames: number): void {
  const n = Math.min(frames, buffer.length);
  for (let i = 0; i < n; i++) {
    const index = buffer.length - n + i;
    buffer[index] = buffer[index]! * (1 - (i + 1) / n);
  }
}

/** Adds `src * gain` into `dest` starting at `start`, wrapping past the end to the start. */
export function addWrapped(
  dest: Float32Array,
  src: Float32Array,
  start: number,
  gain: number,
): void {
  const n = dest.length;
  let at = wrap(start, n);
  let i = 0;
  while (i < src.length) {
    // Contiguous runs up to the end of the loop, then carry on from the start.
    const run = Math.min(src.length - i, n - at);
    for (let k = 0; k < run; k++) dest[at + k] = dest[at + k]! + src[i + k]! * gain;
    i += run;
    at = 0;
  }
}

/** Freeverb's tuning at 44.1 kHz: mutually prime delays that avoid metallic ringing. */
const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING = [556, 441, 341, 225];
const STEREO_SPREAD = 23;

export interface ReverbOptions {
  /** Comb feedback, 0.7 (small room) to 0.9 (hall). */
  readonly size: number;
  /** High-frequency loss in the tail, 0 (bright) to 1 (dark). */
  readonly damp: number;
  readonly wet: number;
}

/**
 * Freeverb-style room on a mono send, added in stereo to the outputs. Low end is
 * kept out of the send so the room never turns to mud under the kick and bass.
 */
export function addReverbLoop(
  send: Float32Array,
  outL: Float32Array,
  outR: Float32Array,
  sampleRate: number,
  options: ReverbOptions,
): void {
  const n = send.length;
  const scale = sampleRate / 44100;
  // All 24 delay lines (8 combs and 4 all-passes per side) live in one flat
  // buffer; each filter is a start offset, a length and a read position.
  const tunings = [
    ...COMB_TUNING,
    ...COMB_TUNING.map((d) => d + STEREO_SPREAD),
    ...ALLPASS_TUNING,
    ...ALLPASS_TUNING.map((d) => d + STEREO_SPREAD),
  ];
  const lengths = Int32Array.from(tunings, (d) => Math.max(1, Math.round(d * scale)));
  const offsets = new Int32Array(lengths.length);
  let total = 0;
  for (let k = 0; k < lengths.length; k++) {
    offsets[k] = total;
    total += lengths[k]!;
  }
  const lines = new Float32Array(total);
  const pos = new Int32Array(lengths.length);
  const store = new Float64Array(16);
  const feedback = options.size;
  const damp = options.damp * 0.4;
  const hpCoef = onePoleCoef(220, sampleRate);
  const wet = options.wet * 3;
  let hpState = 0;

  const warm = Math.min(n, Math.round(sampleRate * 2));
  for (let i = -warm; i < n; i++) {
    const raw = send[wrap(i, n)]!;
    hpState += hpCoef * (raw - hpState);
    const input = (raw - hpState) * 0.015;

    for (let ch = 0; ch < 2; ch++) {
      let acc = 0;
      for (let c = ch * 8; c < ch * 8 + 8; c++) {
        const p = pos[c]!;
        const at = offsets[c]! + p;
        const y = lines[at]!;
        const s = y * (1 - damp) + store[c]! * damp;
        store[c] = s;
        lines[at] = input + s * feedback;
        pos[c] = p + 1 === lengths[c]! ? 0 : p + 1;
        acc += y;
      }
      for (let a = 16 + ch * 4; a < 20 + ch * 4; a++) {
        const p = pos[a]!;
        const at = offsets[a]! + p;
        const buffered = lines[at]!;
        lines[at] = acc + buffered * 0.5;
        acc = buffered - acc;
        pos[a] = p + 1 === lengths[a]! ? 0 : p + 1;
      }
      if (i >= 0) {
        const out = ch === 0 ? outL : outR;
        out[i] = out[i]! + acc * wet;
      }
    }
  }
}

export interface EchoOptions {
  readonly delaySec: number;
  readonly feedback: number;
  readonly wet: number;
  /** Each repeat is a little darker than the one before. */
  readonly toneHz: number;
}

/** Ping-pong echo on a mono send: repeats bounce left, right, left. */
export function addPingPongLoop(
  send: Float32Array,
  outL: Float32Array,
  outR: Float32Array,
  sampleRate: number,
  options: EchoOptions,
): void {
  const n = send.length;
  const size = Math.max(1, Math.round(options.delaySec * sampleRate));
  const lineL = new Float32Array(size);
  const lineR = new Float32Array(size);
  const coef = onePoleCoef(options.toneHz, sampleRate);
  let toneL = 0;
  let toneR = 0;
  let pos = 0;
  const warm = Math.min(n, Math.round(sampleRate * 4));
  for (let i = -warm; i < n; i++) {
    const input = send[wrap(i, n)]!;
    const yl = lineL[pos]!;
    const yr = lineR[pos]!;
    toneL += coef * (yl - toneL);
    toneR += coef * (yr - toneR);
    lineL[pos] = input + toneR * options.feedback;
    lineR[pos] = toneL * options.feedback;
    pos = pos + 1 === size ? 0 : pos + 1;
    if (i >= 0) {
      outL[i] = outL[i]! + yl * options.wet;
      outR[i] = outR[i]! + yr * options.wet;
    }
  }
}

/** Removes DC and sub-sonic rumble in place, loop-aware. */
export function highpassLoop(channel: Float32Array, sampleRate: number, cutoff: number): void {
  const n = channel.length;
  const r = 1 - (TAU * cutoff) / sampleRate;
  let x1 = 0;
  let y1 = 0;
  const warm = Math.min(n, Math.round(sampleRate * 0.5));
  for (let i = -warm; i < n; i++) {
    const index = wrap(i, n);
    const x = channel[index]!;
    const y = x - x1 + r * y1;
    x1 = x;
    y1 = y;
    if (i >= 0) channel[index] = y;
  }
}

export function rms(channels: readonly Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) sum += channel[i]! * channel[i]!;
    count += channel.length;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

export function peak(channels: readonly Float32Array[]): number {
  let max = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const v = Math.abs(channel[i]!);
      if (v > max) max = v;
    }
  }
  return max;
}

export interface MasterOptions {
  /** Loudness every song is brought to, as linear RMS over both channels. */
  readonly targetRms: number;
  /** The limiter keeps every sample at or below this. */
  readonly ceiling: number;
}

export interface MasterReport {
  readonly gain: number;
  readonly rms: number;
  readonly peak: number;
  /** Deepest limiter gain reduction, as a linear factor (1 = none). */
  readonly minLimiterGain: number;
}

const LIMITER_BLOCK = 32;

/**
 * Brings a stereo loop to a set loudness under a hard ceiling, in place.
 *
 * Gain and limiting are solved together: the limiter's gain curve is planned
 * per 32-frame block from block peaks (look-ahead of one block, a short attack
 * ramp before each peak, a gentle release after it), then the make-up gain is
 * refined until the limited loop reaches the target RMS. The curve is cyclic,
 * so there is no gain jump at the seam.
 */
export function masterLoop(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  options: MasterOptions,
): MasterReport {
  const n = left.length;
  const blocks = Math.ceil(n / LIMITER_BLOCK);
  const blockPeak = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let max = 0;
    const end = Math.min(n, (b + 1) * LIMITER_BLOCK);
    for (let i = b * LIMITER_BLOCK; i < end; i++) {
      const v = Math.max(Math.abs(left[i]!), Math.abs(right[i]!));
      if (v > max) max = v;
    }
    blockPeak[b] = max;
  }

  const blockSec = LIMITER_BLOCK / sampleRate;
  const attackStep = blockSec / 0.004;
  const releaseStep = blockSec / 0.25;
  const required = new Float32Array(blocks);
  const curve = new Float32Array(blocks);

  const plan = (gain: number): void => {
    for (let b = 0; b < blocks; b++) {
      const level = blockPeak[b]! * gain;
      required[b] = level > options.ceiling ? options.ceiling / level : 1;
    }
    for (let b = 0; b < blocks; b++) {
      curve[b] = Math.min(
        required[wrap(b - 1, blocks)]!,
        required[b]!,
        required[wrap(b + 1, blocks)]!,
      );
    }
    // Release first, then attack: the attack pass only lowers values ahead of a
    // dip, so it can never undo the release ramp.
    for (let k = 1; k < 2 * blocks; k++) {
      const b = k % blocks;
      const prev = curve[wrap(b - 1, blocks)]!;
      if (curve[b]! > prev + releaseStep) curve[b] = prev + releaseStep;
    }
    for (let k = 2 * blocks - 2; k >= 0; k--) {
      const b = k % blocks;
      const next = curve[wrap(b + 1, blocks)]!;
      if (curve[b]! > next + attackStep) curve[b] = next + attackStep;
    }
  };

  /**
   * Visits every sample with its gain. Gain is linear between block gains:
   * both ends are at or below the block's own requirement, so every sample in
   * between is too.
   */
  const eachGain = (gain: number, visit: (i: number, g: number) => void): void => {
    for (let b = 0; b < blocks; b++) {
      const g0 = curve[b]! * gain;
      const slope = (curve[wrap(b + 1, blocks)]! * gain - g0) / LIMITER_BLOCK;
      const start = b * LIMITER_BLOCK;
      const end = Math.min(n, start + LIMITER_BLOCK);
      for (let i = start; i < end; i++) visit(i, g0 + slope * (i - start));
    }
  };

  const limitedRms = (gain: number): number => {
    let sum = 0;
    eachGain(gain, (i, g) => {
      const l = left[i]! * g;
      const r = right[i]! * g;
      sum += l * l + r * r;
    });
    return Math.sqrt(sum / (2 * n));
  };

  const minCurve = (): number => {
    let min = 1;
    for (let b = 0; b < blocks; b++) min = Math.min(min, curve[b]!);
    return min;
  };

  const raw = rms([left, right]);
  let gain = raw > 0 ? options.targetRms / raw : 1;
  plan(gain);
  for (let pass = 0; pass < 6; pass++) {
    // No block over the ceiling: the plain gain already hits the target.
    if (minCurve() === 1) break;
    const level = limitedRms(gain);
    if (level <= 0) break;
    const correction = options.targetRms / level;
    if (Math.abs(correction - 1) < 0.001) break;
    gain *= correction;
    plan(gain);
  }

  const ceiling = options.ceiling;
  eachGain(gain, (i, g) => {
    // The clamp only catches float rounding; the curve already respects the ceiling.
    left[i] = Math.max(-ceiling, Math.min(ceiling, left[i]! * g));
    right[i] = Math.max(-ceiling, Math.min(ceiling, right[i]! * g));
  });

  return {
    gain,
    rms: rms([left, right]),
    peak: peak([left, right]),
    minLimiterGain: minCurve(),
  };
}
