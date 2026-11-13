/**
 * Turns a starter song into PCM on the device: no download, no audio files.
 *
 * Synthesis is plain TypeScript rather than an OfflineAudioContext, for three
 * reasons: the result is bit-for-bit the same in every browser (Web Audio's
 * filters and oscillators differ between engines), the same code runs in a
 * worker or in Node tests, and the loudness, peak and seam are checked by unit
 * tests instead of by ear alone.
 */

import type { LoadedTrack } from '../types';
import { TrackLoadError } from '../types';
import type { MasterReport } from '@/synth/dsp';
import { addPingPongLoop, addReverbLoop, highpassLoop, masterLoop } from '@/synth/dsp';
import { SONGS } from './songs';
import { Studio } from './studio';
import { CRATE_BARS, CRATE_BPM, CRATE_TRACKS } from './tracks';

/** About -16 dBFS RMS: loud enough to feel full, with room for the kick to breathe. */
export const TARGET_RMS = 10 ** (-16 / 20);
/** Every sample stays at or below this (about -1.1 dBFS; the spec allows 0.89). */
export const CEILING = 0.88;

export interface CrateRender {
  readonly track: LoadedTrack;
  readonly report: MasterReport;
}

/** Lets the page draw a frame between the heavier stages of a render. */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Renders a song with its mastering report (for tests and diagnostics). */
export async function renderCrateTrackWithReport(
  id: string,
  sampleRate: number,
): Promise<CrateRender> {
  const meta = CRATE_TRACKS.find((track) => track.ref.id === id);
  const song = Object.hasOwn(SONGS, id) ? SONGS[id] : undefined;
  if (!meta || !song || !Number.isFinite(sampleRate) || sampleRate < 8000) {
    throw new TrackLoadError('failed', id);
  }

  const studio = new Studio(sampleRate, CRATE_BPM, CRATE_BARS, id);
  song.compose(studio);
  await breathe();

  const { left, right } = studio;
  addReverbLoop(studio.verbSend, left, right, sampleRate, song.verb);
  addPingPongLoop(studio.echoSend, left, right, sampleRate, {
    ...song.echo,
    delaySec: studio.stepsToSec(song.echo.steps),
  });
  await breathe();

  highpassLoop(left, sampleRate, 25);
  highpassLoop(right, sampleRate, 25);
  const report = masterLoop(left, right, sampleRate, { targetRms: TARGET_RMS, ceiling: CEILING });

  return {
    track: { meta, audio: { sampleRate, channels: [left, right] }, loop: true },
    report,
  };
}

/**
 * Renders one of CRATE_TRACKS at the audio context's sample rate. The two
 * channels are new arrays the caller owns outright. Rejects with
 * TrackLoadError('failed') for an unknown id.
 */
export async function renderCrateTrack(id: string, sampleRate: number): Promise<LoadedTrack> {
  return (await renderCrateTrackWithReport(id, sampleRate)).track;
}
