/**
 * The platter model: how a record's rotation answers to the motor and to a
 * hand. Pure maths. Today it moves the record on screen; from Milestone 2 the
 * deck's playback speed follows the very same velocity, which is what makes a
 * scratch sound like the gesture that made it.
 */

/** 33⅓ rpm, in degrees per second. */
export const PLAY_VELOCITY_DEG = (100 / 3 / 60) * 360;

/** A flick cannot spin the record faster than this. */
export const MAX_VELOCITY_DEG = 4000;

export interface PlatterMotion {
  readonly angleDeg: number;
  /** Degrees per second; negative is backwards. */
  readonly velocityDeg: number;
}

/**
 * How hard the motor pulls the record to speed, and how gently a free record
 * coasts down (1/s). Exported so the audio-thread playhead uses the very same feel.
 */
export const MOTOR_RESPONSE = 9;
export const COAST_RESPONSE = 2.2;

/** Below this speed, with the motor off, the record counts as stopped. */
export const REST_VELOCITY_DEG = 0.5;

/**
 * Advance a free-running record (nobody touching it) by `dtSec`.
 * Exponential approach, so the result does not depend on the frame rate.
 */
export function stepPlatter(motion: PlatterMotion, motorOn: boolean, dtSec: number): PlatterMotion {
  const target = motorOn ? PLAY_VELOCITY_DEG : 0;
  const response = motorOn ? MOTOR_RESPONSE : COAST_RESPONSE;
  const blend = 1 - Math.exp(-response * dtSec);
  const velocityDeg = motion.velocityDeg + (target - motion.velocityDeg) * blend;

  return {
    angleDeg: wrapDeg(motion.angleDeg + velocityDeg * dtSec),
    velocityDeg,
  };
}

export function isAtRest(motion: PlatterMotion, motorOn: boolean): boolean {
  return !motorOn && Math.abs(motion.velocityDeg) < REST_VELOCITY_DEG;
}

/** Smallest signed turn from one angle to another, in (-180, 180]. */
export function shortestArcDeg(fromDeg: number, toDeg: number): number {
  const turn = wrapDeg(toDeg - fromDeg);
  return turn > 180 ? turn - 360 : turn;
}

/** Any angle folded into [0, 360). */
export function wrapDeg(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}
