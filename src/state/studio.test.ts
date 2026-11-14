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
  SONG_MAX,
  STEP_ACCENT,
  STEP_ON,
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
    /** The song it was last handed, or null. Like the real one, a loop change ends it. */
    chain: null as readonly DrumPattern[] | null,
    /** The song entry the test says is sounding. */
    position: -1,
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
      sequencer.chain = null;
    },
    setChain(chain: readonly DrumPattern[] | null, moved?: (index: number) => number) {
      sequencer.chain = chain && chain.length > 0 ? chain : null;
      if (moved && sequencer.chain) {
        sequencer.position = Math.max(-1, Math.min(moved(sequencer.position), chain!.length - 1));
      }
    },
    chainPosition() {
      return playing && sequencer.chain ? sequencer.position : -1;
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
  sequencer.position = -1;
});

/** A bar line arrives with song entry `position` sounding. */
function barLine(position: number): void {
  sequencer.position = position;
  sequencer.onBar?.();
}

/** A song of these slots, playing from the top. */
function playSong(...slots: number[]): void {
  for (const slot of slots) studio().addToSong(slot);
  studio().toggleSong();
}

describe('the song', () => {
  it('adds loops to the end, takes entries out, and clears', () => {
    studio().addToSong(3);
    studio().addToSong(1);
    studio().addToSong(3);
    expect(studio().project.song).toEqual([3, 1, 3]);
    studio().removeFromSong(0);
    expect(studio().project.song).toEqual([1, 3]);
    studio().clearSong();
    expect(studio().project.song).toEqual([]);
  });

  it('holds at most SONG_MAX loops', () => {
    for (let i = 0; i < SONG_MAX + 3; i += 1) studio().addToSong(i % 8);
    expect(studio().project.song).toHaveLength(SONG_MAX);
  });

  it('starts from the top with the mix of each entry, and the first loop on screen', () => {
    useStudio.setState({ bar: 1 });
    playSong(2, 5, 2);
    const slots = studio().project.slots;
    expect(sequencer.playing).toBe(true);
    expect(sequencer.chain).toHaveLength(3);
    [2, 5, 2].forEach((slot, i) =>
      expect(patternsEqual(sequencer.chain![i]!, mixLoop(slots[slot]!))).toBe(true),
    );
    expect(studio().playing).toBe(true);
    expect(studio().songPlaying).toBe(true);
    expect(studio().songPosition).toBe(0);
    expect(studio().project.activeSlot).toBe(2);
    expect(studio().bar).toBe(0);
  });

  it('does nothing when there is no song', () => {
    studio().toggleSong();
    expect(studio().songPlaying).toBe(false);
    expect(sequencer.playing).toBe(false);
  });

  it('stops whatever was playing, recording too, before it starts', () => {
    studio().toggleRecord();
    studio().addToSong(4);
    studio().toggleSong();
    expect(studio().recording).toBe(false);
    expect(sequencer.click).toBe(false);
    expect(studio().songPlaying).toBe(true);
  });

  it('shows the loop being heard when a bar line brings the next entry', () => {
    playSong(1, 6);
    useStudio.setState({ bar: 1 });
    barLine(0);
    expect(studio().project.activeSlot).toBe(1);
    expect(studio().bar).toBe(1);
    barLine(1);
    expect(studio().songPosition).toBe(1);
    expect(studio().project.activeSlot).toBe(6);
    expect(studio().bar).toBe(0);
    barLine(0);
    expect(studio().project.activeSlot).toBe(1);
  });

  it('carries on with a changed list, and ends when it is emptied', () => {
    playSong(1, 6);
    studio().addToSong(7);
    expect(sequencer.chain).toHaveLength(3);
    expect(patternsEqual(sequencer.chain![2]!, mixLoop(studio().project.slots[7]!))).toBe(true);
    studio().removeFromSong(0);
    expect(sequencer.chain).toHaveLength(2);
    expect(studio().songPlaying).toBe(true);

    studio().clearSong();
    expect(studio().songPlaying).toBe(false);
    expect(studio().songPosition).toBe(-1);
    expect(sequencer.chain).toBeNull();
    // The loop that was sounding keeps going round.
    expect(studio().playing).toBe(true);
    expect(sequencer.playing).toBe(true);
  });

  it('is stopped by Stop, and by the song button again', () => {
    playSong(2);
    studio().stop();
    expect(studio().songPlaying).toBe(false);
    expect(studio().playing).toBe(false);
    expect(sequencer.chain).toBeNull();

    studio().toggleSong();
    expect(studio().songPlaying).toBe(true);
    studio().toggleSong();
    expect(studio().songPlaying).toBe(false);
    expect(sequencer.playing).toBe(false);
  });

  it('is left for the loop by Play: Play means the loop on screen', () => {
    playSong(2);
    studio().togglePlay();
    studio().togglePlay();
    expect(studio().songPlaying).toBe(false);
    expect(sequencer.chain).toBeNull();
    expect(patternsEqual(sequencer.pattern, mix())).toBe(true);
  });

  it.each<[string, () => void]>([
    ['picking a loop', () => studio().selectSlot(3)],
    ['editing a step', () => studio().toggleStep(5)],
    ['editing a step in the grid', () => studio().toggleStepAt(2, 21)],
    ['switching recording on', () => studio().toggleRecord()],
    ['clearing the loop', () => studio().clearLoop()],
    ['clearing a layer', () => studio().clearLayer()],
    ['resetting the loop', () => studio().resetLoop()],
    ['Undo', () => studio().undoLoop()],
    ['switching a layer off', () => studio().selectLayer(0)],
  ])('is left by %s, and the loop sounding keeps going', (_, touch) => {
    playSong(5, 1);
    barLine(1);
    touch();
    expect(studio().songPlaying).toBe(false);
    expect(studio().songPosition).toBe(-1);
    expect(sequencer.chain).toBeNull();
    expect(studio().playing).toBe(true);
    expect(sequencer.playing).toBe(true);
  });

  it('stays the active loop when the song is left by an edit', () => {
    playSong(5, 1);
    barLine(1);
    studio().toggleStep(5);
    expect(studio().project.activeSlot).toBe(1);
    expect(patternsEqual(sequencer.pattern, mix())).toBe(true);
  });

  it('is not left by playing the pads along with it', () => {
    playSong(5, 1);
    hit(pad('snare'), 4);
    expect(studio().songPlaying).toBe(true);
    expect(sequencer.chain).not.toBeNull();
    // Choosing a different layer only chooses it.
    studio().selectLayer(2);
    expect(studio().songPlaying).toBe(true);
  });
});

describe('editing a step in the grid', () => {
  it('toggles any pad on any step of the loop, whichever pad and bar are shown', () => {
    const shaker = pad('shaker');
    useStudio.setState({ selectedPad: pad('kick'), bar: 0 });
    // Step 3 of the second bar.
    studio().toggleStepAt(shaker, 19);
    expect(loop().layers[0]!.pattern.lanes[shaker]![19]).toBe(STEP_ON);
    expect(sequencer.pattern.lanes[shaker]![19]).toBe(STEP_ON);
    // Nothing else moved.
    expect(loop().layers[0]!.pattern.lanes[pad('kick')]).toBe(
      factory(0).layers[0]!.pattern.lanes[pad('kick')],
    );
    expect(studio().bar).toBe(0);
  });

  it('goes off, on, accented and off again, like a step key', () => {
    const tom = pad('tom');
    studio().toggleStepAt(tom, 2);
    expect(loop().layers[0]!.pattern.lanes[tom]![2]).toBe(STEP_ON);
    studio().toggleStepAt(tom, 2);
    expect(loop().layers[0]!.pattern.lanes[tom]![2]).toBe(STEP_ACCENT);
    studio().toggleStepAt(tom, 2);
    expect(loop().layers[0]!.pattern.lanes[tom]![2]).toBe(0);
    expect(loopsEqual(loop(), factory(0))).toBe(true);
  });

  it('writes into the chosen layer and leaves the others as they were', () => {
    const clap = pad('clap');
    studio().selectLayer(3);
    studio().toggleStepAt(clap, 30);
    expect(loop().layers[3]!.pattern.lanes[clap]![30]).toBe(STEP_ON);
    expect(loop().layers[1]).toBe(factory(0).layers[1]);
    expect(patternsEqual(sequencer.pattern, mix())).toBe(true);
  });

  it('selects the pad whose row was edited', () => {
    studio().toggleStepAt(pad('open-hat'), 0);
    expect(studio().selectedPad).toBe(pad('open-hat'));
  });

  it('does nothing for a pad or a step that is not there', () => {
    const before = loop();
    for (const [badPad, badStep] of [
      [-1, 0],
      [8, 0],
      [1.5, 0],
      [0, -1],
      [0, 32],
      [0, 2.5],
      [Number.NaN, Number.NaN],
    ] as const) {
      studio().toggleStepAt(badPad, badStep);
    }
    expect(loop()).toBe(before);
    expect(studio().selectedPad).toBe(0);
  });

  it('is not something Undo takes back, like any step edit', () => {
    studio().toggleStepAt(pad('snare'), 9);
    expect(studio().undo).toBeNull();
  });
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
