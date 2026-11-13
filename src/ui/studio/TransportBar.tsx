import { useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/engine/sequencer/types';
import { Mark } from '@/ui/components/TrackGlyph';
import { describeSwing, nudgeTempo, tempoForKey } from './tempo';
import styles from './TransportBar.module.css';

interface TransportBarProps {
  playing: boolean;
  recording: boolean;
  bpm: number;
  /** 0..MAX_SWING. */
  swing: number;
  /** Which extras this skill mode shows. */
  showRecord: boolean;
  showTempo: boolean;
  showSwing: boolean;
  showReset: boolean;
  /** The current loop differs from the one it shipped with, so Reset has something to do. */
  canReset: boolean;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onTempoChange: (bpm: number) => void;
  onSwingChange: (swing: number) => void;
  onReset: () => void;
}

/**
 * The Studio's transport: play and stop, and for the older hands record,
 * tempo, swing and reset. Anything a mode does not show is not rendered at
 * all, so in Play mode this is one big button.
 */
export function TransportBar({
  playing,
  recording,
  bpm,
  swing,
  showRecord,
  showTempo,
  showSwing,
  showReset,
  canReset,
  onTogglePlay,
  onToggleRecord,
  onTempoChange,
  onSwingChange,
  onReset,
}: TransportBarProps) {
  return (
    <div className={styles.bar} role="group" aria-label="Transport">
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.play}
          aria-pressed={playing}
          aria-label="Play the loop"
          onClick={onTogglePlay}
        >
          {/* Drawn like the decks' play button. Stop, not pause: the loop starts again from the top. */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {playing ? (
              <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
            ) : (
              <path d="M8.5 5.6v12.8a.6.6 0 0 0 .92.5l9.9-6.4a.6.6 0 0 0 0-1L9.42 5.1a.6.6 0 0 0-.92.5Z" />
            )}
          </svg>
        </button>

        {showRecord && (
          <button
            type="button"
            className={styles.record}
            aria-pressed={recording}
            aria-label="Record"
            onClick={onToggleRecord}
          >
            <span className={styles.mark} aria-hidden="true">
              <Mark name="record" />
            </span>
          </button>
        )}
      </div>

      {showTempo && <Tempo bpm={bpm} onChange={onTempoChange} />}

      {showSwing && (
        <label className={styles.control}>
          <span className={styles.label}>Swing</span>
          <input
            className={styles.swing}
            type="range"
            min={0}
            max={MAX_SWING}
            step={0.01}
            value={swing}
            aria-valuetext={describeSwing(swing)}
            onChange={(event) => onSwingChange(event.currentTarget.valueAsNumber)}
            onDoubleClick={() => onSwingChange(0)}
          />
        </label>
      )}

      {showReset && (
        <button
          type="button"
          className={styles.reset}
          aria-disabled={!canReset}
          aria-label="Reset the loop to how it came"
          onClick={() => {
            if (canReset) onReset();
          }}
        >
          <span className={styles.mark} aria-hidden="true">
            <Mark name="reset" />
          </span>
        </button>
      )}
    </div>
  );
}

/** A held minus or plus waits this long before it starts to repeat, like a key on a keyboard. */
const REPEAT_DELAY_MS = 420;
const REPEAT_EVERY_MS = 70;
/** After this many repeats a held button moves in round fives. */
const REPEATS_BEFORE_COARSE = 12;

interface TempoProps {
  bpm: number;
  onChange: (bpm: number) => void;
}

/**
 * Tempo: a readout in whole beats per minute between minus and plus. The
 * buttons step once on the press and repeat while held, speeding up to round
 * fives. The readout is a spin button, so arrows, Page Up/Down, Home and End
 * work on it from the keyboard.
 */
function Tempo({ bpm, onChange }: TempoProps) {
  const bpmRef = useRef(bpm);
  const onChangeRef = useRef(onChange);
  /** The tempo last asked for, so a fast repeat does not have to wait for the parent to re-render. */
  const asked = useRef(bpm);
  const timer = useRef(0);
  const shown = Math.round(bpm);

  useLayoutEffect(() => {
    bpmRef.current = bpm;
    asked.current = bpm;
    onChangeRef.current = onChange;
  }, [bpm, onChange]);

  const stopRepeat = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
  };

  useEffect(() => stopRepeat, []);

  const step = (direction: -1 | 1, coarse: boolean) => {
    const next = nudgeTempo(asked.current, direction, coarse);
    if (next === Math.round(asked.current)) return false;
    asked.current = next;
    onChangeRef.current(next);
    return true;
  };

  const startRepeat = (direction: -1 | 1, event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stopRepeat();
    asked.current = bpmRef.current;
    step(direction, false);
    let repeats = 0;
    const again = () => {
      repeats += 1;
      const moved = step(direction, repeats > REPEATS_BEFORE_COARSE);
      timer.current = moved ? window.setTimeout(again, REPEAT_EVERY_MS) : 0;
    };
    timer.current = window.setTimeout(again, REPEAT_DELAY_MS);
  };

  // Keyboard and assistive technology press the button without a pointer: one step per press.
  const onClick = (direction: -1 | 1, event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return;
    asked.current = bpmRef.current;
    step(direction, false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tempoForKey(bpm, event.key);
    if (next === null) return;
    event.preventDefault();
    if (next !== shown) onChange(next);
  };

  const pressHandlers = (direction: -1 | 1) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => startRepeat(direction, event),
    onPointerUp: stopRepeat,
    onPointerCancel: stopRepeat,
    onLostPointerCapture: stopRepeat,
    onClick: (event: MouseEvent<HTMLButtonElement>) => onClick(direction, event),
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
  });

  return (
    <div className={styles.control}>
      <span className={styles.label} aria-hidden="true">
        Tempo
      </span>
      <div className={styles.tempo}>
        <button
          type="button"
          className={styles.nudge}
          aria-label="Slower"
          aria-disabled={shown <= MIN_BPM}
          {...pressHandlers(-1)}
        >
          <span className={styles.mark} aria-hidden="true">
            <Mark name="minus" />
          </span>
        </button>
        <div
          className={styles.readout}
          role="spinbutton"
          tabIndex={0}
          aria-label="Tempo"
          aria-valuemin={MIN_BPM}
          aria-valuemax={MAX_BPM}
          aria-valuenow={shown}
          aria-valuetext={`${shown} beats per minute`}
          onKeyDown={onKeyDown}
        >
          <span className={styles.number}>{shown}</span>
          <span className={styles.unit} aria-hidden="true">
            BPM
          </span>
        </div>
        <button
          type="button"
          className={styles.nudge}
          aria-label="Faster"
          aria-disabled={shown >= MAX_BPM}
          {...pressHandlers(1)}
        >
          <span className={styles.mark} aria-hidden="true">
            <Mark name="add" />
          </span>
        </button>
      </div>
    </div>
  );
}
