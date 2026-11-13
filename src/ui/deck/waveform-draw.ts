/**
 * The geometry of the waveform overview, kept apart from the canvas so it can
 * be tested. Everything is in device pixels: whole numbers, so bars land on
 * pixel boundaries and stay sharp.
 */
import { clamp } from '@/lib/audio-math';
import { formatClock } from '@/lib/format-time';

/**
 * Where the bars sit across the lane. Bars keep a fixed width and gap at every
 * size, so a phone shows fewer, not thinner, bars. Whatever is left over (less
 * than one bar's pitch) is split between the two ends, and the timeline runs
 * from the left edge of the first bar to the right edge of the last.
 */
export interface BarLayout {
  readonly count: number;
  readonly barPx: number;
  readonly pitchPx: number;
  /** Left edge of the first bar: where the track starts. */
  readonly startPx: number;
  /** From the start of the track to its end. */
  readonly spanPx: number;
}

export function layoutBars(widthPx: number, barPx: number, gapPx: number): BarLayout {
  const bar = Math.max(1, Math.round(barPx));
  const gap = Math.max(0, Math.round(gapPx));
  const pitchPx = bar + gap;
  const width = Math.max(0, Math.floor(widthPx));
  const count = width >= bar ? Math.floor((width + gap) / pitchPx) : 0;
  const spanPx = count > 0 ? count * pitchPx - gap : 0;
  const startPx = Math.floor((width - spanPx) / 2);
  return { count, barPx: bar, pitchPx, startPx, spanPx };
}

export function barLeft(layout: BarLayout, index: number): number {
  return layout.startPx + index * layout.pitchPx;
}

/**
 * Fold the track's slices into the bars: each bar shows the loudest slice it
 * covers, so a short hit survives on a narrow screen. A bar narrower than a
 * slice shows the slice it falls in. Writes into `out` (length `layout.count`).
 */
export function barLevels(peaks: Float32Array, out: Float32Array): void {
  const bars = out.length;
  const slices = peaks.length;
  for (let i = 0; i < bars; i++) {
    if (slices === 0) {
      out[i] = 0;
      continue;
    }
    const start = Math.floor((i * slices) / bars);
    const end = Math.max(Math.floor(((i + 1) * slices) / bars), start + 1);
    let loudest = 0;
    for (let s = start; s < end; s++) {
      const level = peaks[s]!;
      if (level > loudest) loudest = level;
    }
    out[i] = loudest > 1 ? 1 : loudest;
  }
}

/**
 * The top edge of a bar of `level` (0..1) in a lane `heightPx` tall. Bars are
 * mirrored about the centre, so the bar runs from `top` to `heightPx - top`.
 * Silence still shows the centre line (one pixel, or two in an even-height
 * lane so it stays centred): it is the zero line, not a fake level.
 */
export function barTop(level: number, heightPx: number): number {
  const height = Math.max(0, Math.floor(heightPx));
  const half = height / 2;
  const top = Math.floor(half - (level > 0 ? Math.min(level, 1) : 0) * half);
  return Math.max(0, Math.min(top, Math.floor((height - 1) / 2)));
}

/** Where a position in the track is drawn. */
export function xAtPosition(layout: BarLayout, positionSec: number, durationSec: number): number {
  if (!(durationSec > 0) || !Number.isFinite(positionSec)) return layout.startPx;
  return layout.startPx + clamp(positionSec / durationSec, 0, 1) * layout.spanPx;
}

/** The position in the track under `x`, clamped to the track: the inverse of xAtPosition. */
export function positionAtX(layout: BarLayout, x: number, durationSec: number): number {
  if (!(durationSec > 0) || layout.spanPx <= 0 || !Number.isFinite(x)) return 0;
  return clamp((x - layout.startPx) / layout.spanPx, 0, 1) * durationSec;
}

/**
 * How much has been played when the playhead is at `x`: `played` whole bars,
 * then `partialPx` of the next bar (the playhead is inside it). Everything
 * after is still to come.
 */
export interface PlayedSplit {
  played: number;
  partialPx: number;
}

/** Writes into `out` (and returns it), so the drawing loop can reuse one object every frame. */
export function splitAt(
  layout: BarLayout,
  x: number,
  out: PlayedSplit = { played: 0, partialPx: 0 },
): PlayedSplit {
  out.played = 0;
  out.partialPx = 0;
  const into = x - layout.startPx;
  if (!(into > 0) || layout.count === 0) return out;
  const bar = Math.floor(into / layout.pitchPx);
  if (bar >= layout.count) {
    out.played = layout.count;
    return out;
  }
  const within = into - bar * layout.pitchPx;
  if (within >= layout.barPx) {
    out.played = bar + 1;
  } else {
    out.played = bar;
    out.partialPx = within;
  }
  return out;
}

/** What a screen reader hears, e.g. "1:05 of 3:20". */
export function positionText(positionSec: number, durationSec: number): string {
  return `${formatClock(clamp(positionSec, 0, durationSec))} of ${formatClock(durationSec)}`;
}
