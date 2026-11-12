/**
 * Messages between a Deck on the main thread and its player on the audio
 * thread. Shared by both sides, so it must stay free of DOM types.
 */

/** The name the deck player processor is registered under. */
export const DECK_PLAYER_PROCESSOR = 'deck-player';

/** How often a moving deck reports where it is. About one screen frame. */
export const REPORT_INTERVAL_SEC = 0.015;

/**
 * Commands from the main thread. `seq` numbers the commands that move the
 * needle (load, eject, seek) so a report sent before one of them took effect
 * can be told apart from one sent after.
 */
export type DeckCommand =
  | {
      readonly type: 'load';
      readonly left: Float32Array;
      /** Null for a mono track: the left channel feeds both outputs. */
      readonly right: Float32Array | null;
      readonly loop: boolean;
      readonly seq: number;
    }
  | { readonly type: 'eject'; readonly seq: number }
  | { readonly type: 'seek'; readonly frames: number; readonly seq: number }
  | { readonly type: 'motor'; readonly on: boolean }
  | { readonly type: 'grab' }
  /** The hand turned the record by this many frames of audio since the last message. */
  | { readonly type: 'hand'; readonly deltaFrames: number }
  /** The hand let go. `velocity` is a speed ratio: 1 is normal play, negative is backwards. */
  | { readonly type: 'release'; readonly velocity: number }
  /** Stop processing for good so the node can be collected. */
  | { readonly type: 'dispose' };

/**
 * Where the record is. Not readonly: the audio thread fills one preallocated
 * report and posts it, rather than building a new object every few blocks.
 */
export interface DeckStateReport {
  type: 'state';
  /** Needle position in frames. Jumps on seek, load and loop wrap. */
  positionFrames: number;
  /** Total distance the record has turned, in frames. Never jumps; drives the picture. */
  travelFrames: number;
  /** Speed ratio: 1 is normal play, negative is backwards. */
  velocity: number;
  /** False once the record is still, nobody holds it and the motor is off. */
  moving: boolean;
  /** The last load / eject / seek `seq` that has taken effect. */
  seq: number;
}

/** A track that does not loop reached its end; the motor has been switched off. */
export interface DeckEndedEvent {
  readonly type: 'ended';
}

export type DeckEvent = DeckStateReport | DeckEndedEvent;
