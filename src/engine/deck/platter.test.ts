import { describe, expect, it } from 'vitest';
import {
  isAtRest,
  PLAY_VELOCITY_DEG,
  shortestArcDeg,
  stepPlatter,
  wrapDeg,
  type PlatterMotion,
} from './platter';

const STILL: PlatterMotion = { angleDeg: 0, velocityDeg: 0 };

function run(motion: PlatterMotion, motorOn: boolean, seconds: number, fps: number) {
  let current = motion;
  for (let frame = 0; frame < Math.round(seconds * fps); frame += 1) {
    current = stepPlatter(current, motorOn, 1 / fps);
  }
  return current;
}

describe('stepPlatter', () => {
  it('turns at 33⅓ rpm, which is 200 degrees per second', () => {
    expect(PLAY_VELOCITY_DEG).toBeCloseTo(200, 9);
  });

  it('brings a still record up to speed in about half a second', () => {
    const motion = run(STILL, true, 0.5, 60);
    expect(motion.velocityDeg).toBeGreaterThan(PLAY_VELOCITY_DEG * 0.98);
    expect(motion.velocityDeg).toBeLessThanOrEqual(PLAY_VELOCITY_DEG);
  });

  it('lets a released record coast to a stop', () => {
    const spinning: PlatterMotion = { angleDeg: 0, velocityDeg: PLAY_VELOCITY_DEG };
    expect(isAtRest(run(spinning, false, 0.5, 60), false)).toBe(false);
    expect(isAtRest(run(spinning, false, 3, 60), false)).toBe(true);
  });

  it('pulls a record spun backwards by hand back to forward play', () => {
    const spunBack: PlatterMotion = { angleDeg: 0, velocityDeg: -600 };
    expect(run(spunBack, true, 1, 60).velocityDeg).toBeCloseTo(PLAY_VELOCITY_DEG, 0);
  });

  it('behaves the same at 60 and 120 frames per second', () => {
    const at60 = run(STILL, true, 0.25, 60);
    const at120 = run(STILL, true, 0.25, 120);
    expect(at120.velocityDeg).toBeCloseTo(at60.velocityDeg, 6);
  });

  it('keeps the angle between 0 and 360', () => {
    const motion = run({ angleDeg: 350, velocityDeg: -900 }, false, 2, 60);
    expect(motion.angleDeg).toBeGreaterThanOrEqual(0);
    expect(motion.angleDeg).toBeLessThan(360);
  });

  it('is never at rest while the motor is on', () => {
    expect(isAtRest(STILL, true)).toBe(false);
    expect(isAtRest(STILL, false)).toBe(true);
  });
});

describe('angles', () => {
  it('takes the short way round', () => {
    expect(shortestArcDeg(350, 10)).toBeCloseTo(20, 9);
    expect(shortestArcDeg(10, 350)).toBeCloseTo(-20, 9);
    expect(shortestArcDeg(0, 180)).toBeCloseTo(180, 9);
    expect(shortestArcDeg(-170, 170)).toBeCloseTo(-20, 9);
  });

  it('folds any angle into one turn', () => {
    expect(wrapDeg(370)).toBeCloseTo(10, 9);
    expect(wrapDeg(-10)).toBeCloseTo(350, 9);
    expect(wrapDeg(720)).toBeCloseTo(0, 9);
  });
});
