import { describe, expect, it } from 'vitest';
import { layerLabel } from './layers-label';

describe('layerLabel', () => {
  it('counts from one and names the sounds in the layer', () => {
    expect(layerLabel(1, { empty: false, muted: false, families: ['low', 'snare'] })).toBe(
      'Layer 2, kick and snare',
    );
    expect(layerLabel(0, { empty: false, muted: false, families: ['hat'] })).toBe('Layer 1, hats');
    expect(
      layerLabel(3, { empty: false, muted: false, families: ['low', 'snare', 'hat', 'perc'] }),
    ).toBe('Layer 4, kick, snare, hats and percussion');
  });

  it('says when a layer is empty', () => {
    expect(layerLabel(2, { empty: true, muted: false, families: [] })).toBe('Layer 3, empty');
  });

  it('says when a layer is switched off', () => {
    expect(layerLabel(0, { empty: false, muted: true, families: ['hat'] })).toBe(
      'Layer 1, hats, switched off',
    );
    expect(layerLabel(1, { empty: true, muted: true, families: [] })).toBe(
      'Layer 2, empty, switched off',
    );
  });
});
