import type { DeckId } from '@/engine/core/types';
import { crossfaderGains, defaultCrossfaderSide } from '@/engine/mixer/crossfader';
import { useBooth } from '@/state/booth';
import { TransportButton } from '@/ui/components/TransportButton';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './DeckUnit.module.css';
import { Platter } from './Platter';

/** One deck: what is loaded, the record, and its transport. */
export function DeckUnit({ deck }: { deck: DeckId }) {
  const playing = useBooth((state) => state.playing[deck]);
  const togglePlay = useBooth((state) => state.togglePlay);
  // How present this deck is in the mix, for dimming its colour. Both decks are at full
  // colour with the crossfader centred (where each gain is 1/√2) and fade only beyond it.
  const presence = useBooth((state) =>
    Math.min(1, crossfaderGains(state.crossfader)[defaultCrossfaderSide(deck)] * Math.SQRT2),
  );

  return (
    <section className={styles.unit} aria-label={`Deck ${deck}`} style={deckStyle(deck, presence)}>
      <header className={styles.strip}>
        <span className={styles.badge}>{deck}</span>
        <span className={styles.track}>No track loaded</span>
      </header>

      <div className={styles.platter}>
        <Platter deck={deck} playing={playing} />
      </div>

      <TransportButton
        playing={playing}
        target={`deck ${deck}`}
        onToggle={() => togglePlay(deck)}
      />
    </section>
  );
}
