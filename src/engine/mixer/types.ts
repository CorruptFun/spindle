import type { DeckId } from '../core/types';
import type { CrossfaderCurve } from './crossfader';

/** Everything the rest of the app may do to the mixer. */
export interface MixerControl {
  /** Where a deck's output plugs in. */
  input(deck: DeckId): AudioNode;
  /** Where the drum pads plug in. They join the mix after the crossfader, so it never fades them. */
  readonly padsInput: AudioNode;
  /** The finished mix, after the limiter. The engine connects this to the speakers. */
  readonly output: AudioNode;

  /** Channel fader travel: 0 = bottom (silent), 1 = top (full). */
  setChannelFader(deck: DeckId, position: number): void;
  /** 0 = hard left, 0.5 = centre, 1 = hard right. */
  setCrossfader(position: number): void;
  setCrossfaderCurve(curve: CrossfaderCurve): void;
  /** Level of the drum pads as a whole: 0 = silent, 1 = full. */
  setPadsLevel(position: number): void;
  /** Master volume travel: 0 = silent, 1 = full. */
  setMasterVolume(position: number): void;

  /**
   * Peak level of a channel after its fader and the crossfader, where 1 is
   * full scale. For meters: call from a frame loop, never from React state.
   */
  channelLevel(deck: DeckId): number;
  /** Peak level of the drum pads after their level control. */
  padsLevel(): number;
  /** Peak level of the finished mix, after the limiter. */
  masterLevel(): number;

  dispose(): void;
}
