import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import { PAD_ROLES } from '@/studio/types';
import type { DrumPattern, PadFamily, PadRole } from '@/studio/types';

export interface PictureRow {
  readonly family: PadFamily;
  /** Sixteen steps of the first bar: 0 is silent, up to 1 is the loudest hit on any pad in the row. */
  readonly steps: readonly number[];
}

/**
 * The rows of a loop's picture, top to bottom: hats, snare and clap, kick,
 * as they sit on a drum machine's grid and in most drum notation. The pads in
 * one row are merged, so a clap on the backbeat shows the same as a snare.
 */
const ROWS: readonly { family: PadFamily; roles: readonly PadRole[] }[] = [
  { family: 'hat', roles: ['closed-hat', 'open-hat'] },
  { family: 'snare', roles: ['snare', 'clap'] },
  { family: 'low', roles: ['kick'] },
];

function padsFor(roles: readonly PadRole[]): number[] {
  return PAD_ROLES.flatMap((pad, index) => (roles.includes(pad.role) ? [index] : []));
}

const ROW_PADS = ROWS.map((row) => ({ family: row.family, pads: padsFor(row.roles) }));

/** A small picture of a loop, drawn from its real first bar. */
export function loopPicture(pattern: DrumPattern): PictureRow[] {
  return ROW_PADS.map(({ family, pads }) => ({
    family,
    steps: Array.from({ length: STEPS_PER_BAR }, (_, step) => {
      let loudest = 0;
      for (const pad of pads) {
        const value = pattern.lanes[pad]?.[step] ?? 0;
        if (value > loudest) loudest = Math.min(1, value);
      }
      return loudest;
    }),
  }));
}

export interface SlotStatus {
  active: boolean;
  queued: boolean;
  playing: boolean;
  edited: boolean;
}

/** Screen-reader name of a loop tile: "Loop 3, Boom Bap, playing". */
export function loopSlotLabel(slot: number, name: string, status: SlotStatus): string {
  const parts = [`Loop ${slot + 1}`, name];
  if (status.active) parts.push(status.playing ? 'playing' : 'chosen');
  else if (status.queued) parts.push('plays next');
  if (status.edited) parts.push('changed');
  return parts.join(', ');
}
