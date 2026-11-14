/**
 * Layers: a loop is four patterns that play together. Each layer is recorded
 * or edited on its own and can be switched off, so a new sound is laid over
 * the beat without touching what is already there.
 *
 * Every function is pure, like the pattern edits: it returns a new loop (or
 * the same one when nothing changes) and never touches the one passed in.
 */

import { PAD_COUNT } from '@/engine/sampler/types';
import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import {
  emptyPattern,
  isEmptyPattern,
  normalizePattern,
  patternsEqual,
  setStep,
  toggleStep,
} from './pattern';
import {
  LAYER_COUNT,
  PAD_ROLES,
  type DrumPattern,
  type LoopLayer,
  type PadFamily,
  type PatternBars,
  type StudioLoop,
} from './types';

/** The families in the order they are listed everywhere, and the layer each goes to when a loop is split. */
const FAMILY_ORDER: readonly PadFamily[] = ['low', 'snare', 'hat', 'perc'];

function isIndex(value: number, length: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < length;
}

function emptyLayer(bars: PatternBars): LoopLayer {
  return { pattern: emptyPattern(bars), muted: false };
}

export function emptyLoop(bars: PatternBars): StudioLoop {
  return { bars, layers: Array.from({ length: LAYER_COUNT }, () => emptyLayer(bars)) };
}

export function isLayerEmpty(layer: LoopLayer): boolean {
  return isEmptyPattern(layer.pattern);
}

/** No hits in any layer, switched off or not. */
export function isLoopEmpty(loop: StudioLoop): boolean {
  return loop.layers.every(isLayerEmpty);
}

/** Same hits in the same layers, and the same layers switched off. */
export function loopsEqual(a: StudioLoop, b: StudioLoop): boolean {
  if (a === b) return true;
  if (a.bars !== b.bars || a.layers.length !== b.layers.length) return false;
  return a.layers.every((layer, index) => {
    const other = b.layers[index];
    return (
      other !== undefined &&
      layer.muted === other.muted &&
      patternsEqual(layer.pattern, other.pattern)
    );
  });
}

/**
 * Splits a flat pattern into layers by drum family: low drums, snares and
 * claps, hats, then percussion. Mixing the result gives the pattern back.
 */
export function loopFromPattern(pattern: DrumPattern): StudioLoop {
  const steps = pattern.bars * STEPS_PER_BAR;
  const layers = FAMILY_ORDER.map((family) => ({
    pattern: {
      bars: pattern.bars,
      lanes: Array.from({ length: PAD_COUNT }, (_, pad) => {
        const lane = pattern.lanes[pad];
        return Array.from({ length: steps }, (_, step) =>
          PAD_ROLES[pad]?.family === family ? (lane?.[step] ?? 0) : 0,
        );
      }),
    },
    muted: false,
  }));
  return { bars: pattern.bars, layers };
}

/** The loudest hit per step among the layers that count. */
function loudest(loop: StudioLoop, pad: number, counts: (layer: number) => boolean): number[] {
  const out = new Array<number>(loop.bars * STEPS_PER_BAR).fill(0);
  loop.layers.forEach((layer, index) => {
    if (layer.muted || !counts(index)) return;
    const lane = layer.pattern.lanes[pad];
    if (!lane) return;
    for (let step = 0; step < out.length; step++) {
      const value = lane[step] ?? 0;
      if (value > out[step]!) out[step] = value;
    }
  });
  return out;
}

/** What the sequencer plays: for every pad and step, the loudest hit among the layers that are on. */
export function mixLoop(loop: StudioLoop): DrumPattern {
  return {
    bars: loop.bars,
    lanes: Array.from({ length: PAD_COUNT }, (_, pad) => loudest(loop, pad, () => true)),
  };
}

/** One pad's lane as the other layers that are on play it: the step editor marks those steps. */
export function otherLayersLane(loop: StudioLoop, layer: number, pad: number): number[] {
  if (!isIndex(layer, loop.layers.length) || !isIndex(pad, PAD_COUNT)) {
    return new Array<number>(loop.bars * STEPS_PER_BAR).fill(0);
  }
  return loudest(loop, pad, (index) => index !== layer);
}

function withLayer(loop: StudioLoop, index: number, layer: LoopLayer): StudioLoop {
  const old = loop.layers[index];
  if (!old || (old.pattern === layer.pattern && old.muted === layer.muted)) return loop;
  return { bars: loop.bars, layers: loop.layers.map((l, i) => (i === index ? layer : l)) };
}

/** One tap on a step of one layer: off, on, accented, off. */
export function toggleLayerStep(
  loop: StudioLoop,
  layer: number,
  pad: number,
  step: number,
): StudioLoop {
  const old = loop.layers[layer];
  if (!old || !isIndex(layer, loop.layers.length)) return loop;
  return withLayer(loop, layer, { ...old, pattern: toggleStep(old.pattern, pad, step) });
}

/**
 * A recorded hit, written into one layer. The layer is switched back on:
 * recording into a layer that cannot be heard would be baffling.
 */
export function recordIntoLayer(
  loop: StudioLoop,
  layer: number,
  pad: number,
  step: number,
  velocity: number,
): StudioLoop {
  const old = loop.layers[layer];
  if (!old || !isIndex(layer, loop.layers.length)) return loop;
  if (!isIndex(pad, PAD_COUNT) || !isIndex(step, loop.bars * STEPS_PER_BAR)) return loop;
  return withLayer(loop, layer, {
    pattern: setStep(old.pattern, pad, step, velocity),
    muted: false,
  });
}

/** Empties one layer and switches it back on, ready to be recorded again. */
export function clearLayer(loop: StudioLoop, layer: number): StudioLoop {
  const old = loop.layers[layer];
  if (!old || !isIndex(layer, loop.layers.length)) return loop;
  if (isLayerEmpty(old) && !old.muted) return loop;
  return withLayer(loop, layer, emptyLayer(loop.bars));
}

/** Every layer empty and on, the same length as before. */
export function clearLoop(loop: StudioLoop): StudioLoop {
  if (loop.layers.every((layer) => isLayerEmpty(layer) && !layer.muted)) return loop;
  return emptyLoop(loop.bars);
}

export function setLayerMuted(loop: StudioLoop, layer: number, muted: boolean): StudioLoop {
  const old = loop.layers[layer];
  if (!old || !isIndex(layer, loop.layers.length)) return loop;
  return withLayer(loop, layer, { pattern: old.pattern, muted });
}

/** The families a layer has at least one hit in, in the fixed order low, snare, hat, perc. */
export function layerFamilies(layer: LoopLayer): PadFamily[] {
  return FAMILY_ORDER.filter((family) =>
    PAD_ROLES.some(
      (role, pad) => role.family === family && layer.pattern.lanes[pad]?.some((v) => v > 0),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A field the object holds itself, never one it inherits. */
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/**
 * Turns anything (a saved loop, a hand-edited file) into a loop that can be
 * played: exactly LAYER_COUNT layers, each a clean pattern of the loop's
 * length. A broken layer is silent, missing layers are added empty and extra
 * ones dropped. Returns null when there is nothing shaped like a loop at all:
 * not an object, or no `layers` list.
 *
 * Reads at most LAYER_COUNT layers, so a huge input costs no more than a normal one.
 */
export function normalizeLoop(value: unknown): StudioLoop | null {
  if (!isRecord(value)) return null;
  const rawLayers = own(value, 'layers');
  if (!Array.isArray(rawLayers)) return null;

  const rawPatterns: unknown[] = [];
  const muted: boolean[] = [];
  for (let index = 0; index < LAYER_COUNT; index++) {
    const layer: unknown = rawLayers[index];
    rawPatterns.push(isRecord(layer) ? own(layer, 'pattern') : undefined);
    muted.push(isRecord(layer) && own(layer, 'muted') === true);
  }

  let bars: PatternBars;
  const rawBars = own(value, 'bars');
  if (rawBars === 1 || rawBars === 2) {
    bars = rawBars;
  } else {
    // No usable bar count: go by the longest layer, as that is what was written.
    const lengths = rawPatterns.map((p) => normalizePattern(p)?.bars ?? 1);
    bars = lengths.some((b) => b === 2) ? 2 : 1;
  }

  const layers = rawPatterns.map((raw, index): LoopLayer => {
    const lanes = isRecord(raw) ? own(raw, 'lanes') : undefined;
    // Read at the loop's length, whatever the layer itself claims.
    const pattern = normalizePattern({ bars, lanes });
    return { pattern: pattern ?? emptyPattern(bars), muted: muted[index] ?? false };
  });
  return { bars, layers };
}
