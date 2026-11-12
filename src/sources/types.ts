import type { DeckCapabilities } from '@/engine/core/types';

export type SourceId = 'local' | 'apple-music' | 'spotify';

/**
 * How a source's audio reaches the listener.
 * - `pcm`: we decode the file ourselves and the engine owns every sample.
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

export interface TrackMeta {
  readonly ref: TrackRef;
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
  readonly durationSec?: number;
  readonly artworkUrl?: string;
}
