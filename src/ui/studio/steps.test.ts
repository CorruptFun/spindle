import { describe, expect, it } from 'vitest';
import { STEP_ACCENT, STEP_ON } from '@/studio/pattern';
import { gridStepLabel, playheadInBar, playheadStep, stepLabel, stepState } from './steps';

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

describe('playheadStep', () => {
  it('lights nothing while stopped', () => {
    expect(playheadStep(-1, 32)).toBe(-1);
    expect(playheadStep(Number.NaN, 32)).toBe(-1);
  });

  it('lights the step under the playhead, in either bar', () => {
    expect(playheadStep(0, 32)).toBe(0);
    expect(playheadStep(4.99, 32)).toBe(4);
    expect(playheadStep(16, 32)).toBe(16);
    expect(playheadStep(31.9, 32)).toBe(31);
  });

  it('lights nothing past the end of the loop on screen', () => {
    // For a moment after a two-bar loop gives way to a one-bar one.
    expect(playheadStep(16, 16)).toBe(-1);
    expect(playheadStep(32, 32)).toBe(-1);
  });
});

describe('gridStepLabel', () => {
  it('reads like a step key when the loop is one bar', () => {
    expect(gridStepLabel(4, 1, STEP_ON)).toBe('Step 5, on');
    expect(gridStepLabel(0, 1, 0, STEP_ON)).toBe('Step 1, played by another layer');
  });

  it('says which bar when the loop has two', () => {
    expect(gridStepLabel(4, 2, STEP_ON)).toBe('Bar 1, step 5, on');
    expect(gridStepLabel(16, 2, 0)).toBe('Bar 2, step 1, off');
    expect(gridStepLabel(31, 2, STEP_ACCENT)).toBe('Bar 2, step 16, accent');
    expect(gridStepLabel(20, 2, 0, STEP_ON)).toBe('Bar 2, step 5, played by another layer');
  });
});

describe('stepLabel', () => {
  it('counts from one and says the state', () => {
    expect(stepLabel(4, STEP_ON)).toBe('Step 5, on');
    expect(stepLabel(0, 0)).toBe('Step 1, off');
    expect(stepLabel(15, STEP_ACCENT)).toBe('Step 16, accent');
  });

  it('says when a step that is off here is played by another layer', () => {
    expect(stepLabel(4, 0, STEP_ON)).toBe('Step 5, played by another layer');
    expect(stepLabel(4, 0, 0)).toBe('Step 5, off');
    // This layer's own hit is what the key shows.
    expect(stepLabel(4, STEP_ON, STEP_ACCENT)).toBe('Step 5, on');
  });
});
