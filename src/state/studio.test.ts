import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '@/engine/AudioEngine';
import { withStep } from '@/engine/sequencer/core';
import type { DrumPattern } from '@/engine/sequencer/types';
import {
  defaultProject,
  emptyPattern,
  factoryLoop,
  isLayerEmpty,
  isLoopEmpty,
  loopsEqual,
  mixLoop,
  patternsEqual,
  PAD_ROLES,
} from '@/studio';
import { canUndoLoop, isLoopEdited, useStudio } from './studio';

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
      return { pattern, step: sequencer.hitStep };
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
const mix = () => mixLoop(loop());
const factory = (slot: number) => factoryLoop(slot)!;
const pad = (role: string): number => PAD_ROLES.findIndex((r) => r.role === role);

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
  useStudio.setState({
    project: defaultProject(),
    undo: null,
    selectedPad: 0,
    selectedLayer: 0,
    bar: 0,
  });
  sequencer.setPattern(mix());
});

describe('clearing a loop', () => {
  it('empties every layer, keeps its length, and hands the empty loop to the sequencer', () => {
    studio().clearLoop();
    expect(isLoopEmpty(loop())).toBe(true);
    expect(loop().bars).toBe(factory(0).bars);
    expect(patternsEqual(sequencer.pattern, mix())).toBe(true);
    expect(sequencer.pattern.lanes.flat().every((v) => v === 0)).toBe(true);
  });

  it('leaves the other loops alone', () => {
    studio().clearLoop();
    expect(loopsEqual(studio().project.slots[1]!, factory(1))).toBe(true);
  });

  it('is undone by Undo, and put back by a second Undo', () => {
    studio().clearLoop();
    studio().undoLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
    studio().undoLoop();
    expect(isLoopEmpty(loop())).toBe(true);
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
    expect(loopsEqual(loop(), factory(0))).toBe(true);
    studio().undoLoop();
    expect(loopsEqual(loop(), edited)).toBe(true);
  });

  it('does nothing, and keeps nothing for Undo, when the loop is as it came', () => {
    studio().resetLoop();
    expect(studio().undo).toBeNull();
  });

  it('switches a layer back on: a switched-off layer counts as a change', () => {
    studio().selectLayer(0);
    expect(isLoopEdited(studio().project, 0)).toBe(true);
    studio().resetLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
  });
});

describe('Undo', () => {
  it('belongs to the loop it was made in', () => {
    studio().clearLoop();
    studio().selectSlot(1);
    expect(canUndoLoop(studio().undo, studio().project)).toBe(false);
    studio().undoLoop();
    expect(loopsEqual(loop(), factory(1))).toBe(true);

    studio().selectSlot(0);
    expect(canUndoLoop(studio().undo, studio().project)).toBe(true);
    studio().undoLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
  });

  it('has nothing to do before anything has been changed', () => {
    expect(canUndoLoop(studio().undo, studio().project)).toBe(false);
    studio().undoLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
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
    expect(mix().lanes[7]![5]).toBeGreaterThan(0);
    // Everything that was there is still there.
    mixLoop(factory(0)).lanes.forEach((lane, pad) =>
      lane.forEach((velocity, step) => {
        if (velocity > 0) expect(mix().lanes[pad]![step]).toBeGreaterThan(0);
      }),
    );
  });

  it('builds a loop from nothing: clear, record, and only the hits played are in it', () => {
    studio().clearLoop();
    studio().toggleRecord();
    hit(0, 0);
    hit(1, 4);
    hit(0, 8);
    const played = mix()
      .lanes.flat()
      .filter((velocity) => velocity > 0);
    expect(played).toHaveLength(3);
    expect(mix().lanes[0]![0]).toBeGreaterThan(0);
    expect(mix().lanes[1]![4]).toBeGreaterThan(0);
    expect(mix().lanes[0]![8]).toBeGreaterThan(0);
  });

  it('takes back a whole recording with one Undo, however many hits it had', () => {
    studio().toggleStep(2);
    const before = loop();
    studio().toggleRecord();
    hit(1, 4);
    hit(1, 12);
    studio().selectLayer(2);
    hit(3, 6);
    studio().toggleRecord();
    studio().undoLoop();
    expect(loopsEqual(loop(), before)).toBe(true);
  });

  it('keeps each recording separate: a second one is undone without the first', () => {
    studio().clearLoop();
    studio().toggleRecord();
    hit(0, 0);
    studio().toggleRecord();
    const firstTake = loop();

    studio().toggleRecord();
    hit(1, 4);
    hit(1, 12);
    studio().toggleRecord();
    studio().undoLoop();
    expect(loopsEqual(loop(), firstTake)).toBe(true);
  });

  it('brings back the loop from before a Clear pressed while recording', () => {
    studio().toggleRecord();
    studio().clearLoop();
    hit(2, 3);
    studio().undoLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
  });

  it('does not record while the loop is stopped', () => {
    hit(7, 5);
    expect(loopsEqual(loop(), factory(0))).toBe(true);
  });
});

describe('layers', () => {
  it('records into the chosen layer only and leaves the others untouched', () => {
    studio().clearLoop();
    studio().toggleRecord();
    hit(pad('kick'), 0);
    studio().selectLayer(1);
    hit(pad('snare'), 4);
    hit(pad('kick'), 8);

    const [first, second, third, fourth] = loop().layers;
    expect(first!.pattern.lanes[pad('kick')]![0]).toBeGreaterThan(0);
    expect(first!.pattern.lanes.flat().filter((v) => v > 0)).toHaveLength(1);
    expect(second!.pattern.lanes[pad('snare')]![4]).toBeGreaterThan(0);
    // The layer takes any pad, not only its own family's.
    expect(second!.pattern.lanes[pad('kick')]![8]).toBeGreaterThan(0);
    expect(isLayerEmpty(third!)).toBe(true);
    expect(isLayerEmpty(fourth!)).toBe(true);
  });

  it('hands the sequencer the mix of every layer that is on', () => {
    studio().toggleRecord();
    studio().selectLayer(3);
    hit(pad('extra'), 9);
    expect(patternsEqual(sequencer.pattern, mix())).toBe(true);
    expect(sequencer.pattern.lanes[pad('extra')]![9]).toBeGreaterThan(0);
    // The factory hits in the other layers keep playing.
    expect(sequencer.pattern.lanes[pad('kick')]![0]).toBeGreaterThan(0);
  });

  it('only selects a different layer, and never changes the loop doing so', () => {
    const before = loop();
    studio().selectLayer(2);
    expect(studio().selectedLayer).toBe(2);
    expect(loop()).toBe(before);
    for (const bad of [-1, 4, 1.5]) {
      studio().selectLayer(bad);
      expect(studio().selectedLayer).toBe(2);
    }
  });

  it('switches the chosen layer off when it is chosen again, and back on the next time', () => {
    const kick = pad('kick');
    expect(sequencer.pattern.lanes[kick]![0]).toBeGreaterThan(0);
    studio().selectLayer(0);
    expect(loop().layers[0]!.muted).toBe(true);
    expect(sequencer.pattern.lanes[kick]!.every((v) => v === 0)).toBe(true);
    // The hits are still there, just not played.
    expect(loop().layers[0]!.pattern.lanes[kick]![0]).toBeGreaterThan(0);
    // Not an Undo point.
    expect(studio().undo).toBeNull();

    studio().selectLayer(0);
    expect(loop().layers[0]!.muted).toBe(false);
    expect(sequencer.pattern.lanes[kick]![0]).toBeGreaterThan(0);
  });

  it('switches a layer back on when something is recorded into it', () => {
    studio().selectLayer(1);
    studio().selectLayer(1);
    expect(loop().layers[1]!.muted).toBe(true);
    studio().toggleRecord();
    hit(pad('clap'), 2);
    expect(loop().layers[1]!.muted).toBe(false);
    expect(sequencer.pattern.lanes[pad('snare')]!.some((v) => v > 0)).toBe(true);
  });

  it('edits steps in the chosen layer', () => {
    useStudio.setState({ selectedPad: pad('shaker') });
    studio().selectLayer(2);
    studio().toggleStep(1);
    expect(loop().layers[2]!.pattern.lanes[pad('shaker')]![1]).toBeGreaterThan(0);
    expect(loop().layers[3]).toBe(factory(0).layers[3]);
    expect(sequencer.pattern.lanes[pad('shaker')]![1]).toBeGreaterThan(0);
  });

  it('clears the chosen layer, keeps the rest, and Undo brings it back', () => {
    studio().selectLayer(2);
    studio().clearLayer();
    expect(isLayerEmpty(loop().layers[2]!)).toBe(true);
    expect(loop().layers[0]).toBe(factory(0).layers[0]);
    expect(sequencer.pattern.lanes[pad('closed-hat')]!.every((v) => v === 0)).toBe(true);
    expect(sequencer.pattern.lanes[pad('kick')]![0]).toBeGreaterThan(0);

    studio().undoLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
    studio().undoLoop();
    expect(isLayerEmpty(loop().layers[2]!)).toBe(true);
  });

  it('does nothing, and keeps nothing for Undo, when the chosen layer is already empty', () => {
    studio().clearLoop();
    const undo = studio().undo;
    studio().clearLayer();
    expect(studio().undo).toBe(undo);
  });

  it('keeps a layer cleared during a recording with that take: one Undo for both', () => {
    studio().toggleRecord();
    studio().clearLayer();
    hit(pad('tom'), 7);
    studio().undoLoop();
    expect(loopsEqual(loop(), factory(0))).toBe(true);
  });
});
