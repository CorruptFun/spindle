import type { DeckCapabilities, PcmAudio } from '@/engine/core/types';

export type SourceId = 'crate' | 'local' | 'apple-music' | 'spotify';

/**
 * How a source's audio reaches the listener.
 * - `pcm`: we decode or render the audio ourselves and the engine owns every sample.
 * - `opaque`: the service's own player plays a protected stream. The app can
 *   start, stop and seek it, and never sees the audio.
 */
export type AudioPath = 'pcm' | 'opaque';

export interface SourceDescriptor {
  readonly id: SourceId;
  readonly label: string;
  readonly audioPath: AudioPath;
  readonly capabilities: DeckCapabilities;
  /** What the listener needs before this source works, in plain words. */
  readonly requires: readonly string[];
}

/** A track, wherever it lives. `id` is only meaningful to its own source. */
export interface TrackRef {
  readonly source: SourceId;
  readonly id: string;
}

/** A simple shape that stands for a track, so it can be picked without reading. */
export type TrackGlyph = 'circle' | 'triangle' | 'square' | 'star' | 'note';

export interface TrackMeta {
  readonly ref: TrackRef;
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
  readonly durationSec?: number;
  readonly artworkUrl?: string;
  /** Defaults to `note` where a source has nothing better. */
  readonly glyph?: TrackGlyph;
  readonly bpm?: number;
}

/** A track that is decoded and ready to go on a deck. */
export interface LoadedTrack {
  readonly meta: TrackMeta;
  readonly audio: PcmAudio;
  /** True for material made to play round and round (the starter songs). */
  readonly loop: boolean;
}

export type TrackLoadFailure =
  /** Not an audio format this browser can decode. */
  | 'unsupported'
  /** Copy-protected, such as a song downloaded with a streaming subscription. */
  | 'protected'
  /** Longer than the app will hold in memory. */
  | 'too-long'
  | 'failed';

export class TrackLoadError extends Error {
  readonly reason: TrackLoadFailure;
  readonly trackName: string;

  constructor(reason: TrackLoadFailure, trackName: string) {
    super(`Could not load "${trackName}" (${reason})`);
    this.name = 'TrackLoadError';
    this.reason = reason;
    this.trackName = trackName;
  }
}
