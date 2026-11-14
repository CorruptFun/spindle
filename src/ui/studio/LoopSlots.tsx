import type { DrumPattern } from '@/studio/types';
import { loopSlotLabel } from './loop-picture';
import { LoopPicture } from './LoopPicture';
import styles from './LoopSlots.module.css';

export interface LoopSlot {
  name: string;
  pattern: DrumPattern;
  /** The person has changed this loop from the one it shipped with. */
  edited: boolean;
}

interface LoopSlotsProps {
  /** Exactly 8. */
  slots: readonly LoopSlot[];
  active: number;
  /** A loop waiting for the next bar line, if any. */
  queued: number | null;
  playing: boolean;
  showNames: boolean;
  onSelect: (slot: number) => void;
}

/**
 * The eight loops to hand, four by two. Each tile shows a picture of its loop,
 * so a loop can be chosen by how it looks. The chosen loop wears an ink ring;
 * one waiting for the next bar line has a ring that breathes until it comes in.
 */
export function LoopSlots({ slots, active, queued, playing, showNames, onSelect }: LoopSlotsProps) {
  return (
    <div className={styles.slots} role="group" aria-label="Loops" data-names={showNames}>
      {slots.map((slot, index) => {
        const isActive = index === active;
        const isQueued = !isActive && index === queued;
        return (
          <button
            key={index}
            type="button"
            className={styles.tile}
            data-active={isActive}
            data-queued={isQueued}
            aria-pressed={isActive}
            aria-label={loopSlotLabel(index, slot.name, {
              active: isActive,
              queued: isQueued,
              playing,
              edited: slot.edited,
            })}
            onClick={() => onSelect(index)}
          >
            <LoopPicture pattern={slot.pattern} />
            {showNames && (
              <span className={styles.name} aria-hidden="true">
                {slot.name}
              </span>
            )}
            {slot.edited && <span className={styles.edited} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
