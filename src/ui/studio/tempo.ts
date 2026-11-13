import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/engine/sequencer/types';

/** A long hold moves in steps this big, landing on round numbers. */
export const COARSE_BPM = 5;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

/**
 * One press of minus (-1) or plus (+1). A fine step moves one beat per minute
 * from wherever the tempo is; a coarse step lands on the next multiple of
 * COARSE_BPM in that direction, so a long hold arrives at a round number.
 */
export function nudgeTempo(bpm: number, direction: -1 | 1, coarse = false): number {
  const whole = Math.round(clampBpm(bpm));
  if (!coarse) return clampBpm(whole + direction);
  const next =
    direction > 0
      ? (Math.floor(whole / COARSE_BPM) + 1) * COARSE_BPM
      : (Math.ceil(whole / COARSE_BPM) - 1) * COARSE_BPM;
  return clampBpm(next);
}

/** The tempo a key press asks for, or null when the key is not a tempo key. Matches a native spin button. */
export function tempoForKey(bpm: number, key: string): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return nudgeTempo(bpm, 1);
    case 'ArrowDown':
    case 'ArrowLeft':
      return nudgeTempo(bpm, -1);
    case 'PageUp':
      return clampBpm(Math.round(bpm) + 10);
    case 'PageDown':
      return clampBpm(Math.round(bpm) - 10);
    case 'Home':
      return MIN_BPM;
    case 'End':
      return MAX_BPM;
    default:
      return null;
  }
}

/** Swing for screen readers: "Straight", or how far towards the most swing there is. */
export function describeSwing(swing: number): string {
  const share = Math.min(1, Math.max(0, swing / MAX_SWING));
  if (!(share > 0.005)) return 'Straight';
  return `${Math.round(share * 100)}% swing`;
}
