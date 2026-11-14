import { describe, expect, it } from 'vitest';
import { PAD_COUNT } from '@/engine/sampler/types';
import {
  clearLayer,
  clearLoop,
  emptyLoop,
  isLayerEmpty,
  isLoopEmpty,
  layerFamilies,
  loopFromPattern,
  loopsEqual,
  mixLoop,
  normalizeLoop,
  otherLayersLane,
  recordIntoLayer,
  setLayerMuted,
  toggleLayerStep,
} from './layers';
import { FACTORY_LOOPS } from './loops';
import { emptyPattern, patternsEqual, setStep, STEP_ACCENT, STEP_ON } from './pattern';
import { LAYER_COUNT, PAD_ROLES, type StudioLoop } from './types';

const pad = (role: string): number => PAD_ROLES.findIndex((r) => r.role === role);
const KICK = pad('kick');
const SNARE = pad('snare');
const HAT = pad('closed-hat');

/** A loop with a kick on step 0 in layer 0 and a snare on step 4 in layer 1. */
function twoLayers(): StudioLoop {
  let loop = emptyLoop(1);
  loop = recordIntoLayer(loop, 0, KICK, 0, 1);
  loop = recordIntoLayer(loop, 1, SNARE, 4, STEP_ON);
  return loop;
}

describe('emptyLoop', () => {
  it('has four empty layers of the right length, none switched off', () => {
    const loop = emptyLoop(2);
    expect(loop.bars).toBe(2);
    expect(loop.layers).toHaveLength(LAYER_COUNT);
    for (const layer of loop.layers) {
      expect(layer.muted).toBe(false);
      expect(layer.pattern.bars).toBe(2);
      expect(layer.pattern.lanes).toHaveLength(PAD_COUNT);
      expect(layer.pattern.lanes.every((lane) => lane.length === 32)).toBe(true);
      expect(isLayerEmpty(layer)).toBe(true);
    }
    expect(isLoopEmpty(loop)).toBe(true);
  });
});

describe('loopFromPattern', () => {
  it('puts each drum family in its own layer: low, snare, hat, perc', () => {
    for (const { pattern } of FACTORY_LOOPS) {
      const loop = loopFromPattern(pattern);
      expect(loop.bars).toBe(pattern.bars);
      expect(loop.layers).toHaveLength(LAYER_COUNT);
      const order = ['low', 'snare', 'hat', 'perc'];
      loop.layers.forEach((layer, index) => {
        expect(layer.muted).toBe(false);
        PAD_ROLES.forEach((role, p) => {
          const expected = role.family === order[index] ? pattern.lanes[p] : new Array(32).fill(0);
          expect(layer.pattern.lanes[p]).toEqual(expected);
        });
      });
    }
  });

  it('mixes back into the very same pattern', () => {
    for (const { pattern } of FACTORY_LOOPS) {
      expect(patternsEqual(mixLoop(loopFromPattern(pattern)), pattern)).toBe(true);
    }
  });

  it('never shares a lane with the pattern it came from', () => {
    const pattern = setStep(emptyPattern(1), KICK, 0, 1);
    const loop = loopFromPattern(pattern);
    expect(loop.layers[0]!.pattern.lanes[KICK]).not.toBe(pattern.lanes[KICK]);
  });
});

describe('mixLoop', () => {
  it('plays every layer that is on, the loudest hit winning', () => {
    let loop = twoLayers();
    loop = recordIntoLayer(loop, 2, KICK, 0, 0.3);
    const mix = mixLoop(loop);
    expect(mix.lanes).toHaveLength(PAD_COUNT);
    expect(mix.lanes[KICK]![0]).toBe(1);
    expect(mix.lanes[SNARE]![4]).toBe(STEP_ON);
    expect(mix.lanes.flat().filter((v) => v > 0)).toHaveLength(2);
  });

  it('leaves out a layer that is switched off', () => {
    const mix = mixLoop(setLayerMuted(twoLayers(), 1, true));
    expect(mix.lanes[SNARE]![4]).toBe(0);
    expect(mix.lanes[KICK]![0]).toBe(1);
  });

  it('is always eight lanes of the loop length', () => {
    const mix = mixLoop(emptyLoop(2));
    expect(mix.bars).toBe(2);
    expect(mix.lanes).toHaveLength(PAD_COUNT);
    expect(mix.lanes.every((lane) => lane.length === 32)).toBe(true);
  });
});

describe('otherLayersLane', () => {
  it('shows what the other layers that are on play on one pad', () => {
    let loop = twoLayers();
    loop = recordIntoLayer(loop, 3, SNARE, 12, 0.5);
    expect(otherLayersLane(loop, 0, SNARE)[4]).toBe(STEP_ON);
    expect(otherLayersLane(loop, 0, SNARE)[12]).toBe(0.5);
    // A layer's own hits are not "another layer".
    expect(otherLayersLane(loop, 1, SNARE)[4]).toBe(0);
    expect(otherLayersLane(setLayerMuted(loop, 3, true), 0, SNARE)[12]).toBe(0);
  });

  it('is a silent lane of the loop length for a layer or pad that does not exist', () => {
    for (const [layer, p] of [
      [-1, 0],
      [4, 0],
      [0, 8],
      [0.5, 0],
    ] as const) {
      const lane = otherLayersLane(twoLayers(), layer, p);
      expect(lane).toHaveLength(16);
      expect(lane.every((v) => v === 0)).toBe(true);
    }
  });
});

describe('editing one layer', () => {
  it('toggles a step in that layer only, off then on then accent then off', () => {
    const loop = emptyLoop(1);
    const on = toggleLayerStep(loop, 2, HAT, 3);
    expect(on.layers[2]!.pattern.lanes[HAT]![3]).toBe(STEP_ON);
    expect(on.layers[0]).toBe(loop.layers[0]);
    const accent = toggleLayerStep(on, 2, HAT, 3);
    expect(accent.layers[2]!.pattern.lanes[HAT]![3]).toBe(STEP_ACCENT);
    expect(toggleLayerStep(accent, 2, HAT, 3).layers[2]!.pattern.lanes[HAT]![3]).toBe(0);
    // Nothing changed in place.
    expect(isLoopEmpty(loop)).toBe(true);
  });

  it('records into a layer and switches it back on', () => {
    const muted = setLayerMuted(emptyLoop(1), 1, true);
    const recorded = recordIntoLayer(muted, 1, SNARE, 8, 0.9);
    expect(recorded.layers[1]!.muted).toBe(false);
    expect(recorded.layers[1]!.pattern.lanes[SNARE]![8]).toBe(0.9);
    expect(muted.layers[1]!.muted).toBe(true);
  });

  it('clears a layer, switches it on, and leaves the others alone', () => {
    const loop = setLayerMuted(twoLayers(), 1, true);
    const cleared = clearLayer(loop, 1);
    expect(isLayerEmpty(cleared.layers[1]!)).toBe(true);
    expect(cleared.layers[1]!.muted).toBe(false);
    expect(cleared.layers[0]).toBe(loop.layers[0]);
    const again = clearLayer(cleared, 1);
    expect(again).toBe(cleared);
  });

  it('clears the whole loop, keeping its length and switching every layer on', () => {
    const loop = setLayerMuted(loopFromPattern(FACTORY_LOOPS[0]!.pattern), 2, true);
    const cleared = clearLoop(loop);
    expect(isLoopEmpty(cleared)).toBe(true);
    expect(cleared.bars).toBe(2);
    expect(cleared.layers.every((layer) => !layer.muted)).toBe(true);
    expect(clearLoop(cleared)).toBe(cleared);
  });

  it('gives the same loop back when nothing changes', () => {
    const loop = twoLayers();
    expect(setLayerMuted(loop, 0, false)).toBe(loop);
    expect(recordIntoLayer(loop, 0, KICK, 0, 1)).toBe(loop);
  });

  it('ignores a layer, pad or step that does not exist', () => {
    const loop = twoLayers();
    for (const layer of [-1, 4, 1.5, Number.NaN]) {
      expect(toggleLayerStep(loop, layer, KICK, 0)).toBe(loop);
      expect(recordIntoLayer(loop, layer, KICK, 1, 1)).toBe(loop);
      expect(clearLayer(loop, layer)).toBe(loop);
      expect(setLayerMuted(loop, layer, true)).toBe(loop);
    }
    expect(toggleLayerStep(loop, 0, 8, 0)).toBe(loop);
    expect(toggleLayerStep(loop, 0, KICK, 16)).toBe(loop);
    expect(recordIntoLayer(loop, 0, -1, 0, 1)).toBe(loop);
    expect(recordIntoLayer(loop, 0, KICK, 16, 1)).toBe(loop);
    expect(recordIntoLayer(loop, 0, KICK, 2.5, 1)).toBe(loop);
  });
});

describe('loopsEqual', () => {
  it('compares hits and which layers are switched off', () => {
    expect(loopsEqual(twoLayers(), twoLayers())).toBe(true);
    expect(loopsEqual(twoLayers(), setLayerMuted(twoLayers(), 0, true))).toBe(false);
    expect(loopsEqual(twoLayers(), recordIntoLayer(twoLayers(), 3, HAT, 2, 1))).toBe(false);
    // The same hits in a different layer are a different loop.
    const moved = recordIntoLayer(clearLayer(twoLayers(), 0), 2, KICK, 0, 1);
    expect(patternsEqual(mixLoop(moved), mixLoop(twoLayers()))).toBe(true);
    expect(loopsEqual(moved, twoLayers())).toBe(false);
    expect(loopsEqual(emptyLoop(1), emptyLoop(2))).toBe(false);
  });
});

describe('layerFamilies', () => {
  it('lists the families a layer has hits in, in a fixed order', () => {
    let loop = emptyLoop(1);
    expect(layerFamilies(loop.layers[0]!)).toEqual([]);
    loop = recordIntoLayer(loop, 0, HAT, 0, 1);
    loop = recordIntoLayer(loop, 0, pad('shaker'), 1, 1);
    loop = recordIntoLayer(loop, 0, pad('tom'), 2, 1);
    expect(layerFamilies(loop.layers[0]!)).toEqual(['low', 'hat', 'perc']);
  });
});

describe('normalizeLoop', () => {
  const plain = (loop: StudioLoop): unknown => JSON.parse(JSON.stringify(loop));

  it('keeps a good loop exactly', () => {
    const loop = setLayerMuted(loopFromPattern(FACTORY_LOOPS[3]!.pattern), 2, true);
    expect(loopsEqual(normalizeLoop(plain(loop))!, loop)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a number', 7],
    ['a string', 'loop'],
    ['an array', [[1, 2]]],
    ['no layers', { bars: 1 }],
    ['layers that are not a list', { bars: 1, layers: { 0: {} } }],
  ])('gives null for %s', (_, value) => {
    expect(normalizeLoop(value)).toBeNull();
  });

  it('adds missing layers, drops extra ones, and silences broken ones', () => {
    const good = { pattern: setStep(emptyPattern(1), KICK, 0, 1), muted: true };
    const short = normalizeLoop({ bars: 1, layers: [good] })!;
    expect(short.layers).toHaveLength(LAYER_COUNT);
    expect(short.layers[0]!.muted).toBe(true);
    expect(short.layers[0]!.pattern.lanes[KICK]![0]).toBe(1);
    expect(short.layers.slice(1).every(isLayerEmpty)).toBe(true);

    const long = normalizeLoop({ bars: 1, layers: Array.from({ length: 9 }, () => good) })!;
    expect(long.layers).toHaveLength(LAYER_COUNT);

    const broken = normalizeLoop({
      bars: 1,
      layers: [null, 'x', { pattern: 3 }, { pattern: { lanes: 'no' }, muted: 'yes' }],
    })!;
    expect(isLoopEmpty(broken)).toBe(true);
    expect(broken.layers.every((layer) => layer.muted === false)).toBe(true);
  });

  it('makes every layer the length of the loop and every value a hit in 0..1', () => {
    const loop = normalizeLoop({
      bars: 1,
      layers: [
        { pattern: { bars: 2, lanes: [new Array(32).fill(1)] }, muted: false },
        { pattern: { bars: 1, lanes: [[5, -1, Number.NaN, 'x', 0.5]] }, muted: false },
      ],
    })!;
    for (const layer of loop.layers) {
      expect(layer.pattern.bars).toBe(1);
      expect(layer.pattern.lanes).toHaveLength(PAD_COUNT);
      expect(layer.pattern.lanes.every((lane) => lane.length === 16)).toBe(true);
    }
    expect(loop.layers[1]!.pattern.lanes[0]!.slice(0, 5)).toEqual([1, 0, 0, 0, 0.5]);
  });

  it('goes by the longest layer when the bar count is missing', () => {
    const loop = normalizeLoop({ layers: [{ pattern: { lanes: [new Array(20).fill(1)] } }] })!;
    expect(loop.bars).toBe(2);
    expect(loop.layers[1]!.pattern.bars).toBe(2);
  });

  it('keeps no extra fields and reads nothing inherited', () => {
    const loop = normalizeLoop({ ...(plain(twoLayers()) as object), secret: 1 })!;
    expect(Object.keys(loop).sort()).toEqual(['bars', 'layers']);
    expect(Object.keys(loop.layers[0]!).sort()).toEqual(['muted', 'pattern']);

    const inherited = Object.create({ layers: [] }) as object;
    expect(normalizeLoop(inherited)).toBeNull();
    const sneaky = JSON.parse('{"bars":1,"layers":[],"__proto__":{"muted":true}}') as unknown;
    expect(normalizeLoop(sneaky)!.layers.every((layer) => !layer.muted)).toBe(true);
  });
});
