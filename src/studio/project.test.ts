import { describe, expect, it } from 'vitest';
import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/engine/sequencer/types';
import { KITS } from './kits';
import {
  emptyLoop,
  loopFromPattern,
  loopsEqual,
  mixLoop,
  recordIntoLayer,
  setLayerMuted,
  toggleLayerStep,
} from './layers';
import { FACTORY_LOOPS, factoryLoop } from './loops';
import { emptyPattern, patternsEqual, setStep } from './pattern';
import { defaultProject, parseProject, serializeProject } from './project';
import { LAYER_COUNT, SLOT_COUNT, SONG_MAX, type StudioProject } from './types';

function expectSameProject(a: StudioProject, b: StudioProject): void {
  expect({ ...a, slots: undefined }).toEqual({ ...b, slots: undefined });
  expect(a.slots).toHaveLength(b.slots.length);
  a.slots.forEach((slot, i) => expect(loopsEqual(slot, b.slots[i]!)).toBe(true));
}

/** A saved project as plain JSON data, to break in different ways. */
function saved(): Record<string, unknown> {
  return JSON.parse(serializeProject(defaultProject())) as Record<string, unknown>;
}

const parse = (data: unknown): StudioProject | null => parseProject(JSON.stringify(data));

describe('defaultProject', () => {
  it('starts on the first kit with the eight factory loops, slot 0 at its own tempo', () => {
    const p = defaultProject();
    expect(p.version).toBe(2);
    expect(p.kitId).toBe(KITS[0]!.id);
    expect(p.bpm).toBe(FACTORY_LOOPS[0]!.bpm);
    expect(p.swing).toBe(0);
    expect(p.activeSlot).toBe(0);
    expect(p.slots).toHaveLength(SLOT_COUNT);
    p.slots.forEach((slot, i) => expect(slot).toBe(factoryLoop(i)));
    expect(p.song).toEqual([]);
  });

  it('is what a parse of itself gives back', () => {
    expectSameProject(parseProject(serializeProject(defaultProject()))!, defaultProject());
  });

  it('fits well inside the size a saved project may have', () => {
    expect(serializeProject(defaultProject()).length).toBeLessThan(50_000);
  });
});

describe('serializeProject and parseProject', () => {
  it('round-trip an edited project exactly, layers switched off included', () => {
    const base = defaultProject();
    const slots = [...base.slots];
    slots[3] = setLayerMuted(
      recordIntoLayer(toggleLayerStep(emptyLoop(1), 0, 0, 0), 2, 6, 15, 0.123456789),
      1,
      true,
    );
    slots[7] = emptyLoop(2);
    const project: StudioProject = {
      ...base,
      kitId: KITS[2]!.id,
      bpm: 97.5,
      swing: 0.33,
      slots,
      activeSlot: 3,
      song: [3, 0, 0, 7, 3],
    };
    const back = parseProject(serializeProject(project))!;
    expectSameProject(back, project);
    expect(back.slots[3]!.layers[1]!.muted).toBe(true);
    expect(serializeProject(back)).toBe(serializeProject(project));
  });

  it('saves nothing but the project fields', () => {
    const project = { ...defaultProject(), secret: 'x' } as StudioProject;
    expect(Object.keys(JSON.parse(serializeProject(project)) as object).sort()).toEqual(
      ['activeSlot', 'bpm', 'kitId', 'slots', 'song', 'swing', 'version'].sort(),
    );
  });

  it('saves nothing but the loop and layer fields', () => {
    const loop = { ...emptyLoop(1), secret: 'x' };
    const project = { ...defaultProject(), slots: [loop] } as StudioProject;
    const data = JSON.parse(serializeProject(project)) as {
      slots: { layers: Record<string, unknown>[] }[];
    };
    expect(Object.keys(data.slots[0]!).sort()).toEqual(['bars', 'layers']);
    expect(Object.keys(data.slots[0]!.layers[0]!).sort()).toEqual(['muted', 'pattern']);
  });
});

describe('parseProject on hostile input', () => {
  it.each([
    ['null', null],
    ['an empty string', ''],
    ['the text null', 'null'],
    ['an array', '[]'],
    ['an empty object', '{}'],
    ['a number', '42'],
    ['a string', '"hello"'],
    ['broken JSON', '{"version":2,'],
    ['not JSON at all', 'version=2'],
  ])('gives null for %s', (_, text) => {
    expect(parseProject(text)).toBeNull();
  });

  it.each([0, 3, '1', '2', null, 1.0000001])('gives null for version %s', (version) => {
    expect(parse({ ...saved(), version })).toBeNull();
  });

  it('gives null for a text longer than 200 kB, without parsing it', () => {
    const big = JSON.stringify({ ...saved(), pad: 'x'.repeat(1_000_000) });
    expect(parseProject(big)).toBeNull();
  });

  it('fills every missing field from the defaults', () => {
    expectSameProject(parse({ version: 2 })!, defaultProject());
    expectSameProject(parse({ version: 1 })!, defaultProject());
  });

  it('falls back to the first kit for an unknown or odd kit id', () => {
    for (const kitId of ['nope', 'toString', '__proto__', 7, null, ['club']]) {
      expect(parse({ ...saved(), kitId })!.kitId).toBe(KITS[0]!.id);
    }
    expect(parse({ ...saved(), kitId: KITS[1]!.id })!.kitId).toBe(KITS[1]!.id);
  });

  it('clamps tempo and swing, and uses the defaults for anything not a number', () => {
    expect(parse({ ...saved(), bpm: 5 })!.bpm).toBe(MIN_BPM);
    expect(parse({ ...saved(), bpm: 1e9 })!.bpm).toBe(MAX_BPM);
    expect(parse({ ...saved(), swing: -1 })!.swing).toBe(0);
    expect(parse({ ...saved(), swing: 9 })!.swing).toBe(MAX_SWING);
    for (const bad of ['120', null, true, [], {}]) {
      const p = parse({ ...saved(), bpm: bad, swing: bad })!;
      expect(p.bpm).toBe(defaultProject().bpm);
      expect(p.swing).toBe(0);
    }
    // JSON cannot hold NaN or Infinity; they arrive as null.
    expect(parse({ ...saved(), bpm: Number.NaN })!.bpm).toBe(defaultProject().bpm);
  });

  it('clamps the active slot to a real slot', () => {
    expect(parse({ ...saved(), activeSlot: -3 })!.activeSlot).toBe(0);
    expect(parse({ ...saved(), activeSlot: 99 })!.activeSlot).toBe(SLOT_COUNT - 1);
    expect(parse({ ...saved(), activeSlot: 2.4 })!.activeSlot).toBe(2);
    expect(parse({ ...saved(), activeSlot: '5' })!.activeSlot).toBe(0);
  });

  it('replaces a broken slot with its factory loop and keeps the good ones', () => {
    const mine = recordIntoLayer(emptyLoop(1), 1, 0, 0, 1);
    const slots = [...defaultProject().slots] as unknown[];
    slots[1] = mine;
    slots[2] = 'garbage';
    slots[4] = null;
    slots[5] = { bars: 2, layers: { not: 'a list' } };
    const p = parse({ ...saved(), slots })!;
    expect(p.slots).toHaveLength(SLOT_COUNT);
    expect(loopsEqual(p.slots[1]!, mine)).toBe(true);
    for (const i of [2, 4, 5]) expect(p.slots[i]).toBe(factoryLoop(i));
  });

  it('repairs a slot that is nearly right instead of throwing it away', () => {
    const slots = [...defaultProject().slots] as unknown[];
    slots[0] = { bars: 1, layers: [{ pattern: { bars: 1, lanes: [[1, 5, -1, 'x']] } }] };
    const p = parse({ ...saved(), slots })!;
    const layer = p.slots[0]!.layers[0]!;
    expect(layer.pattern.lanes[0]!.slice(0, 4)).toEqual([1, 1, 0, 0]);
    expect(layer.pattern.lanes).toHaveLength(8);
    expect(p.slots[0]!.layers).toHaveLength(LAYER_COUNT);
  });

  it('copes with too few, too many, or no slots', () => {
    const few = parse({ ...saved(), slots: [emptyLoop(1)] })!;
    expect(few.slots).toHaveLength(SLOT_COUNT);
    expect(loopsEqual(few.slots[0]!, emptyLoop(1))).toBe(true);
    expect(few.slots[7]).toBe(factoryLoop(7));

    const ten = Array.from({ length: 10 }, () => emptyLoop(2));
    const many = parse({ ...saved(), slots: ten })!;
    expect(many.slots).toHaveLength(SLOT_COUNT);
    expect(many.slots.every((s) => loopsEqual(s, emptyLoop(2)))).toBe(true);

    for (const slots of [undefined, 'none', 3, { 0: emptyLoop(1) }]) {
      const p = parse({ ...saved(), slots })!;
      p.slots.forEach((s, i) => expect(s).toBe(factoryLoop(i)));
    }
  });

  it('keeps only real slot numbers in the song, and at most SONG_MAX of them', () => {
    expect(parse({ ...saved(), song: [1, 2, 2, 7] })!.song).toEqual([1, 2, 2, 7]);
    expect(parse({ ...saved(), song: [0, -1, 8, 2.5, '3', null, {}, 4, 1e9] })!.song).toEqual([
      0, 4,
    ]);
    const long = Array.from({ length: 40 }, (_, i) => i % SLOT_COUNT);
    expect(parse({ ...saved(), song: long })!.song).toHaveLength(SONG_MAX);
    for (const song of [undefined, null, 'song', 3, { 0: 1, length: 1 }]) {
      expect(parse({ ...saved(), song })!.song).toEqual([]);
    }
  });

  it('ignores fields it does not know', () => {
    const p = parse({ ...saved(), future: { anything: [1, 2, 3] } })!;
    expectSameProject(p, defaultProject());
    expect('future' in p).toBe(false);
  });

  it('never throws on random junk', () => {
    const junk = [
      '{"version":1,"slots":[[[[[[[]]]]]]]}',
      '{"version":2,"slots":[[[[[[[]]]]]]]}',
      '{"version":2,"slots":[{"layers":[{"pattern":{"lanes":{"length":1e9}}}]}]}',
      '{"version":2,"slots":[{"layers":{"length":1e9}}]}',
      '{"version":1,"slots":{"length":1e9}}',
      '{"__proto__":{"version":1}}',
      '{"version":1,"constructor":{"prototype":{"x":1}}}',
      '\u0000￿',
      '['.repeat(5000),
      '1e999',
    ];
    for (const text of junk) expect(() => parseProject(text)).not.toThrow();
    expect(parseProject('{"__proto__":{"version":1}}')).toBeNull();
    expect(parseProject('{"__proto__":{"version":2}}')).toBeNull();
  });
});

describe('a beat saved before layers existed (version 1)', () => {
  /** A version 1 project, as the app wrote it: every slot one flat pattern. */
  function savedV1(slots: unknown[]): string {
    return JSON.stringify({
      version: 1,
      kitId: KITS[1]!.id,
      bpm: 92,
      swing: 0.2,
      slots,
      activeSlot: 5,
    });
  }

  it('is read as version 2, every loop split into layers that mix back into it exactly', () => {
    const patterns = FACTORY_LOOPS.map((f) => f.pattern);
    patterns[2] = setStep(setStep(emptyPattern(1), 0, 0, 1), 3, 6, 0.37);
    patterns[6] = emptyPattern(2);
    const p = parseProject(savedV1(patterns))!;
    expect(p.version).toBe(2);
    expect(p.kitId).toBe(KITS[1]!.id);
    expect(p.bpm).toBe(92);
    expect(p.swing).toBe(0.2);
    expect(p.activeSlot).toBe(5);
    expect(p.song).toEqual([]);
    p.slots.forEach((loop, slot) => {
      expect(loop.layers).toHaveLength(LAYER_COUNT);
      expect(loop.layers.every((layer) => !layer.muted)).toBe(true);
      expect(patternsEqual(mixLoop(loop), patterns[slot]!)).toBe(true);
      expect(loopsEqual(loop, loopFromPattern(patterns[slot]!))).toBe(true);
    });
  });

  it('is saved again as version 2 and reads back the same', () => {
    const p = parseProject(savedV1([setStep(emptyPattern(1), 1, 4, 1)]))!;
    const text = serializeProject(p);
    expect((JSON.parse(text) as { version: number }).version).toBe(2);
    expectSameProject(parseProject(text)!, p);
  });

  it('repairs or replaces its broken slots as before', () => {
    const p = parseProject(savedV1([{ bars: 1, lanes: [[1, 5, -1, 'x']] }, 'garbage']))!;
    expect(mixLoop(p.slots[0]!).lanes[0]!.slice(0, 4)).toEqual([1, 1, 0, 0]);
    expect(p.slots[1]).toBe(factoryLoop(1));
  });
});
