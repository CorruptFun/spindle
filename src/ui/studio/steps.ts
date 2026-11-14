import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import { STEP_ACCENT } from '@/studio/pattern';

/** What a step button shows. Anything softer than an accent, ghost notes included, is just "on". */
export type StepState = 'off' | 'on' | 'accent';

export function stepState(value: number): StepState {
  if (!(value > 0)) return 'off';
  return value >= STEP_ACCENT ? 'accent' : 'on';
}

/**
 * The step to light in the bar on screen, or -1 when the playhead is elsewhere.
 * `position` is the playhead within the whole loop, in steps (fractional), and
 * -1 when stopped.
 */
export function playheadInBar(position: number, bar: number): number {
  if (!(position >= 0)) return -1;
  const step = Math.floor(position);
  return Math.floor(step / STEPS_PER_BAR) === bar ? step % STEPS_PER_BAR : -1;
}

/**
 * Screen-reader name of a step button: "Step 5, on". A step that is off here
 * but played by another layer says so: "Step 5, played by another layer".
 */
export function stepLabel(step: number, value: number, other = 0): string {
  const state = stepState(value);
  if (state === 'off' && other > 0) return `Step ${step + 1}, played by another layer`;
  return `Step ${step + 1}, ${state}`;
}
