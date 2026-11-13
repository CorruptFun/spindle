import { describe, expect, it } from 'vitest';
import { PAD_COUNT } from '@/engine/sampler/types';
import { MAX_BPM, MIN_BPM, STEPS_PER_BAR } from '@/engine/sequencer/types';
import { FACTORY_LOOPS } from './loops';
import { isEmptyPattern, normalizePattern, patternsEqual } from './pattern';
import { PAD_ROLES, SLOT_COUNT } from './types';

const pad = (role: string): number => PAD_ROLES.findIndex((r) => r.role === role);
const hits = (lane: readonly number[]): number => lane.filter((v) => v > 0).length;

describe('FACTORY_LOOPS', () => {
  it('fills every slot with a loop that has a unique id and name', () => {
    expect(FACTORY_LOOPS).toHaveLength(SLOT_COUNT);
    expect(new Set(FACTORY_LOOPS.map((l) => l.id)).size).toBe(SLOT_COUNT);
    expect(new Set(FACTORY_LOOPS.map((l) => l.name)).size).toBe(SLOT_COUNT);
    for (const loop of FACTORY_LOOPS) {
      expect(loop.id).toMatch(/^[a-z][a-z-]*$/);
      // One or two short words.
      expect(loop.name).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/);
    }
  });

  it('is written between 80 and 140 BPM, inside the sequencer range', () => {
    for (const loop of FACTORY_LOOPS) {
      expect(loop.bpm).toBeGreaterThanOrEqual(80);
      expect(loop.bpm).toBeLessThanOrEqual(140);
      expect(loop.bpm).toBeGreaterThanOrEqual(MIN_BPM);
      expect(loop.bpm).toBeLessThanOrEqual(MAX_BPM);
    }
  });

  it('is two bars of eight lanes, 32 values each, all in 0..1', () => {
    for (const { pattern } of FACTORY_LOOPS) {
      expect(pattern.bars).toBe(2);
      expect(pattern.lanes).toHaveLength(PAD_COUNT);
      for (const lane of pattern.lanes) {
        expect(lane).toHaveLength(32);
        for (const v of lane) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
      // Already in the shape the rest of the app expects.
      expect(patternsEqual(normalizePattern(pattern)!, pattern)).toBe(true);
    }
  });

  it('always has a kick and something on the hats or shaker', () => {
    for (const { pattern } of FACTORY_LOOPS) {
      expect(isEmptyPattern(pattern)).toBe(false);
      expect(hits(pattern.lanes[pad('kick')]!)).toBeGreaterThan(0);
      const timekeeping = ['closed-hat', 'open-hat', 'shaker'].map((r) =>
        hits(pattern.lanes[pad(r)]!),
      );
      expect(Math.max(...timekeeping)).toBeGreaterThan(0);
    }
  });

  it('starts on a kick, so pressing Play lands on the beat', () => {
    for (const { pattern } of FACTORY_LOOPS)
      expect(pattern.lanes[pad('kick')]![0]).toBeGreaterThan(0);
  });

  it('varies bar two, so it does not feel like a one-bar loop', () => {
    for (const { pattern } of FACTORY_LOOPS) {
      const differs = pattern.lanes.some((lane) =>
        lane.slice(0, STEPS_PER_BAR).some((v, i) => v !== lane[i + STEPS_PER_BAR]),
      );
      expect(differs).toBe(true);
    }
  });

  it('uses velocity for feel: every loop has more than one hit strength', () => {
    for (const { pattern } of FACTORY_LOOPS) {
      const strengths = new Set(pattern.lanes.flat().filter((v) => v > 0));
      expect(strengths.size).toBeGreaterThan(1);
    }
  });

  it('gives the tom, shaker and extra pads something to do across the set', () => {
    for (const role of ['tom', 'shaker', 'extra', 'clap', 'open-hat']) {
      const users = FACTORY_LOOPS.filter((l) => hits(l.pattern.lanes[pad(role)]!) > 0);
      expect(users.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has no two identical loops', () => {
    for (let a = 0; a < FACTORY_LOOPS.length; a++) {
      for (let b = a + 1; b < FACTORY_LOOPS.length; b++) {
        expect(patternsEqual(FACTORY_LOOPS[a]!.pattern, FACTORY_LOOPS[b]!.pattern)).toBe(false);
      }
    }
  });

  it('is frozen, so a slot that shares a factory loop cannot change it', () => {
    const { pattern } = FACTORY_LOOPS[0]!;
    expect(Object.isFrozen(pattern)).toBe(true);
    expect(Object.isFrozen(pattern.lanes)).toBe(true);
    expect(Object.isFrozen(pattern.lanes[0])).toBe(true);
  });
});
