import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { DetailPeaks } from '@/analysis/peaks';
import type { DeckId } from '@/engine/core/types';
import type { DeckControl } from '@/engine/deck/types';
import { clamp } from '@/lib/audio-math';
import { formatRemaining } from '@/lib/format-time';
import { deckStyle } from '@/ui/theme/deck-colors';
import {
  createFollower,
  followNeedle,
  LANE_PX_PER_SEC,
  laneColumns,
  laneWindow,
  movedPosition,
  trackPixel,
  waveReach,
  type LaneWindow,
} from './lane-draw';
import { positionText } from './waveform-draw';
import styles from './WaveLane.module.css';

/** What the lane asks its deck, every frame. */
type LaneDeck = Pick<DeckControl, 'positionSec' | 'angleDeg' | 'isMoving'>;

interface WaveLaneProps {
  deck: DeckId;
  /** The deck to follow. null while it has nothing to show. */
  control: LaneDeck | null;
  /** The loaded track up close. null while there is no track: an empty lane, not a fake waveform. */
  detail: DetailPeaks | null;
  /** The track plays round and round, so its picture comes round again too. */
  loop: boolean;
  /** The name of the track on the deck, if there is one. */
  title: string | null;
  playing: boolean;
  /** 0..1, how present this deck is in the mix (dims its waveform). */
  presence: number;
  /** The person dragged the waveform, or used the keys, to move the needle. */
  onSeek: (positionSec: number) => void;
  /** A hand or a key landed on this lane. */
  onTouch?: () => void;
}

/** How often a record that is not turning is checked for a change of position. */
const IDLE_CHECK_MS = 120;
/** Screen readers get the position at a human pace, not sixty times a second. */
const ANNOUNCE_EVERY_MS = 250;
/** How far one arrow key press moves the needle: a fine step, next to the overview's coarse one. */
const KEY_STEP_SEC = 1;
/** Beyond this the picture looks no sharper, and the canvas costs more to fill. */
const MAX_PIXEL_RATIO = 2;
/** Width of the "now" line in CSS pixels, rounded to whole device pixels when drawn. */
const NOW_LINE_CSS_PX = 2;

const NO_TRACK_TEXT = 'No song';

interface Drag {
  readonly pointerId: number;
  /** Where the pointer was at the last move. */
  x: number;
}

/**
 * One deck's music up close: a few seconds either side of the needle, in the
 * deck's colour, scrolling under a "now" line fixed in the middle, so what is
 * coming can be seen before it is heard. The deck's letter and the track's
 * name sit before it and the time left after it. Drag the waveform to move the
 * needle; it follows the hand like a tape. Drawn on a canvas outside React,
 * every frame while the record turns and on a slow check otherwise.
 */
export function WaveLane({
  deck,
  control,
  detail,
  loop,
  title,
  playing,
  presence,
  onSeek,
  onTouch,
}: WaveLaneProps) {
  const wellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  /** Draw on the next frame, whatever the loop is doing: a seek should show at once. */
  const wakeRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const loaded = detail !== null && control !== null;

  // Before paint, so a new track never flashes the old picture.
  useLayoutEffect(() => {
    const well = wellRef.current;
    const canvas = canvasRef.current;
    const time = timeRef.current;
    const ctx = canvas?.getContext('2d');
    if (!well || !canvas || !ctx) return;

    if (!detail || !control) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (time) time.textContent = '';
      well.setAttribute('aria-valuenow', '0');
      return;
    }

    const durationSec = detail.durationSec;
    const follower = createFollower();
    const view: LaneWindow = { firstPixel: 0, nowX: 0 };
    // People who ask for less motion get a picture that stands still, a lane-width at a time.
    const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    /** One entry for each column of the canvas, reused every frame. */
    let reach = new Float32Array(0);
    let cssWidth = 0;
    let cssHeight = 0;
    let seenRatio = 0;
    let pxPerSec = LANE_PX_PER_SEC;
    let padPx = 0;
    let nowLinePx = 1;
    let colourWave = '';
    let colourShade = '';
    let colourNow = '';
    let playedShade = 0;
    let dirty = true;
    let drawnFirst = Number.NaN;
    let drawnNowX = Number.NaN;
    let shownTime: string | null = null;
    let lastAnnounceMs = Number.NEGATIVE_INFINITY;
    let announced = '';
    /** The last look was a frame ago, not a slow check ago: the needle can be followed smoothly. */
    let inMotion = false;
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
      if (reach.length !== width) reach = new Float32Array(width);
      pxPerSec = LANE_PX_PER_SEC * ratio;
      nowLinePx = Math.max(1, Math.round(NOW_LINE_CSS_PX * ratio));

      // Custom properties come back with var() already resolved, so the deck's colour is
      // whatever the ancestor set.
      const style = getComputedStyle(well);
      colourWave = style.getPropertyValue('--lane-wave').trim();
      colourShade = style.getPropertyValue('--lane-shade').trim();
      colourNow = style.getPropertyValue('--lane-now').trim();
      playedShade = clamp(
        Number.parseFloat(style.getPropertyValue('--lane-played-shade')) || 0,
        0,
        1,
      );
      padPx = (Number.parseFloat(style.getPropertyValue('--lane-pad')) || 0) * ratio;
      dirty = true;
    };

    const paint = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      if (width === 0 || height === 0) return;

      // Each column's level, then how far it reaches from the centre line. Columns with no
      // track under them stay below zero.
      laneColumns(detail, pxPerSec, view.firstPixel, loop, reach);
      for (let x = 0; x < width; x++) {
        if (reach[x]! >= 0) reach[x] = waveReach(reach[x]!, height, padPx);
      }
      // The middle of a pixel row, so that silence is one sharp line.
      const mid = Math.floor(height / 2) + 0.5;

      // Each stretch of track is one filled shape: along the top, then back along the bottom.
      ctx.fillStyle = colourWave;
      let x = 0;
      while (x < width) {
        if (reach[x]! < 0) {
          x += 1;
          continue;
        }
        const from = x;
        ctx.beginPath();
        ctx.moveTo(from, mid - reach[from]!);
        for (; x < width && reach[x]! >= 0; x++) ctx.lineTo(x + 0.5, mid - reach[x]!);
        ctx.lineTo(x, mid - reach[x - 1]!);
        ctx.lineTo(x, mid + reach[x - 1]!);
        for (let back = x - 1; back >= from; back--) ctx.lineTo(back + 0.5, mid + reach[back]!);
        ctx.lineTo(from, mid + reach[from]!);
        ctx.closePath();
        ctx.fill();
      }

      // What has gone by is dimmed, so the eye rests on what is coming.
      if (playedShade > 0 && view.nowX > 0) {
        ctx.globalAlpha = playedShade;
        ctx.fillStyle = colourShade;
        ctx.fillRect(0, 0, view.nowX, height);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = colourNow;
      const left = clamp(view.nowX - Math.floor(nowLinePx / 2), 0, Math.max(0, width - nowLinePx));
      ctx.fillRect(left, 0, nowLinePx, height);
    };

    const announce = (positionSec: number) => {
      const now = performance.now();
      if (now - lastAnnounceMs < ANNOUNCE_EVERY_MS) return;
      lastAnnounceMs = now;
      const text = positionText(positionSec, durationSec);
      if (text === announced) return;
      announced = text;
      well.setAttribute('aria-valuenow', Math.round(clamp(positionSec, 0, durationSec)).toString());
      well.setAttribute('aria-valuetext', text);
    };

    const draw = () => {
      // Moving the window to another screen changes the density without changing the size.
      if (window.devicePixelRatio !== seenRatio) rebuild();
      // After a pause in drawing, or a jump made here, start from where the needle really is.
      if (!inMotion) follower.locked = false;
      const positionSec = followNeedle(
        follower,
        control.positionSec(),
        control.angleDeg(),
        durationSec,
        loop,
      );
      laneWindow(trackPixel(positionSec, pxPerSec), canvas.width, lessMotion.matches, view);
      // Whole device pixels: the picture only changes when the track has moved by one.
      if (dirty || view.firstPixel !== drawnFirst || view.nowX !== drawnNowX) {
        paint();
        dirty = false;
        drawnFirst = view.firstPixel;
        drawnNowX = view.nowX;
      }
      const left = formatRemaining(positionSec, durationSec);
      if (left !== shownTime && time) {
        shownTime = left;
        time.textContent = left;
      }
      announce(positionSec);
    };

    // Every frame while the record turns. Otherwise a slow check, which still catches a
    // jump back to the start or a seek made somewhere else.
    const tick = () => {
      frame = 0;
      idleCheck = 0;
      draw();
      inMotion = playing || control.isMoving();
      if (inMotion) {
        frame = requestAnimationFrame(tick);
      } else {
        idleCheck = window.setTimeout(tick, IDLE_CHECK_MS);
      }
    };

    const wake = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleCheck);
      idleCheck = 0;
      inMotion = false;
      lastAnnounceMs = Number.NEGATIVE_INFINITY;
      frame = requestAnimationFrame(tick);
    };

    const box = canvas.getBoundingClientRect();
    cssWidth = box.width;
    cssHeight = box.height;
    rebuild();
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

    const onMotionChange = () => {
      dirty = true;
      wake();
    };
    lessMotion.addEventListener('change', onMotionChange);

    tick();
    return () => {
      observer.disconnect();
      lessMotion.removeEventListener('change', onMotionChange);
      cancelAnimationFrame(frame);
      window.clearTimeout(idleCheck);
      wakeRef.current = null;
    };
  }, [detail, control, loop, playing]);

  /** Move the needle by a length of time, and show it at once. */
  const moveBy = (bySec: number) => {
    if (!detail || !control) return;
    onSeek(movedPosition(control.positionSec(), bySec, detail.durationSec, loop));
    wakeRef.current?.();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!loaded || dragRef.current !== null) return; // nothing to move, or a hand is already on it
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX };
  };

  // The picture follows the hand: pulling it to the right brings earlier music under the line.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (dx === 0) return;
    drag.x = event.clientX;
    moveBy(-dx / LANE_PX_PER_SEC);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!detail || !control) return;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        moveBy(-KEY_STEP_SEC);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        moveBy(KEY_STEP_SEC);
        break;
      case 'Home':
        onSeek(0);
        wakeRef.current?.();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const durationSec = detail?.durationSec ?? 0;

  return (
    <div
      className={styles.lane}
      style={deckStyle(deck, presence)}
      onPointerDownCapture={onTouch}
      onKeyDownCapture={onTouch}
    >
      <div className={styles.name}>
        <span className={styles.badge} aria-hidden="true">
          {deck}
        </span>
        {title !== null && <span className={styles.title}>{title}</span>}
      </div>

      <div
        ref={wellRef}
        className={styles.well}
        data-state={loaded ? 'loaded' : 'empty'}
        role="slider"
        tabIndex={loaded ? 0 : -1}
        aria-label={`Deck ${deck} waveform`}
        aria-disabled={!loaded}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSec)}
        aria-valuenow={0}
        aria-valuetext={loaded ? positionText(0, durationSec) : NO_TRACK_TEXT}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      </div>

      <span ref={timeRef} className={styles.time} aria-hidden="true" />
    </div>
  );
}
