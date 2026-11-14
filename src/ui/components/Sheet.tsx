import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react';
import styles from './Sheet.module.css';
import { Mark } from './TrackGlyph';

interface SheetProps {
  open: boolean;
  /** Asked for by Escape, a tap outside, or the Close button. The parent owns open and closed. */
  onClose: () => void;
  /** What the sheet is, in a few words. */
  heading: ReactNode;
  /** Something small shown before the heading, such as a deck's badge. */
  lead?: ReactNode;
  style?: CSSProperties;
  /** Controls that belong beside Close, so they never scroll out of reach. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * A panel that sits above the app: a sheet from the bottom on a phone, a
 * centred panel on anything larger. A native modal dialog, so focus stays
 * inside it and Escape closes it without extra code. Every sheet in the app is
 * this one, so there is one place where it has to work on every browser.
 */
export function Sheet({ open, onClose, heading, lead, style, actions, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
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
    // Very old browsers have the element but not the modal behaviour; the sheet still opens there.
    const modal = typeof dialog.showModal === 'function';
    if (open && !dialog.open) {
      if (modal) dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (modal) dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  // Escape asks the parent to close rather than closing by itself; if the browser closes the
  // dialog anyway (it may on a second Escape), tell the parent.
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

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      style={style}
      aria-labelledby={headingId}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {open && (
        <div className={styles.content}>
          <header className={styles.header}>
            {lead}
            <h2 id={headingId} className={styles.heading}>
              {heading}
            </h2>
          </header>

          <div className={styles.body}>{children}</div>

          <footer className={styles.footer} data-actions={actions !== undefined}>
            {actions}
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
