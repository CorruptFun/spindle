import type { CSSProperties } from 'react';
import type { PadFamily } from '@/studio/types';

const FAMILY_COLOR: Record<PadFamily, string> = {
  low: 'var(--family-low)',
  snare: 'var(--family-snare)',
  hat: 'var(--family-hat)',
  perc: 'var(--family-perc)',
};

/** Inline style that hands a drum family's colour to everything drawn inside the element as `--family`. */
export function familyStyle(family: PadFamily): CSSProperties {
  return { '--family': FAMILY_COLOR[family] } as CSSProperties;
}
