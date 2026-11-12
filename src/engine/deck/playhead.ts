/**
 * The main thread's view of a deck's playhead. The audio thread reports where
 * the record is every few milliseconds; between reports this estimates the
 * position and the record's angle, so a drawing loop can ask every frame.
 *
 * The angle follows the record's total travel, which never jumps (seek, load
 * and loop wraps move the needle, not the record). Wherever an estimate has to
 * be corrected, the difference is eased out instead of shown as a jump, so the
 * picture stays continuous and still converges on what the audio is doing.
 * Pure: time comes in as an argument, so tests need no clock and no Web Audio.
 */
import type { DeckStateReport } from '../worklets/protocol';
import { PLAY_VELOCITY_DEG } from './platter';

/** Never extrapolate further than this past a report; a stalled audio thread freezes the picture. */
export const EXTRAPOLATE_CAP_MS = 50;

/** How quickly a correction to the picture is eased out. */
export const CORRECTION_TAU_MS = 100;

/** Corrections smaller than this (degrees) are simply kept, and the record may rest. */
const CORRECTION_EPS_DEG = 0.01;

export class Playhead {
  private readonly sampleRate: number;

  private loaded = false;
  private loop = false;
  private durationFrames = 0;
  private motorOn = false;

  /** Last known state, and when it was true (ms on the caller's clock). */
  private basePosition = 0;
  private baseTravel = 0;
  private baseMs = 0;
  private velocity = 0;
  private reportedMoving = false;
  /** Reports older than this still describe the needle before the latest seek / load / eject. */
  private expectedSeq = 0;

  private held = false;
  private heldAngleDeg = 0;

  private offsetDeg = 0;
  private correctionDeg = 0;
  private correctionMs = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate > 0 && Number.isFinite(sampleRate) ? sampleRate : 48000;
  }

  get isHeld(): boolean {
    return this.held;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** The record's angle in degrees: unbounded and continuous. */
  angleDeg(nowMs: number): number {
    return this.held ? this.heldAngleDeg : this.freeAngleDeg(nowMs);
  }

  isMoving(nowMs: number): boolean {
    if (this.held || this.motorOn || this.reportedMoving) return true;
    // Still easing a correction: keep drawing until it is done.
    return Math.abs(this.correction(nowMs)) > CORRECTION_EPS_DEG;
  }

  /** Needle position in frames. 0 when empty; clamped to the track, or wrapped when it loops. */
  positionFrames(nowMs: number): number {
    if (!this.loaded) return 0;
    const raw = this.rawPosition(nowMs);
    const length = this.durationFrames;
    if (length <= 0) return 0;
    if (this.loop) return raw - Math.floor(raw / length) * length;
    return Math.min(Math.max(raw, 0), length);
  }

  /** Track length in frames; 0 when empty. */
  get duration(): number {
    return this.durationFrames;
  }

  receive(nowMs: number, report: DeckStateReport): void {
    if (
      !Number.isFinite(report.positionFrames) ||
      !Number.isFinite(report.travelFrames) ||
      !Number.isFinite(report.velocity)
    ) {
      return;
    }
    const angleBefore = this.freeAngleDeg(nowMs);
    const positionBefore = this.rawPosition(nowMs);

    this.baseTravel = report.travelFrames;
    this.velocity = report.velocity;
    this.reportedMoving = report.moving;
    this.baseMs = nowMs;
    // A report sent before our latest jump took effect would drag the needle back for a moment.
    this.basePosition = report.seq >= this.expectedSeq ? report.positionFrames : positionBefore;

    if (!this.held) this.easeFrom(nowMs, angleBefore);
  }

  setMotor(on: boolean): void {
    this.motorOn = on;
  }

  /** A track that does not loop reached its end; the audio thread switched the motor off. */
  ended(): void {
    this.motorOn = false;
  }

  grab(nowMs: number): void {
    if (this.held) return;
    this.heldAngleDeg = this.freeAngleDeg(nowMs);
    this.held = true;
  }

  /** Turn the held record by `deltaDeg`. Returns the same turn in frames of audio, or 0 if not held. */
  dragBy(deltaDeg: number): number {
    if (!this.held || !Number.isFinite(deltaDeg)) return 0;
    this.heldAngleDeg += deltaDeg;
    return (deltaDeg / PLAY_VELOCITY_DEG) * this.sampleRate;
  }

  /** The hand lifts off at `velocity` (speed ratio). */
  release(nowMs: number, velocity: number): void {
    if (!this.held) return;
    this.rebase(nowMs, this.rawPosition(nowMs));
    this.velocity = Number.isFinite(velocity) ? velocity : 0;
    this.reportedMoving = true;
    this.held = false;
    this.easeFrom(nowMs, this.heldAngleDeg);
  }

  seek(nowMs: number, frames: number, seq: number): void {
    this.expectedSeq = seq;
    this.rebase(nowMs, frames);
  }

  load(nowMs: number, durationFrames: number, loop: boolean, seq: number): void {
    this.loaded = true;
    this.loop = loop;
    this.durationFrames = Math.max(0, durationFrames);
    this.seek(nowMs, 0, seq);
  }

  eject(nowMs: number, seq: number): void {
    this.loaded = false;
    this.loop = false;
    this.durationFrames = 0;
    this.seek(nowMs, 0, seq);
  }

  /** Restart extrapolation at `nowMs` with the needle at `position`. The record's travel is untouched. */
  private rebase(nowMs: number, position: number): void {
    this.baseTravel = this.rawTravel(nowMs);
    this.basePosition = position;
    this.baseMs = nowMs;
  }

  /** Make the picture show `angleDeg` right now, then ease towards the estimate. */
  private easeFrom(nowMs: number, angleDeg: number): void {
    this.correctionDeg = angleDeg - this.estimateAngleDeg(nowMs);
    this.correctionMs = nowMs;
  }

  private freeAngleDeg(nowMs: number): number {
    // Correction first: it may fold its last sliver into the offset the estimate uses.
    const correction = this.correction(nowMs);
    return this.estimateAngleDeg(nowMs) + correction;
  }

  private estimateAngleDeg(nowMs: number): number {
    return (this.rawTravel(nowMs) / this.sampleRate) * PLAY_VELOCITY_DEG + this.offsetDeg;
  }

  private correction(nowMs: number): number {
    if (this.correctionDeg === 0) return 0;
    const elapsed = Math.max(0, nowMs - this.correctionMs);
    const remaining = this.correctionDeg * Math.exp(-elapsed / CORRECTION_TAU_MS);
    if (Math.abs(remaining) <= CORRECTION_EPS_DEG) {
      // Keep the last sliver for good rather than letting the picture creep while at rest.
      this.offsetDeg += remaining;
      this.correctionDeg = 0;
      return 0;
    }
    return remaining;
  }

  private elapsedFrames(nowMs: number): number {
    const elapsedMs = Math.min(Math.max(nowMs - this.baseMs, 0), EXTRAPOLATE_CAP_MS);
    return this.velocity * this.sampleRate * (elapsedMs / 1000);
  }

  private rawTravel(nowMs: number): number {
    return this.baseTravel + this.elapsedFrames(nowMs);
  }

  private rawPosition(nowMs: number): number {
    return this.basePosition + this.elapsedFrames(nowMs);
  }
}
