import { describe, expect, it } from 'vitest';
import { STEP_ACCENT, STEP_ON } from '@/studio/pattern';
import { playheadInBar, stepLabel, stepState } from './steps';

describe('stepState', () => {
  it('reads silence, normal hits, soft hits and accents', () => {
    expect(stepState(0)).toBe('off');
    expect(stepState(Number.NaN)).toBe('off');
    expect(stepState(-0.5)).toBe('off');
    expect(stepState(STEP_ON)).toBe('on');
    expect(stepState(0.25)).toBe('on');
    expect(stepState(STEP_ACCENT)).toBe('accent');
  });
});

describe('playheadInBar', () => {
  it('lights nothing while stopped', () => {
    expect(playheadInBar(-1, 0)).toBe(-1);
    expect(playheadInBar(Number.NaN, 0)).toBe(-1);
  });

  it('lights the step under the playhead in the bar on screen', () => {
    expect(playheadInBar(0, 0)).toBe(0);
    expect(playheadInBar(4.99, 0)).toBe(4);
    expect(playheadInBar(15.5, 0)).toBe(15);
  });

  it('lights nothing when the playhead is in the other bar', () => {
    expect(playheadInBar(16, 0)).toBe(-1);
    expect(playheadInBar(3, 1)).toBe(-1);
    expect(playheadInBar(17.2, 1)).toBe(1);
  });
});

describe('stepLabel', () => {
  it('counts from one and says the state', () => {
    expect(stepLabel(4, STEP_ON)).toBe('Step 5, on');
    expect(stepLabel(0, 0)).toBe('Step 1, off');
    expect(stepLabel(15, STEP_ACCENT)).toBe('Step 16, accent');
  });
});
