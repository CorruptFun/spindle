import type { PadFamily } from '@/studio/types';

/** What a layer box shows: whether it has anything in it, whether it is switched off, and which sounds. */
export interface LayerSummary {
  readonly empty: boolean;
  readonly muted: boolean;
  /** In the order low, snare, hat, perc. */
  readonly families: readonly PadFamily[];
}

const FAMILY_WORDS: Readonly<Record<PadFamily, string>> = {
  low: 'kick',
  snare: 'snare',
  hat: 'hats',
  perc: 'percussion',
};

/** "kick", "kick and snare", "kick, snare and hats". */
function listOf(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]!}`;
}

/** Screen-reader name of a layer box: "Layer 2, kick and snare", "Layer 1, hats, switched off". */
export function layerLabel(layer: number, summary: LayerSummary): string {
  const sounds =
    summary.empty || summary.families.length === 0
      ? 'empty'
      : listOf(summary.families.map((family) => FAMILY_WORDS[family]));
  const parts = [`Layer ${layer + 1}`, sounds];
  if (summary.muted) parts.push('switched off');
  return parts.join(', ');
}
