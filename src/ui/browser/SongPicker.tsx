import type { DeckId } from '@/engine/core/types';
import type { TrackMeta, TrackRef } from '@/sources/types';
import { Sheet } from '@/ui/components/Sheet';
import { Mark, TrackGlyph } from '@/ui/components/TrackGlyph';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './SongPicker.module.css';

export interface PickerSection {
  label: string;
  tracks: readonly TrackMeta[];
}

interface SongPickerProps {
  /** Which deck the song is for. null = closed. */
  deck: DeckId | null;
  sections: readonly PickerSection[];
  /** The tile currently loading, if any. */
  busy: TrackRef | null;
  /** A plain-language problem to show, e.g. a file that could not be read. */
  error: string | null;
  onPick: (track: TrackMeta) => void;
  /** Open the device's file picker. */
  onAddMusic: () => void;
  onClose: () => void;
}

function sameTrack(a: TrackRef, b: TrackRef): boolean {
  return a.source === b.source && a.id === b.id;
}

/**
 * Choosing a song for a deck. Songs are big tiles, shape first, so a child can
 * pick "the star one".
 */
export function SongPicker({
  deck,
  sections,
  busy,
  error,
  onPick,
  onAddMusic,
  onClose,
}: SongPickerProps) {
  const visible = sections.filter((section) => section.tracks.length > 0);

  return (
    <Sheet
      open={deck !== null}
      onClose={onClose}
      style={deck ? deckStyle(deck) : undefined}
      lead={
        <span className={styles.badge} aria-hidden="true">
          {deck}
        </span>
      }
      heading={
        <>
          Pick a song<span className={styles.hidden}> for deck {deck}</span>
        </>
      }
    >
      <div className={styles.songs}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {visible.map((section) => (
          <section key={section.label}>
            <h3 className={styles.label}>{section.label}</h3>
            <ul className={styles.tiles}>
              {section.tracks.map((track) => {
                const isBusy = busy !== null && sameTrack(busy, track.ref);
                return (
                  <li key={`${track.ref.source}:${track.ref.id}`}>
                    <button
                      type="button"
                      className={styles.tile}
                      data-busy={isBusy}
                      aria-busy={isBusy}
                      aria-disabled={busy !== null}
                      aria-label={track.artist ? `${track.title} by ${track.artist}` : track.title}
                      onClick={() => {
                        if (busy === null) onPick(track);
                      }}
                    >
                      <span className={styles.glyph} aria-hidden="true">
                        <TrackGlyph glyph={track.glyph ?? 'note'} />
                      </span>
                      <span className={styles.title} aria-hidden="true">
                        {track.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <ul className={styles.tiles}>
          <li>
            <button type="button" className={`${styles.tile} ${styles.add}`} onClick={onAddMusic}>
              <span className={styles.glyph} aria-hidden="true">
                <Mark name="add" />
              </span>
              <span className={styles.title}>Add music</span>
            </button>
          </li>
        </ul>
      </div>
    </Sheet>
  );
}
