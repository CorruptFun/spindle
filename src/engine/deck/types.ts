import type { DeckId, PcmAudio } from '../core/types';

/**
 * What the record on screen needs from a deck. The deck is the single source
 * of truth for where the record is, so picture and sound cannot drift apart.
 */
export interface PlatterControl {
  /** The record's angle right now, in degrees. Unbounded and continuous: it never jumps. */
  angleDeg(): number;
  /** False when the record is still and nobody is holding it, so a drawing loop can sleep. */
  isMoving(): boolean;
  /** A hand lands on the record. The motor no longer drives it until `release`. */
  grab(): void;
  /** The hand has turned the record by `deltaDeg` (clockwise positive) since the last call. */
  dragBy(deltaDeg: number): void;
  /**
   * The hand lifts off. `throwVelocityDeg` is how fast it was turning at that
   * moment, in degrees per second (0 when it was holding the record still).
   */
  release(throwVelocityDeg: number): void;
}

export interface DeckLoadOptions {
  /** Play round and round instead of stopping at the end. */
  readonly loop?: boolean;
}

/** Everything the rest of the app may do to a deck. */
export interface DeckControl extends PlatterControl {
  readonly id: DeckId;
  /** The deck's stereo output, to plug into the mixer. */
  readonly output: AudioNode;

  /**
   * Put a track on the deck, replacing whatever was there, and return to the
   * start. The motor is left as it was: a spinning deck plays the new track
   * straight away. The deck takes ownership of `audio`'s sample arrays.
   */
  load(audio: PcmAudio, options?: DeckLoadOptions): void;
  eject(): void;
  readonly loaded: boolean;

  /** Start or stop the motor. The record takes a moment to reach speed, or to coast down. */
  setMotor(on: boolean): void;
  readonly motorOn: boolean;

  /** Jump to a position in the track. Out-of-range values are clamped. */
  seek(positionSec: number): void;
  /** Where the needle is, in seconds. Cheap enough to call every frame. */
  positionSec(): number;
  /** Length of the loaded track in seconds; 0 when the deck is empty. */
  durationSec(): number;

  /** Called when a track that does not loop reaches its end. The motor has been switched off. */
  onEnded: (() => void) | null;

  /** Disconnect and free the deck. */
  dispose(): void;
}
