import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { DeckId } from '@/engine/core/types';
import {
  isAtRest,
  MAX_VELOCITY_DEG,
  shortestArcDeg,
  stepPlatter,
  type PlatterMotion,
} from '@/engine/deck/platter';
import { clamp, lerp } from '@/lib/audio-math';
import styles from './Platter.module.css';

/** Radii of the visible groove rings, in a 200-unit viewBox. The gaps read as track breaks. */
const GROOVES = [40, 43.5, 47, 50.5, 54, 60, 63.5, 67, 70.5, 74, 80, 83.5, 87];

/** A hand that has not moved for this long is holding the record still, not throwing it. */
const HOLD_STILL_MS = 80;

interface Hold {
  pointerId: number;
  pointerDeg: number;
  timeMs: number;
}

interface PlatterProps {
  deck: DeckId;
  /** Whether the motor is running. */
  playing: boolean;
}

/**
 * A record you can grab. The motor turns it at 33⅓ rpm; a finger overrides the
 * motor, and on release the record is thrown, coasts, or is pulled back up to
 * speed. The rotation is written straight to the element every frame and never
 * touches React state.
 */
export function Platter({ deck, playing }: PlatterProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const motion = useRef<PlatterMotion>({ angleDeg: 0, velocityDeg: 0 });
  const hold = useRef<Hold | null>(null);
  const motorOn = useRef(false);
  const frame = useRef(0);

  /** Start the frame loop if it is not running. It stops itself once the record is at rest. */
  const run = useCallback(() => {
    if (frame.current !== 0) return;
    let last = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (!hold.current) {
        motion.current = stepPlatter(motion.current, motorOn.current, dtSec);
      }
      if (discRef.current) {
        discRef.current.style.transform = `rotate(${motion.current.angleDeg.toFixed(2)}deg)`;
      }

      const resting = !hold.current && isAtRest(motion.current, motorOn.current);
      frame.current = resting ? 0 : requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    // With reduced motion the record still follows a finger, but does not spin by itself.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    motorOn.current = playing && !reducedMotion;
    run();
  }, [playing, run]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  const pointerDeg = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (box.left + box.width / 2);
    const y = event.clientY - (box.top + box.height / 2);
    return (Math.atan2(y, x) * 180) / Math.PI;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (hold.current) return; // one hand per record
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.current = {
      pointerId: event.pointerId,
      pointerDeg: pointerDeg(event),
      timeMs: event.timeStamp,
    };
    motion.current = { angleDeg: motion.current.angleDeg, velocityDeg: 0 };
    run();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;

    const deg = pointerDeg(event);
    const turned = shortestArcDeg(held.pointerDeg, deg);
    const dtSec = (event.timeStamp - held.timeMs) / 1000;
    const handVelocity = dtSec > 0 ? turned / dtSec : motion.current.velocityDeg;

    motion.current = {
      angleDeg: motion.current.angleDeg + turned,
      velocityDeg: clamp(
        lerp(motion.current.velocityDeg, handVelocity, 0.5),
        -MAX_VELOCITY_DEG,
        MAX_VELOCITY_DEG,
      ),
    };
    hold.current = { pointerId: held.pointerId, pointerDeg: deg, timeMs: event.timeStamp };
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;

    if (event.timeStamp - held.timeMs > HOLD_STILL_MS) {
      motion.current = { angleDeg: motion.current.angleDeg, velocityDeg: 0 };
    }
    hold.current = null;
    run();
  };

  return (
    <div
      className={styles.platter}
      role="img"
      aria-label={`Deck ${deck} record. Drag to spin it.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className={styles.disc} ref={discRef}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className={styles.rim} cx="100" cy="100" r="99" />
          <circle className={styles.strobe} cx="100" cy="100" r="95.5" />
          <circle className={styles.vinyl} cx="100" cy="100" r="91.5" />
          {GROOVES.map((radius) => (
            <circle key={radius} className={styles.groove} cx="100" cy="100" r={radius} />
          ))}
          <line className={styles.marker} x1="100" y1="12" x2="100" y2="62" />
          <circle className={styles.label} cx="100" cy="100" r="33" />
          <circle className={styles.labelRing} cx="100" cy="100" r="27" />
          <text className={styles.letter} x="100" y="119">
            {deck}
          </text>
          <circle className={styles.labelShade} cx="100" cy="100" r="33" />
          <circle className={styles.spindle} cx="100" cy="100" r="3.2" />
        </svg>
      </div>
      <div className={styles.sheen} />
    </div>
  );
}
