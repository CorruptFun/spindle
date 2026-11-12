import { describe, expect, it } from 'vitest';
import {
  barSec,
  barStep,
  beatSec,
  inPentatonic,
  loopFrames,
  loopSec,
  midiToFreq,
  noteToMidi,
  parsePattern,
  patternLength,
  scaleStep,
  stepFrame,
  stepSec,
  STEPS_PER_BAR,
} from './sequence';

describe('timing', () => {
  it('divides a beat into four steps and a bar into four beats', () => {
    expect(beatSec(120)).toBe(0.5);
    expect(stepSec(120)).toBe(0.125);
    expect(barSec(120)).toBe(2);
    expect(loopSec(16, 120)).toBe(32);
    expect(STEPS_PER_BAR).toBe(16);
    expect(barStep(2, 3)).toBe(35);
  });

  it('matches the loop-length formula exactly', () => {
    for (const rate of [22050, 44100, 48000, 96000]) {
      for (const bpm of [104, 110, 116]) {
        expect(loopFrames(16, bpm, rate)).toBe(Math.round(((16 * 4 * 60) / bpm) * rate));
      }
    }
    expect(loopFrames(16, 110, 48000)).toBe(1675636);
    expect(loopFrames(16, 110, 44100)).toBe(1539491);
  });

  it('puts the step after the last one exactly on the loop length', () => {
    for (const rate of [22050, 44100, 48000]) {
      expect(stepFrame(16 * STEPS_PER_BAR, 110, rate)).toBe(loopFrames(16, 110, rate));
    }
  });

  it('places steps from the exact time, without drift', () => {
    expect(stepFrame(0, 110, 48000)).toBe(0);
    expect(stepFrame(1, 110, 48000)).toBe(Math.round((60 / 110 / 4) * 48000));
    expect(stepFrame(500, 110, 48000)).toBe(Math.round(((500 * 60) / 440) * 48000));
  });
});

describe('patterns', () => {
  it('reads one step per character, ignoring spacing', () => {
    expect(patternLength('X...x...|o...g...')).toBe(16);
    expect(patternLength('x . x .')).toBe(4);
  });

  it('turns characters into hits with velocities', () => {
    expect(parsePattern('X..x o-g.')).toEqual([
      { step: 0, velocity: 1 },
      { step: 3, velocity: 0.7 },
      { step: 4, velocity: 0.45 },
      { step: 6, velocity: 0.25 },
    ]);
    expect(parsePattern('................')).toEqual([]);
  });

  it('rejects characters it does not know', () => {
    expect(() => parsePattern('X..?')).toThrow();
  });
});

describe('pitch', () => {
  it('names notes in scientific pitch', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A1')).toBe(33);
    expect(noteToMidi('F#2')).toBe(42);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('C-1')).toBe(0);
    expect(() => noteToMidi('H2')).toThrow();
    expect(() => noteToMidi('A')).toThrow();
  });

  it('tunes to A440 in equal temperament', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
  });

  it('walks the A minor pentatonic scale', () => {
    const a2 = noteToMidi('A2');
    const up = [0, 1, 2, 3, 4, 5].map((n) => scaleStep(a2, n));
    expect(up).toEqual(['A2', 'C3', 'D3', 'E3', 'G3', 'A3'].map(noteToMidi));
    expect(scaleStep(a2, -1)).toBe(noteToMidi('G2'));
    expect(scaleStep(noteToMidi('C2'), 3)).toBe(noteToMidi('G2'));
    expect(scaleStep(noteToMidi('D2'), 3)).toBe(noteToMidi('A2'));
    expect(() => scaleStep(noteToMidi('F2'), 1)).toThrow();
  });

  it('knows which notes are in the scale', () => {
    expect(['A3', 'C4', 'D4', 'E4', 'G4'].map(noteToMidi).every(inPentatonic)).toBe(true);
    expect(['F4', 'B3', 'C#4'].map(noteToMidi).some(inPentatonic)).toBe(false);
  });
});
