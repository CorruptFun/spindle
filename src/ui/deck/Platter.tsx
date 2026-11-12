import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { DeckId } from '@/engine/core/types';
import { MAX_VELOCITY_DEG, shortestArcDeg, wrapDeg } from '@/engine/deck/platter';
import type { PlatterControl } from '@/engine/deck/types';
import { clamp } from '@/lib/audio-math';
import styles from './Platter.module.css';

/** Radii of the visible groove rings, in a 200-unit viewBox. The gaps read as track breaks. */
const GROOVES = [40, 43.5, 47, 50.5, 54, 60, 63.5, 67, 70.5, 74, 80, 83.5, 87];

/** A hand that has not moved for this long is holding the record still, not throwing it. */
const HOLD_STILL_MS = 80;

/** How quickly the measured hand speed follows the hand. Long enough to smooth out jittery touch events. */
const HAND_SMOOTHING_MS = 30;

/**
 * Near the spindle a tiny movement is a huge change of angle. Inside this share
 * of the radius the hand does not turn the record, so passing over the middle
 * cannot whip it round.
 */
const DEAD_CENTRE = 0.12;

interface Hold {
  readonly pointerId: number;
  /** The deck that was grabbed, so the same one is released even if the prop changes. */
  readonly control: PlatterControl;
  readonly centreX: number;
  readonly centreY: number;
  readonly radius: number;
  pointerDeg: number;
  lastMoveMs: number;
  /** Turn not yet counted in the speed, from events that arrived with the same timestamp. */
  pendingDeg: number;
  velocityDeg: number;
}

interface PlatterProps {
  deck: DeckId;
  /** The deck that owns the record's motion. null until the engine is ready: draw a still record. */
  control: PlatterControl | null;
  /** Motor on. When this changes, wake the drawing loop. */
  playing: boolean;
}

/**
 * A record you can grab. The deck owns the motion: this component only shows
 * the angle the deck reports and passes the hand's movement to it. The angle is
 * written straight to the element every frame and never touches React state;
 * the loop sleeps whenever the record is still and nobody is holding it.
 */
export function Platter({ deck, control, playing }: PlatterProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef(control);
  const hold = useRef<Hold | null>(null);
  const reducedMotion = useRef(false);
  const frame = useRef(0);
  /** The angle on screen, and how far it is from the deck's (only ever non-zero with reduced motion). */
  const shownDeg = useRef(0);
  const offsetDeg = useRef(0);

  const paint = useCallback(() => {
    const deckControl = controlRef.current;
    if (!deckControl || !discRef.current) return;
    shownDeg.current = deckControl.angleDeg() + offsetDeg.current;
    discRef.current.style.transform = `rotate(${wrapDeg(shownDeg.current).toFixed(2)}deg)`;
  }, []);

  /** Start the frame loop if it is not running. It stops itself once there is nothing to show. */
  const wake = useCallback(() => {
    if (frame.current !== 0) return;

    const tick = () => {
      const deckControl = controlRef.current;
      const held = hold.current !== null;
      // With reduced motion the record only moves under a finger, never by itself.
      const follow = held || !reducedMotion.current;
      if (follow) paint();
      const keepGoing = deckControl !== null && (held || (follow && deckControl.isMoving()));
      frame.current = keepGoing ? requestAnimationFrame(tick) : 0;
    };

    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  // A new deck (or the first one): show where its record is, then follow it.
  useEffect(() => {
    controlRef.current = control;
    paint();
    wake();
  }, [control, paint, wake]);

  useEffect(() => {
    wake();
  }, [playing, wake]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotion.current = query.matches;
      wake();
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [wake]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      // Never leave a deck held by a hand that is gone.
      hold.current?.control.release(0);
      hold.current = null;
    },
    [],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!control || hold.current) return; // one hand per record
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    // The record does not move while held, so its centre is measured once per grab.
    const box = event.currentTarget.getBoundingClientRect();
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    hold.current = {
      pointerId: event.pointerId,
      control,
      centreX,
      centreY,
      radius: box.width / 2,
      pointerDeg: angleOf(event.clientX - centreX, event.clientY - centreY),
      lastMoveMs: event.timeStamp,
      pendingDeg: 0,
      velocityDeg: 0,
    };

    // Keep the picture where it is: with reduced motion the deck may have moved on unseen.
    offsetDeg.current = shownDeg.current - control.angleDeg();
    control.grab();
    wake();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;

    const dx = event.clientX - held.centreX;
    const dy = event.clientY - held.centreY;
    const deg = angleOf(dx, dy);
    const turned = shortestArcDeg(held.pointerDeg, deg);
    held.pointerDeg = deg;
    if (Math.hypot(dx, dy) < held.radius * DEAD_CENTRE) return;

    // Screen y points down, so a growing angle is clockwise, which is what the deck expects.
    held.control.dragBy(turned);

    held.pendingDeg += turned;
    const dtMs = event.timeStamp - held.lastMoveMs;
    if (dtMs > 0) {
      const handVelocity = (held.pendingDeg / dtMs) * 1000;
      const blend = 1 - Math.exp(-dtMs / HAND_SMOOTHING_MS);
      held.velocityDeg += (handVelocity - held.velocityDeg) * blend;
      held.pendingDeg = 0;
      held.lastMoveMs = event.timeStamp;
    }
  };

  /** The hand lifts: throw the record at the hand's speed, unless it had stopped. */
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const held = hold.current;
    if (!held || held.pointerId !== event.pointerId) return;
    const still = event.timeStamp - held.lastMoveMs > HOLD_STILL_MS;
    letGo(still ? 0 : clamp(held.velocityDeg, -MAX_VELOCITY_DEG, MAX_VELOCITY_DEG));
  };

  /** The browser took the pointer away (a system gesture, a lost capture): put the record down gently. */
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (hold.current?.pointerId === event.pointerId) letGo(0);
  };

  const letGo = (throwVelocityDeg: number) => {
    const held = hold.current;
    if (!held) return;
    hold.current = null;
    held.control.release(throwVelocityDeg);
    wake();
  };

  return (
    <div
      className={styles.platter}
      data-ready={control !== null}
      role="img"
      aria-label={control ? `Deck ${deck} record. Drag to spin it.` : `Deck ${deck} record`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
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

/** Angle of a point around the centre, in degrees, clockwise on screen. */
function angleOf(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
