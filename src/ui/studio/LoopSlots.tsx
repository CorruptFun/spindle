import { useMemo } from 'react';
import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import type { DrumPattern } from '@/studio/types';
import { familyStyle } from '@/ui/theme/family-colors';
import { loopPicture, loopSlotLabel } from './loop-picture';
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

/*
 * The picture's grid, in its own units: sixteen cells a row, a wider gap
 * between beats so the four beats read at a glance, three rows.
 */
const CELL = 4;
const CELL_GAP = 1.5;
const BEAT_GAP = 3.5;
const ROW_GAP = 2.5;
const ROWS = 3;
/** A rest is drawn as a dot this wide, half a cell. */
const REST = 2;
const PICTURE_WIDTH = STEPS_PER_BAR * CELL + (STEPS_PER_BAR - 4) * CELL_GAP + 3 * BEAT_GAP;
const PICTURE_HEIGHT = ROWS * CELL + (ROWS - 1) * ROW_GAP;
/** Below this a hit is drawn softer, the way a ghost note sounds. */
const SOFT_HIT = 0.6;

function cellX(step: number): number {
  const beat = Math.floor(step / 4);
  const within = step % 4;
  return beat * (4 * CELL + 3 * CELL_GAP + BEAT_GAP) + within * (CELL + CELL_GAP);
}

/** The first bar of a loop, drawn from its real pattern: hats, snare and clap, kick. */
function LoopPicture({ pattern }: { pattern: DrumPattern }) {
  const rows = useMemo(() => loopPicture(pattern), [pattern]);
  return (
    <svg
      className={styles.picture}
      viewBox={`0 0 ${PICTURE_WIDTH} ${PICTURE_HEIGHT}`}
      aria-hidden="true"
    >
      {rows.map((row, rowIndex) => (
        <g key={row.family} style={familyStyle(row.family)}>
          {row.steps.map((value, step) => {
            const x = cellX(step);
            const y = rowIndex * (CELL + ROW_GAP);
            if (value <= 0) {
              // A rest: a small mark, so the empty grid is still there to read against.
              return (
                <rect
                  key={step}
                  className={styles.rest}
                  x={x + CELL / 2 - REST / 2}
                  y={y + CELL / 2 - REST / 2}
                  width={REST}
                  height={REST}
                  rx={REST / 2}
                />
              );
            }
            return (
              <rect
                key={step}
                className={styles.hit}
                data-soft={value < SOFT_HIT}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={1}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
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
