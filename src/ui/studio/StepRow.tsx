import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import type { PadInfo } from '@/studio/types';
import { familyStyle } from '@/ui/theme/family-colors';
import { playheadInBar, stepLabel, stepState } from './steps';
import styles from './StepRow.module.css';

interface StepRowProps {
  pad: PadInfo;
  /** The 16 steps of the bar being shown: 0 = off, up to 1 = loudest. */
  steps: readonly number[];
  /** The same 16 steps as the other layers play them. A key that is off here but on there is outlined. */
  otherSteps?: readonly number[];
  /** Sits in the header between the pad's name and the bar switch: the layer keys. */
  headerSlot?: ReactNode;
  /** Which bar of the loop is shown (0 or 1) and how many it has. */
  bar: number;
  bars: 1 | 2;
  onBarChange: (bar: number) => void;
  /** Playhead within the whole loop, in steps (fractional), or -1 when stopped. Read every frame while running. */
  readStep: () => number;
  running: boolean;
  /** Step index within the shown bar, 0..15. */
  onToggle: (step: number) => void;
}

const BEATS = STEPS_PER_BAR / 4;

/**
 * One pad's steps, like the row of step keys on a drum machine: sixteen keys
 * in four groups of four, one group per beat. A key is dark when off, tinted
 * with the pad's colour when on, and filled with it when accented. A key that
 * another layer plays is outlined in that colour, so a new layer can be fitted
 * around the old ones. The lamp at the top of each key is the playhead, moved
 * straight on the page every frame while the loop runs and only while the bar
 * it is playing is the bar on screen.
 */
export function StepRow({
  pad,
  steps,
  otherSteps,
  headerSlot,
  bar,
  bars,
  onBarChange,
  readStep,
  running,
  onToggle,
}: StepRowProps) {
  const headingId = useId();
  const keys = useRef<(HTMLButtonElement | null)[]>([]);
  const readStepRef = useRef(readStep);
  // A two-bar view of a loop that has just become one bar long shows the bar there is.
  const shownBar = Math.min(Math.max(bar, 0), bars - 1);

  useLayoutEffect(() => {
    readStepRef.current = readStep;
  }, [readStep]);

  useEffect(() => {
    let lit = -1;
    let frame = 0;

    const show = (step: number) => {
      if (step === lit) return;
      keys.current[lit]?.removeAttribute('data-now');
      keys.current[step]?.setAttribute('data-now', 'true');
      lit = step;
    };

    const tick = () => {
      show(playheadInBar(readStepRef.current(), shownBar));
      frame = requestAnimationFrame(tick);
    };

    if (running) tick();
    return () => {
      cancelAnimationFrame(frame);
      show(-1);
    };
  }, [running, shownBar]);

  return (
    <section className={styles.row} style={familyStyle(pad.family)} aria-labelledby={headingId}>
      <header className={styles.header} data-slot={Boolean(headerSlot)}>
        <h3 id={headingId} className={styles.heading}>
          <span className={styles.chip} aria-hidden="true" />
          <span className={styles.hidden}>Steps for </span>
          {pad.name}
        </h3>

        {headerSlot}

        {bars === 2 && (
          <div className={styles.bars} role="group" aria-label="Bar">
            <span className={styles.barsLabel} aria-hidden="true">
              Bar
            </span>
            <span className={styles.switch}>
              {[0, 1].map((index) => (
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

      <div
        className={styles.keys}
        role="group"
        aria-label={bars === 2 ? `${pad.name}, bar ${shownBar + 1}` : pad.name}
      >
        {Array.from({ length: BEATS }, (_, beat) => (
          <div key={beat} className={styles.beat}>
            <span className={styles.beatNumber} aria-hidden="true">
              {beat + 1}
            </span>
            <span className={styles.beatKeys}>
              {Array.from({ length: 4 }, (_, within) => {
                const step = beat * 4 + within;
                const value = steps[step] ?? 0;
                const other = otherSteps?.[step] ?? 0;
                const state = stepState(value);
                return (
                  <button
                    key={step}
                    ref={(element) => {
                      keys.current[step] = element;
                    }}
                    type="button"
                    className={styles.key}
                    data-state={state}
                    data-other={state === 'off' && other > 0 ? 'true' : undefined}
                    aria-label={stepLabel(step, value, other)}
                    onClick={() => onToggle(step)}
                  >
                    <span className={styles.lamp} aria-hidden="true" />
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
