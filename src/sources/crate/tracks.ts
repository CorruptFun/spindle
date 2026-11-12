/**
 * The starter songs as the rest of the app sees them, plus the musical ground
 * rules all four share so that any two blend on the decks.
 *
 * - One tempo. There is no sync yet, so two decks only sound together if the
 *   songs were written at the same speed.
 * - One key family. Harmony moves through A minor / C major chords that all
 *   share an E, and every melody note is from the A minor pentatonic
 *   (A C D E G), which has no semitone clashes. The two rhythm songs keep their
 *   bass on A, C or D, which sit well under every chord below; the two melody
 *   songs put a soft bass under their own chord roots.
 */

import { BRAND } from '@/config/brand';
import type { TrackMeta } from '../types';
import { loopSec, noteToMidi } from './sequence';

export const CRATE_BPM = 110;
export const CRATE_BARS = 16;

export interface Chord {
  readonly name: string;
  /** Root for the bass, in the bass octave. */
  readonly root: number;
  /** Close voicing around middle C. Every chord keeps E4, so changes are smooth. */
  readonly voicing: readonly number[];
}

const chord = (name: string, root: string, notes: readonly string[]): Chord => ({
  name,
  root: noteToMidi(root),
  voicing: notes.map(noteToMidi),
});

/** Two bars per chord, eight bars round, played twice in a 16-bar song. */
export const PROGRESSION: readonly Chord[] = [
  chord('Am7', 'A2', ['A3', 'C4', 'E4', 'G4']),
  chord('Fmaj7', 'F2', ['F3', 'A3', 'C4', 'E4']),
  chord('Cadd9', 'C3', ['G3', 'C4', 'D4', 'E4']),
  chord('G6sus2', 'G2', ['G3', 'A3', 'D4', 'E4']),
];

export function chordAtBar(bar: number): Chord {
  const index = Math.floor(bar / 2) % PROGRESSION.length;
  return PROGRESSION[index] ?? PROGRESSION[0]!;
}

const DURATION_SEC = loopSec(CRATE_BARS, CRATE_BPM);

/** Rhythm-led first, melody-led second, so a pair from each half layers well. */
export const CRATE_TRACKS: readonly TrackMeta[] = [
  {
    ref: { source: 'crate', id: 'bounce' },
    title: 'Bounce',
    artist: BRAND.name,
    durationSec: DURATION_SEC,
    bpm: CRATE_BPM,
    glyph: 'square',
  },
  {
    ref: { source: 'crate', id: 'stomp' },
    title: 'Stomp',
    artist: BRAND.name,
    durationSec: DURATION_SEC,
    bpm: CRATE_BPM,
    glyph: 'triangle',
  },
  {
    ref: { source: 'crate', id: 'sparkle' },
    title: 'Sparkle',
    artist: BRAND.name,
    durationSec: DURATION_SEC,
    bpm: CRATE_BPM,
    glyph: 'star',
  },
  {
    ref: { source: 'crate', id: 'sunny' },
    title: 'Sunny',
    artist: BRAND.name,
    durationSec: DURATION_SEC,
    bpm: CRATE_BPM,
    glyph: 'circle',
  },
];
