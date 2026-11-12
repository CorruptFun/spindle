import type { DeckId } from '@/engine/core/types';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './ChannelFader.module.css';

interface ChannelFaderProps {
  deck: DeckId;
  /** 0 = bottom, 1 = top. */
  value: number;
  onChange: (value: number) => void;
}

function describe(value: number): string {
  if (value <= 0.005) return 'Off';
  if (value >= 0.995) return 'Full';
  return `${Math.round(value * 100)}%`;
}

/**
 * A deck's volume fader: the crossfader turned upright. A native range input
 * underneath (keyboard, screen reader and touch for free), rotated into a
 * vertical slot with the same cap, plus the deck's badge at its foot.
 * Double-click or double-tap returns it to the top.
 *
 * It fills the height its parent gives it (a stretched flex item, or
 * `--fader-length` on any parent); the slot is never shorter than two touch targets.
 */
export function ChannelFader({ deck, value, onChange }: ChannelFaderProps) {
  return (
    <div className={styles.fader} style={deckStyle(deck)}>
      <div className={styles.rail}>
        <input
          className={styles.slot}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          aria-label={`Deck ${deck} volume`}
          aria-valuetext={describe(value)}
          aria-orientation="vertical"
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          onDoubleClick={() => onChange(1)}
        />
      </div>
      <span className={styles.badge} aria-hidden="true">
        {deck}
      </span>
    </div>
  );
}
