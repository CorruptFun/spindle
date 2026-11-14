import { describe, expect, it } from 'vitest';
import { PAD_COUNT, type PadSound } from '@/engine/sampler/types';
import { KITS, renderKit } from './kits';
import { HAT_CHOKE_GROUP, PAD_ROLES } from './types';

const RATE = 44100;
const db = (gain: number): number => 20 * Math.log10(gain);

/**
 * Loudness as the tests judge it: RMS over the first 200 ms. Deliberately not
 * the kit's own measure, so the balance is checked rather than restated.
 */
function loudness(sound: PadSound): number {
  const x = sound.audio.channels[0]!;
  const window = Math.round(0.2 * sound.audio.sampleRate);
  let sum = 0;
  for (let i = 0; i < Math.min(window, x.length); i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / window);
}

function peakOf(sound: PadSound): number {
  let max = 0;
  for (const ch of sound.audio.channels) for (const v of ch) max = Math.max(max, Math.abs(v));
  return max;
}

const rendered = new Map(KITS.map((kit) => [kit.id, renderKit(kit.id, RATE)]));
const kitSounds = (id: string): PadSound[] => rendered.get(id)!;
const roleIndex = (role: string): number => PAD_ROLES.findIndex((r) => r.role === role);

describe('KITS', () => {
  it('has four kits with unique ids, names and glyphs', () => {
    expect(KITS).toHaveLength(4);
    for (const key of ['id', 'name', 'glyph'] as const) {
      expect(new Set(KITS.map((k) => k[key])).size).toBe(4);
    }
  });

  it('names every kit and pad with one short word, or the number the machine is known by', () => {
    for (const kit of KITS) {
      expect(kit.name).toMatch(/^([A-Z][a-z]{1,9}|[0-9]{3})$/);
      for (const pad of kit.pads) expect(pad.name).toMatch(/^[A-Z][a-z]{1,9}$/);
    }
  });

  it('has eight pads in role order with the right families', () => {
    for (const kit of KITS) {
      expect(kit.pads).toHaveLength(PAD_COUNT);
      kit.pads.forEach((pad, i) => {
        expect(pad.role).toBe(PAD_ROLES[i]!.role);
        expect(pad.family).toBe(PAD_ROLES[i]!.family);
      });
    }
  });

  it('gives each kit its own signature sound on the extra pad', () => {
    const extras = KITS.map((k) => k.pads[roleIndex('extra')]!.name);
    expect(new Set(extras).size).toBe(4);
  });

  it('keeps the kits people already have beats on first, in the same order', () => {
    expect(KITS.slice(0, 3).map((k) => k.id)).toEqual(['club', 'dusty', 'toybox']);
  });
});

describe('renderKit', () => {
  it('renders exactly PAD_COUNT mono sounds at the requested rate', () => {
    for (const kit of KITS) {
      const sounds = kitSounds(kit.id);
      expect(sounds).toHaveLength(PAD_COUNT);
      for (const s of sounds) {
        expect(s.audio.sampleRate).toBe(RATE);
        expect(s.audio.channels).toHaveLength(1);
        expect(s.audio.channels[0]).toBeInstanceOf(Float32Array);
      }
    }
  });

  it('puts the choke group on the two hats and nowhere else', () => {
    for (const kit of KITS) {
      kitSounds(kit.id).forEach((s, i) => {
        const hat = PAD_ROLES[i]!.family === 'hat';
        expect(s.chokeGroup).toBe(hat ? HAT_CHOKE_GROUP : undefined);
      });
    }
  });

  it('makes finite, audible sounds within the peak and length limits that end on silence', () => {
    for (const kit of KITS) {
      for (const s of kitSounds(kit.id)) {
        const x = s.audio.channels[0]!;
        expect(x.every(Number.isFinite)).toBe(true);
        expect(peakOf(s)).toBeLessThanOrEqual(0.9);
        expect(peakOf(s)).toBeGreaterThan(0.1);
        expect(x.length).toBeLessThanOrEqual(1.5 * RATE);
        expect(Math.abs(x[x.length - 1]!)).toBeLessThan(1e-4);
        expect(Math.abs(x[0]!)).toBeLessThan(0.01);
      }
    }
  });

  it('is deterministic and hands out fresh arrays every time', () => {
    for (const kit of KITS) {
      const a = renderKit(kit.id, RATE);
      const b = renderKit(kit.id, RATE);
      a.forEach((s, i) => {
        expect(s.audio.channels[0]).toEqual(b[i]!.audio.channels[0]);
        expect(s.audio.channels[0]).not.toBe(b[i]!.audio.channels[0]);
      });
    }
  });

  it('balances each kit like a drummer: kick and snare lead, hats and shaker sit back', () => {
    for (const kit of KITS) {
      const level = (role: string): number => db(loudness(kitSounds(kit.id)[roleIndex(role)]!));
      for (const quiet of ['closed-hat', 'open-hat', 'shaker']) {
        expect(level('kick') - level(quiet)).toBeGreaterThan(9);
        expect(level('snare') - level(quiet)).toBeGreaterThan(4);
      }
      expect(level('kick')).toBeGreaterThan(level('snare'));
    }
  });

  it('keeps each role at about the same loudness in every kit', () => {
    PAD_ROLES.forEach((_, i) => {
      const levels = KITS.map((kit) => db(loudness(kitSounds(kit.id)[i]!)));
      expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(3);
    });
  });

  it('works at 48 kHz too, at the same length in seconds', () => {
    for (const kit of KITS) {
      const at48 = renderKit(kit.id, 48000);
      at48.forEach((s, i) => {
        expect(s.audio.sampleRate).toBe(48000);
        expect(peakOf(s)).toBeLessThanOrEqual(0.9);
        const seconds44 = kitSounds(kit.id)[i]!.audio.channels[0]!.length / RATE;
        expect(s.audio.channels[0]!.length / 48000).toBeCloseTo(seconds44, 3);
        expect(Math.abs(db(loudness(s)) - db(loudness(kitSounds(kit.id)[i]!)))).toBeLessThan(0.5);
      });
    }
  });

  it('renders a whole kit quickly', () => {
    for (const kit of KITS) {
      const start = performance.now();
      renderKit(kit.id, 48000);
      // Generous for a slow test machine; a laptop does it in a fraction of this.
      expect(performance.now() - start).toBeLessThan(250);
    }
  });

  it('throws RangeError for an unknown kit', () => {
    expect(() => renderKit('nope', RATE)).toThrow(RangeError);
    expect(() => renderKit('toString', RATE)).toThrow(RangeError);
    expect(() => renderKit('', RATE)).toThrow(RangeError);
  });
});
