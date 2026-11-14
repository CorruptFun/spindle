import type { SkillMode } from './modes';

/**
 * What each skill mode shows in the Studio. As at the decks, a mode only
 * decides how much is on screen; the drum machine underneath is the same.
 * What is still to come is listed in docs/PLAN.md (Studio track), not in the app.
 */
export interface StudioModeFeatures {
  /** Words next to the shapes. Play mode manages without. */
  readonly names: boolean;
  readonly record: boolean;
  readonly tempo: boolean;
  readonly stepEditor: boolean;
  readonly swing: boolean;
  /** The layer boxes. Without them every layer still plays; there is just no choosing one. */
  readonly layers: boolean;
}

export const STUDIO_MODES: Readonly<Record<SkillMode, StudioModeFeatures>> = {
  play: {
    names: false,
    record: false,
    tempo: false,
    stepEditor: false,
    swing: false,
    layers: false,
  },
  mix: { names: true, record: true, tempo: true, stepEditor: true, swing: false, layers: true },
  pro: { names: true, record: true, tempo: true, stepEditor: true, swing: true, layers: true },
};
