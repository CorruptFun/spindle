/**
 * The geometry of the close-up, scrolling waveform, kept apart from the canvas
 * so it can be tested. Columns are device pixels: whole numbers, so the
 * picture moves by whole pixels and stays sharp.
 */
import type { DetailPeaks } from '@/analysis/peaks';
import { PLAY_VELOCITY_DEG } from '@/engine/deck/platter';
import { clamp } from '@/lib/audio-math';

/** How far the lane is zoomed in: CSS pixels for each second of music. About four bars across a laptop. */
export const LANE_PX_PER_SEC = 100;

/** A column with no track under it: before the start of a track, or after its end. */
export const NO_TRACK = -1;

/**
 * The track laid out as one long row of pixels, and the one the needle is on.
 * A whole number: every column of the lane then always covers the same slices
 * of the track, wherever it has scrolled to, so the picture does not shimmer.
 */
export function trackPixel(positionSec: number, pxPerSec: number): number {
  if (!Number.isFinite(positionSec) || !(pxPerSec > 0)) return 0;
  return Math.round(positionSec * pxPerSec);
}

/** Which part of the track the lane shows, and where in the lane "now" is. */
export interface LaneWindow {
  /** The track pixel in the lane's first column. */
  firstPixel: number;
  /** The column of the "now" line. */
  nowX: number;
}

/**
 * The lane's view when the needle is on `nowPixel`. Normally the track scrolls
 * under a "now" line fixed in the middle. `paged` is for people who have asked
 * for less motion: the picture stands still and the line crosses it, a
 * lane-width of the track at a time. Writes into `out` (and returns it), so the
 * drawing loop can reuse one object every frame.
 */
export function laneWindow(
  nowPixel: number,
  widthPx: number,
  paged: boolean,
  out: LaneWindow = { firstPixel: 0, nowX: 0 },
): LaneWindow {
  const width = Math.max(0, Math.floor(widthPx));
  if (paged && width > 0) {
    out.firstPixel = Math.floor(nowPixel / width) * width;
    out.nowX = nowPixel - out.firstPixel;
  } else {
    out.nowX = Math.floor(width / 2);
    out.firstPixel = nowPixel - out.nowX;
  }
  return out;
}

/**
 * The level (0..1) of every column of the lane, starting at track pixel
 * `firstPixel`: the loudest slice the column covers, so a short hit is never
 * lost between columns. Columns off either end of the track get NO_TRACK,
 * unless the track loops: then it comes round again. Writes into `out`, one
 * entry for each column.
 */
export function laneColumns(
  detail: DetailPeaks,
  pxPerSec: number,
  firstPixel: number,
  loop: boolean,
  out: Float32Array,
): void {
  const { peaks } = detail;
  const slices = peaks.length;
  const slicesPerPixel = detail.perSecond / pxPerSec;
  if (slices === 0 || !(slicesPerPixel > 0) || !Number.isFinite(slicesPerPixel)) {
    out.fill(NO_TRACK);
    return;
  }

  for (let x = 0; x < out.length; x++) {
    const pixel = firstPixel + x;
    let start = Math.floor(pixel * slicesPerPixel);
    // A column narrower than a slice shows the slice it falls in.
    let end = Math.max(Math.floor((pixel + 1) * slicesPerPixel), start + 1);
    if (!loop) {
      if (end <= 0 || start >= slices) {
        out[x] = NO_TRACK;
        continue;
      }
      if (start < 0) start = 0;
      if (end > slices) end = slices;
    }
    let loudest = 0;
    for (let s = start; s < end; s++) {
      const level = peaks[loop ? s - Math.floor(s / slices) * slices : s]!;
      if (level > loudest) loudest = level;
    }
    out[x] = loudest > 1 ? 1 : loudest;
  }
}

/**
 * How far the waveform reaches above and below the centre line for a level
 * (0..1), in a lane `heightPx` tall that keeps `padPx` clear at top and
 * bottom. Never less than half a pixel: silence still draws the centre line,
 * which shows where there is track and where there is none.
 */
export function waveReach(level: number, heightPx: number, padPx: number): number {
  const most = Math.max(0, heightPx / 2 - Math.max(0, padPx));
  return Math.max(0.5, (level > 0 ? Math.min(level, 1) : 0) * most);
}

/**
 * The position `bySec` away from `positionSec`: kept inside the track, or
 * taken round the join when the track loops.
 */
export function movedPosition(
  positionSec: number,
  bySec: number,
  durationSec: number,
  loop: boolean,
): number {
  if (!(durationSec > 0) || !Number.isFinite(positionSec) || !Number.isFinite(bySec)) return 0;
  const target = positionSec + bySec;
  if (loop) return target - Math.floor(target / durationSec) * durationSec;
  return clamp(target, 0, durationSec);
}

/**
 * A gap between where the lane shows the needle and where the deck says it is
 * that is bigger than this is a real jump (a seek, a new place in the track):
 * show it at once.
 */
export const FOLLOW_SNAP_SEC = 0.05;

/** The share of a smaller gap that is closed each frame. */
export const FOLLOW_PULL = 0.1;

/** What the lane remembers from one frame to the next. */
export interface LaneFollower {
  /** Where the lane shows the needle, in seconds. */
  positionSec: number;
  /** The record's angle when that was worked out. */
  angleDeg: number;
  /** False until the first reading, and whenever the next one should be shown as it is. */
  locked: boolean;
}

export function createFollower(): LaneFollower {
  return { positionSec: 0, angleDeg: 0, locked: false };
}

/**
 * Where to draw the needle this frame.
 *
 * The deck's needle position is an estimate between reports from the audio
 * thread, and wobbles by a few milliseconds: nothing on a whole-track
 * overview, a visible judder on a waveform this close up. The record's angle
 * is already smoothed, and turns exactly as the needle travels. So the lane
 * moves by how far the record has turned since the last frame, and is only
 * pulled gently towards the reported position so the two cannot drift apart.
 * It also means a hand on the record moves the waveform at once.
 */
export function followNeedle(
  follower: LaneFollower,
  needleSec: number,
  angleDeg: number,
  durationSec: number,
  loop: boolean,
): number {
  if (!Number.isFinite(needleSec) || !Number.isFinite(angleDeg) || !(durationSec > 0)) {
    follower.locked = false;
    follower.positionSec = 0;
    return 0;
  }

  const turnedSec = (angleDeg - follower.angleDeg) / PLAY_VELOCITY_DEG;
  follower.angleDeg = angleDeg;
  if (!follower.locked) {
    follower.locked = true;
    follower.positionSec = needleSec;
    return needleSec;
  }

  const expected = follower.positionSec + turnedSec;
  let gap = needleSec - expected;
  // Round a loop, the short way to the needle may be across the join.
  if (loop) gap -= Math.round(gap / durationSec) * durationSec;
  const next = Math.abs(gap) > FOLLOW_SNAP_SEC ? needleSec : expected + gap * FOLLOW_PULL;
  follower.positionSec = movedPosition(next, 0, durationSec, loop);
  return follower.positionSec;
}
