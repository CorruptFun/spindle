/**
 * Saving a beat on the device. A project is plain data, written as JSON.
 *
 * Whatever comes back out of storage may be from an older version, edited by
 * hand or cut short, so parsing never throws: it repairs what it can (a bad
 * slot goes back to its factory loop, a wild tempo is clamped) and gives up
 * with null only when the text cannot be trusted at all.
 *
 * Version 1 kept each loop as one flat pattern. Version 2 keeps its layers.
 * A version 1 beat is split into layers by drum family when it is read, so
 * nothing saved before layers existed is lost.
 */

import { clamp } from '@/lib';
import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/engine/sequencer/types';
import { KITS } from './kits';
import { loopFromPattern, normalizeLoop } from './layers';
import { FACTORY_LOOPS, factoryLoop } from './loops';
import { normalizePattern } from './pattern';
import { SLOT_COUNT, type StudioLoop, type StudioProject } from './types';

/** Far bigger than any real project (about 30 kB), small enough to parse in an instant. */
const MAX_TEXT_LENGTH = 200_000;

function factory(slot: number): StudioLoop {
  return factoryLoop(slot)!;
}

export function defaultProject(): StudioProject {
  return {
    version: 2,
    kitId: KITS[0]!.id,
    bpm: FACTORY_LOOPS[0]!.bpm,
    swing: 0,
    slots: Array.from({ length: SLOT_COUNT }, (_, slot) => factory(slot)),
    activeSlot: 0,
  };
}

export function serializeProject(project: StudioProject): string {
  // Fields listed one by one, so nothing but the project itself is ever saved.
  return JSON.stringify({
    version: project.version,
    kitId: project.kitId,
    bpm: project.bpm,
    swing: project.swing,
    slots: project.slots.map((loop) => ({
      bars: loop.bars,
      layers: loop.layers.map((layer) => ({
        pattern: { bars: layer.pattern.bars, lanes: layer.pattern.lanes },
        muted: layer.muted,
      })),
    })),
    activeSlot: project.activeSlot,
  });
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** One saved slot as a loop: version 1 held a flat pattern, version 2 its layers. */
function readSlot(value: unknown, version: 1 | 2): StudioLoop | null {
  if (version === 2) return normalizeLoop(value);
  const pattern = normalizePattern(value);
  return pattern && loopFromPattern(pattern);
}

export function parseProject(text: string | null): StudioProject | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const version = record['version'];
  if (version !== 1 && version !== 2) return null;

  const defaults = defaultProject();
  const kitId = KITS.some((k) => k.id === record['kitId'])
    ? (record['kitId'] as string)
    : defaults.kitId;

  const bpm = finiteNumber(record['bpm']);
  const swing = finiteNumber(record['swing']);
  const active = finiteNumber(record['activeSlot']);

  const savedSlots: unknown = record['slots'];
  const slots = Array.from(
    { length: SLOT_COUNT },
    (_, slot) =>
      (Array.isArray(savedSlots) ? readSlot(savedSlots[slot], version) : null) ?? factory(slot),
  );

  return {
    version: 2,
    kitId,
    bpm: bpm === null ? defaults.bpm : clamp(bpm, MIN_BPM, MAX_BPM),
    swing: swing === null ? defaults.swing : clamp(swing, 0, MAX_SWING),
    slots,
    activeSlot: active === null ? 0 : clamp(Math.round(active), 0, SLOT_COUNT - 1),
  };
}
