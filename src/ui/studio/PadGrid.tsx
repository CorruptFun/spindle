import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { PadInfo } from '@/studio/types';
import { familyStyle } from '@/ui/theme/family-colors';
import { padLight } from './pad-light';
import styles from './PadGrid.module.css';

interface PadGridProps {
  /** Exactly 8, in order. */
  pads: readonly PadInfo[];
  /** How lit a pad is right now, 0..1. Read every frame while anything is lit. */
  readGlow: (pad: number) => number;
  /** A pad was hit. Fires on pointer down, not on click, so there is no delay. */
  onHit: (pad: number) => void;
  /** The sequencer is running, so pads may light up without being touched: keep the frame loop awake. */
  running: boolean;
  /** The pad whose steps are being edited, if any. Shown as selected. */
  selected: number | null;
  /** Show each pad's name. Off in Play mode, where shape and colour do the work. */
  showNames: boolean;
}

/** A key press and the click the browser may still make from it are one hit, not two. */
const KEY_CLICK_WINDOW_MS = 400;

function isHitKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/**
 * Eight drum pads, four by two. A pad answers on the press itself: it lights
 * and goes down in the same frame, before React or the audio has done anything.
 * After that the light follows the sound (`readGlow`), written straight to the
 * page by one frame loop for all eight, which sleeps once every pad is dark and
 * the sequencer is stopped. Each finger is its own pointer, so pads can be hit
 * together.
 */
export function PadGrid({ pads, readGlow, onHit, running, selected, showNames }: PadGridProps) {
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const lights = useRef<(HTMLSpanElement | null)[]>([]);
  const readGlowRef = useRef(readGlow);
  const runningRef = useRef(running);
  const frame = useRef(0);
  /** When each pad was last touched (performance.now() time), for the touch flash. */
  const touchedAt = useRef<number[]>([]);
  /** The light level on screen per pad, so unchanged pads are not written. */
  const shown = useRef<number[]>([]);
  /** Fingers, mouse buttons or keys holding each pad down. */
  const holders = useRef<Set<string>[]>([]);
  const lastKeyHit = useRef(-Infinity);

  useLayoutEffect(() => {
    readGlowRef.current = readGlow;
  }, [readGlow]);

  const paint = useCallback((pad: number, level: number) => {
    if (shown.current[pad] === level) return;
    shown.current[pad] = level;
    const light = lights.current[pad];
    if (light) light.style.opacity = level.toString();
  }, []);

  /** Start the frame loop if it is asleep. It puts itself back to sleep when there is nothing to show. */
  const wake = useCallback(() => {
    if (frame.current !== 0) return;
    const tick = (now: number) => {
      let lit = false;
      for (let pad = 0; pad < cells.current.length; pad++) {
        const level = padLight(
          readGlowRef.current(pad),
          now - (touchedAt.current[pad] ?? -Infinity),
        );
        paint(pad, level);
        if (level > 0) lit = true;
      }
      frame.current = lit || runningRef.current ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  useEffect(() => {
    runningRef.current = running;
    if (running) wake();
  }, [running, wake]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  const press = (pad: number, holder: string) => {
    const set = (holders.current[pad] ??= new Set());
    set.add(holder);
    cells.current[pad]?.setAttribute('data-down', 'true');
  };

  const lift = (pad: number, holder: string) => {
    const set = holders.current[pad];
    if (!set?.delete(holder) || set.size > 0) return;
    cells.current[pad]?.removeAttribute('data-down');
  };

  const hit = (pad: number) => {
    // Light first, in this very event, then tell the engine.
    touchedAt.current[pad] = performance.now();
    paint(pad, 1);
    onHit(pad);
    wake();
  };

  const onPointerDown = (pad: number, event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // The lift comes back to this pad even if the finger slides off it.
    event.currentTarget.setPointerCapture(event.pointerId);
    press(pad, `pointer-${event.pointerId}`);
    hit(pad);
  };

  const onPointerEnd = (pad: number, event: PointerEvent<HTMLButtonElement>) => {
    lift(pad, `pointer-${event.pointerId}`);
  };

  const onKeyDown = (pad: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isHitKey(event.key)) return;
    // Handled here, on the way down, so the browser's own click (on key up for Space) does not hit again.
    event.preventDefault();
    if (event.repeat) return;
    lastKeyHit.current = performance.now();
    press(pad, 'key');
    hit(pad);
  };

  const onKeyUp = (pad: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isHitKey(event.key)) return;
    event.preventDefault();
    lift(pad, 'key');
  };

  // A click with no pointer behind it comes from assistive technology: that is a hit too.
  const onClick = (pad: number, event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return;
    if (performance.now() - lastKeyHit.current < KEY_CLICK_WINDOW_MS) return;
    hit(pad);
  };

  return (
    <div className={styles.frame}>
      <div className={styles.grid} role="group" aria-label="Drum pads">
        {pads.map((pad, index) => (
          <button
            key={index}
            ref={(element) => {
              cells.current[index] = element;
            }}
            type="button"
            className={styles.cell}
            style={familyStyle(pad.family)}
            data-selected={selected === index}
            aria-label={pad.name}
            aria-current={selected === index ? 'true' : undefined}
            onPointerDown={(event) => onPointerDown(index, event)}
            onPointerUp={(event) => onPointerEnd(index, event)}
            onPointerCancel={(event) => onPointerEnd(index, event)}
            onLostPointerCapture={(event) => onPointerEnd(index, event)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onKeyUp={(event) => onKeyUp(index, event)}
            onBlur={() => lift(index, 'key')}
            onClick={(event) => onClick(index, event)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className={styles.pad} aria-hidden="true">
              <span
                ref={(element) => {
                  lights.current[index] = element;
                }}
                className={styles.light}
              />
            </span>
            {showNames && (
              <span className={styles.name} aria-hidden="true">
                {pad.name}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
