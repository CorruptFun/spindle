/**
 * Skill modes: one engine, three faces. A mode only decides which controls are
 * on screen and how big they are; the audio underneath is identical, so a kid
 * who outgrows Play keeps every habit when they move to Mix.
 *
 * The control lists below drive the shell preview today and become the layout
 * contracts for `ui/layouts` as each milestone lands (see docs/FEATURES.md).
 */
export type SkillMode = 'play' | 'mix' | 'pro';

export interface ModeDefinition {
  readonly id: SkillMode;
  readonly name: string;
  readonly tagline: string;
  readonly audience: string;
  readonly deckCount: 2 | 4;
  /** Control groups on each deck. */
  readonly deck: readonly string[];
  /** Control groups on the mixer. */
  readonly mixer: readonly string[];
  /** Everything around the decks. */
  readonly extras: readonly string[];
}

export const MODE_ORDER: readonly SkillMode[] = ['play', 'mix', 'pro'];

export const MODES: Readonly<Record<SkillMode, ModeDefinition>> = {
  play: {
    id: 'play',
    name: 'Play',
    tagline: 'Tap a record, slide between songs, hit the pads. Everything stays in time.',
    audience: 'Ages 4 and up, no reading needed',
    deckCount: 2,
    deck: ['Big play button', 'Spin and scratch platter', 'Song picker'],
    mixer: ['Crossfader', 'Magic FX pad'],
    extras: ['Sound pads', 'Always in sync', 'Volume kept at a safe level'],
  },
  mix: {
    id: 'mix',
    name: 'Mix',
    tagline: 'Learn real DJ skills, one control at a time.',
    audience: 'Beginners and families',
    deckCount: 2,
    deck: ['Play and cue', 'Platter', 'Waveform', 'Tempo fader', 'Sync', '4 hot cues', 'Loops'],
    mixer: ['Crossfader', 'Channel faders', '3-band EQ', 'Filter', '3 effects'],
    extras: ['Guided lessons', 'Sound pads', 'Record your mix'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'The full booth: four decks, a full mixer, controllers and recording.',
    audience: 'Experienced DJs',
    deckCount: 4,
    deck: [
      'Play and cue',
      'Jog wheel with vinyl and slip',
      'Stacked waveforms',
      'Tempo ranges',
      'Key lock and key shift',
      'Sync and quantize',
      '8 hot cues',
      'Loops, rolls and beat jump',
    ],
    mixer: [
      'Crossfader with curve',
      'Channel faders and trim',
      'EQ or isolator',
      'Colour FX',
      'Beat FX',
      'Headphone cue',
      'Meters',
    ],
    extras: ['Sampler', 'MIDI controllers', 'Recording', 'Library with BPM and key'],
  },
};
