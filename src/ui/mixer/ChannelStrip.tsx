import type { DeckId } from '@/engine/core/types';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { deckStyle } from '@/ui/theme/deck-colors';
import { ChannelFader } from './ChannelFader';
import styles from './ChannelStrip.module.css';

interface ChannelStripProps {
  deck: DeckId;
  /** Fader travel: 0 = bottom, 1 = top. */
  value: number;
  onChange: (value: number) => void;
  /** The channel's peak level right now, 1 = full scale. Called every frame. */
  readLevel: () => number;
  /** A hand or a key landed on this strip. */
  onTouch?: () => void;
}

/**
 * One channel of the mixer: the deck's level meter beside its fader, both in
 * the deck's colour. As tall as the row of strips it stands in.
 */
export function ChannelStrip({ deck, value, onChange, readLevel, onTouch }: ChannelStripProps) {
  return (
    <div
      className={styles.strip}
      style={deckStyle(deck)}
      onPointerDownCapture={onTouch}
      onKeyDownCapture={onTouch}
    >
      <LevelMeter read={readLevel} label={`Deck ${deck} level`} />
      <ChannelFader deck={deck} value={value} onChange={onChange} />
    </div>
  );
}
