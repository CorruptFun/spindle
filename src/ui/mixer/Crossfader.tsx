import type { DeckId } from '@/engine/core/types';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './Crossfader.module.css';

interface CrossfaderProps {
  /** 0 = hard left, 0.5 = centre, 1 = hard right. */
  value: number;
  onChange: (value: number) => void;
  /** Decks assigned to each end, outermost last. */
  left: readonly DeckId[];
  right: readonly DeckId[];
}

function describe(value: number, left: readonly DeckId[], right: readonly DeckId[]): string {
  const leftName = `deck ${left.join(' and ')}`;
  const rightName = `deck ${right.join(' and ')}`;
  if (value <= 0.01) return `Only ${leftName}`;
  if (value >= 0.99) return `Only ${rightName}`;
  if (Math.abs(value - 0.5) < 0.01) return 'Centre';
  return value < 0.5 ? `Towards ${leftName}` : `Towards ${rightName}`;
}

/**
 * The crossfader. A native range input underneath, so keyboard, screen readers
 * and touch all work without extra code; styled as a slot with a fader cap.
 * Double-click or double-tap snaps back to the centre.
 */
export function Crossfader({ value, onChange, left, right }: CrossfaderProps) {
  return (
    <div className={styles.crossfader}>
      <Ends decks={left} />
      <input
        className={styles.slot}
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={value}
        aria-label="Crossfader"
        aria-valuetext={describe(value, left, right)}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        onDoubleClick={() => onChange(0.5)}
      />
      <Ends decks={right} />
    </div>
  );
}

function Ends({ decks }: { decks: readonly DeckId[] }) {
  return (
    <span className={styles.ends} aria-hidden="true">
      {decks.map((deck) => (
        <span key={deck} className={styles.end} style={deckStyle(deck)}>
          {deck}
        </span>
      ))}
    </span>
  );
}
