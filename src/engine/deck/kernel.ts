/**
 * The deck playback kernel: a record you can play, stop, grab, scratch, throw
 * and seek, rendered sample by sample. It runs inside the deck player worklet
 * but is plain maths, so tests drive it directly.
 *
 * Rules for this file: no allocation in `renderKernel`, no DOM types (the
 * worklet bundles it), and no NaN or Infinity may ever reach the output.
 */
import {
  COAST_RESPONSE,
  MAX_VELOCITY_DEG,
  MOTOR_RESPONSE,
  PLAY_VELOCITY_DEG,
  REST_VELOCITY_DEG,
} from './platter';

/** The fastest a hand or a throw can spin the record, as a speed ratio (20x). */
export const MAX_SPEED = MAX_VELOCITY_DEG / PLAY_VELOCITY_DEG;

/** Below this speed, with the motor off, the record has stopped. Same rule as the platter model. */
export const REST_SPEED = REST_VELOCITY_DEG / PLAY_VELOCITY_DEG;

/** How tightly the record follows the hand: the gap closes with this time constant. */
export const HAND_TAU_SEC = 0.012;

/**
 * Smoothing of the hand-driven speed. A quarter of HAND_TAU_SEC makes the chase
 * critically damped: no zipper noise from stepwise hand updates, and no overshoot.
 */
export const HAND_SMOOTH_SEC = HAND_TAU_SEC / 4;

/** Below this speed the output fades towards silence, so a still record hums nothing. */
export const SILENT_SPEED = 0.05;

/** Smoothing of that speed-following gain. */
export const SPEED_GAIN_SEC = 0.002;

/** Fade out and back in around a seek, load or eject, so the jump does not click. */
export const DECLICK_SEC = 0.005;

/**
 * A hand step is spread over the interval since the previous one, but never
 * less than one render quantum (the finest grain messages arrive at) nor more
 * than this, so the first move after a pause is not smeared out.
 */
export const HAND_FEED_MAX_SEC = 0.04;
const HAND_FEED_MIN_SAMPLES = 128;

/** Close enough to the hand to snap onto it and stop (frames, speed ratio). */
const HAND_SNAP_FRAMES = 1e-3;
const HAND_SNAP_SPEED = 1e-5;

/** Close enough to motor speed to sit at exactly 1, which keeps unity playback bit-exact. */
const MOTOR_SNAP_SPEED = 1e-6;

/** Gains this small are zero: avoids denormal tails in the output. */
const GAIN_FLOOR = 1e-6;

/** Anything a decoder could emit beyond this is garbage, not audio. */
const SAMPLE_LIMIT = 1e6;

const FALLBACK_SAMPLE_RATE = 48000;

const PENDING_NONE = 0;
const PENDING_LOAD = 1;
const PENDING_EJECT = 2;
type PendingTrack = typeof PENDING_NONE | typeof PENDING_LOAD | typeof PENDING_EJECT;

/**
 * Everything the kernel knows. One object, created once and mutated in place.
 * Positions are in frames at the context's sample rate (a loaded track must
 * already be at that rate), speeds are ratios (1 = normal play).
 */
export interface KernelState {
  /** Track samples. `right` is null for mono. Null `left` means no track. */
  left: Float32Array | null;
  right: Float32Array | null;
  /** Track length in frames; 0 when empty. */
  length: number;
  loop: boolean;

  /** Needle position. Fractional; may be negative or past the end when off the track. */
  position: number;
  /** Total distance turned, in frames. Never jumps, so the picture can follow it. */
  travel: number;
  /** Speed ratio; negative is backwards. */
  velocity: number;
  motorOn: boolean;
  held: boolean;
  /** Where the hand wants the needle, in frames. Meaningful only while held. */
  handTarget: number;
  /** Part of the last hand movement not yet fed into `handTarget`, and how much per sample. */
  handFeedRemaining: number;
  handFeedRate: number;
  /** Samples since the last hand movement arrived: the hand's update interval. */
  samplesSinceHand: number;
  /** Longest stretch a hand movement is spread over, in samples (set from the sample rate). */
  handFeedMax: number;

  /** Gain that follows speed near zero. */
  speedGain: number;
  /** Declick fade around jumps, 0 to 1. */
  fade: number;
  /**
   * Set when a track that does not loop reaches its end (the motor is switched off at the
   * same moment). Only the caller clears it, after reporting it: a load or seek landing in
   * the same instant must not swallow the news that the motor stopped.
   */
  ended: boolean;
  /** The last load / eject / seek sequence number that took effect. */
  seq: number;

  /** A load or eject waiting for the fade-out to finish. */
  pendingTrack: PendingTrack;
  pendingLeft: Float32Array | null;
  pendingRight: Float32Array | null;
  pendingLoop: boolean;
  pendingTrackSeq: number;
  /** A seek waiting for the fade-out to finish. Applied after any pending load. */
  pendingSeek: boolean;
  pendingSeekFrames: number;
  pendingSeekSeq: number;
}

export function createKernelState(): KernelState {
  return {
    left: null,
    right: null,
    length: 0,
    loop: false,
    position: 0,
    travel: 0,
    velocity: 0,
    motorOn: false,
    held: false,
    handTarget: 0,
    handFeedRemaining: 0,
    handFeedRate: 0,
    samplesSinceHand: 0,
    handFeedMax: HAND_FEED_MAX_SEC * FALLBACK_SAMPLE_RATE,
    speedGain: 0,
    fade: 1,
    ended: false,
    seq: 0,
    pendingTrack: PENDING_NONE,
    pendingLeft: null,
    pendingRight: null,
    pendingLoop: false,
    pendingTrackSeq: 0,
    pendingSeek: false,
    pendingSeekFrames: 0,
    pendingSeekSeq: 0,
  };
}

/** True while the record turns, is held, or the motor is driving it. */
export function kernelMoving(state: KernelState): boolean {
  return state.held || state.motorOn || state.velocity !== 0;
}

/**
 * Put a track on. Mono passes `right` as null. The needle returns to the start;
 * the motor and the hand are left as they are.
 */
export function kernelLoad(
  state: KernelState,
  left: Float32Array,
  right: Float32Array | null,
  loop: boolean,
  seq: number,
): void {
  state.pendingTrack = PENDING_LOAD;
  state.pendingLeft = left;
  state.pendingRight = right;
  state.pendingLoop = loop;
  state.pendingTrackSeq = finiteOr(seq, state.seq);
  // A load returns to the start, so an older seek no longer applies.
  state.pendingSeek = false;
  applyNowIfInaudible(state);
}

export function kernelEject(state: KernelState, seq: number): void {
  state.pendingTrack = PENDING_EJECT;
  state.pendingLeft = null;
  state.pendingRight = null;
  state.pendingTrackSeq = finiteOr(seq, state.seq);
  state.pendingSeek = false;
  applyNowIfInaudible(state);
}

/** Move the needle. Clamped to the track; ignored when the deck is empty. */
export function kernelSeek(state: KernelState, frames: number, seq: number): void {
  if (!Number.isFinite(frames)) return;
  state.pendingSeek = true;
  state.pendingSeekFrames = frames;
  state.pendingSeekSeq = finiteOr(seq, state.seq);
  applyNowIfInaudible(state);
}

export function kernelSetMotor(state: KernelState, on: boolean): void {
  state.motorOn = on;
}

/** A hand lands on the record and holds it where it is. */
export function kernelGrab(state: KernelState): void {
  if (state.held) return;
  state.held = true;
  state.handTarget = state.position;
  state.handFeedRemaining = 0;
  state.handFeedRate = 0;
  state.samplesSinceHand = 0;
}

/**
 * The hand turned the record by `deltaFrames`. Ignored when nobody holds it.
 *
 * Hand movements arrive in steps, one per pointer event (every 4 to 16 ms).
 * Chasing a staircase would warble the pitch at the event rate, so each step
 * is spread evenly over the time the previous one took to arrive: the target
 * then moves at the hand's speed, smoothly, one update interval late.
 */
export function kernelHand(state: KernelState, deltaFrames: number): void {
  if (!state.held || !Number.isFinite(deltaFrames)) return;
  // Whatever is left of the previous step lands now, so the target never falls further behind.
  state.handTarget += state.handFeedRemaining;
  const interval = Math.min(
    Math.max(state.samplesSinceHand, HAND_FEED_MIN_SAMPLES),
    state.handFeedMax,
  );
  state.handFeedRemaining = deltaFrames;
  state.handFeedRate = deltaFrames / interval;
  state.samplesSinceHand = 0;
}

/** The hand lets go at `velocity` (speed ratio); the motor or friction takes over from there. */
export function kernelRelease(state: KernelState, velocity: number): void {
  if (!state.held) return;
  state.held = false;
  state.handFeedRemaining = 0;
  state.handFeedRate = 0;
  state.velocity = clampSpeed(finiteOr(velocity, 0));
}

/**
 * Render `frames` samples into the two outputs. Every step is per sample, so
 * the result does not depend on how the work is split into blocks.
 */
export function renderKernel(
  state: KernelState,
  outLeft: Float32Array,
  outRight: Float32Array,
  frames: number,
  sampleRate: number,
): void {
  const rate = sampleRate > 0 && Number.isFinite(sampleRate) ? sampleRate : FALLBACK_SAMPLE_RATE;
  const motorBlend = 1 - Math.exp(-MOTOR_RESPONSE / rate);
  const coastBlend = 1 - Math.exp(-COAST_RESPONSE / rate);
  const handTauFrames = HAND_TAU_SEC * rate;
  const handBlend = 1 - Math.exp(-1 / (HAND_SMOOTH_SEC * rate));
  const gainBlend = 1 - Math.exp(-1 / (SPEED_GAIN_SEC * rate));
  const fadeStep = 1 / (DECLICK_SEC * rate);
  const count = Math.min(frames, outLeft.length, outRight.length);
  state.handFeedMax = HAND_FEED_MAX_SEC * rate;

  for (let i = 0; i < count; i += 1) {
    // 1. Speed: the hand, or the motor and friction.
    let velocity = state.velocity;
    if (state.held) {
      const remaining = state.handFeedRemaining;
      if (remaining !== 0) {
        const feed = state.handFeedRate;
        const step = Math.abs(feed) >= Math.abs(remaining) ? remaining : feed;
        state.handTarget += step;
        state.handFeedRemaining = remaining - step;
      }
      if (state.samplesSinceHand < state.handFeedMax) state.samplesSinceHand += 1;
      const gap = state.handTarget - state.position;
      const wanted = clampSpeed(gap / handTauFrames);
      velocity += (wanted - velocity) * handBlend;
      if (Math.abs(gap) < HAND_SNAP_FRAMES && Math.abs(velocity) < HAND_SNAP_SPEED) {
        state.travel += gap;
        state.position = state.handTarget;
        velocity = 0;
      }
    } else if (state.motorOn) {
      velocity += (1 - velocity) * motorBlend;
      if (Math.abs(velocity - 1) < MOTOR_SNAP_SPEED) velocity = 1;
    } else {
      velocity += -velocity * coastBlend;
      if (Math.abs(velocity) < REST_SPEED) velocity = 0;
    }
    state.velocity = velocity;

    // 2. Declick: fade out before a jump, apply it at silence, fade back in.
    if (state.pendingTrack !== PENDING_NONE || state.pendingSeek) {
      state.fade -= fadeStep;
      if (state.fade <= 0) {
        state.fade = 0;
        applyPending(state);
      }
    } else if (state.fade < 1) {
      state.fade = Math.min(1, state.fade + fadeStep);
    }

    // 3. Gain follows speed near zero, so a stopped record is silent rather than a DC offset.
    const speedTarget = Math.min(Math.abs(state.velocity) / SILENT_SPEED, 1);
    let speedGain = state.speedGain + (speedTarget - state.speedGain) * gainBlend;
    if (speedGain < GAIN_FLOOR) speedGain = 0;
    state.speedGain = speedGain;
    const gain = speedGain * state.fade;

    // 4. Read the track at the needle.
    const left = state.left;
    if (left === null || gain === 0) {
      outLeft[i] = 0;
      outRight[i] = 0;
    } else {
      const sampleLeft = readHermite(left, state.position, state.length, state.loop);
      const right = state.right;
      const sampleRight =
        right === null ? sampleLeft : readHermite(right, state.position, state.length, state.loop);
      outLeft[i] = sampleLeft * gain;
      outRight[i] = sampleRight * gain;
    }

    // 5. Move the needle, then keep it on the track.
    state.position += state.velocity;
    state.travel += state.velocity;
    keepOnTrack(state);
  }

  // Belt and braces: a corrupted state must never get stuck producing garbage.
  if (
    !Number.isFinite(state.position) ||
    !Number.isFinite(state.velocity) ||
    !Number.isFinite(state.travel) ||
    !Number.isFinite(state.handTarget) ||
    !Number.isFinite(state.handFeedRemaining)
  ) {
    state.position = 0;
    state.velocity = 0;
    state.travel = 0;
    state.handTarget = 0;
    state.handFeedRemaining = 0;
    state.handFeedRate = 0;
    state.speedGain = 0;
  }
}

/** Wrap a looping track, or stop at the end of one that does not loop. */
function keepOnTrack(state: KernelState): void {
  const length = state.length;
  if (length <= 0) return;
  const position = state.position;
  if (state.loop) {
    if (position >= length || position < 0) {
      const wrapped = position - Math.floor(position / length) * length;
      // Floating point can land exactly on `length`; that is the start again.
      const onTrack = wrapped >= length ? 0 : wrapped;
      // The hand moves with the needle, so a wrap does not make the hand chase it back.
      state.handTarget += onTrack - position;
      state.position = onTrack;
    }
  } else if (!state.held && state.velocity > 0 && position >= length) {
    state.position = length;
    state.velocity = 0;
    state.motorOn = false;
    state.ended = true;
  }
}

function applyNowIfInaudible(state: KernelState): void {
  // Nothing to declick when nothing is sounding: apply straight away.
  if (state.left === null || state.speedGain === 0 || state.fade === 0) {
    const wasEmpty = state.left === null;
    applyPending(state);
    // A record already spinning when the first track lands fades the track in.
    if (wasEmpty && state.left !== null && state.velocity !== 0) state.fade = 0;
  }
}

function applyPending(state: KernelState): void {
  if (state.pendingTrack === PENDING_LOAD && state.pendingLeft !== null) {
    const left = state.pendingLeft;
    const right = state.pendingRight;
    state.left = left;
    state.right = right;
    state.length = right === null ? left.length : Math.min(left.length, right.length);
    state.loop = state.pendingLoop;
    moveNeedle(state, 0);
    state.seq = Math.max(state.seq, state.pendingTrackSeq);
  } else if (state.pendingTrack === PENDING_EJECT) {
    state.left = null;
    state.right = null;
    state.length = 0;
    state.loop = false;
    state.seq = Math.max(state.seq, state.pendingTrackSeq);
  }
  state.pendingTrack = PENDING_NONE;
  state.pendingLeft = null;
  state.pendingRight = null;

  if (state.pendingSeek) {
    state.pendingSeek = false;
    if (state.length > 0) {
      moveNeedle(state, Math.min(Math.max(state.pendingSeekFrames, 0), state.length));
    }
    state.seq = Math.max(state.seq, state.pendingSeekSeq);
  }
}

/** Jump the needle. A hand on the record moves with it, so it does not drag the needle back. */
function moveNeedle(state: KernelState, frames: number): void {
  state.handTarget += frames - state.position;
  state.position = frames;
}

/** 4-point, 3rd-order Hermite interpolation. Taps outside the track are silence, or wrap when looping. */
function readHermite(
  channel: Float32Array,
  position: number,
  length: number,
  loop: boolean,
): number {
  const index = Math.floor(position);
  const t = position - index;
  const xm1 = tap(channel, index - 1, length, loop);
  const x0 = tap(channel, index, length, loop);
  const x1 = tap(channel, index + 1, length, loop);
  const x2 = tap(channel, index + 2, length, loop);
  const c1 = 0.5 * (x1 - xm1);
  const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
  const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
  const value = ((c3 * t + c2) * t + c1) * t + x0;
  // Also false for NaN.
  return value < SAMPLE_LIMIT && value > -SAMPLE_LIMIT ? value : 0;
}

function tap(channel: Float32Array, index: number, length: number, loop: boolean): number {
  if (index >= 0 && index < length) return channel[index] ?? 0;
  if (!loop || length <= 0) return 0;
  return channel[index - Math.floor(index / length) * length] ?? 0;
}

function clampSpeed(speed: number): number {
  return Math.min(MAX_SPEED, Math.max(-MAX_SPEED, speed));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
