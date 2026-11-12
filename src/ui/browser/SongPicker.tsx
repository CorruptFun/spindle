import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { DeckId } from '@/engine/core/types';
import type { TrackMeta, TrackRef } from '@/sources/types';
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
 * Choosing a song for a deck. A native modal dialog, so focus stays inside and
 * Escape closes it without extra code. Songs are big tiles, shape first, so a
 * child can pick "the star one". A sheet from the bottom on a phone, a centred
 * panel on anything larger.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const open = deck !== null;
  // Read by the dialog's own events, which can arrive after the parent has already closed it.
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  /** Where the last press started, so a drag that ends on the backdrop is not a tap outside. */
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The parent owns open and closed. Escape asks it to close rather than closing by itself;
  // if the browser closes the dialog anyway (it may on a second Escape), tell the parent.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (openRef.current) onCloseRef.current();
    };
    const onClosed = () => {
      if (openRef.current) onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClosed);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClosed);
    };
  }, []);

  // The dialog box itself only receives presses on the backdrop: its content fills it.
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
    pressedBackdrop.current = false;
  };

  const visible = sections.filter((section) => section.tracks.length > 0);

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      style={deck ? deckStyle(deck) : undefined}
      aria-labelledby={headingId}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {deck && (
        <div className={styles.content}>
          <header className={styles.header}>
            <span className={styles.badge} aria-hidden="true">
              {deck}
            </span>
            <h2 id={headingId} className={styles.heading}>
              Pick a song<span className={styles.hidden}> for deck {deck}</span>
            </h2>
          </header>

          <div className={styles.body}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            {visible.map((section) => (
              <section key={section.label} className={styles.section}>
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
                          aria-label={
                            track.artist ? `${track.title} by ${track.artist}` : track.title
                          }
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
                <button
                  type="button"
                  className={`${styles.tile} ${styles.add}`}
                  onClick={onAddMusic}
                >
                  <span className={styles.glyph} aria-hidden="true">
                    <Mark name="add" />
                  </span>
                  <span className={styles.title}>Add music</span>
                </button>
              </li>
            </ul>
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.close} onClick={onClose}>
              <span className={styles.closeMark} aria-hidden="true">
                <Mark name="close" />
              </span>
              Close
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
