/**
 * Skill modes: one engine, three faces. A mode only decides which controls are
 * on screen and how big they are; the audio underneath is identical, so a kid
 * who outgrows Play keeps every habit when they move to Mix.
 *
 * Each control names the milestone that builds it (docs/PLAN.md). The shell
 * lists the ones that are not built yet, so what is on screen never claims
 * more than exists.
 */
export type SkillMode = 'play' | 'mix' | 'pro';

/** The last milestone that is finished. Raise it when a milestone ships. */
export const BUILT_THROUGH_MILESTONE = 1;

export interface ModeControl {
  readonly label: string;
  readonly milestone: number;
}

export interface ModeDefinition {
  readonly id: SkillMode;
  readonly name: string;
  readonly tagline: string;
  readonly audience: string;
  readonly deckCount: 2 | 4;
  /** Controls on each deck. */
  readonly deck: readonly ModeControl[];
  /** Controls on the mixer. */
  readonly mixer: readonly ModeControl[];
  /** Everything around the decks. */
  readonly extras: readonly ModeControl[];
}

export const MODE_ORDER: readonly SkillMode[] = ['play', 'mix', 'pro'];

const control = (label: string, milestone: number): ModeControl => ({ label, milestone });

export function isBuilt(item: ModeControl): boolean {
  return item.milestone <= BUILT_THROUGH_MILESTONE;
}

export const MODES: Readonly<Record<SkillMode, ModeDefinition>> = {
  play: {
    id: 'play',
    name: 'Play',
    tagline: 'Tap a record. Slide between songs.',
    audience: 'Ages 4 and up, no reading needed',
    deckCount: 2,
    deck: [
      control('Big play button', 1),
      control('Spin and scratch platter', 1),
      control('Song picker', 1),
    ],
    mixer: [control('Crossfader', 1), control('Magic FX pad', 4)],
    extras: [
      control('Sound pads', 4),
      control('Always in sync', 3),
      control('Grown-ups can set the top volume', 5),
    ],
  },
  mix: {
    id: 'mix',
    name: 'Mix',
    tagline: 'Learn real DJ skills, one control at a time.',
    audience: 'Beginners and families',
    deckCount: 2,
    deck: [
      control('Play and back to start', 1),
      control('Platter', 1),
      control('Waveform', 2),
      control('Tempo fader', 2),
      control('Sync', 3),
      control('4 hot cues', 4),
      control('Loops', 4),
    ],
    mixer: [
      control('Crossfader', 1),
      control('Channel faders', 1),
      control('Level meters', 1),
      control('3-band EQ', 4),
      control('Filter', 4),
      control('3 effects', 4),
    ],
    extras: [control('Guided lessons', 5), control('Sound pads', 4), control('Record your mix', 6)],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The full booth, four decks wide.',
    audience: 'Experienced DJs',
    deckCount: 4,
    deck: [
      control('Play and back to start', 1),
      control('Jog wheel with vinyl feel', 1),
      control('Stacked waveforms', 2),
      control('Tempo ranges', 2),
      control('Key lock and key shift', 3),
      control('Sync and quantize', 3),
      control('8 hot cues', 4),
      control('Loops, rolls and beat jump', 4),
      control('Slip mode', 4),
    ],
    mixer: [
      control('Crossfader', 1),
      control('Channel faders', 1),
      control('Level meters', 1),
      control('Trim', 4),
      control('EQ or isolator', 4),
      control('Colour FX', 4),
      control('Beat FX', 4),
      control('Crossfader curve', 6),
      control('Headphone cue', 6),
    ],
    extras: [
      control('Library with BPM and key', 3),
      control('Sampler', 4),
      control('MIDI controllers', 6),
      control('Recording', 6),
    ],
  },
};
