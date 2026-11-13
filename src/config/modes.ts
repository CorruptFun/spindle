/**
 * Skill modes: one engine, three faces. A mode only decides which controls are
 * on screen and how big they are; the audio underneath is identical, so a kid
 * who outgrows Play keeps every habit when they move to Mix.
 *
 * What each mode shows, built and planned, is listed in docs/FEATURES.md.
 */
export type SkillMode = 'play' | 'mix' | 'pro';

export interface ModeDefinition {
  readonly id: SkillMode;
  /** The one word on the switch. */
  readonly name: string;
  readonly deckCount: 2 | 4;
}

export const MODE_ORDER: readonly SkillMode[] = ['play', 'mix', 'pro'];

export const MODES: Readonly<Record<SkillMode, ModeDefinition>> = {
  play: { id: 'play', name: 'Play', deckCount: 2 },
  mix: { id: 'mix', name: 'Mix', deckCount: 2 },
  pro: { id: 'pro', name: 'Pro', deckCount: 4 },
};
