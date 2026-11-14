import type { CSSProperties, ReactNode } from 'react';
import type { DeckId } from '@/engine/core/types';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { Crossfader } from './Crossfader';
import styles from './MixerUnit.module.css';

interface MixerUnitProps {
  /** One channel strip for each deck on screen, in the order the decks sit. */
  children: ReactNode;
  /** 0 = hard left, 0.5 = centre, 1 = hard right. */
  crossfader: number;
  onCrossfader: (value: number) => void;
  /** Decks assigned to each end of the crossfader, outermost last. */
  left: readonly DeckId[];
  right: readonly DeckId[];
  /** Peak level of the finished mix, 1 = full scale. Called every frame. */
  readMaster: () => number;
}

/**
 * The mixer as one unit, for a screen with room to stand it between the decks:
 * the channel strips, then the master level over the crossfader. It holds only
 * what the engine can do today.
 */
export function MixerUnit({
  children,
  crossfader,
  onCrossfader,
  left,
  right,
  readMaster,
}: MixerUnitProps) {
  // How many deck letters stand at each end of the crossfader: the master meter steps in by
  // as much, so it lines up with the slot.
  const ends = { '--ends': Math.max(left.length, right.length, 1) } as CSSProperties;

  return (
    <div className={styles.mixer} role="group" aria-label="Mixer" style={ends}>
      <div className={styles.channels} role="group" aria-label="Channel faders">
        {children}
      </div>
      <div className={styles.output}>
        <div className={styles.master}>
          <LevelMeter read={readMaster} label="Master level" orientation="horizontal" />
        </div>
        <Crossfader value={crossfader} onChange={onCrossfader} left={left} right={right} />
      </div>
    </div>
  );
}
