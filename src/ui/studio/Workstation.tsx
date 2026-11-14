import type { ReactNode } from 'react';
import styles from './Workstation.module.css';

interface WorkstationProps {
  /** The kits and the loops to hand. */
  shelf: ReactNode;
  /** The song as a strip, in the modes that have a song. */
  song?: ReactNode;
  /** The grid of the whole beat. */
  beat: ReactNode;
  /** The eight pads, as a small block. */
  pads: ReactNode;
  transport: ReactNode;
  /** The level meter, standing. */
  meter: ReactNode;
}

/**
 * The Studio laid out as a small workstation, for a desk-sized screen. Top to
 * bottom: the shelf, the song, the whole beat as a grid, and a deck with the
 * pads, the transport and the level. It only arranges what it is given, and
 * fits it into the room it has: see the stylesheet for how the height is shared.
 */
export function Workstation({ shelf, song, beat, pads, transport, meter }: WorkstationProps) {
  return (
    <div className={styles.bench}>
      {shelf}
      {song !== undefined && <div className={styles.song}>{song}</div>}
      <div className={styles.beat}>{beat}</div>
      <div className={styles.deck}>
        <div className={styles.pads}>{pads}</div>
        <div className={styles.transport}>{transport}</div>
        <div className={styles.meter}>{meter}</div>
      </div>
    </div>
  );
}
