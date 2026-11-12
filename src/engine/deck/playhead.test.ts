import { describe, expect, it } from 'vitest';
import type { DeckStateReport } from '../worklets/protocol';
import { PLAY_VELOCITY_DEG } from './platter';
import { CORRECTION_TAU_MS, EXTRAPOLATE_CAP_MS, Playhead } from './playhead';

const RATE = 48000;

function report(fields: Partial<DeckStateReport>): DeckStateReport {
  return {
    type: 'state',
    positionFrames: 0,
    travelFrames: 0,
    velocity: 0,
    moving: false,
    seq: 0,
    ...fields,
  };
}

/** A playhead with a ten-second track, playing at speed one second in, as of t = 1000 ms. */
function playing(): Playhead {
  const playhead = new Playhead(RATE);
  playhead.load(-3000, RATE * 10, false, 1);
  // An earlier still report, long enough ago that easing it in has finished.
  playhead.receive(-3000, report({ positionFrames: RATE, travelFrames: RATE, seq: 1 }));
  playhead.setMotor(true);
  playhead.receive(
    1000,
    report({ positionFrames: RATE, travelFrames: RATE, velocity: 1, moving: true, seq: 1 }),
  );
  return playhead;
}

/** Largest change of angle between two samples 1 ms apart, over [from, to). */
function largestJump(playhead: Playhead, from: number, to: number): number {
  let previous = playhead.angleDeg(from);
  let jump = 0;
  for (let t = from + 1; t < to; t += 1) {
    const angle = playhead.angleDeg(t);
    jump = Math.max(jump, Math.abs(angle - previous));
    previous = angle;
  }
  return jump;
}

/** One millisecond of travel at normal speed, in degrees. */
const DEG_PER_MS = PLAY_VELOCITY_DEG / 1000;

describe('playhead estimate', () => {
  it('extrapolates between reports at the reported speed', () => {
    const playhead = playing();
    expect(playhead.positionFrames(1000)).toBe(RATE);
    expect(playhead.positionFrames(1010)).toBeCloseTo(RATE + 480, 6);
    expect(playhead.angleDeg(1010) - playhead.angleDeg(1000)).toBeCloseTo(10 * DEG_PER_MS, 6);
  });

  it('stops extrapolating when reports stop coming', () => {
    const playhead = playing();
    const capped = RATE + (RATE * EXTRAPOLATE_CAP_MS) / 1000;
    expect(playhead.positionFrames(1000 + EXTRAPOLATE_CAP_MS)).toBeCloseTo(capped, 6);
    expect(playhead.positionFrames(5000)).toBeCloseTo(capped, 6);
  });

  it('clamps the position to the track, or wraps it when the track loops', () => {
    const playhead = new Playhead(RATE);
    playhead.load(0, RATE, false, 1);
    playhead.receive(0, report({ positionFrames: RATE - 10, velocity: 1, moving: true, seq: 1 }));
    expect(playhead.positionFrames(20)).toBe(RATE);
    playhead.receive(30, report({ positionFrames: 5, velocity: -1, moving: true, seq: 1 }));
    expect(playhead.positionFrames(40)).toBe(0);

    playhead.load(100, RATE, true, 2);
    playhead.receive(100, report({ positionFrames: RATE - 10, velocity: 1, moving: true, seq: 2 }));
    expect(playhead.positionFrames(101)).toBeCloseTo(38, 6);
  });

  it('reports nothing for an empty deck', () => {
    const playhead = new Playhead(RATE);
    playhead.receive(0, report({ positionFrames: 500, travelFrames: 500, velocity: 1 }));
    expect(playhead.positionFrames(10)).toBe(0);
    expect(playhead.duration).toBe(0);
    expect(playhead.isLoaded).toBe(false);
  });

  it('follows the hand at once while held, and stays continuous through release', () => {
    const playhead = playing();
    const beforeGrab = playhead.angleDeg(1005);
    playhead.grab(1005);
    expect(playhead.angleDeg(1005)).toBe(beforeGrab);

    expect(playhead.dragBy(30)).toBeCloseTo((30 / PLAY_VELOCITY_DEG) * RATE, 6);
    expect(playhead.angleDeg(1006)).toBeCloseTo(beforeGrab + 30, 9);
    playhead.dragBy(-50);
    expect(playhead.angleDeg(1007)).toBeCloseTo(beforeGrab - 20, 9);

    // Reports while held do not move the picture: the hand does.
    playhead.receive(
      1010,
      report({
        positionFrames: RATE + 100,
        travelFrames: RATE + 100,
        velocity: -2,
        moving: true,
        seq: 1,
      }),
    );
    expect(playhead.angleDeg(1012)).toBeCloseTo(beforeGrab - 20, 9);

    playhead.release(1020, 3);
    expect(playhead.angleDeg(1020)).toBeCloseTo(beforeGrab - 20, 9);
    // After release the record moves on at the thrown speed, without a jump.
    expect(largestJump(playhead, 1020, 1060)).toBeLessThan(3 * DEG_PER_MS * 1.5);
  });

  it('ignores a drag before a grab', () => {
    const playhead = playing();
    const angle = playhead.angleDeg(1000);
    expect(playhead.dragBy(90)).toBe(0);
    expect(playhead.angleDeg(1000)).toBe(angle);
  });

  it('eases a late report in instead of jumping, then settles on it', () => {
    const playhead = playing();
    const before = playhead.angleDeg(1015);
    // The audio thread says the record is 40 degrees further on than estimated.
    const travel = RATE + 720 + (40 / PLAY_VELOCITY_DEG) * RATE;
    playhead.receive(
      1015,
      report({
        positionFrames: RATE + 720,
        travelFrames: travel,
        velocity: 1,
        moving: true,
        seq: 1,
      }),
    );
    expect(playhead.angleDeg(1015)).toBeCloseTo(before, 9);
    expect(largestJump(playhead, 1015, 1060)).toBeLessThan(DEG_PER_MS + 40 / CORRECTION_TAU_MS);

    // Once eased out, the picture follows the reports exactly.
    playhead.receive(
      3000,
      report({ positionFrames: 2 * RATE, travelFrames: travel + RATE, velocity: 0, seq: 1 }),
    );
    const settledAt = 3000 + CORRECTION_TAU_MS * 20;
    const truth = ((travel + RATE) / RATE) * PLAY_VELOCITY_DEG;
    expect(playhead.angleDeg(settledAt) - truth).toBeCloseTo(
      playhead.angleDeg(settledAt + 1000) - truth,
      9,
    );
    expect(playhead.isMoving(settledAt)).toBe(true); // the motor is still on
    playhead.setMotor(false);
    expect(playhead.isMoving(settledAt)).toBe(false);
  });

  it('keeps the angle continuous across a seek, and the needle where it was sent', () => {
    const playhead = playing();
    const before = playhead.angleDeg(1010);
    playhead.seek(1010, RATE * 5, 2);
    expect(playhead.angleDeg(1010)).toBeCloseTo(before, 9);
    expect(playhead.positionFrames(1010)).toBe(RATE * 5);

    // A report sent before the seek took effect must not drag the needle back.
    playhead.receive(
      1012,
      report({
        positionFrames: RATE + 600,
        travelFrames: RATE + 600,
        velocity: 1,
        moving: true,
        seq: 1,
      }),
    );
    expect(playhead.positionFrames(1012)).toBeCloseTo(RATE * 5 + 96, 6);
    expect(largestJump(playhead, 1012, 1030)).toBeLessThan(DEG_PER_MS * 1.5);

    playhead.receive(
      1020,
      report({
        positionFrames: RATE * 5 + 480,
        travelFrames: RATE + 1000,
        velocity: 1,
        moving: true,
        seq: 2,
      }),
    );
    expect(playhead.positionFrames(1020)).toBe(RATE * 5 + 480);
  });

  it('keeps the angle continuous across load and eject', () => {
    const playhead = playing();
    const beforeLoad = playhead.angleDeg(1010);
    playhead.load(1010, RATE * 3, true, 2);
    expect(playhead.angleDeg(1010)).toBeCloseTo(beforeLoad, 9);
    expect(playhead.positionFrames(1010)).toBe(0);
    expect(playhead.duration).toBe(RATE * 3);

    const beforeEject = playhead.angleDeg(1020);
    playhead.eject(1020, 3);
    expect(playhead.angleDeg(1020)).toBeCloseTo(beforeEject, 9);
    expect(playhead.isLoaded).toBe(false);
    expect(playhead.positionFrames(1020)).toBe(0);
  });

  it('is moving while held, while the motor runs, or until the record comes to rest', () => {
    const playhead = new Playhead(RATE);
    expect(playhead.isMoving(0)).toBe(false);
    playhead.grab(0);
    expect(playhead.isMoving(0)).toBe(true);
    playhead.release(10, 2);
    expect(playhead.isMoving(10)).toBe(true);
    playhead.receive(20, report({ travelFrames: 960, velocity: 2, moving: true }));
    expect(playhead.isMoving(20)).toBe(true);
    playhead.receive(2000, report({ travelFrames: 960 * 30, velocity: 0, moving: false }));
    expect(playhead.isMoving(2000 + CORRECTION_TAU_MS * 20)).toBe(false);

    playhead.setMotor(true);
    expect(playhead.isMoving(5000)).toBe(true);
    playhead.ended();
    expect(playhead.isMoving(5000)).toBe(false);
  });

  it('never returns NaN for broken reports', () => {
    const playhead = playing();
    playhead.receive(1010, report({ positionFrames: NaN, travelFrames: Infinity, velocity: NaN }));
    expect(Number.isFinite(playhead.angleDeg(1020))).toBe(true);
    expect(Number.isFinite(playhead.positionFrames(1020))).toBe(true);
    playhead.grab(1020);
    playhead.dragBy(NaN);
    playhead.release(1030, NaN);
    expect(Number.isFinite(playhead.angleDeg(1040))).toBe(true);
  });
});
