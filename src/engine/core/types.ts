export type DeckId = 'A' | 'B' | 'C' | 'D';

export const DECK_IDS: readonly DeckId[] = ['A', 'B', 'C', 'D'];

export type TransportState = 'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

/**
 * Decoded audio that the engine owns outright. Whoever hands one to a deck
 * gives up the sample arrays: they are moved to the audio thread, not copied.
 */
export interface PcmAudio {
  /** Must equal the audio context's sample rate; decode and render at that rate. */
  readonly sampleRate: number;
  /** One channel (mono) or two (left, right), all the same length. */
  readonly channels: readonly Float32Array[];
}

export function pcmFrames(audio: PcmAudio): number {
  return audio.channels[0]?.length ?? 0;
}

export function pcmDurationSec(audio: PcmAudio): number {
  return pcmFrames(audio) / audio.sampleRate;
}

/**
 * What can be done with the track that is loaded on a deck.
 *
 * Capabilities come from where the audio came from, not from the deck: a file
 * the listener owns can do everything, a protected stream can do very little
 * (docs/STREAMING.md). The UI and controllers must ask before offering a
 * control, so an unavailable feature is hidden instead of silently broken.
 */
export interface DeckCapabilities {
  /** Play, pause and seek. */
  readonly transport: boolean;
  /** Level can be set by the app. */
  readonly volume: boolean;
  /** May sound at the same time as other audio (crossfading, layering pads). */
  readonly overlap: boolean;
  /** Playback speed can change (tempo fader, nudge, sync). */
  readonly tempo: boolean;
  /** The playhead can be moved by hand (scratch, spin-back, reverse). */
  readonly scratch: boolean;
  /** Tempo can change without changing pitch. */
  readonly keyLock: boolean;
  /** Audio passes through the mixer strip (trim, EQ, filter). */
  readonly eq: boolean;
  /** Audio can be sent through effects. */
  readonly fx: boolean;
  /** Decoded audio is available to draw a waveform. */
  readonly waveform: boolean;
  /** Decoded audio is available for BPM, beat-grid and key detection. */
  readonly analysis: boolean;
  /** Hot cues, loops and beat jump (need a sample-accurate playhead). */
  readonly cuesAndLoops: boolean;
  /** May be captured in a recorded mix. */
  readonly record: boolean;
}

/** Everything on: decoded audio the engine fully controls. */
export const FULL_CAPABILITIES: DeckCapabilities = {
  transport: true,
  volume: true,
  overlap: true,
  tempo: true,
  scratch: true,
  keyLock: true,
  eq: true,
  fx: true,
  waveform: true,
  analysis: true,
  cuesAndLoops: true,
  record: true,
};

/**
 * Listen-only: a protected stream played by its own service's player. One song
 * at a time, nothing layered on top, nothing altered.
 */
export const LISTEN_ONLY_CAPABILITIES: DeckCapabilities = {
  transport: true,
  volume: true,
  overlap: false,
  tempo: false,
  scratch: false,
  keyLock: false,
  eq: false,
  fx: false,
  waveform: false,
  analysis: false,
  cuesAndLoops: false,
  record: false,
};
