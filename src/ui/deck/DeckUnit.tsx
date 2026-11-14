import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { DeckId } from '@/engine/core/types';
import type { WaveformPeaks } from '@/analysis/peaks';
import type { DeckControl } from '@/engine/deck/types';
import type { TrackMeta } from '@/sources/types';
import { Mark } from '@/ui/components/TrackGlyph';
import { TransportButton } from '@/ui/components/TransportButton';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './DeckUnit.module.css';
import { Platter } from './Platter';
import { TrackStrip } from './TrackStrip';
import { Waveform } from './Waveform';

interface DeckUnitProps {
  deck: DeckId;
  control: DeckControl | null;
  track: TrackMeta | null;
  loading: boolean;
  playing: boolean;
  /** 0..1, how present this deck is in the mix (dims its colour). */
  presence: number;
  onTogglePlay: () => void;
  /** Return the needle to the start. Leave it out when that is not possible: the button is then not shown. */
  onBackToStart?: () => void;
  onChooseTrack: () => void;
  /** The shape of the loaded track, for the waveform. */
  peaks: WaveformPeaks | null;
  /** Jump to a place in the track. */
  onSeek: (positionSec: number) => void;
  /** Something was dropped on the deck (the integrator filters for audio files). */
  onDropData?: (data: DataTransfer) => void;
  /**
   * Set on a desk-sized screen, where a close-up waveform elsewhere carries the
   * track's name and time: the deck's own strip then leaves them out. `wide`
   * also puts the strip and the overview side by side, for a deck with the
   * width to spare, which leaves the record more of the height.
   */
  desk?: 'narrow' | 'wide';
  /** A hand or a key landed on this deck. */
  onTouch?: () => void;
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

/** One deck: what is on it, the record, and its transport. Presentational: props in, callbacks out. */
export function DeckUnit({
  deck,
  control,
  track,
  loading,
  playing,
  presence,
  onTogglePlay,
  onBackToStart,
  onChooseTrack,
  peaks,
  onSeek,
  onDropData,
  desk,
  onTouch,
}: DeckUnitProps) {
  const [dragOver, setDragOver] = useState(false);
  // dragenter and dragleave fire for every child crossed, so count them.
  const dragDepth = useRef(0);

  const hasTrack = track !== null && !loading && control !== null;
  const readPositionSec = useCallback(() => control?.positionSec() ?? 0, [control]);
  const isMoving = useCallback(() => control?.isMoving() ?? false, [control]);
  // Read at render: it only changes when a track is loaded, which re-renders the deck anyway.
  const durationSec = (hasTrack && control.durationSec()) || track?.durationSec || 0;

  const dropHandlers = onDropData
    ? {
        onDragEnter: (event: DragEvent) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragOver(true);
        },
        onDragOver: (event: DragEvent) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave: (event: DragEvent) => {
          if (!carriesFiles(event)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        },
        onDrop: (event: DragEvent) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          onDropData(event.dataTransfer);
        },
      }
    : {};

  const strip = (
    <TrackStrip
      deck={deck}
      track={track}
      loading={loading}
      readPositionSec={hasTrack ? readPositionSec : null}
      durationSec={durationSec}
      playing={playing}
      isMoving={hasTrack ? isMoving : null}
      onChoose={onChooseTrack}
      compact={desk !== undefined}
    />
  );

  const wave = (
    <div className={styles.wave}>
      <Waveform
        peaks={hasTrack ? peaks : null}
        readPositionSec={hasTrack ? readPositionSec : null}
        isMoving={hasTrack ? isMoving : null}
        playing={playing}
        onSeek={onSeek}
        label={`Deck ${deck} position`}
      />
    </div>
  );

  return (
    <section
      className={styles.unit}
      aria-label={`Deck ${deck}`}
      style={deckStyle(deck, presence)}
      data-drop={dragOver}
      onPointerDownCapture={onTouch}
      onKeyDownCapture={onTouch}
      {...dropHandlers}
    >
      {desk ? (
        <div className={styles.head} data-wide={desk === 'wide'}>
          <div className={styles.key}>{strip}</div>
          {wave}
        </div>
      ) : (
        <>
          {strip}
          {wave}
        </>
      )}

      <div className={styles.platter}>
        <Platter deck={deck} control={control} playing={playing} />
      </div>

      <div className={styles.transport}>
        {onBackToStart && (
          <button
            type="button"
            className={styles.backToStart}
            aria-label={`Back to the start of deck ${deck}`}
            onClick={onBackToStart}
          >
            <span className={styles.backMark} aria-hidden="true">
              <Mark name="start" />
            </span>
          </button>
        )}
        <TransportButton playing={playing} target={`deck ${deck}`} onToggle={onTogglePlay} />
      </div>

      {dragOver && (
        <div className={styles.dropTarget} aria-hidden="true">
          <span className={styles.dropMark}>
            <Mark name="drop" />
          </span>
        </div>
      )}
    </section>
  );
}
