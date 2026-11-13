import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import type { DrumPattern } from '@/studio/types';
import { loopPicture, loopSlotLabel } from './loop-picture';

/** Eight silent lanes of `bars` bars, with the given hits written in. */
function pattern(bars: 1 | 2, hits: [pad: number, step: number, value: number][]): DrumPattern {
  const lanes = Array.from({ length: 8 }, () => new Array<number>(bars * STEPS_PER_BAR).fill(0));
  for (const [pad, step, value] of hits) lanes[pad]![step] = value;
  return { bars, lanes };
}

describe('loopPicture', () => {
  it('draws hats, snare and kick rows, top to bottom, sixteen steps each', () => {
    const rows = loopPicture(pattern(1, []));
    expect(rows.map((row) => row.family)).toEqual(['hat', 'snare', 'low']);
    for (const row of rows) expect(row.steps).toHaveLength(STEPS_PER_BAR);
  });

  it('takes the kick from the kick pad only', () => {
    // Pad 5 is the tom: also a low drum, but not part of the picture.
    const [, , kick] = loopPicture(
      pattern(1, [
        [0, 0, 1],
        [5, 2, 1],
      ]),
    );
    expect(kick!.steps[0]).toBe(1);
    expect(kick!.steps[2]).toBe(0);
  });

  it('merges snare with clap and closed with open hat, keeping the louder hit', () => {
    const [hat, snare] = loopPicture(
      pattern(1, [
        [1, 4, 0.5],
        [2, 4, 0.9],
        [2, 12, 0.3],
        [3, 2, 0.8],
        [4, 6, 0.7],
      ]),
    );
    expect(snare!.steps[4]).toBe(0.9);
    expect(snare!.steps[12]).toBe(0.3);
    expect(hat!.steps[2]).toBe(0.8);
    expect(hat!.steps[6]).toBe(0.7);
  });

  it('shows the first bar of a two-bar loop', () => {
    const [, , kick] = loopPicture(
      pattern(2, [
        [0, 1, 1],
        [0, 17, 1],
        [0, 20, 1],
      ]),
    );
    expect(kick!.steps[1]).toBe(1);
    expect(kick!.steps[4]).toBe(0);
  });

  it('survives a short or missing lane', () => {
    const rows = loopPicture({ bars: 1, lanes: [[1]] });
    expect(rows[2]!.steps[0]).toBe(1);
    expect(rows[0]!.steps.every((value) => value === 0)).toBe(true);
  });
});

describe('loopSlotLabel', () => {
  const quiet = { active: false, queued: false, playing: false, edited: false };

  it('names the slot from one, then the loop', () => {
    expect(loopSlotLabel(2, 'Boom Bap', quiet)).toBe('Loop 3, Boom Bap');
  });

  it('says what the loop is doing', () => {
    expect(loopSlotLabel(2, 'Boom Bap', { ...quiet, active: true, playing: true })).toBe(
      'Loop 3, Boom Bap, playing',
    );
    expect(loopSlotLabel(0, 'Four Floor', { ...quiet, active: true })).toBe(
      'Loop 1, Four Floor, chosen',
    );
    expect(loopSlotLabel(4, 'Shuffle', { ...quiet, queued: true, edited: true })).toBe(
      'Loop 5, Shuffle, plays next, changed',
    );
  });
});
