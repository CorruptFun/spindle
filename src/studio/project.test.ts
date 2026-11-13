import { describe, expect, it } from 'vitest';
import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/engine/sequencer/types';
import { KITS } from './kits';
import { FACTORY_LOOPS } from './loops';
import { emptyPattern, patternsEqual, setStep, toggleStep } from './pattern';
import { defaultProject, parseProject, serializeProject } from './project';
import { SLOT_COUNT, type StudioProject } from './types';

function expectSameProject(a: StudioProject, b: StudioProject): void {
  expect({ ...a, slots: undefined }).toEqual({ ...b, slots: undefined });
  expect(a.slots).toHaveLength(b.slots.length);
  a.slots.forEach((slot, i) => expect(patternsEqual(slot, b.slots[i]!)).toBe(true));
}

/** A saved project as plain JSON data, to break in different ways. */
function saved(): Record<string, unknown> {
  return JSON.parse(serializeProject(defaultProject())) as Record<string, unknown>;
}

const parse = (data: unknown): StudioProject | null => parseProject(JSON.stringify(data));

describe('defaultProject', () => {
  it('starts on the first kit with the eight factory loops, slot 0 at its own tempo', () => {
    const p = defaultProject();
    expect(p.version).toBe(1);
    expect(p.kitId).toBe(KITS[0]!.id);
    expect(p.bpm).toBe(FACTORY_LOOPS[0]!.bpm);
    expect(p.swing).toBe(0);
    expect(p.activeSlot).toBe(0);
    expect(p.slots).toHaveLength(SLOT_COUNT);
    p.slots.forEach((slot, i) => expect(slot).toBe(FACTORY_LOOPS[i]!.pattern));
  });

  it('is what a parse of itself gives back', () => {
    expectSameProject(parseProject(serializeProject(defaultProject()))!, defaultProject());
  });
});

describe('serializeProject and parseProject', () => {
  it('round-trip an edited project exactly', () => {
    const base = defaultProject();
    const slots = [...base.slots];
    slots[3] = setStep(toggleStep(emptyPattern(1), 0, 0), 6, 15, 0.123456789);
    slots[7] = emptyPattern(2);
    const project: StudioProject = {
      ...base,
      kitId: KITS[2]!.id,
      bpm: 97.5,
      swing: 0.33,
      slots,
      activeSlot: 3,
    };
    const back = parseProject(serializeProject(project))!;
    expectSameProject(back, project);
    expect(serializeProject(back)).toBe(serializeProject(project));
  });

  it('saves nothing but the project fields', () => {
    const project = { ...defaultProject(), secret: 'x' } as StudioProject;
    expect(Object.keys(JSON.parse(serializeProject(project)) as object).sort()).toEqual(
      ['activeSlot', 'bpm', 'kitId', 'slots', 'swing', 'version'].sort(),
    );
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
    ['broken JSON', '{"version":1,'],
    ['not JSON at all', 'version=1'],
  ])('gives null for %s', (_, text) => {
    expect(parseProject(text)).toBeNull();
  });

  it.each([0, 2, '1', null, 1.0000001])('gives null for version %s', (version) => {
    expect(parse({ ...saved(), version })).toBeNull();
  });

  it('gives null for a text longer than 200 kB, without parsing it', () => {
    const big = JSON.stringify({ ...saved(), pad: 'x'.repeat(1_000_000) });
    expect(parseProject(big)).toBeNull();
  });

  it('fills every missing field from the defaults', () => {
    const p = parse({ version: 1 })!;
    expectSameProject(p, defaultProject());
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
    const mine = setStep(emptyPattern(1), 0, 0, 1);
    const slots = [...defaultProject().slots] as unknown[];
    slots[1] = mine;
    slots[2] = 'garbage';
    slots[4] = null;
    slots[5] = { bars: 2, lanes: { not: 'a list' } };
    const p = parse({ ...saved(), slots })!;
    expect(p.slots).toHaveLength(SLOT_COUNT);
    expect(patternsEqual(p.slots[1]!, mine)).toBe(true);
    for (const i of [2, 4, 5]) expect(p.slots[i]).toBe(FACTORY_LOOPS[i]!.pattern);
  });

  it('repairs a slot that is nearly right instead of throwing it away', () => {
    const slots = [...defaultProject().slots] as unknown[];
    slots[0] = { bars: 1, lanes: [[1, 5, -1, 'x']] };
    const p = parse({ ...saved(), slots })!;
    expect(p.slots[0]!.lanes[0]!.slice(0, 4)).toEqual([1, 1, 0, 0]);
    expect(p.slots[0]!.lanes).toHaveLength(8);
  });

  it('copes with too few, too many, or no slots', () => {
    const few = parse({ ...saved(), slots: [emptyPattern(1)] })!;
    expect(few.slots).toHaveLength(SLOT_COUNT);
    expect(patternsEqual(few.slots[0]!, emptyPattern(1))).toBe(true);
    expect(few.slots[7]).toBe(FACTORY_LOOPS[7]!.pattern);

    const ten = Array.from({ length: 10 }, () => emptyPattern(2));
    const many = parse({ ...saved(), slots: ten })!;
    expect(many.slots).toHaveLength(SLOT_COUNT);
    expect(many.slots.every((s) => patternsEqual(s, emptyPattern(2)))).toBe(true);

    for (const slots of [undefined, 'none', 3, { 0: emptyPattern(1) }]) {
      const p = parse({ ...saved(), slots })!;
      p.slots.forEach((s, i) => expect(s).toBe(FACTORY_LOOPS[i]!.pattern));
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
      '{"version":1,"slots":{"length":1e9}}',
      '{"__proto__":{"version":1}}',
      '{"version":1,"constructor":{"prototype":{"x":1}}}',
      '\u0000￿',
      '['.repeat(5000),
      '1e999',
    ];
    for (const text of junk) expect(() => parseProject(text)).not.toThrow();
    expect(parseProject('{"__proto__":{"version":1}}')).toBeNull();
  });
});
