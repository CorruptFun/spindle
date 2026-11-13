import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { WaveformPeaks } from '@/analysis/peaks';
import { clamp } from '@/lib/audio-math';
import styles from './Waveform.module.css';
import {
  barLeft,
  barLevels,
  barTop,
  layoutBars,
  positionAtX,
  positionText,
  splitAt,
  xAtPosition,
  type BarLayout,
  type PlayedSplit,
} from './waveform-draw';

interface WaveformProps {
  /** null while there is no track: draw an empty lane, not a fake waveform. */
  peaks: WaveformPeaks | null;
  /** Needle position in seconds, read every frame while the record moves. */
  readPositionSec: (() => number) | null;
  /** Whether the record is turning right now. */
  isMoving: (() => boolean) | null;
  playing: boolean;
  /** The person tapped or dragged on the waveform to jump to a place in the track. */
  onSeek: (positionSec: number) => void;
  /** For screen readers, e.g. "Deck A position". */
  label: string;
}

/** How often a record that is not turning is checked for a change of position. */
const IDLE_CHECK_MS = 120;
/** Screen readers get the position at a human pace, not sixty times a second. */
const ANNOUNCE_EVERY_MS = 250;
/** How far one arrow key press moves the needle. */
const KEY_STEP_SEC = 5;
/** Beyond this the bars look no sharper, and the canvas costs more to fill. */
const MAX_PIXEL_RATIO = 2;
/** Bar, gap and playhead widths in CSS pixels, rounded to whole device pixels when drawn. */
const BAR_CSS_PX = 2;
const GAP_CSS_PX = 1;
const PLAYHEAD_CSS_PX = 2;

const NO_TRACK_TEXT = 'No song';

interface Geometry {
  layout: BarLayout;
  durationSec: number;
}

/**
 * The whole track at a glance: one bar per stretch of the track, mirrored about
 * the centre line, played part in the deck's colour, and the playhead. Tap or
 * drag to move the needle. Drawn on a canvas outside React, every frame while
 * the record turns and on a slow check otherwise.
 */
export function Waveform({
  peaks,
  readPositionSec,
  isMoving,
  playing,
  onSeek,
  label,
}: WaveformProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** What the pointer needs to turn a place on screen into a time; set by the drawing loop. */
  const geometryRef = useRef<Geometry | null>(null);
  /** Draw on the next frame, whatever the loop is doing: a seek should show at once. */
  const wakeRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<number | null>(null);

  // Before paint, so a new track never flashes the old picture.
  useLayoutEffect(() => {
    const lane = laneRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!lane || !canvas || !ctx) return;

    if (!peaks) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      geometryRef.current = null;
      return;
    }

    const durationSec = peaks.durationSec;
    const geometry: Geometry = { layout: layoutBars(0, 1, 0), durationSec };
    const split: PlayedSplit = { played: 0, partialPx: 0 };
    let levels = new Float32Array(0);
    let tops = new Float32Array(0);
    let cssWidth = 0;
    let cssHeight = 0;
    let seenRatio = 0;
    let playheadPx = 1;
    let colourPlayed = '';
    let colourToCome = '';
    let colourPlayhead = '';
    let dirty = true;
    let drawnX = Number.NaN;
    let lastAnnounceMs = Number.NEGATIVE_INFINITY;
    let announced = '';
    let frame = 0;
    let idleCheck = 0;

    // Everything that depends on size, pixel density or colour. Runs at human speed only.
    const rebuild = () => {
      seenRatio = window.devicePixelRatio || 1;
      const ratio = Math.min(seenRatio, MAX_PIXEL_RATIO);
      const width = Math.round(cssWidth * ratio);
      const height = Math.round(cssHeight * ratio);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const layout = layoutBars(width, BAR_CSS_PX * ratio, GAP_CSS_PX * ratio);
      geometry.layout = layout;
      levels = new Float32Array(layout.count);
      barLevels(peaks.peaks, levels);
      tops = new Float32Array(layout.count);
      for (let i = 0; i < layout.count; i++) tops[i] = barTop(levels[i]!, height);
      playheadPx = Math.max(1, Math.round(PLAYHEAD_CSS_PX * ratio));

      // Custom properties come back with var() already resolved, so the deck's colour is
      // whatever the ancestor set.
      const style = getComputedStyle(lane);
      colourPlayed = style.getPropertyValue('--wave-played').trim();
      colourToCome = style.getPropertyValue('--wave-to-come').trim();
      colourPlayhead = style.getPropertyValue('--wave-playhead').trim();
      dirty = true;
    };

    const paint = (x: number) => {
      const { layout } = geometry;
      const { barPx, count } = layout;
      const height = canvas.height;
      ctx.clearRect(0, 0, canvas.width, height);
      if (count === 0) return;

      splitAt(layout, x, split);
      const { played, partialPx } = split;

      ctx.fillStyle = colourPlayed;
      for (let i = 0; i < played; i++) {
        const top = tops[i]!;
        ctx.fillRect(barLeft(layout, i), top, barPx, height - 2 * top);
      }
      let next = played;
      if (partialPx > 0) {
        const top = tops[next]!;
        const left = barLeft(layout, next);
        ctx.fillRect(left, top, partialPx, height - 2 * top);
        ctx.fillStyle = colourToCome;
        ctx.fillRect(left + partialPx, top, barPx - partialPx, height - 2 * top);
        next += 1;
      }
      ctx.fillStyle = colourToCome;
      for (let i = next; i < count; i++) {
        const top = tops[i]!;
        ctx.fillRect(barLeft(layout, i), top, barPx, height - 2 * top);
      }

      ctx.fillStyle = colourPlayhead;
      const left = clamp(x - Math.floor(playheadPx / 2), 0, Math.max(0, canvas.width - playheadPx));
      ctx.fillRect(left, 0, playheadPx, height);
    };

    const announce = (positionSec: number) => {
      const now = performance.now();
      if (now - lastAnnounceMs < ANNOUNCE_EVERY_MS) return;
      lastAnnounceMs = now;
      const text = positionText(positionSec, durationSec);
      if (text === announced) return;
      announced = text;
      lane.setAttribute('aria-valuenow', Math.round(clamp(positionSec, 0, durationSec)).toString());
      lane.setAttribute('aria-valuetext', text);
    };

    const draw = () => {
      // Moving the window to another screen changes the density without changing the size.
      if (window.devicePixelRatio !== seenRatio) rebuild();
      const positionSec = readPositionSec ? readPositionSec() : 0;
      // Whole device pixels: the picture only changes when the playhead moves a pixel.
      const x = Math.round(xAtPosition(geometry.layout, positionSec, durationSec));
      if (dirty || x !== drawnX) {
        paint(x);
        dirty = false;
        drawnX = x;
      }
      announce(positionSec);
    };

    // Every frame while the record turns. Otherwise a slow check, which still catches a
    // jump back to the start or a hand moving a paused record.
    const tick = () => {
      frame = 0;
      idleCheck = 0;
      draw();
      if (playing || isMoving?.()) {
        frame = requestAnimationFrame(tick);
      } else {
        idleCheck = window.setTimeout(tick, IDLE_CHECK_MS);
      }
    };

    const wake = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleCheck);
      idleCheck = 0;
      lastAnnounceMs = Number.NEGATIVE_INFINITY;
      frame = requestAnimationFrame(tick);
    };

    const box = canvas.getBoundingClientRect();
    cssWidth = box.width;
    cssHeight = box.height;
    rebuild();
    geometryRef.current = geometry;
    wakeRef.current = wake;

    const observer = new ResizeObserver((entries) => {
      const size = entries[entries.length - 1]?.contentRect;
      if (!size || (size.width === cssWidth && size.height === cssHeight)) return;
      cssWidth = size.width;
      cssHeight = size.height;
      rebuild();
      // Resizing the canvas has just cleared it: draw now, not on the next check.
      draw();
    });
    observer.observe(canvas);

    tick();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(idleCheck);
      geometryRef.current = null;
      wakeRef.current = null;
    };
  }, [peaks, playing, readPositionSec, isMoving]);

  const seekToPointer = (clientX: number) => {
    const geometry = geometryRef.current;
    const canvas = canvasRef.current;
    if (!geometry || !canvas) return;
    const box = canvas.getBoundingClientRect();
    if (box.width <= 0) return;
    const x = (clientX - box.left) * (canvas.width / box.width);
    onSeek(positionAtX(geometry.layout, x, geometry.durationSec));
    wakeRef.current?.();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!peaks || dragRef.current !== null) return; // nothing to seek, or a hand is already on it
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = event.pointerId;
    seekToPointer(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current !== event.pointerId) return;
    seekToPointer(event.clientX);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === event.pointerId) dragRef.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!peaks) return;
    const now = readPositionSec ? readPositionSec() : 0;
    let target: number;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        target = now - KEY_STEP_SEC;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        target = now + KEY_STEP_SEC;
        break;
      case 'Home':
        target = 0;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSeek(clamp(target, 0, peaks.durationSec));
    wakeRef.current?.();
  };

  const durationSec = peaks?.durationSec ?? 0;

  return (
    <div
      ref={laneRef}
      className={styles.lane}
      data-state={peaks ? 'loaded' : 'empty'}
      role="slider"
      tabIndex={peaks ? 0 : -1}
      aria-label={label}
      aria-disabled={!peaks}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationSec)}
      aria-valuenow={0}
      aria-valuetext={peaks ? positionText(0, durationSec) : NO_TRACK_TEXT}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}
