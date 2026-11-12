/**
 * How a level meter moves. Pure, so it can be tested without a screen.
 *
 * The meter works in its own display scale: 0 is the bottom, 1 is full scale,
 * and the scale is linear in decibels between METER_FLOOR_DB and 0 dB, the way
 * the ear hears loudness. In that scale a peak meter is simple: it jumps up at
 * once (so no peak is ever hidden) and falls at a steady number of decibels per
 * second (so it can be read). Every rate is per second, never per frame, so a
 * 120 Hz screen and a 30 Hz one show the same thing.
 */

/** The quietest level the meter shows. Anything quieter reads as silence. */
export const METER_FLOOR_DB = -48;

/** How fast the bar falls once the sound gets quieter. */
export const METER_RELEASE_DB_PER_SEC = 26;

/** How long the peak mark waits at the loudest recent level before it falls. */
export const PEAK_HOLD_SEC = 0.9;

/** How fast the peak mark falls after waiting. Slower than the bar, so it stays readable. */
export const PEAK_RELEASE_DB_PER_SEC = 14;

export interface MeterState {
  /** Height of the bar, 0..1 in the meter's scale. */
  readonly level: number;
  /** Height of the peak mark, 0..1. Never below `level`. */
  readonly peak: number;
  /** Seconds the peak mark still waits before falling. */
  readonly holdSec: number;
}

export const METER_REST: MeterState = { level: 0, peak: 0, holdSec: 0 };

const RELEASE_PER_SEC = METER_RELEASE_DB_PER_SEC / -METER_FLOOR_DB;
const PEAK_RELEASE_PER_SEC = PEAK_RELEASE_DB_PER_SEC / -METER_FLOOR_DB;

/** A linear peak level (1 = full scale) as a height on the meter, 0..1. */
export function meterPosition(peak: number): number {
  const magnitude = Math.abs(peak);
  if (!Number.isFinite(magnitude) || magnitude <= 0) return 0;
  const db = 20 * Math.log10(magnitude);
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

/** A height on the meter back to decibels. The bottom of the scale is -Infinity. */
export function meterDb(position: number): number {
  return position <= 0 ? -Infinity : METER_FLOOR_DB * (1 - Math.min(1, position));
}

/**
 * Advance the meter by `dtSec` with a new linear peak reading. Instant attack,
 * linear-in-dB release, and a peak mark that holds, then falls.
 */
export function stepMeter(state: MeterState, peak: number, dtSec: number): MeterState {
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
  const input = meterPosition(peak);

  const level = Math.max(input, state.level - RELEASE_PER_SEC * dt);

  if (level >= state.peak) {
    return { level, peak: level, holdSec: PEAK_HOLD_SEC };
  }

  // Only the part of this step after the hold ran out moves the mark, so the
  // result is the same however the time is cut into frames.
  const fallingSec = Math.max(0, dt - state.holdSec);
  const holdSec = Math.max(0, state.holdSec - dt);
  const peakNow = Math.max(level, state.peak - PEAK_RELEASE_PER_SEC * fallingSec);
  return { level, peak: peakNow, holdSec };
}

/** True when there is nothing left to draw: the bar and the mark are both at the bottom. */
export function isMeterAtRest(state: MeterState): boolean {
  return state.level <= 0 && state.peak <= 0;
}
