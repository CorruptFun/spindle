import { describe, expect, it } from 'vitest';
import {
  createKernelState,
  DECLICK_SEC,
  kernelEject,
  kernelGrab,
  kernelHand,
  kernelLoad,
  kernelMoving,
  kernelRelease,
  kernelSeek,
  kernelSetMotor,
  MAX_SPEED,
  renderKernel,
  type KernelState,
} from './kernel';

const RATE = 48000;
const BLOCK = 128;

interface Rendered {
  left: Float32Array;
  right: Float32Array;
  /** How many blocks raised `ended` (cleared after each block, as the worklet does). */
  endedCount: number;
}

/** Render like the worklet does: in blocks, with an optional hook before each block. */
function render(
  state: KernelState,
  frames: number,
  block = BLOCK,
  beforeBlock?: (offset: number) => void,
): Rendered {
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let endedCount = 0;
  for (let offset = 0; offset < frames; offset += block) {
    beforeBlock?.(offset);
    const size = Math.min(block, frames - offset);
    renderKernel(
      state,
      left.subarray(offset, offset + size),
      right.subarray(offset, offset + size),
      size,
      RATE,
    );
    if (state.ended) {
      endedCount += 1;
      state.ended = false;
    }
  }
  return { left, right, endedCount };
}

function noise(frames: number, seed: number): Float32Array {
  const data = new Float32Array(frames);
  let x = seed;
  for (let i = 0; i < frames; i += 1) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    data[i] = x / 2147483648 - 1;
  }
  return data;
}

function sine(frames: number, period: number, amplitude = 0.8): Float32Array {
  const data = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) data[i] = amplitude * Math.sin((2 * Math.PI * i) / period);
  return data;
}

/** A deck already playing at speed with nothing fading, for exact comparisons. */
function playingAtSpeed(state: KernelState): void {
  kernelSetMotor(state, true);
  state.velocity = 1;
  state.speedGain = 1;
  state.fade = 1;
}

function maxStep(data: Float32Array, from = 1, to = data.length): number {
  let step = 0;
  for (let i = Math.max(from, 1); i < to; i += 1) {
    step = Math.max(step, Math.abs((data[i] ?? 0) - (data[i - 1] ?? 0)));
  }
  return step;
}

describe('deck kernel', () => {
  it('reproduces the track exactly at normal speed', () => {
    const left = noise(5000, 1);
    const right = noise(5000, 2);
    const state = createKernelState();
    kernelLoad(state, left, right, false, 1);
    playingAtSpeed(state);

    const out = render(state, 4000);
    expect(out.left).toEqual(left.subarray(0, 4000));
    expect(out.right).toEqual(right.subarray(0, 4000));
  });

  it('feeds a mono track to both outputs', () => {
    const mono = noise(4000, 3);
    const state = createKernelState();
    kernelLoad(state, mono, null, false, 1);
    kernelSetMotor(state, true);

    const out = render(state, 3000);
    expect(out.left).toEqual(out.right);
    expect(maxStep(out.left)).toBeGreaterThan(0);
  });

  it('reaches speed within half a second and coasts to rest within three', () => {
    const state = createKernelState();
    kernelSetMotor(state, true);
    render(state, RATE * 0.5);
    expect(state.velocity).toBeGreaterThan(0.98);
    expect(state.velocity).toBeLessThanOrEqual(1);

    render(state, RATE);
    kernelSetMotor(state, false);
    render(state, RATE * 0.5);
    expect(kernelMoving(state)).toBe(true);
    render(state, RATE * 2.5);
    expect(state.velocity).toBe(0);
    expect(kernelMoving(state)).toBe(false);
  });

  it('moves the record with no track loaded, silently', () => {
    const state = createKernelState();
    kernelSetMotor(state, true);
    const out = render(state, RATE);
    expect(state.position).toBeGreaterThan(RATE * 0.8);
    expect(out.left.every((sample) => sample === 0)).toBe(true);
  });

  it('sounds the same whether rendered in small blocks or one large one', () => {
    const track = noise(RATE * 3, 4);
    const run = (block: number) => {
      const state = createKernelState();
      kernelLoad(state, track, null, false, 1);
      kernelSetMotor(state, true);
      const spinUp = render(state, BLOCK * 100, block);
      kernelSetMotor(state, false);
      const coast = render(state, BLOCK * 300, block);
      return { spinUp, coast, state };
    };
    const small = run(BLOCK);
    const large = run(BLOCK * 300);
    expect(large.spinUp.left).toEqual(small.spinUp.left);
    expect(large.coast.left).toEqual(small.coast.left);
    expect(large.state.position).toBe(small.state.position);
    expect(large.state.velocity).toBe(small.state.velocity);
  });

  it('plays the audio backwards when the hand turns the record back', () => {
    // A slow ramp: reversed playback reads it going down, one sample per frame.
    const length = RATE * 2;
    const ramp = new Float32Array(length);
    for (let i = 0; i < length; i += 1) ramp[i] = i / length;
    const state = createKernelState();
    kernelLoad(state, ramp, null, false, 1);
    playingAtSpeed(state);
    kernelSeek(state, RATE, 2);
    render(state, RATE * 0.05); // the seek's declick

    // The hand reports like a 60 Hz screen: a step of 768 frames every 768 samples.
    const handStep = BLOCK * 6;
    kernelGrab(state);
    const out = render(state, RATE * 0.4, BLOCK, (offset) => {
      if (offset % handStep === 0) kernelHand(state, -handStep);
    });
    expect(state.velocity).toBeCloseTo(-1, 2);

    // After the chase has settled (allow 0.15 s), every step goes down by about one sample.
    const step = 1 / length;
    for (let i = Math.round(RATE * 0.15); i < out.left.length; i += 1) {
      const delta = (out.left[i] ?? 0) - (out.left[i - 1] ?? 0);
      expect(delta).toBeLessThan(-step * 0.9);
      expect(delta).toBeGreaterThan(-step * 1.1);
    }
  });

  it('settles under a still hand and goes silent', () => {
    const state = createKernelState();
    kernelLoad(state, sine(RATE, 100), null, false, 1);
    playingAtSpeed(state);
    render(state, 1000);

    kernelGrab(state);
    const target = state.handTarget;
    const out = render(state, RATE * 0.3);
    expect(state.velocity).toBe(0);
    expect(state.position).toBe(target);
    expect(out.left.subarray(-RATE * 0.1).every((sample) => sample === 0)).toBe(true);
  });

  it('never chases the hand faster than the platter allows', () => {
    const state = createKernelState();
    kernelGrab(state);
    kernelHand(state, RATE * 100);
    render(state, RATE * 0.1);
    expect(state.velocity).toBeLessThanOrEqual(MAX_SPEED);
    expect(state.velocity).toBeGreaterThan(MAX_SPEED * 0.99);
  });

  it('throws on release, and the motor pulls the record back to speed', () => {
    const state = createKernelState();
    kernelSetMotor(state, true);
    kernelGrab(state);
    kernelRelease(state, -6);
    expect(state.velocity).toBe(-6);
    render(state, RATE);
    expect(state.velocity).toBeCloseTo(1, 2);

    kernelGrab(state);
    kernelRelease(state, 1000);
    expect(state.velocity).toBe(MAX_SPEED);
  });

  it('loops round without a discontinuity, at normal and at odd speeds', () => {
    // 10 whole periods, so the loop point is seamless in the source.
    const period = 48;
    const track = sine(period * 10, period);
    const maxSlope = 0.8 * ((2 * Math.PI) / period);

    for (const speed of [1, 1.37, -0.73]) {
      const state = createKernelState();
      kernelLoad(state, track, null, true, 1);
      state.velocity = speed;
      state.speedGain = 1;
      state.fade = 1;
      state.position = 0.5;
      kernelGrab(state); // hold a constant speed: drive the hand at exactly that speed
      state.velocity = speed;
      const out = render(state, 5000, BLOCK, () => kernelHand(state, speed * BLOCK));
      // Skip the first stretch while the chase settles on the hand's speed.
      expect(maxStep(out.left, 2000)).toBeLessThan(maxSlope * Math.abs(speed) * 1.05);
      expect(state.position).toBeGreaterThanOrEqual(0);
      expect(state.position).toBeLessThan(track.length);
    }
  });

  it('loops while free-running, and keeps going past the end', () => {
    const track = sine(480, 48);
    const state = createKernelState();
    kernelLoad(state, track, null, true, 1);
    playingAtSpeed(state);
    const out = render(state, 5000);
    // At exactly normal speed a loop is the track over and over.
    for (let i = 0; i < 5000; i += 1) expect(out.left[i]).toBe(track[i % 480]);
    expect(out.endedCount).toBe(0);
  });

  it('stops at the end of a track that does not loop, and says so once', () => {
    const track = new Float32Array(RATE * 0.1).fill(0.5);
    const state = createKernelState();
    kernelLoad(state, track, null, false, 1);
    playingAtSpeed(state);
    const out = render(state, RATE * 0.5);

    expect(out.endedCount).toBe(1);
    expect(state.motorOn).toBe(false);
    expect(state.velocity).toBe(0);
    expect(state.position).toBe(track.length);
    expect(out.left.subarray(track.length + 10).every((sample) => sample === 0)).toBe(true);
    expect(render(state, RATE * 0.5).endedCount).toBe(0);
  });

  it('fades around a seek instead of clicking', () => {
    // Half the track at +0.8, half at -0.8: a raw jump between them would step 1.6.
    const track = new Float32Array(RATE);
    track.fill(0.8, 0, RATE / 2);
    track.fill(-0.8, RATE / 2);
    const state = createKernelState();
    kernelLoad(state, track, null, false, 1);
    playingAtSpeed(state);
    render(state, 1000);

    kernelSeek(state, RATE * 0.75, 2);
    expect(state.position).toBeLessThan(RATE / 2); // not yet: it waits for the fade-out
    const out = render(state, 2000);
    const fadeStep = 0.8 / (DECLICK_SEC * RATE);
    expect(maxStep(out.left)).toBeLessThan(fadeStep * 1.01);
    expect(state.seq).toBe(2);
    expect(state.position).toBeGreaterThan(RATE * 0.75);
    expect(out.left[1999]).toBeCloseTo(-0.8, 6);
  });

  it('fades around a load and an eject while playing', () => {
    const state = createKernelState();
    kernelLoad(state, new Float32Array(RATE).fill(0.6), null, false, 1);
    playingAtSpeed(state);
    render(state, 1000);

    kernelLoad(state, new Float32Array(RATE).fill(-0.6), null, false, 2);
    const swapped = render(state, 2000);
    kernelEject(state, 3);
    const ejected = render(state, 2000);

    const fadeStep = 0.6 / (DECLICK_SEC * RATE);
    expect(maxStep(swapped.left)).toBeLessThan(fadeStep * 1.01);
    expect(maxStep(ejected.left)).toBeLessThan(fadeStep * 1.01);
    expect(swapped.left[1999]).toBeCloseTo(-0.6, 6);
    expect(ejected.left[1999]).toBe(0);
    expect(state.left).toBeNull();
    expect(state.seq).toBe(3);
  });

  it('seeks straight away when the record is silent', () => {
    const state = createKernelState();
    kernelLoad(state, noise(RATE, 5), null, false, 1);
    kernelSeek(state, 1234.5, 2);
    expect(state.position).toBe(1234.5);
    expect(state.seq).toBe(2);
    kernelSeek(state, RATE * 10, 3);
    expect(state.position).toBe(RATE);
  });

  it('keeps the hand on the record across a seek', () => {
    const state = createKernelState();
    kernelLoad(state, noise(RATE, 6), null, false, 1);
    kernelGrab(state);
    kernelHand(state, 100);
    kernelSeek(state, 20000, 2);
    // Where the hand is heading, including the part of its move not yet fed in.
    expect(state.handTarget + state.handFeedRemaining - state.position).toBe(100);
  });

  it('never produces NaN or Infinity, whatever it is told', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const wild = () => {
      const pick = random();
      if (pick < 0.05) return NaN;
      if (pick < 0.1) return Infinity;
      if (pick < 0.15) return -Infinity;
      if (pick < 0.2) return 1e300 * (random() - 0.5);
      return (random() - 0.5) * 2 * RATE;
    };
    const tracks = [1, 2, 3, 7, 300, 5000].map((frames, i) => {
      const data = noise(frames, 10 + i);
      if (i === 5) data[100] = NaN; // a broken decoder
      if (i === 4) data[10] = Infinity;
      return data;
    });

    const state = createKernelState();
    const left = new Float32Array(512);
    const right = new Float32Array(512);
    let badSamples = 0;
    let badStates = 0;
    for (let step = 0; step < 4000; step += 1) {
      const action = Math.floor(random() * 9);
      const track = tracks[Math.floor(random() * tracks.length)] ?? new Float32Array(1);
      if (action === 0)
        kernelLoad(state, track, random() < 0.5 ? null : track, random() < 0.5, step);
      if (action === 1) kernelEject(state, step);
      if (action === 2) kernelSeek(state, wild(), step);
      if (action === 3) kernelSetMotor(state, random() < 0.6);
      if (action === 4) kernelGrab(state);
      if (action === 5) kernelHand(state, wild());
      if (action === 6) kernelRelease(state, wild());
      const size = 1 + Math.floor(random() * 512);
      renderKernel(state, left, right, size, random() < 0.02 ? NaN : RATE);
      for (let i = 0; i < size; i += 1) {
        if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) badSamples += 1;
      }
      if (
        !Number.isFinite(state.position) ||
        !Number.isFinite(state.velocity) ||
        !Number.isFinite(state.travel) ||
        Math.abs(state.velocity) > MAX_SPEED
      ) {
        badStates += 1;
      }
      state.ended = false;
    }
    expect(badSamples).toBe(0);
    expect(badStates).toBe(0);
  });
});
