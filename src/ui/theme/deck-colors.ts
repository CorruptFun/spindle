import type { CSSProperties } from 'react';
import type { DeckId } from '@/engine/core/types';

const DECK_COLOR: Record<DeckId, string> = {
  A: 'var(--deck-a)',
  B: 'var(--deck-b)',
  C: 'var(--deck-c)',
  D: 'var(--deck-d)',
};

export function deckColor(deck: DeckId): string {
  return DECK_COLOR[deck];
}

/**
 * Inline style that hands a deck's colour, and optionally how present it is in
 * the mix (0 = faded out, 1 = full), to everything drawn inside the element.
 */
export function deckStyle(deck: DeckId, presence?: number): CSSProperties {
  return {
    '--deck': deckColor(deck),
    ...(presence === undefined ? {} : { '--presence': presence }),
  } as CSSProperties;
}
