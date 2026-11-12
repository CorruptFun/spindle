import { useEffect, useLayoutEffect, useRef } from 'react';
import { isMeterAtRest, METER_REST, meterDb, stepMeter, type MeterState } from './meter-ballistics';
import styles from './LevelMeter.module.css';

/** After this much silence the meter stops drawing every frame. */
const SLEEP_AFTER_SEC = 0.5;
/** While asleep it checks for sound this often, which is quicker than an ear notices. */
const WAKE_POLL_MS = 100;
/** Screen readers get the value at a human pace, not sixty times a second. */
const ANNOUNCE_EVERY_SEC = 0.25;
/** A long gap (a hidden tab) is treated as this much time, so the meter does not stall. */
const MAX_STEP_SEC = 0.25;

interface LevelMeterProps {
  /** Peak level right now, 1 = full scale. Called every frame. */
  read: () => number;
  /** For screen readers, e.g. "Deck A level". */
  label: string;
  orientation?: 'vertical' | 'horizontal';
}

function spoken(level: number): string {
  if (level <= 0) return 'Silent';
  return `${Math.round(meterDb(level))} dB`;
}

/**
 * A peak meter: an LED ladder in a recessed slot, with a peak-hold mark. Takes
 * the deck's colour inside a deck and ink anywhere else. It draws outside React
 * and sleeps while there is nothing to show.
 */
export function LevelMeter({ read, label, orientation = 'vertical' }: LevelMeterProps) {
  const meterRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const peakRef = useRef<HTMLSpanElement>(null);
  const readRef = useRef(read);
  const vertical = orientation === 'vertical';

  // The latest reader, without restarting the loop (and dropping the meter) when it changes.
  useLayoutEffect(() => {
    readRef.current = read;
  }, [read]);

  useEffect(() => {
    let state: MeterState = METER_REST;
    let last = performance.now();
    let silentSec = 0;
    let sinceAnnounceSec = ANNOUNCE_EVERY_SEC;
    let announced = '';
    let shownLevel = -1;
    let shownPeak = -1;
    let frame = 0;
    let timer = 0;

    const paint = () => {
      if (state.level !== shownLevel && fillRef.current) {
        shownLevel = state.level;
        fillRef.current.style.transform = vertical
          ? `scaleY(${shownLevel.toFixed(4)})`
          : `scaleX(${shownLevel.toFixed(4)})`;
      }
      if (state.peak !== shownPeak && peakRef.current) {
        shownPeak = state.peak;
        // The mark rides on a full-size layer, so a percentage moves it by the slot's length.
        const offset = ((1 - shownPeak) * 100).toFixed(3);
        peakRef.current.style.transform = vertical
          ? `translateY(${offset}%)`
          : `translateX(-${offset}%)`;
      }
    };

    const announce = (dt: number) => {
      sinceAnnounceSec += dt;
      if (sinceAnnounceSec < ANNOUNCE_EVERY_SEC || !meterRef.current) return;
      sinceAnnounceSec = 0;
      const text = spoken(state.level);
      if (text === announced) return;
      announced = text;
      meterRef.current.setAttribute('aria-valuenow', Math.round(state.level * 100).toString());
      meterRef.current.setAttribute('aria-valuetext', text);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_STEP_SEC);
      last = now;
      const input = readRef.current();
      state = stepMeter(state, input, dt);
      paint();
      announce(dt);

      silentSec = input > 0 || !isMeterAtRest(state) ? 0 : silentSec + dt;
      if (silentSec < SLEEP_AFTER_SEC) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        timer = window.setTimeout(listen, WAKE_POLL_MS);
      }
    };

    // Asleep: no drawing, just an occasional look for sound.
    const listen = () => {
      timer = 0;
      if (readRef.current() > 0) {
        last = performance.now();
        silentSec = 0;
        frame = requestAnimationFrame(tick);
      } else {
        timer = window.setTimeout(listen, WAKE_POLL_MS);
      }
    };

    paint();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [vertical]);

  return (
    <div
      ref={meterRef}
      className={styles.meter}
      data-orientation={orientation}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-valuetext="Silent"
    >
      <span className={styles.window} aria-hidden="true">
        <span className={styles.ladder}>
          <span ref={fillRef} className={styles.fill} />
        </span>
        <span ref={peakRef} className={styles.peak} />
      </span>
    </div>
  );
}
