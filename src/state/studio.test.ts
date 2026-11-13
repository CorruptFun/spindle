import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/engine/AudioEngine';
import { withStep } from '@/engine/sequencer/core';
import type { DrumPattern } from '@/engine/sequencer/types';
import {
  defaultProject,
  emptyPattern,
  FACTORY_LOOPS,
  isEmptyPattern,
  patternsEqual,
} from '@/studio';
import { canUndoLoop, useStudio } from './studio';

/**
 * A stand-in for the audio engine: it keeps the loop it is given and writes a
 * recorded hit on whichever step the test names, with no clock and no sound.
 */
function standIn() {
  let pattern: DrumPattern = emptyPattern(2);
  let playing = false;
  const sequencer = {
    click: false,
    /** The step the next recorded hit lands on. */
    hitStep: 0,
    onBar: null as (() => void) | null,
    bpm: 100,
    swing: 0,
    changePending: false,
    get playing() {
      return playing;
    },
    get pattern() {
      return pattern;
    },
    start() {
      playing = true;
    },
    stop() {
      playing = false;
    },
    setTempo() {},
    setSwing() {},
    setPattern(next: DrumPattern) {
      pattern = next;
    },
    setClick(on: boolean) {
      sequencer.click = on;
    },
    recordHit(pad: number, velocity: number) {
      if (!playing) return null;
      pattern = withStep(pattern, pad, sequencer.hitStep, velocity);
      return pattern;
    },
    stepPosition: () => -1,
    dispose() {},
  };
  const engine = {
    context: { sampleRate: 44100 },
    mixer: { setPadsLevel() {} },
    pads: { setSound() {}, trigger() {} },
    sequencer,
    resume: () => Promise.resolve(),
  } as unknown as AudioEngine;
  return { engine, sequencer };
}

const { engine, sequencer } = standIn();
const studio = () => useStudio.getState();
const loop = () => studio().project.slots[studio().project.activeSlot]!;
const factory = (slot: number) => FACTORY_LOOPS[slot]!.pattern;

/** Record one hit of `pad` on `step`. */
function hit(pad: number, step: number): void {
  sequencer.hitStep = step;
  studio().hitPad(pad);
}

beforeAll(() => {
  // Edits are saved a moment later; nothing here should wait for that.
  vi.useFakeTimers();
  studio().attach(engine);
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  studio().stop();
  useStudio.setState({ project: defaultProject(), undo: null, selectedPad: 0, bar: 0 });
  sequencer.setPattern(loop());
});

describe('clearing a loop', () => {
  it('empties it, keeps its length, and hands the empty loop to the sequencer', () => {
    studio().clearLoop();
    expect(isEmptyPattern(loop())).toBe(true);
    expect(loop().bars).toBe(factory(0).bars);
    expect(sequencer.pattern).toBe(loop());
  });

  it('leaves the other loops alone', () => {
    studio().clearLoop();
    expect(patternsEqual(studio().project.slots[1]!, factory(1))).toBe(true);
  });

  it('is undone by Undo, and put back by a second Undo', () => {
    studio().clearLoop();
    studio().undoLoop();
    expect(patternsEqual(loop(), factory(0))).toBe(true);
    studio().undoLoop();
    expect(isEmptyPattern(loop())).toBe(true);
  });

  it('does nothing to a loop that is already empty', () => {
    studio().clearLoop();
    const undo = studio().undo;
    studio().clearLoop();
    expect(studio().undo).toBe(undo);
  });
});

describe('resetting a loop', () => {
  it('can be undone, bringing the edited loop back', () => {
    studio().toggleStep(3);
    const edited = loop();
    studio().resetLoop();
    expect(patternsEqual(loop(), factory(0))).toBe(true);
    studio().undoLoop();
    expect(patternsEqual(loop(), edited)).toBe(true);
  });

  it('does nothing, and keeps nothing for Undo, when the loop is as it came', () => {
    studio().resetLoop();
    expect(studio().undo).toBeNull();
  });
});

describe('Undo', () => {
  it('belongs to the loop it was made in', () => {
    studio().clearLoop();
    studio().selectSlot(1);
    expect(canUndoLoop(studio().undo, studio().project)).toBe(false);
    studio().undoLoop();
    expect(patternsEqual(loop(), factory(1))).toBe(true);

    studio().selectSlot(0);
    expect(canUndoLoop(studio().undo, studio().project)).toBe(true);
    studio().undoLoop();
    expect(patternsEqual(loop(), factory(0))).toBe(true);
  });

  it('has nothing to do before anything has been changed', () => {
    expect(canUndoLoop(studio().undo, studio().project)).toBe(false);
    studio().undoLoop();
    expect(patternsEqual(loop(), factory(0))).toBe(true);
  });
});

describe('recording', () => {
  it('starts the loop and the click when Record is pressed first', () => {
    studio().toggleRecord();
    expect(studio().recording).toBe(true);
    expect(studio().playing).toBe(true);
    expect(sequencer.playing).toBe(true);
    expect(sequencer.click).toBe(true);
  });

  it('switches the click off with Record, and leaves the loop running', () => {
    studio().toggleRecord();
    studio().toggleRecord();
    expect(sequencer.click).toBe(false);
    expect(studio().playing).toBe(true);
  });

  it('switches recording and the click off when the loop stops', () => {
    studio().toggleRecord();
    studio().stop();
    expect(studio().recording).toBe(false);
    expect(sequencer.click).toBe(false);
  });

  it('adds hits to what is already in the loop', () => {
    studio().toggleRecord();
    hit(7, 5);
    expect(loop().lanes[7]![5]).toBeGreaterThan(0);
    // Everything that was there is still there.
    factory(0).lanes.forEach((lane, pad) =>
      lane.forEach((velocity, step) => {
        if (velocity > 0) expect(loop().lanes[pad]![step]).toBeGreaterThan(0);
      }),
    );
  });

  it('builds a loop from nothing: clear, record, and only the hits played are in it', () => {
    studio().clearLoop();
    studio().toggleRecord();
    hit(0, 0);
    hit(1, 4);
    hit(0, 8);
    const played = loop()
      .lanes.flat()
      .filter((velocity) => velocity > 0);
    expect(played).toHaveLength(3);
    expect(loop().lanes[0]![0]).toBeGreaterThan(0);
    expect(loop().lanes[1]![4]).toBeGreaterThan(0);
    expect(loop().lanes[0]![8]).toBeGreaterThan(0);
  });

  it('takes back a whole recording with one Undo, however many hits it had', () => {
    studio().toggleStep(2);
    const before = loop();
    studio().toggleRecord();
    hit(1, 4);
    hit(1, 12);
    hit(3, 6);
    studio().toggleRecord();
    studio().undoLoop();
    expect(patternsEqual(loop(), before)).toBe(true);
  });

  it('keeps each recording separate: a second one is undone without the first', () => {
    studio().clearLoop();
    studio().toggleRecord();
    hit(0, 0);
    studio().toggleRecord();
    const firstLayer = loop();

    studio().toggleRecord();
    hit(1, 4);
    hit(1, 12);
    studio().toggleRecord();
    studio().undoLoop();
    expect(patternsEqual(loop(), firstLayer)).toBe(true);
  });

  it('brings back the loop from before a Clear pressed while recording', () => {
    studio().toggleRecord();
    studio().clearLoop();
    hit(2, 3);
    studio().undoLoop();
    expect(patternsEqual(loop(), factory(0))).toBe(true);
  });

  it('does not record while the loop is stopped', () => {
    hit(7, 5);
    expect(patternsEqual(loop(), factory(0))).toBe(true);
  });
});
