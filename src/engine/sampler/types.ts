import type { PcmAudio } from '../core/types';

/** A drum machine has eight pads. Their order is the same in every kit (see studio/types). */
export const PAD_COUNT = 8;

/** One sound on one pad. */
export interface PadSound {
  /** A short mono or stereo sound at the audio context's sample rate. The bank takes ownership. */
  readonly audio: PcmAudio;
  /**
   * Pads in the same choke group cut each other off, the way closing a hi-hat
   * silences the open one. Leave undefined for a pad that rings freely.
   */
  readonly chokeGroup?: number;
}

/** Everything the rest of the app may do to the bank of pads. */
export interface PadBankControl {
  /** The pads' stereo output, to plug into the mixer. */
  readonly output: AudioNode;

  /** Put a sound on a pad, replacing what was there. null empties the pad. */
  setSound(pad: number, sound: PadSound | null): void;

  /**
   * Play a pad. `velocity` is how hard it was hit, 0 to 1 (default 1). `when`
   * is a time on the audio context's clock; leave it out to play immediately,
   * which is what a finger on a pad needs.
   */
  trigger(pad: number, velocity?: number, when?: number): void;

  /**
   * How recently the pad sounded: 1 at the moment of a hit, fading to 0 over a
   * fraction of a second. For lighting the pad; cheap enough to call every frame.
   * Hits scheduled for the future do not light it until they actually sound.
   */
  glow(pad: number): number;

  /** Level of one pad: 0 = silent, 1 = full (fader travel, not gain). */
  setPadLevel(pad: number, position: number): void;

  /** Stop everything that is sounding or scheduled, without a click. */
  silence(): void;

  dispose(): void;
}
