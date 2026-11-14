import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { STEPS_PER_BAR, STEPS_PER_BEAT } from '@/engine/sequencer/types';
import type { PadInfo } from '@/studio/types';
import { familyStyle } from '@/ui/theme/family-colors';
import { gridStepLabel, playheadStep, stepState } from './steps';
import styles from './BeatGrid.module.css';

interface BeatGridProps {
  /** Exactly 8, in order: one row each, top to bottom. */
  pads: readonly PadInfo[];
  /** The chosen layer, one lane per pad, every step of the loop: 0 = off, up to 1 = loudest. */
  lanes: readonly (readonly number[])[];
  /** The same steps as the other layers play them. A key that is off here but on there is outlined. */
  otherLanes: readonly (readonly number[])[];
  bars: 1 | 2;
  /** The bar shown where there is room for only one of two (0 or 1). */
  bar: number;
  onBarChange: (bar: number) => void;
  /** The pad last played or edited. Its row's name is shown as chosen. */
  selected: number;
  /** Sits at the start of the header: the layer keys. */
  headerSlot?: ReactNode;
  /** Playhead within the whole loop, in steps (fractional), or -1 when stopped. Read every frame while running. */
  readStep: () => number;
  running: boolean;
  /** A row's name was pressed: play its pad. */
  onHit: (pad: number) => void;
  /** A key was pressed: the pad, and the step counted from the start of the loop. */
  onToggle: (pad: number, step: number) => void;
}

const BEATS = STEPS_PER_BAR / STEPS_PER_BEAT;
const ONE_BAR: readonly number[] = [0];
const TWO_BARS: readonly number[] = [0, 1];
const NO_STEPS: readonly number[] = [];

/**
 * The whole beat at once, like the face of a drum machine: a row for each pad
 * in its family's colour, sixteen keys to the bar in four groups of four, and
 * both bars of a loop side by side where there is room (the stylesheet
 * decides; otherwise one bar and a switch). The keys are the step row's keys:
 * dark when off, tinted when on, filled when accented, outlined where another
 * layer plays. The name at the start of a row plays its pad. One frame loop
 * moves the playhead lamp down all eight rows together, straight on the page.
 */
export function BeatGrid({
  pads,
  lanes,
  otherLanes,
  bars,
  bar,
  onBarChange,
  selected,
  headerSlot,
  readStep,
  running,
  onHit,
  onToggle,
}: BeatGridProps) {
  const grid = useRef<HTMLElement>(null);
  const readStepRef = useRef(readStep);
  // A two-bar view of a loop that has just become one bar long shows the bar there is.
  const shownBar = Math.min(Math.max(bar, 0), bars - 1);
  const steps = bars * STEPS_PER_BAR;
  const barIndices = bars === 2 ? TWO_BARS : ONE_BAR;

  useLayoutEffect(() => {
    readStepRef.current = readStep;
  }, [readStep]);

  useEffect(() => {
    const element = grid.current;
    if (!element || !running) return;

    // The eight keys of a step, found once and kept: the keys stay put while the loop keeps its length.
    const columns = new Map<number, Element[]>();
    const column = (step: number): Element[] => {
      let keys = columns.get(step);
      if (!keys) {
        keys = step < 0 ? [] : Array.from(element.querySelectorAll(`[data-step="${step}"]`));
        columns.set(step, keys);
      }
      return keys;
    };

    let lit = -1;
    let frame = 0;

    const show = (step: number) => {
      if (step === lit) return;
      for (const key of column(lit)) key.removeAttribute('data-now');
      for (const key of column(step)) key.setAttribute('data-now', 'true');
      lit = step;
    };

    const tick = () => {
      show(playheadStep(readStepRef.current(), steps));
      frame = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(frame);
      show(-1);
    };
  }, [running, steps]);

  return (
    <section ref={grid} className={styles.grid} data-bar={shownBar} aria-label="Steps">
      <header className={styles.header}>
        {headerSlot}

        {bars === 2 && (
          <div className={styles.barSwitch} role="group" aria-label="Bar">
            <span className={styles.barLabel} aria-hidden="true">
              Bar
            </span>
            <span className={styles.switch}>
              {TWO_BARS.map((index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.barOption}
                  aria-pressed={shownBar === index}
                  aria-label={`Bar ${index + 1}`}
                  onClick={() => onBarChange(index)}
                >
                  {index + 1}
                </button>
              ))}
            </span>
          </div>
        )}
      </header>

      {/* The beats, counted above the keys. */}
      <div className={styles.scale} aria-hidden="true">
        <span />
        <span className={styles.bars}>
          {barIndices.map((barIndex) => (
            <span key={barIndex} className={styles.bar} data-index={barIndex}>
              {Array.from({ length: BEATS }, (_, beat) => (
                <span key={beat} className={styles.beatNumber}>
                  {beat + 1}
                </span>
              ))}
            </span>
          ))}
        </span>
      </div>

      <div className={styles.rows}>
        {pads.map((pad, index) => (
          <BeatRow
            key={index}
            pad={pad}
            index={index}
            bars={bars}
            lane={lanes[index] ?? NO_STEPS}
            other={otherLanes[index] ?? NO_STEPS}
            selected={selected === index}
            onHit={onHit}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}

interface BeatRowProps {
  pad: PadInfo;
  index: number;
  bars: 1 | 2;
  lane: readonly number[];
  other: readonly number[];
  selected: boolean;
  onHit: (pad: number) => void;
  onToggle: (pad: number, step: number) => void;
}

function sameSteps(a: readonly number[], b: readonly number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, step) => value === b[step]);
}

/** An edit changes one row: the other seven are left as they are drawn. */
function sameRow(a: BeatRowProps, b: BeatRowProps): boolean {
  return (
    a.pad === b.pad &&
    a.index === b.index &&
    a.bars === b.bars &&
    a.selected === b.selected &&
    a.onHit === b.onHit &&
    a.onToggle === b.onToggle &&
    sameSteps(a.lane, b.lane) &&
    sameSteps(a.other, b.other)
  );
}

/** One pad's row: its name, then its keys bar by bar and beat by beat. */
const BeatRow = memo(function BeatRow({
  pad,
  index,
  bars,
  lane,
  other,
  selected,
  onHit,
  onToggle,
}: BeatRowProps) {
  const barIndices = bars === 2 ? TWO_BARS : ONE_BAR;
  return (
    <div
      className={styles.row}
      style={familyStyle(pad.family)}
      role="group"
      aria-label={`${pad.name} steps`}
    >
      <button
        type="button"
        className={styles.name}
        data-selected={selected}
        aria-current={selected ? 'true' : undefined}
        // On the press, like a pad, so the sound does not wait for the finger to lift.
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          onHit(index);
        }}
        // A click with no pointer behind it comes from the keyboard or assistive technology.
        onClick={(event) => {
          if (event.detail === 0) onHit(index);
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className={styles.chip} aria-hidden="true" />
        <span className={styles.label}>{pad.name}</span>
      </button>

      <div className={styles.bars}>
        {barIndices.map((barIndex) => (
          <div key={barIndex} className={styles.bar} data-index={barIndex}>
            {Array.from({ length: BEATS }, (_, beat) => (
              <div key={beat} className={styles.beat}>
                {Array.from({ length: STEPS_PER_BEAT }, (_, within) => {
                  const step = barIndex * STEPS_PER_BAR + beat * STEPS_PER_BEAT + within;
                  const value = lane[step] ?? 0;
                  const others = other[step] ?? 0;
                  const state = stepState(value);
                  return (
                    <button
                      key={step}
                      type="button"
                      className={styles.key}
                      data-step={step}
                      data-state={state}
                      data-other={state === 'off' && others > 0 ? 'true' : undefined}
                      aria-label={gridStepLabel(step, bars, value, others)}
                      onClick={() => onToggle(index, step)}
                    >
                      <span className={styles.lamp} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}, sameRow);
