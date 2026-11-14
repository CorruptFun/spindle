import { useLayoutEffect, useRef } from 'react';
import type { DeckId } from '@/engine/core/types';
import { clamp } from '@/lib/audio-math';
import { formatRemaining } from '@/lib/format-time';
import type { TrackMeta } from '@/sources/types';
import { Mark, TrackGlyph } from '@/ui/components/TrackGlyph';
import styles from './TrackStrip.module.css';

interface TrackStripProps {
  deck: DeckId;
  track: TrackMeta | null;
  loading: boolean;
  /** Needle position in seconds, read every frame while playing. null when there is nothing to read. */
  readPositionSec: (() => number) | null;
  durationSec: number;
  playing: boolean;
  /** Whether the record is turning right now (it coasts after pause, and a hand can move it). */
  isMoving: (() => boolean) | null;
  /** Open the song picker for this deck. */
  onChoose: () => void;
  /** Leave out the time left and the progress line, where a waveform nearby already shows them. */
  compact?: boolean;
}

/** How often a deck that is not turning is checked for a change of position. */
const IDLE_CHECK_MS = 120;

type StripState = 'empty' | 'loading' | 'loaded';

function accessibleName(deck: DeckId, state: StripState, track: TrackMeta | null): string {
  if (state === 'loading') return `Deck ${deck}: loading a song`;
  if (state === 'empty' || !track) return `Deck ${deck}: choose a song`;
  const by = track.artist ? ` by ${track.artist}` : '';
  return `Deck ${deck}: ${track.title}${by}. Choose a different song`;
}

/**
 * The top of a deck: what is on it, and the way to change it. The whole strip
 * is one button that opens the song picker. Time left and the progress line are
 * written straight to the page every frame while the record turns.
 */
export function TrackStrip({
  deck,
  track,
  loading,
  readPositionSec,
  durationSec,
  playing,
  isMoving,
  onChoose,
  compact = false,
}: TrackStripProps) {
  const timeRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const state: StripState = loading ? 'loading' : track ? 'loaded' : 'empty';

  // Before paint, so a new track never flashes the old time.
  useLayoutEffect(() => {
    // Nothing to write while there is no track, or no time and progress line to write to.
    if (state !== 'loaded' || compact) return;
    let shownTime = '';
    let shownProgress = -1;
    let frame = 0;
    let idleCheck = 0;

    const paint = () => {
      const positionSec = readPositionSec ? readPositionSec() : 0;
      const time = durationSec > 0 ? formatRemaining(positionSec, durationSec) : '';
      if (time !== shownTime && timeRef.current) {
        shownTime = time;
        timeRef.current.textContent = time;
      }
      const progress = durationSec > 0 ? clamp(positionSec / durationSec, 0, 1) : 0;
      if (progress !== shownProgress && progressRef.current) {
        shownProgress = progress;
        progressRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      }
    };

    // Every frame while the record turns. Otherwise a slow check, which still catches a
    // jump back to the start or a hand moving a paused record.
    const tick = () => {
      paint();
      if (playing || isMoving?.()) {
        frame = requestAnimationFrame(tick);
      } else {
        idleCheck = window.setTimeout(tick, IDLE_CHECK_MS);
      }
    };

    paint();
    if (readPositionSec) tick();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleCheck);
    };
  }, [state, compact, track, readPositionSec, durationSec, playing, isMoving]);

  return (
    <button
      type="button"
      className={styles.strip}
      data-state={state}
      aria-label={accessibleName(deck, state, track)}
      aria-busy={loading}
      onClick={onChoose}
    >
      <span className={styles.badge} aria-hidden="true">
        {deck}
      </span>

      {state === 'empty' && (
        <span className={styles.shape} aria-hidden="true">
          <Mark name="add" />
        </span>
      )}

      {state === 'loading' && (
        <span className={styles.line} aria-hidden="true">
          <span className={styles.working} />
        </span>
      )}

      {state === 'loaded' && track && (
        <>
          <span className={styles.shape} aria-hidden="true">
            <TrackGlyph glyph={track.glyph ?? 'note'} />
          </span>
          <span className={styles.title} aria-hidden="true">
            {track.title}
          </span>
          {!compact && (
            <>
              <span ref={timeRef} className={styles.time} aria-hidden="true" />
              <span className={styles.line} aria-hidden="true">
                <span ref={progressRef} className={styles.progress} />
              </span>
            </>
          )}
        </>
      )}
    </button>
  );
}
