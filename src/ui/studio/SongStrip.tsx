import type { CSSProperties } from 'react';
import { SONG_MAX } from '@/studio/types';
import { Mark } from '@/ui/components/TrackGlyph';
import { LoopPicture } from './LoopPicture';
import type { SongLoop } from './SongSheet';
import styles from './SongStrip.module.css';

interface SongStripProps {
  /** The eight loops, in slot order. */
  loops: readonly SongLoop[];
  /** Slot numbers in playing order. */
  song: readonly number[];
  /** The entry being heard, or -1. */
  position: number;
  /** The song is playing. */
  playing: boolean;
  /** The slot of the loop on screen: the one the + cap puts at the end. */
  current: number;
  onAdd: (slot: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onTogglePlay: () => void;
}

/**
 * The song where it can be seen, for a screen with room to spare: its loops in
 * playing order along a lane, the one being heard ringed. The cap at the end of
 * the lane adds the loop on screen; pressing an entry takes it out. The same
 * song as the song sheet builds on a smaller screen.
 */
export function SongStrip({
  loops,
  song,
  position,
  playing,
  current,
  onAdd,
  onRemove,
  onClear,
  onTogglePlay,
}: SongStripProps) {
  const empty = song.length === 0;
  const full = song.length >= SONG_MAX;
  const currentName = loops[current]?.name ?? 'this loop';

  return (
    <div className={styles.strip} role="group" aria-label="Song">
      <span className={styles.label} aria-hidden="true">
        Song
      </span>

      <button
        type="button"
        className={styles.play}
        aria-pressed={playing}
        aria-disabled={empty}
        aria-label="Play the song"
        onClick={() => {
          if (!empty) onTogglePlay();
        }}
      >
        {/* The transport's play button: stop, not pause, because the song starts from the top. */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {playing ? (
            <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
          ) : (
            <path d="M8.5 5.6v12.8a.6.6 0 0 0 .92.5l9.9-6.4a.6.6 0 0 0 0-1L9.42 5.1a.6.6 0 0 0-.92.5Z" />
          )}
        </svg>
      </button>

      <div className={styles.lane}>
        {!empty && (
          // The list is told how many tiles it holds, so it can be exactly as wide as they need.
          <ol className={styles.entries} style={{ '--entries': song.length } as CSSProperties}>
            {song.map((slot, index) => {
              const loop = loops[slot];
              if (!loop) return null;
              const heard = playing && index === position;
              return (
                <li key={index} className={styles.place}>
                  <button
                    type="button"
                    className={styles.tile}
                    data-active={heard}
                    aria-current={heard ? 'true' : undefined}
                    aria-label={`${index + 1}: ${loop.name}. Take out of the song`}
                    onClick={() => onRemove(index)}
                  >
                    <LoopPicture pattern={loop.pattern} />
                    <span className={styles.name} aria-hidden="true">
                      {loop.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <button
          type="button"
          className={styles.add}
          aria-disabled={full}
          aria-label={`Add ${currentName} to the song`}
          onClick={() => {
            if (!full) onAdd(current);
          }}
        >
          <span className={styles.mark} aria-hidden="true">
            <Mark name="add" />
          </span>
        </button>
      </div>

      <button
        type="button"
        className={styles.clear}
        aria-disabled={empty}
        aria-label="Clear the song"
        onClick={() => {
          if (!empty) onClear();
        }}
      >
        <span className={styles.mark} aria-hidden="true">
          <Mark name="clear" />
        </span>
      </button>
    </div>
  );
}
