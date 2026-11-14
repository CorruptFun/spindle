import { SONG_MAX } from '@/studio/types';
import type { DrumPattern } from '@/studio/types';
import { Sheet } from '@/ui/components/Sheet';
import { Mark } from '@/ui/components/TrackGlyph';
import { LoopPicture } from './LoopPicture';
import styles from './SongSheet.module.css';

export interface SongLoop {
  name: string;
  pattern: DrumPattern;
}

interface SongSheetProps {
  open: boolean;
  onClose: () => void;
  /** The eight loops, in slot order. */
  loops: readonly SongLoop[];
  /** Slot numbers in playing order. */
  song: readonly number[];
  /** The entry being heard, or -1. */
  position: number;
  /** The song is playing. */
  playing: boolean;
  onAdd: (slot: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onTogglePlay: () => void;
}

/**
 * Building a song: the loops in playing order above, the eight loops below.
 * Tap a loop to put it at the end; tap an entry in the song to take it out.
 */
export function SongSheet({
  open,
  onClose,
  loops,
  song,
  position,
  playing,
  onAdd,
  onRemove,
  onClear,
  onTogglePlay,
}: SongSheetProps) {
  const empty = song.length === 0;
  const full = song.length >= SONG_MAX;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      heading="Song"
      actions={
        <>
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
        </>
      }
    >
      <div className={styles.groups}>
        <section>
          <h3 className={styles.label}>Song</h3>
          {empty ? (
            <div className={styles.tiles}>
              <div className={styles.empty} role="img" aria-label="No loops in the song yet" />
            </div>
          ) : (
            <ol className={styles.tiles}>
              {song.map((slot, index) => {
                const loop = loops[slot];
                if (!loop) return null;
                return (
                  <li key={index}>
                    <button
                      type="button"
                      className={`${styles.tile} ${styles.entry}`}
                      data-active={playing && index === position}
                      aria-label={`${index + 1}: ${loop.name}. Take out of the song`}
                      onClick={() => onRemove(index)}
                    >
                      <span className={styles.place} aria-hidden="true">
                        {index + 1}
                      </span>
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
        </section>

        <section>
          <h3 className={styles.label}>Loops</h3>
          <ul className={styles.tiles}>
            {loops.map((loop, slot) => (
              <li key={slot}>
                <button
                  type="button"
                  className={styles.tile}
                  aria-disabled={full}
                  aria-label={`Add ${loop.name} to the song`}
                  onClick={() => {
                    if (!full) onAdd(slot);
                  }}
                >
                  <LoopPicture pattern={loop.pattern} />
                  <span className={styles.name} aria-hidden="true">
                    {loop.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.note}>Tap a loop to add it. Tap it in the song to take it out.</p>
      </div>
    </Sheet>
  );
}
