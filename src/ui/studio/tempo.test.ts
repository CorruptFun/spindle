import { describe, expect, it } from 'vitest';
import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/engine/sequencer/types';
import { clampBpm, describeSwing, nudgeTempo, tempoForKey } from './tempo';

describe('nudgeTempo', () => {
  it('moves one beat per minute', () => {
    expect(nudgeTempo(120, 1)).toBe(121);
    expect(nudgeTempo(120, -1)).toBe(119);
  });

  it('starts from the whole number on screen', () => {
    expect(nudgeTempo(120.4, 1)).toBe(121);
    expect(nudgeTempo(119.6, -1)).toBe(119);
  });

  it('lands on round numbers when held', () => {
    expect(nudgeTempo(121, 1, true)).toBe(125);
    expect(nudgeTempo(125, 1, true)).toBe(130);
    expect(nudgeTempo(124, -1, true)).toBe(120);
    expect(nudgeTempo(120, -1, true)).toBe(115);
  });

  it('never leaves the range', () => {
    expect(nudgeTempo(MAX_BPM, 1)).toBe(MAX_BPM);
    expect(nudgeTempo(MIN_BPM, -1)).toBe(MIN_BPM);
    expect(nudgeTempo(MAX_BPM - 1, 1, true)).toBe(MAX_BPM);
    expect(nudgeTempo(MIN_BPM + 1, -1, true)).toBe(MIN_BPM);
    expect(clampBpm(Number.NaN)).toBe(MIN_BPM);
  });
});

describe('tempoForKey', () => {
  it('follows a native spin button', () => {
    expect(tempoForKey(100, 'ArrowUp')).toBe(101);
    expect(tempoForKey(100, 'ArrowDown')).toBe(99);
    expect(tempoForKey(100, 'PageUp')).toBe(110);
    expect(tempoForKey(100, 'PageDown')).toBe(90);
    expect(tempoForKey(100, 'Home')).toBe(MIN_BPM);
    expect(tempoForKey(100, 'End')).toBe(MAX_BPM);
    expect(tempoForKey(175, 'PageUp')).toBe(MAX_BPM);
    expect(tempoForKey(100, 'a')).toBeNull();
  });
});

describe('describeSwing', () => {
  it('says straight at zero and a share of the most swing otherwise', () => {
    expect(describeSwing(0)).toBe('Straight');
    expect(describeSwing(MAX_SWING / 2)).toBe('50% swing');
    expect(describeSwing(MAX_SWING)).toBe('100% swing');
    expect(describeSwing(MAX_SWING * 2)).toBe('100% swing');
  });
});
