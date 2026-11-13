import type { PcmAudio } from '@/engine/core/types';

/** Enough detail for a whole-track overview on the widest deck, small enough to keep per track. */
export const DEFAULT_PEAK_BUCKETS = 600;

export interface WaveformPeaks {
  /** Loudest absolute sample in each slice of the track, 0..1, left and right combined. */
  readonly peaks: Float32Array;
  readonly durationSec: number;
}

/**
 * Summarise a track for drawing. Must be called BEFORE the audio is handed to a
 * deck (that moves the samples away).
 *
 * The track is cut into `buckets` equal slices and each keeps its loudest
 * sample, so a single drum hit is never averaged away. If there are more
 * slices than frames, each slice shows the frame it falls on. A NaN sample
 * counts as silence; anything beyond full scale is shown as full scale.
 */
export function computePeaks(audio: PcmAudio, buckets = DEFAULT_PEAK_BUCKETS): WaveformPeaks {
  const count =
    Number.isFinite(buckets) && buckets >= 1 ? Math.floor(buckets) : DEFAULT_PEAK_BUCKETS;
  const peaks = new Float32Array(count);
  const frames = audio.channels[0]?.length ?? 0;
  if (frames === 0) return { peaks, durationSec: 0 };

  // One channel at a time keeps the reads sequential through memory, which is what makes
  // a long track fast; the slices are then combined across channels by taking the louder.
  for (const channel of audio.channels) {
    const length = Math.min(channel.length, frames);
    for (let b = 0; b < count; b++) {
      const start = Math.floor((b * frames) / count);
      const end = Math.min(Math.max(Math.floor(((b + 1) * frames) / count), start + 1), length);
      let loudest = peaks[b]!;
      for (let i = start; i < end; i++) {
        const sample = channel[i]!;
        // NaN fails both comparisons, so it never raises the peak.
        const level = sample < 0 ? -sample : sample;
        if (level > loudest) loudest = level;
      }
      peaks[b] = loudest;
    }
  }

  for (let b = 0; b < count; b++) {
    if (peaks[b]! > 1) peaks[b] = 1;
  }

  const durationSec = audio.sampleRate > 0 ? frames / audio.sampleRate : 0;
  return { peaks, durationSec };
}
