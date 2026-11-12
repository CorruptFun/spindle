/**
 * The four starter songs, written as arrangements on a Studio.
 *
 * Each is 16 bars: an 8-bar A section and an 8-bar B section that adds a layer
 * or changes a pattern, with a short fill at bar 8 and a bigger one in bar 16
 * that leads back round to the top. Every song has sound on its first beat.
 */

import type { EchoOptions, ReverbOptions } from './dsp';
import {
  bounceBass,
  clap,
  electricPiano,
  fatBass,
  hat,
  held,
  kick,
  mallet,
  pad,
  pluck,
  roundBass,
  shaker,
  snare,
  stab,
  tom,
  whistle,
  woodblock,
} from './instruments';
import { barStep, midiToFreq, noteToMidi, parsePattern, scaleStep } from './sequence';
import type { Studio } from './studio';
import { CRATE_BARS, chordAtBar } from './tracks';

export interface Song {
  readonly verb: ReverbOptions;
  /** Echo time is in sixteenth-note steps, so repeats land on the grid. */
  readonly echo: Omit<EchoOptions, 'delaySec'> & { readonly steps: number };
  compose(studio: Studio): void;
}

/** The B section starts here (0-based bar). */
const B = 8;
const LAST = CRATE_BARS - 1;

const hz = midiToFreq;

/** Rhythm-song bass roots: A for the A section, then A, A, C, D two bars each. */
function pedalRoot(bar: number, low: number): number {
  if (bar < 12) return low;
  return scaleStep(low, bar < 14 ? 1 : 2);
}

/** A few takes of each hat, so a run of them does not sound like a machine gun. */
function hats(s: Studio, decaySec: number, name: string): Float32Array[] {
  return [0, 1, 2, 3].map((i) => s.sound(`${name}-${i}`, (r) => hat(s.sampleRate, r, decaySec)));
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]!;
}

// ------------------------------------------------------------------ Bounce
// Four-on-the-floor house: off-beat octave bass, claps on 2 and 4, chord stabs
// arrive in bar 5 and open up in the B section.

const bounce: Song = {
  verb: { size: 0.8, damp: 0.5, wet: 0.2 },
  echo: { steps: 3, feedback: 0.3, wet: 0.45, toneHz: 2500 },
  compose(s) {
    const sr = s.sampleRate;
    const rng = s.rng('groove');
    const kickHit = s.sound('kick', (r) => kick(sr, r));
    const clapHit = s.sound('clap', (r) => clap(sr, r));
    const closed = hats(s, 0.03, 'hat-closed');
    const open = hats(s, 0.12, 'hat-open');
    const hold = s.stepsToSec(1.3);

    for (let bar = 0; bar < CRATE_BARS; bar++) {
      const at = barStep(bar);
      const fill = bar === LAST;
      for (let beat = 0; beat < 4; beat++) {
        if (!(fill && beat === 3)) s.play(kickHit, at + beat * 4, { gain: 0.58 });
        s.play(pick(open, bar + beat), at + beat * 4 + 2, {
          gain: bar >= B ? 0.45 : 0.35,
          pan: 0.25,
        });
        if (bar >= 4) {
          for (const sub of [1, 3]) {
            s.play(pick(closed, beat * 2 + sub), at + beat * 4 + sub, {
              gain: rng.range(0.16, 0.26),
              pan: -0.3,
            });
          }
        }
      }
      s.play(clapHit, at + 4, { gain: 0.55, verb: 0.3 });
      if (!fill) s.play(clapHit, at + 12, { gain: 0.55, verb: 0.3 });

      // Off-beat bass, jumping an octave; every second bar adds a fifth.
      const root = pedalRoot(bar, noteToMidi('A1'));
      const notes: [number, number][] = [
        [2, root],
        [6, root + 12],
        [10, root],
        [14, root + 12],
      ];
      if (bar % 2 === 1) notes.push([11, scaleStep(root, 3) + 12]);
      for (const [step, midi] of notes) {
        s.play(
          s.sound(`bounce-${midi}`, () => bounceBass(sr, hz(midi), hold)),
          at + step,
          { gain: 0.38 },
        );
      }

      if (bar >= 4) {
        const voicing = chordAtBar(bar).voicing.map((m) => m + 12);
        const chordStab = s.sound(`stab-${voicing.join('.')}`, () => stab(sr, voicing.map(hz)));
        const steps = bar % 2 === 0 ? [6, 14] : [3, 6, 14];
        steps.forEach((step, i) =>
          s.play(chordStab, at + step, {
            gain: bar >= B ? 0.5 : 0.35,
            pan: i % 2 === 0 ? -0.2 : 0.2,
            verb: 0.35,
            echo: bar >= B ? 0.3 : 0,
          }),
        );
      }
    }

    // Bar 8: a little clap run into the B section.
    [0.18, 0.26, 0.34].forEach((gain, i) =>
      s.play(clapHit, barStep(B - 1, 13 + i), { gain, verb: 0.3 }),
    );
    // Bar 16: tuned toms tumble down into the top of the loop.
    ['E3', 'D3', 'C3', 'A2'].forEach((note, i) =>
      s.play(
        s.sound(`tom-${note}`, (r) => tom(sr, r, hz(noteToMidi(note)))),
        barStep(LAST, 12 + i),
        { gain: 0.6, pan: 0.3 - i * 0.2, verb: 0.2 },
      ),
    );
  },
};

// ------------------------------------------------------------------- Stomp
// Breakbeat with a thick, warm bass riff. The B section adds busier hats and a
// mallet hook that answers the bass every other bar.

const KICKS = [parsePattern('X......x..X.....'), parsePattern('X.x.......X..x..')];
const SNARES = [parsePattern('....X.......X...'), parsePattern('....X..g.g..X..g')];

/** [step, scale steps above the root, length in steps] */
const STOMP_RIFF: readonly (readonly [number, number, number])[][] = [
  [
    [0, 0, 6],
    [7, 0, 2],
    [10, 1, 3],
    [14, 2, 2],
  ],
  [
    [0, 0, 6],
    [7, 5, 2],
    [10, 3, 2],
    [12, 2, 2],
    [14, 1, 2],
  ],
];

const STOMP_HOOKS: readonly (readonly [number, string])[][] = [
  [
    [2, 'A4'],
    [4, 'C5'],
    [6, 'E5'],
    [10, 'D5'],
  ],
  [
    [2, 'G4'],
    [4, 'A4'],
    [6, 'C5'],
    [8, 'A4'],
  ],
];

const stomp: Song = {
  verb: { size: 0.78, damp: 0.5, wet: 0.18 },
  echo: { steps: 3, feedback: 0.35, wet: 0.5, toneHz: 2200 },
  compose(s) {
    const sr = s.sampleRate;
    const rng = s.rng('groove');
    const kickHit = s.sound('kick', (r) => kick(sr, r));
    const snareHit = s.sound('snare', (r) => snare(sr, r));
    const closed = hats(s, 0.035, 'hat-closed');
    const open = s.sound('hat-open-long', (r) => hat(sr, r, 0.18));

    for (let bar = 0; bar < CRATE_BARS; bar++) {
      const at = barStep(bar);
      const fill = bar === LAST;
      const half = bar % 2;

      for (const hit of pick(KICKS, half)) {
        if (fill && hit.step >= 12) continue;
        s.play(kickHit, at + hit.step, { gain: 0.62 * hit.velocity });
      }
      for (const hit of pick(SNARES, half)) {
        if (fill && hit.step >= 12) continue;
        s.play(snareHit, at + hit.step, { gain: 0.75 * hit.velocity, verb: 0.15 });
      }
      for (let step = 0; step < 16; step += 2) {
        if (step === 14 && bar % 4 === 3) continue;
        const accent = step % 4 === 0 ? 0.4 : 0.28;
        s.play(pick(closed, step / 2 + bar), at + step, {
          gain: accent * rng.range(0.85, 1.05),
          pan: 0.3,
        });
        if (bar >= B && !fill) {
          s.play(pick(closed, step + 1), at + step + 1, { gain: rng.range(0.1, 0.16), pan: 0.3 });
        }
      }
      if (bar % 4 === 3 && !fill) s.play(open, at + 14, { gain: 0.32, pan: 0.3 });

      const root = pedalRoot(bar, noteToMidi('A1'));
      for (const [step, degree, length] of pick(STOMP_RIFF, half)) {
        const midi = scaleStep(root, degree);
        const note = s.sound(`fat-${midi}-${length}`, () =>
          fatBass(sr, hz(midi), s.stepsToSec(length) * 0.9),
        );
        s.play(note, at + step, { gain: 0.36 });
      }

      if (bar >= B && half === 1) {
        for (const [step, name] of pick(STOMP_HOOKS, (bar - B - 1) / 2)) {
          const midi = noteToMidi(name);
          s.play(
            s.sound(`mallet-${midi}`, () => mallet(sr, hz(midi))),
            at + step,
            { gain: 0.42, pan: -0.25, verb: 0.3, echo: 0.35 },
          );
        }
      }
    }

    [0.22, 0.3, 0.38, 0.46].forEach((gain, i) =>
      s.play(snareHit, barStep(B - 1, 12 + i), { gain, verb: 0.15 }),
    );
    ['G3', 'E3', 'D3', 'A2'].forEach((note, i) =>
      s.play(
        s.sound(`tom-${note}`, (r) => tom(sr, r, hz(noteToMidi(note)))),
        barStep(LAST, 12 + i),
        { gain: 0.62, pan: 0.3 - i * 0.2, verb: 0.2 },
      ),
    );
  },
};

// ----------------------------------------------------------------- Sparkle
// A plucked-string arpeggio through the chords with a ping-pong echo, light
// drums and a soft bass. The B section changes the arpeggio shape and adds a
// mallet tune; the loop ends on a run up the scale.

const ARP_SHAPES = [
  [0, 1, 2, 3, 4, 3, 2, 1],
  [0, 2, 4, 6, 5, 3, 4, 2],
];

/** [bar, step, note]: the B-section tune, all on the pentatonic scale. */
const SPARKLE_TUNE: readonly (readonly [number, number, string])[] = [
  [8, 0, 'E5'],
  [8, 3, 'D5'],
  [8, 6, 'C5'],
  [8, 8, 'A4'],
  [8, 12, 'C5'],
  [9, 0, 'E5'],
  [9, 6, 'G5'],
  [9, 10, 'E5'],
  [10, 0, 'A5'],
  [10, 3, 'G5'],
  [10, 6, 'E5'],
  [10, 8, 'C5'],
  [11, 0, 'D5'],
  [11, 4, 'C5'],
  [11, 8, 'A4'],
  [12, 0, 'G5'],
  [12, 3, 'E5'],
  [12, 6, 'D5'],
  [12, 8, 'C5'],
  [13, 0, 'E5'],
  [13, 4, 'D5'],
  [13, 8, 'E5'],
  [13, 12, 'G5'],
  [14, 0, 'A5'],
  [14, 3, 'G5'],
  [14, 6, 'E5'],
  [14, 8, 'D5'],
  [15, 0, 'E5'],
  [15, 4, 'D5'],
  [15, 6, 'C5'],
  [15, 12, 'A5'],
  [15, 13, 'C6'],
  [15, 14, 'D6'],
  [15, 15, 'E6'],
  // Bar 8 previews the run, an octave lower and softer.
  [7, 12, 'A4'],
  [7, 13, 'C5'],
  [7, 14, 'D5'],
  [7, 15, 'E5'],
];

const sparkle: Song = {
  verb: { size: 0.84, damp: 0.45, wet: 0.24 },
  echo: { steps: 3, feedback: 0.38, wet: 0.55, toneHz: 3000 },
  compose(s) {
    const sr = s.sampleRate;
    const rng = s.rng('groove');
    const kickHit = s.sound('kick', (r) => kick(sr, r));
    const tock = s.sound('woodblock', () => woodblock(sr));
    const clapHit = s.sound('clap', (r) => clap(sr, r));
    const shakes = [0, 1, 2].map((i) => s.sound(`shaker-${i}`, (r) => shaker(sr, r)));

    for (let bar = 0; bar < CRATE_BARS; bar++) {
      const at = barStep(bar);
      const chord = chordAtBar(bar);
      const tones = chord.voicing.map((m) => m + 12);
      const ladder = [...tones, ...tones.map((m) => m + 12)];
      const shape = pick(ARP_SHAPES, bar >= B ? 1 : 0);

      for (let step = 0; step < 16; step++) {
        const midi = ladder[pick(shape, step)] ?? tones[0]!;
        const accent = step % 4 === 0 ? 0.62 : 0.42;
        s.play(
          s.sound(`pluck-${midi}`, (r) => pluck(sr, r, hz(midi))),
          at + step,
          {
            gain: accent * rng.range(0.92, 1.05),
            pan: step % 2 === 0 ? -0.3 : 0.3,
            verb: 0.25,
            echo: 0.3,
          },
        );
      }

      s.play(kickHit, at, { gain: 0.55 });
      s.play(kickHit, at + 8, { gain: 0.45 });
      if (bar % 4 === 3 && bar !== LAST) s.play(kickHit, at + 10, { gain: 0.35 });
      if (bar >= 2) {
        s.play(tock, at + 4, { gain: 0.32, pan: 0.15 });
        s.play(tock, at + 12, { gain: 0.32, pan: 0.15 });
      }
      if (bar >= B) {
        s.play(clapHit, at + 4, { gain: 0.2, verb: 0.4 });
        s.play(clapHit, at + 12, { gain: 0.2, verb: 0.4 });
      }
      if (bar >= 4) {
        for (let step = 0; step < 16; step += 2) {
          s.play(pick(shakes, step / 2), at + step, {
            gain: (step % 4 === 2 ? 0.4 : 0.24) * rng.range(0.9, 1.05),
            pan: 0.4,
          });
        }
      }

      for (const [step, length] of [
        [0, 7],
        [8, 6],
      ] as const) {
        s.play(
          s.sound(`round-${chord.root}-${length}`, () =>
            roundBass(sr, hz(chord.root), s.stepsToSec(length)),
          ),
          at + step,
          { gain: 0.36 },
        );
      }
    }

    for (const [bar, step, name] of SPARKLE_TUNE) {
      const midi = noteToMidi(name);
      s.play(
        s.sound(`mallet-${midi}`, () => mallet(sr, hz(midi))),
        barStep(bar, step),
        {
          gain: bar < B ? 0.3 : 0.48,
          pan: 0.1,
          verb: 0.3,
          echo: 0.2,
        },
      );
    }
  },
};

// ------------------------------------------------------------------- Sunny
// Warm chords: a soft pad, an electric piano that pushes each chord change a
// sixteenth early, a shaker, and a sparse kick. The B section adds a lazy
// backbeat and a whistled tune.

/** [bar, step, note, length in steps] */
const SUNNY_TUNE: readonly (readonly [number, number, string, number])[] = [
  [8, 0, 'E5', 6],
  [8, 6, 'D5', 2],
  [8, 8, 'C5', 8],
  [9, 0, 'A4', 4],
  [9, 4, 'C5', 4],
  [9, 8, 'D5', 8],
  [10, 0, 'C5', 6],
  [10, 6, 'A4', 2],
  [10, 8, 'C5', 4],
  [10, 12, 'D5', 4],
  [11, 0, 'E5', 12],
  [12, 0, 'G5', 6],
  [12, 6, 'E5', 2],
  [12, 8, 'D5', 8],
  [13, 0, 'C5', 4],
  [13, 4, 'D5', 4],
  [13, 8, 'E5', 8],
  [14, 0, 'D5', 6],
  [14, 6, 'E5', 2],
  [14, 8, 'G5', 4],
  [14, 12, 'A5', 4],
  [15, 0, 'E5', 10],
];

const sunny: Song = {
  verb: { size: 0.86, damp: 0.45, wet: 0.26 },
  echo: { steps: 3, feedback: 0.3, wet: 0.4, toneHz: 2500 },
  compose(s) {
    const sr = s.sampleRate;
    const rng = s.rng('groove');
    const kickHit = s.sound('kick', (r) => kick(sr, r));
    const snareHit = s.sound('snare', (r) => snare(sr, r));
    const shakes = [0, 1, 2].map((i) => s.sound(`shaker-${i}`, (r) => shaker(sr, r)));
    const shakeLevels = [0.42, 0.18, 0.32, 0.18];

    /** `chordBar` picks the chord, so a push can play the next bar's chord early. */
    const playKeys = (
      bar: number,
      step: number,
      length: number,
      gain: number,
      chordBar = bar,
    ): void => {
      const voicing = chordAtBar(chordBar).voicing.map((m) => m + 12);
      const name = `ep-${voicing.join('.')}`;
      const ringing = s.sound(name, () => electricPiano(sr, voicing.map(hz)));
      const keys = s.sound(`${name}-${length}`, () => held(ringing, sr, s.stepsToSec(length)));
      s.playStereo(keys, barStep(bar, step), { gain, verb: 0.3 });
    };

    for (let bar = 0; bar < CRATE_BARS; bar++) {
      const at = barStep(bar);
      const chord = chordAtBar(bar);
      const fill = bar === LAST;

      if (bar % 2 === 0) {
        const voicing = chord.voicing;
        const chordPad = s.sound(`pad-${voicing.join('.')}`, (r) =>
          pad(sr, r, voicing.map(hz), s.stepsToSec(31)),
        );
        s.playStereo(chordPad, at, { gain: 0.45, verb: 0.35 });
        // The push from the bar before carries over the downbeat.
        playKeys(bar, 6, 2, 0.5);
        playKeys(bar, 10, 3, 0.55);
      } else {
        playKeys(bar, 2, 2, 0.45);
        playKeys(bar, 6, 3, 0.55);
        playKeys(bar, 14, 6, 0.65, bar + 1);
      }

      s.play(kickHit, at, { gain: 0.6 });
      if (!fill && bar !== B - 1) s.play(kickHit, at + 10, { gain: 0.5 });
      if (bar >= B && !fill) s.play(snareHit, at + 12, { gain: 0.24, verb: 0.35 });

      for (let step = 0; step < 16; step++) {
        const roll = fill && step >= 12;
        s.play(pick(shakes, step), at + step, {
          gain: (roll ? 0.2 + (step - 12) * 0.04 : pick(shakeLevels, step)) * rng.range(0.9, 1.05),
          pan: 0.35,
        });
      }

      const next = chordAtBar(bar + 1);
      // Like the keys, the bass pushes each chord change a sixteenth early.
      const bassNotes: [number, number, number][] =
        bar % 2 === 0
          ? [[10, chord.root, 4]]
          : [
              [0, chord.root, 5],
              [10, chord.root, 3],
              [14, next.root, 8],
            ];
      for (const [step, midi, length] of bassNotes) {
        s.play(
          s.sound(`round-${midi}-${length}`, () => roundBass(sr, hz(midi), s.stepsToSec(length))),
          at + step,
          { gain: 0.42 },
        );
      }
    }

    for (const [bar, step, name, length] of SUNNY_TUNE) {
      const midi = noteToMidi(name);
      s.play(
        s.sound(`whistle-${midi}-${length}`, () =>
          whistle(sr, hz(midi), s.stepsToSec(length) * 0.95),
        ),
        barStep(bar, step),
        { gain: 0.4, pan: -0.15, verb: 0.35, echo: 0.25 },
      );
    }

    // Bar 8 and bar 16: soft tuned toms climbing into the next section.
    const climb = (bar: number, from: number, gain: number): void =>
      ['A2', 'C3', 'D3', 'E3'].slice(from).forEach((note, i) =>
        s.play(
          s.sound(`tom-${note}`, (r) => tom(sr, r, hz(noteToMidi(note)))),
          barStep(bar, 12 + (from + i)),
          { gain, pan: -0.2 + (from + i) * 0.15, verb: 0.3 },
        ),
      );
    climb(B - 1, 2, 0.3);
    climb(LAST, 0, 0.38);
  },
};

export const SONGS: Readonly<Record<string, Song>> = { bounce, stomp, sparkle, sunny };
