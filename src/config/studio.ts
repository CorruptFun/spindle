import type { SkillMode } from './modes';

/**
 * What each skill mode shows in the Studio. As at the decks, a mode only
 * decides how much is on screen; the drum machine underneath is the same.
 */
export interface StudioModeFeatures {
  readonly tagline: string;
  /** Words next to the shapes. Play mode manages without. */
  readonly names: boolean;
  readonly record: boolean;
  readonly tempo: boolean;
  readonly stepEditor: boolean;
  readonly swing: boolean;
}

export const STUDIO_MODES: Readonly<Record<SkillMode, StudioModeFeatures>> = {
  play: {
    tagline: 'Tap the pads. Pick a loop.',
    names: false,
    record: false,
    tempo: false,
    stepEditor: false,
    swing: false,
  },
  mix: {
    tagline: 'Play it, record it, change it step by step.',
    names: true,
    record: true,
    tempo: true,
    stepEditor: true,
    swing: false,
  },
  pro: {
    tagline: 'The drum machine, with everything showing.',
    names: true,
    record: true,
    tempo: true,
    stepEditor: true,
    swing: true,
  },
};

export interface ComingStage {
  /** The stage on the Studio track in docs/PLAN.md. */
  readonly stage: string;
  readonly heading: string;
  readonly items: readonly string[];
}

/** What the Studio does not do yet, so the screen never claims more than exists. */
export const STUDIO_COMING: readonly ComingStage[] = [
  {
    stage: 'S2',
    heading: 'Instruments',
    items: ['Bass, keys and lead sounds', 'A keyboard that stays in key', 'Note editor'],
  },
  {
    stage: 'S3',
    heading: 'Songs',
    items: ['Chain loops into a song', 'Mute and solo', 'Effects on each sound'],
  },
  {
    stage: 'S4–S5',
    heading: 'Record and share',
    items: ['Record your voice', 'Your own sounds on the pads', 'Save as an audio file'],
  },
];
