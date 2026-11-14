/**
 * The drum kits. Every sound is synthesised on the spot (see `synth`),
 * so a kit costs nothing to download and sounds the same everywhere.
 *
 * Each kit fills the same eight roles (PAD_ROLES), so any loop plays on any
 * kit. Every pad is brought to a set loudness for its role, the same in every
 * kit: swapping kits mid-loop changes the colour, not the balance.
 */

import type { PadSound } from '@/engine/sampler/types';
import {
  boomKick,
  clap,
  clave,
  conga,
  cowbell,
  crackSnare,
  createRng,
  fadeIn,
  hat,
  machineClap,
  maracas,
  metalHat,
  punchKick,
  rimshot,
  seedFromString,
  shaker,
  snap,
  snappySnare,
  snare,
  soften,
  softKick,
  tapSnare,
  tom,
  woodblock,
  type Rng,
} from '@/synth';
import { HAT_CHOKE_GROUP, PAD_ROLES, type KitMeta, type PadInfo, type PadRole } from './types';

type Voice = (sampleRate: number, rng: Rng) => Float32Array;

interface KitDefinition {
  readonly meta: KitMeta;
  /** One per pad, in PAD_ROLES order. */
  readonly voices: readonly Voice[];
  /**
   * Turns the whole kit down by this many dB (a negative number). For a kit
   * whose sounds ring on under each other, so that a busy loop peaks about
   * where the other kits do instead of leaning on the limiter.
   */
  readonly trimDb?: number;
}

/** Loudness is measured over the first 150 ms: about how long the ear takes to judge a hit. */
export const LOUDNESS_WINDOW_SEC = 0.15;

/** No pad peaks above this, so a few pads together still leave the limiter little to do. */
export const PAD_PEAK_LIMIT = 0.89;

/**
 * Loudness of each role, as RMS over the loudness window in dB. Set the way a
 * drummer balances a kit: kick and snare lead, hats and shaker sit well back.
 * The high, bright sounds are set lower again because the ear is more
 * sensitive up there.
 */
const ROLE_LEVEL_DB: Readonly<Record<PadRole, number>> = {
  kick: -9,
  snare: -16,
  clap: -17,
  'closed-hat': -25,
  'open-hat': -23,
  tom: -14,
  shaker: -25,
  extra: -18,
};

/** RMS of the first LOUDNESS_WINDOW_SEC of a sound (silence after a short sound counts). */
export function hitLoudness(samples: Float32Array, sampleRate: number): number {
  const window = Math.max(1, Math.round(LOUDNESS_WINDOW_SEC * sampleRate));
  const n = Math.min(window, samples.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / window);
}

/** Scales a sound in place to its role's loudness, never above the peak limit. */
function level(samples: Float32Array, sampleRate: number, role: PadRole): Float32Array {
  const loudness = hitLoudness(samples, sampleRate);
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]!));
  if (loudness <= 0 || max <= 0) return samples;
  const gain = Math.min(10 ** (ROLE_LEVEL_DB[role] / 20) / loudness, PAD_PEAK_LIMIT / max);
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * gain;
  return samples;
}

function pads(names: readonly string[]): PadInfo[] {
  return PAD_ROLES.map(({ role, family }, i) => ({ role, family, name: names[i] ?? role }));
}

const DEFINITIONS: readonly KitDefinition[] = [
  {
    // Tight and punchy, for house and disco: short kick, crisp hats, a cowbell.
    meta: {
      id: 'club',
      name: 'Club',
      glyph: 'circle',
      pads: pads(['Kick', 'Snare', 'Clap', 'Hat', 'Open', 'Tom', 'Shaker', 'Cowbell']),
    },
    voices: [
      (sr, rng) => punchKick(sr, rng),
      (sr, rng) => snare(sr, rng),
      (sr, rng) => clap(sr, rng),
      (sr, rng) => hat(sr, rng, 0.03),
      (sr, rng) => hat(sr, rng, 0.15),
      (sr, rng) => tom(sr, rng, 150),
      (sr, rng) => shaker(sr, rng),
      (sr) => cowbell(sr),
    ],
  },
  {
    // Fat and dusty, like a sampled record: long low kick, cracking snare,
    // everything a little darker on top, a rimshot.
    meta: {
      id: 'dusty',
      name: 'Dusty',
      glyph: 'square',
      pads: pads(['Kick', 'Snare', 'Clap', 'Hat', 'Open', 'Tom', 'Shaker', 'Rim']),
    },
    voices: [
      (sr, rng) => boomKick(sr, rng),
      (sr, rng) => crackSnare(sr, rng),
      (sr, rng) => soften(clap(sr, rng), sr, 4000),
      (sr, rng) => soften(hat(sr, rng, 0.04), sr, 7500),
      (sr, rng) => soften(hat(sr, rng, 0.2), sr, 7500),
      (sr, rng) => tom(sr, rng, 98),
      (sr, rng) => soften(shaker(sr, rng), sr, 5000),
      (sr, rng) => rimshot(sr, rng),
    ],
  },
  {
    // Light and playful, a toy box of hand percussion: a soft kick with no
    // click, a snap for the clap, a bongo for the tom, a wood block.
    meta: {
      id: 'toybox',
      name: 'Toybox',
      glyph: 'star',
      pads: pads(['Kick', 'Snare', 'Snap', 'Hat', 'Open', 'Bongo', 'Shaker', 'Block']),
    },
    voices: [
      (sr) => softKick(sr),
      (sr, rng) => tapSnare(sr, rng),
      (sr, rng) => snap(sr, rng),
      (sr, rng) => soften(hat(sr, rng, 0.025), sr, 9000),
      (sr, rng) => soften(hat(sr, rng, 0.12), sr, 9000),
      (sr, rng) => conga(sr, rng, 290),
      (sr, rng) => shaker(sr, rng),
      (sr) => soften(woodblock(sr), sr, 5000),
    ],
  },
  {
    // The drum machine behind hip-hop and trap: a kick that booms on and on,
    // a thin snappy snare, a clap with a room behind it, hats made of metal,
    // maracas and a clave. Tones and noise only, as that machine made them.
    meta: {
      id: '808',
      name: '808',
      glyph: 'triangle',
      pads: pads(['Kick', 'Snare', 'Clap', 'Hat', 'Open', 'Tom', 'Maracas', 'Clave']),
    },
    voices: [
      (sr, rng) => boomKick(sr, rng, 0.6, 1.45),
      (sr, rng) => snappySnare(sr, rng),
      (sr, rng) => machineClap(sr, rng),
      (sr) => metalHat(sr, 0.045),
      (sr) => metalHat(sr, 0.25),
      (sr, rng) => tom(sr, rng, 125),
      (sr, rng) => maracas(sr, rng),
      (sr) => clave(sr),
    ],
    // The long kick is still sounding when the snare and clap land on top of it.
    trimDb: -1.5,
  },
];

export const KITS: readonly KitMeta[] = DEFINITIONS.map((d) => d.meta);

/**
 * Renders every pad of a kit at the audio context's sample rate. The arrays
 * are new on every call, so the pad bank can take them.
 */
export function renderKit(kitId: string, sampleRate: number): PadSound[] {
  const kit = DEFINITIONS.find((d) => d.meta.id === kitId);
  if (!kit) throw new RangeError(`Unknown kit: ${kitId}`);
  const trim = 10 ** ((kit.trimDb ?? 0) / 20);
  return PAD_ROLES.map(({ role }, i): PadSound => {
    const voice = kit.voices[i]!;
    // Each pad has its own noise stream, so changing one sound leaves the others alone.
    const rng = createRng(seedFromString(`${kitId}/${role}`));
    // A quarter-millisecond fade-in: some shared voices (the clap) start on a
    // non-zero sample, which would tick on every hit.
    const raw = fadeIn(voice(sampleRate, rng), Math.round(0.00025 * sampleRate));
    const samples = level(raw, sampleRate, role);
    if (trim !== 1) for (let n = 0; n < samples.length; n++) samples[n] = samples[n]! * trim;
    const audio = { sampleRate, channels: [samples] };
    return role === 'closed-hat' || role === 'open-hat'
      ? { audio, chokeGroup: HAT_CHOKE_GROUP }
      : { audio };
  });
}
