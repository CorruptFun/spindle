import type { ModeDefinition } from '@/config/modes';
import { DECK_IDS } from '@/engine/core/types';
import { defaultCrossfaderSide } from '@/engine/mixer/crossfader';
import { useBooth } from '@/state/booth';
import { DeckUnit } from '@/ui/deck/DeckUnit';
import { Crossfader } from '@/ui/mixer/Crossfader';
import styles from './Booth.module.css';

/** The instrument itself: decks on either side, the crossfader between them. */
export function Booth({ mode }: { mode: ModeDefinition }) {
  const crossfader = useBooth((state) => state.crossfader);
  const setCrossfader = useBooth((state) => state.setCrossfader);

  const decks = DECK_IDS.slice(0, mode.deckCount);
  const left = decks.filter((deck) => defaultCrossfaderSide(deck) === 'a');
  const right = decks.filter((deck) => defaultCrossfaderSide(deck) === 'b');

  return (
    <section className={styles.booth} data-mode={mode.id} aria-label="Booth">
      <div className={`${styles.side} ${styles.left}`}>
        {left.map((deck) => (
          <DeckUnit key={deck} deck={deck} />
        ))}
      </div>
      <div className={styles.side}>
        {right.map((deck) => (
          <DeckUnit key={deck} deck={deck} />
        ))}
      </div>
      <div className={styles.mixer}>
        <Crossfader value={crossfader} onChange={setCrossfader} left={left} right={right} />
      </div>
    </section>
  );
}
