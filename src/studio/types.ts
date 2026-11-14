import type { PatternBars, DrumPattern } from '@/engine/sequencer/types';

/**
 * The four families of drum sound. Each has one colour in the Studio, the same
 * way each deck has one in the booth, so a pad can be found without reading.
 */
export type PadFamily = 'low' | 'snare' | 'hat' | 'perc';

/**
 * What sits on each of the eight pads, by position. The order is the same in
 * every kit, so a loop written for one kit plays on any other.
 */
export const PAD_ROLES = [
  { role: 'kick', family: 'low' },
  { role: 'snare', family: 'snare' },
  { role: 'clap', family: 'snare' },
  { role: 'closed-hat', family: 'hat' },
  { role: 'open-hat', family: 'hat' },
  { role: 'tom', family: 'low' },
  { role: 'shaker', family: 'perc' },
  { role: 'extra', family: 'perc' },
] as const satisfies readonly { role: string; family: PadFamily }[];

export type PadRole = (typeof PAD_ROLES)[number]['role'];

/** The closed and open hi-hat share a choke group: one cuts the other off. */
export const HAT_CHOKE_GROUP = 1;

export interface PadInfo {
  readonly role: PadRole;
  readonly family: PadFamily;
  /** One short word, e.g. "Kick". The `extra` pad is named by its kit ("Cowbell", "Block"). */
  readonly name: string;
}

export type KitGlyph = 'circle' | 'triangle' | 'square' | 'star';

export interface KitMeta {
  readonly id: string;
  /** One short, friendly word, or the number a kind of drum machine is known by. */
  readonly name: string;
  /** A shape that stands for the kit, so it can be chosen without reading. Unique per kit. */
  readonly glyph: KitGlyph;
  /** Exactly eight, in PAD_ROLES order. */
  readonly pads: readonly PadInfo[];
}

export interface FactoryLoop {
  readonly id: string;
  /** One or two short words: "Four Floor", "Boom Bap". */
  readonly name: string;
  /** The tempo the loop was written at. */
  readonly bpm: number;
  readonly pattern: DrumPattern;
}

/** How many loops the Studio keeps to hand. */
export const SLOT_COUNT = 8;

/** How many layers a loop is built from. They all play together. */
export const LAYER_COUNT = 4;

/** One layer of a loop: its own hits, and whether it is switched off. */
export interface LoopLayer {
  readonly pattern: DrumPattern;
  readonly muted: boolean;
}

/**
 * A loop as the person builds it: layers recorded one over another, so a new
 * sound never costs the ones underneath. Exactly LAYER_COUNT layers, each
 * pattern the same length as the loop. What plays is their mix.
 */
export interface StudioLoop {
  readonly bars: PatternBars;
  readonly layers: readonly LoopLayer[];
}

/** Everything about a beat that is worth keeping between visits. Plain data. */
export interface StudioProject {
  readonly version: 2;
  readonly kitId: string;
  readonly bpm: number;
  readonly swing: number;
  /** Exactly SLOT_COUNT loops. */
  readonly slots: readonly StudioLoop[];
  readonly activeSlot: number;
}

export type { DrumPattern, PatternBars };
