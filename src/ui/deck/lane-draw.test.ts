import { describe, expect, it } from 'vitest';
import type { DetailPeaks } from '@/analysis/peaks';
import { PLAY_VELOCITY_DEG } from '@/engine/deck/platter';
import { Playhead } from '@/engine/deck/playhead';
import {
  createFollower,
  FOLLOW_PULL,
  FOLLOW_SNAP_SEC,
  followNeedle,
  laneColumns,
  laneWindow,
  movedPosition,
  NO_TRACK,
  trackPixel,
  waveReach,
} from './lane-draw';

/** A track whose slice n has level n / 100: easy to tell which slices a column covers. */
function ramp(slices: number, perSecond: number): DetailPeaks {
  return {
    peaks: new Float32Array(slices).map((_, n) => n / 100),
    perSecond,
    durationSec: slices / perSecond,
  };
}

function columns(
  detail: DetailPeaks,
  pxPerSec: number,
  firstPixel: number,
  loop: boolean,
  count: number,
): number[] {
  const out = new Float32Array(count);
  laneColumns(detail, pxPerSec, firstPixel, loop, out);
  return Array.from(out).map((level) => Number(level.toFixed(4)));
}

describe('trackPixel', () => {
  it('is the whole pixel nearest the needle', () => {
    expect(trackPixel(0, 200)).toBe(0);
    expect(trackPixel(1.5, 200)).toBe(300);
    expect(trackPixel(0.0124, 200)).toBe(2);
    expect(trackPixel(0.0126, 200)).toBe(3);
  });

  it('is zero for nonsense', () => {
    expect(trackPixel(NaN, 200)).toBe(0);
    expect(trackPixel(3, 0)).toBe(0);
    expect(trackPixel(3, NaN)).toBe(0);
  });
});

describe('laneWindow', () => {
  it('keeps "now" in the middle and scrolls the track under it', () => {
    expect(laneWindow(0, 1000, false)).toEqual({ firstPixel: -500, nowX: 500 });
    expect(laneWindow(1234, 1000, false)).toEqual({ firstPixel: 734, nowX: 500 });
    expect(laneWindow(1234, 1001, false)).toEqual({ firstPixel: 734, nowX: 500 });
  });

  it('moves the picture by exactly as far as the needle moved', () => {
    const before = laneWindow(4000, 900, false).firstPixel;
    expect(laneWindow(4003, 900, false).firstPixel - before).toBe(3);
  });

  it('stands still and moves the line when paged', () => {
    expect(laneWindow(0, 1000, true)).toEqual({ firstPixel: 0, nowX: 0 });
    expect(laneWindow(999, 1000, true)).toEqual({ firstPixel: 0, nowX: 999 });
    expect(laneWindow(1000, 1000, true)).toEqual({ firstPixel: 1000, nowX: 0 });
    expect(laneWindow(2345, 1000, true)).toEqual({ firstPixel: 2000, nowX: 345 });
  });

  it('copes with a lane of no width', () => {
    expect(laneWindow(50, 0, false)).toEqual({ firstPixel: 50, nowX: 0 });
    expect(laneWindow(50, 0, true)).toEqual({ firstPixel: 50, nowX: 0 });
  });

  it('reuses the object it is given', () => {
    const out = { firstPixel: 0, nowX: 0 };
    expect(laneWindow(700, 400, false, out)).toBe(out);
    expect(out).toEqual({ firstPixel: 500, nowX: 200 });
  });
});

describe('laneColumns', () => {
  it('shows one slice a column when they are the same size', () => {
    expect(columns(ramp(50, 200), 200, 10, false, 4)).toEqual([0.1, 0.11, 0.12, 0.13]);
  });

  it('keeps the loudest slice under each column when columns are wider', () => {
    // 100 px a second over 200 slices a second: two slices a column.
    expect(columns(ramp(50, 200), 100, 5, false, 3)).toEqual([0.11, 0.13, 0.15]);
    const spike: DetailPeaks = {
      peaks: new Float32Array([0, 0.9, 0, 0, 0, 0]),
      perSecond: 200,
      durationSec: 0.03,
    };
    expect(columns(spike, 100, 0, false, 3)).toEqual([0.9, 0, 0]);
  });

  it('repeats a slice across columns when columns are narrower', () => {
    // 400 px a second over 200 slices a second: two columns a slice.
    expect(columns(ramp(50, 200), 400, 20, false, 4)).toEqual([0.1, 0.1, 0.11, 0.11]);
  });

  it('gives every column the same slices wherever the lane has scrolled to', () => {
    // 125 px a second (a 1.25x screen) over 200 slices a second: an uneven 1.6 slices a column.
    const detail = ramp(100, 200);
    const here = columns(detail, 125, 10, false, 20);
    const scrolled = columns(detail, 125, 13, false, 20);
    expect(scrolled.slice(0, 17)).toEqual(here.slice(3));
  });

  it('marks the columns before the start and after the end of a track', () => {
    expect(columns(ramp(6, 200), 200, -2, false, 10)).toEqual([
      NO_TRACK,
      NO_TRACK,
      0,
      0.01,
      0.02,
      0.03,
      0.04,
      0.05,
      NO_TRACK,
      NO_TRACK,
    ]);
  });

  it('brings a looping track round again at both ends', () => {
    expect(columns(ramp(6, 200), 200, -2, true, 10)).toEqual([
      0.04, 0.05, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0, 0.01,
    ]);
  });

  it('never goes above full scale', () => {
    const hot: DetailPeaks = {
      peaks: new Float32Array([0.5, 3]),
      perSecond: 200,
      durationSec: 0.01,
    };
    expect(columns(hot, 200, 0, false, 2)).toEqual([0.5, 1]);
  });

  it('has no track to show without slices or a sensible scale', () => {
    const none: DetailPeaks = { peaks: new Float32Array(0), perSecond: 0, durationSec: 0 };
    expect(columns(none, 200, 0, false, 3)).toEqual([NO_TRACK, NO_TRACK, NO_TRACK]);
    expect(columns(ramp(10, 200), 0, 0, false, 2)).toEqual([NO_TRACK, NO_TRACK]);
    expect(columns(ramp(10, 200), NaN, 0, true, 2)).toEqual([NO_TRACK, NO_TRACK]);
  });
});

describe('waveReach', () => {
  it('fills the lane at full scale, less the clear edge', () => {
    expect(waveReach(1, 80, 0)).toBe(40);
    expect(waveReach(1, 80, 4)).toBe(36);
    expect(waveReach(0.5, 80, 4)).toBe(18);
  });

  it('keeps silence as the centre line', () => {
    expect(waveReach(0, 80, 4)).toBe(0.5);
    expect(waveReach(-1, 80, 4)).toBe(0.5);
    expect(waveReach(NaN, 80, 4)).toBe(0.5);
    expect(waveReach(1, 6, 4)).toBe(0.5);
  });

  it('never goes above full scale', () => {
    expect(waveReach(7, 80, 4)).toBe(36);
  });
});

describe('movedPosition', () => {
  it('moves by the time given', () => {
    expect(movedPosition(10, 2.5, 60, false)).toBe(12.5);
    expect(movedPosition(10, -2.5, 60, true)).toBe(7.5);
  });

  it('stops at the ends of a track that does not loop', () => {
    expect(movedPosition(1, -5, 60, false)).toBe(0);
    expect(movedPosition(58, 5, 60, false)).toBe(60);
  });

  it('goes round the join of a track that loops', () => {
    expect(movedPosition(1, -5, 60, true)).toBe(56);
    expect(movedPosition(58, 5, 60, true)).toBe(3);
    expect(movedPosition(60, 0, 60, true)).toBe(0);
  });

  it('is zero for an empty deck or nonsense', () => {
    expect(movedPosition(5, 1, 0, false)).toBe(0);
    expect(movedPosition(NaN, 1, 60, false)).toBe(0);
    expect(movedPosition(5, Infinity, 60, true)).toBe(0);
  });
});

describe('followNeedle', () => {
  const DURATION = 60;
  /** How far the record turns in `sec` seconds of music. */
  const turn = (sec: number) => sec * PLAY_VELOCITY_DEG;

  it('shows the first reading as it is', () => {
    const follower = createFollower();
    expect(followNeedle(follower, 12.34, 9999, DURATION, false)).toBe(12.34);
  });

  it('moves by how far the record turned, not by the wobble in the reading', () => {
    const follower = createFollower();
    const frame = 1 / 60;
    followNeedle(follower, 10, turn(10), DURATION, false);
    let worst = 0;
    let last = 10;
    for (let n = 1; n <= 600; n++) {
      const truth = 10 + n * frame;
      // The reading is early or late by up to 8 ms, frame by frame.
      const wobble = (n % 2 === 0 ? 1 : -1) * 0.008;
      const shown = followNeedle(follower, truth + wobble, turn(truth), DURATION, false);
      worst = Math.max(worst, Math.abs(shown - truth));
      // Every step is a frame's worth of music, give or take a tenth of the wobble.
      expect(shown - last).toBeGreaterThan(frame - 0.002);
      expect(shown - last).toBeLessThan(frame + 0.002);
      last = shown;
    }
    expect(worst).toBeLessThan(0.002);
  });

  it('is steadier than the reading it follows, with a real playhead behind it', () => {
    const RATE = 48_000;
    const FRAME_SEC = 1 / 60;
    const playhead = new Playhead(RATE);
    playhead.load(0, DURATION * RATE, false, 1);
    playhead.setMotor(true);

    // The audio thread reports every 16 ms of music, but renders in bursts of 10 ms, so a
    // report reaches the screen up to 10 ms after the moment it describes.
    const reports: { arrivalMs: number; audioSec: number }[] = [];
    for (let audioMs = 16; audioMs < 12_000; audioMs += 16) {
      reports.push({ arrivalMs: Math.ceil(audioMs / 10) * 10, audioSec: audioMs / 1000 });
    }

    const follower = createFollower();
    let next = 0;
    let lastNeedle = 0;
    let lastShown = 0;
    let needleWobble = 0;
    let shownWobble = 0;
    let apart = 0;
    let frames = 0;
    for (let k = 1; k < 600; k++) {
      const nowMs = k * FRAME_SEC * 1000;
      for (; next < reports.length && reports[next]!.arrivalMs <= nowMs; next++) {
        const report = reports[next]!;
        playhead.receive(report.arrivalMs, {
          type: 'state',
          positionFrames: report.audioSec * RATE,
          travelFrames: report.audioSec * RATE,
          velocity: 1,
          moving: true,
          seq: 1,
        });
      }
      const needle = playhead.positionFrames(nowMs) / RATE;
      const shown = followNeedle(follower, needle, playhead.angleDeg(nowMs), DURATION, false);
      // Once the record is up to speed, every frame should move on by a frame's worth of music.
      if (k > 60) {
        needleWobble = Math.max(needleWobble, Math.abs(needle - lastNeedle - FRAME_SEC));
        shownWobble = Math.max(shownWobble, Math.abs(shown - lastShown - FRAME_SEC));
        apart += shown - needle;
        frames += 1;
      }
      lastNeedle = needle;
      lastShown = shown;
    }

    // The reading jumps about by several milliseconds, which is a pixel or two this close up.
    expect(needleWobble).toBeGreaterThan(0.004);
    // What is drawn moves evenly to within a fraction of a pixel,
    expect(shownWobble).toBeLessThan(0.0015);
    // and on average is neither ahead of the needle nor behind it.
    expect(Math.abs(apart / frames)).toBeLessThan(0.0005);
  });

  it('closes a small gap a share at a time', () => {
    const follower = createFollower();
    followNeedle(follower, 10, 0, DURATION, false);
    // The record has not turned, but the deck now says the needle is 20 ms further on.
    const shown = followNeedle(follower, 10.02, 0, DURATION, false);
    expect(shown).toBeCloseTo(10 + 0.02 * FOLLOW_PULL, 9);
    let now = shown;
    for (let n = 0; n < 200; n++) now = followNeedle(follower, 10.02, 0, DURATION, false);
    expect(now).toBeCloseTo(10.02, 6);
  });

  it('shows a real jump at once', () => {
    const follower = createFollower();
    followNeedle(follower, 10, 0, DURATION, false);
    expect(followNeedle(follower, 42, 0, DURATION, false)).toBe(42);
    expect(followNeedle(follower, 42 - FOLLOW_SNAP_SEC * 2, 0, DURATION, false)).toBe(
      42 - FOLLOW_SNAP_SEC * 2,
    );
  });

  it('follows a hand on the record at once, forwards and backwards', () => {
    const follower = createFollower();
    followNeedle(follower, 10, turn(10), DURATION, false);
    // The hand pulls the record back 30 ms; the reading has not caught up yet.
    expect(followNeedle(follower, 10, turn(9.97), DURATION, false)).toBeCloseTo(
      9.97 + 0.03 * FOLLOW_PULL,
      9,
    );
  });

  it('goes round the join of a loop without a jump', () => {
    const follower = createFollower();
    followNeedle(follower, 59.99, turn(59.99), DURATION, true);
    // 20 ms later the needle has wrapped; the record just kept turning.
    const shown = followNeedle(follower, 0.01, turn(60.01), DURATION, true);
    expect(shown).toBeCloseTo(0.01, 9);
  });

  it('stays inside a track that does not loop while the record coasts on', () => {
    const follower = createFollower();
    followNeedle(follower, 59.99, turn(59.99), DURATION, false);
    expect(followNeedle(follower, 60, turn(60.02), DURATION, false)).toBe(60);
    followNeedle(follower, 0, turn(60.02), DURATION, false);
    expect(followNeedle(follower, 0, turn(60), DURATION, false)).toBe(0);
  });

  it('starts again after it is unlocked', () => {
    const follower = createFollower();
    followNeedle(follower, 10, 0, DURATION, false);
    follower.locked = false;
    expect(followNeedle(follower, 10.01, 0, DURATION, false)).toBe(10.01);
  });

  it('is zero for an empty deck or nonsense, and starts again afterwards', () => {
    const follower = createFollower();
    followNeedle(follower, 10, 0, DURATION, false);
    expect(followNeedle(follower, NaN, 0, DURATION, false)).toBe(0);
    expect(followNeedle(follower, 5, 0, 0, false)).toBe(0);
    expect(followNeedle(follower, 7, 0, DURATION, false)).toBe(7);
  });
});
