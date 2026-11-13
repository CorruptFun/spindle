import { describe, expect, it } from 'vitest';
import { TrackLoadError } from '../types';
import { peak, rms } from '@/synth/dsp';
import { CEILING, renderCrateTrack, renderCrateTrackWithReport, TARGET_RMS } from './render';
import { loopFrames, stepFrame } from './sequence';
import { CRATE_BARS, CRATE_BPM, CRATE_TRACKS } from './tracks';

// A lower rate keeps the suite quick; the maths is rate-independent.
const RATE = 22050;
const db = (gain: number): number => 20 * Math.log10(gain);

const renders = Promise.all(
  CRATE_TRACKS.map((track) => renderCrateTrackWithReport(track.ref.id, RATE)),
);

describe('renderCrateTrack', () => {
  it('rejects an unknown song with TrackLoadError', async () => {
    await expect(renderCrateTrack('nope', RATE)).rejects.toBeInstanceOf(TrackLoadError);
    await expect(renderCrateTrack('nope', RATE)).rejects.toMatchObject({ reason: 'failed' });
    await expect(renderCrateTrack('toString', RATE)).rejects.toBeInstanceOf(TrackLoadError);
  });

  it('renders a looping stereo track of exactly 16 bars', async () => {
    for (const { track } of await renders) {
      expect(track.loop).toBe(true);
      expect(track.audio.sampleRate).toBe(RATE);
      expect(track.audio.channels).toHaveLength(2);
      const frames = loopFrames(CRATE_BARS, CRATE_BPM, RATE);
      for (const channel of track.audio.channels) {
        expect(channel).toBeInstanceOf(Float32Array);
        expect(channel.length).toBe(frames);
        expect(channel.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('stays under the peak ceiling at a steady loudness', async () => {
    const levels: number[] = [];
    for (const { track, report } of await renders) {
      const { channels } = track.audio;
      expect(peak(channels)).toBeLessThanOrEqual(CEILING);
      levels.push(db(rms(channels)));
      // Limiting should shave peaks, not squash the song.
      expect(db(report.minLimiterGain)).toBeGreaterThan(-6);
    }
    for (const level of levels) expect(Math.abs(level - db(TARGET_RMS))).toBeLessThan(0.5);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(1.5);
  });

  it('loops without a jump at the seam', async () => {
    for (const { track } of await renders) {
      for (const channel of track.audio.channels) {
        const seam = Math.abs(channel[0]! - channel[channel.length - 1]!);
        let typical = 0;
        for (let i = 1; i < channel.length; i++) typical += Math.abs(channel[i]! - channel[i - 1]!);
        typical /= channel.length - 1;
        expect(seam).toBeLessThan(Math.max(0.02, typical * 8));
      }
    }
  });

  it('makes sound within the first beat', async () => {
    const beat = stepFrame(4, CRATE_BPM, RATE);
    for (const { track } of await renders) {
      const firstBeat = track.audio.channels.map((c) => c.subarray(0, beat));
      expect(db(rms(firstBeat))).toBeGreaterThan(db(TARGET_RMS) - 10);
    }
  });

  it('keeps the low end in the middle', async () => {
    for (const { track } of await renders) {
      const [left, right] = track.audio.channels as [Float32Array, Float32Array];
      let side = 0;
      let mid = 0;
      for (let i = 0; i < left.length; i++) {
        mid += (left[i]! + right[i]!) ** 2;
        side += (left[i]! - right[i]!) ** 2;
      }
      expect(side).toBeLessThan(mid * 0.25);
    }
  });

  it('renders the same samples every time, into fresh arrays', async () => {
    const id = CRATE_TRACKS[0]!.ref.id;
    const a = await renderCrateTrack(id, RATE);
    const b = await renderCrateTrack(id, RATE);
    expect(a.audio.channels[0]).not.toBe(b.audio.channels[0]);
    expect(a.audio.channels[0]).toEqual(b.audio.channels[0]);
    expect(a.audio.channels[1]).toEqual(b.audio.channels[1]);
  });
});
