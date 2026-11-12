/**
 * Timing, pattern and pitch helpers for the starter songs. Pure maths: no audio
 * APIs, so all of it is tested in Node.
 *
 * Time is counted in sixteenth-note steps from the start of the loop.
 */

export const BEATS_PER_BAR = 4;
export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT;

export function beatSec(bpm: number): number {
  return 60 / bpm;
}

export function stepSec(bpm: number): number {
  return beatSec(bpm) / STEPS_PER_BEAT;
}

export function barSec(bpm: number): number {
  return beatSec(bpm) * BEATS_PER_BAR;
}

export function loopSec(bars: number, bpm: number): number {
  return (bars * BEATS_PER_BAR * 60) / bpm;
}

/**
 * Frames in a loop of whole bars. Rounded once, from the exact length, so a
 * loop never drifts by a frame per bar and every song at one rate agrees.
 */
export function loopFrames(bars: number, bpm: number, sampleRate: number): number {
  return Math.round(((bars * BEATS_PER_BAR * 60) / bpm) * sampleRate);
}

/** The frame a step starts on, rounded from the exact time (no accumulated error). */
export function stepFrame(step: number, bpm: number, sampleRate: number): number {
  return Math.round(((step * 60) / (bpm * STEPS_PER_BEAT)) * sampleRate);
}

/** Step index of a bar (0-based) and a step within it. */
export function barStep(bar: number, step = 0): number {
  return bar * STEPS_PER_BAR + step;
}

export interface Hit {
  readonly step: number;
  readonly velocity: number;
}

const VELOCITY: Readonly<Record<string, number>> = { X: 1, x: 0.7, o: 0.45, g: 0.25 };
const REST = new Set(['.', '-']);
const IGNORED = new Set([' ', '|']);

/**
 * A drum-machine row: one character per step. `X` loud, `x` normal, `o` soft,
 * `g` ghost, `.` or `-` rest. Spaces and `|` are only for reading.
 */
export function parsePattern(pattern: string): Hit[] {
  const hits: Hit[] = [];
  let step = 0;
  for (const char of pattern) {
    if (IGNORED.has(char)) continue;
    const velocity = VELOCITY[char];
    if (velocity !== undefined) hits.push({ step, velocity });
    else if (!REST.has(char)) throw new Error(`Unknown pattern character "${char}"`);
    step++;
  }
  return hits;
}

/** How many steps a pattern row spans, rests included. */
export function patternLength(pattern: string): number {
  let steps = 0;
  for (const char of pattern) if (!IGNORED.has(char)) steps++;
  return steps;
}

const NOTE_OFFSETS: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Scientific pitch name to MIDI number: `A4` is 69, `C4` is 60, `F#2` is 42. */
export function noteToMidi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const offset = match ? NOTE_OFFSETS[match[1] ?? ''] : undefined;
  if (!match || offset === undefined) throw new Error(`Not a note name: "${name}"`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + offset + accidental;
}

/** Equal temperament, A4 = 440 Hz. */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * C major / A minor pentatonic (C D E G A). Every melodic note in the crate
 * comes from this set: it has no semitone clashes, so any two songs can play
 * over each other at any offset.
 */
export const PENTATONIC: readonly number[] = [0, 2, 4, 7, 9];

export function inPentatonic(midi: number): boolean {
  return PENTATONIC.includes(((midi % 12) + 12) % 12);
}

/** Move `steps` notes up (or down) the pentatonic scale from a note that is in it. */
export function scaleStep(midi: number, steps: number): number {
  const pc = ((midi % 12) + 12) % 12;
  const index = PENTATONIC.indexOf(pc);
  if (index < 0) throw new Error(`MIDI ${midi} is not in the pentatonic scale`);
  const total = index + steps;
  const octaves = Math.floor(total / PENTATONIC.length);
  const degree = PENTATONIC[total - octaves * PENTATONIC.length] ?? 0;
  return midi - pc + octaves * 12 + degree;
}
