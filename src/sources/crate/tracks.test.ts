import { describe, expect, it } from 'vitest';
import { BRAND } from '@/config/brand';
import { CRATE_TRACKS as PUBLIC_TRACKS, renderCrateTrack } from '.';
import { loopFrames, loopSec, PENTATONIC } from './sequence';
import { SONGS } from './songs';
import { CRATE_BARS, CRATE_BPM, CRATE_TRACKS, PROGRESSION, chordAtBar } from './tracks';

describe('CRATE_TRACKS', () => {
  it('is exported from the folder with the renderer', () => {
    expect(PUBLIC_TRACKS).toBe(CRATE_TRACKS);
    expect(typeof renderCrateTrack).toBe('function');
  });

  it('has four songs with unique ids and unique glyphs', () => {
    expect(CRATE_TRACKS).toHaveLength(4);
    expect(new Set(CRATE_TRACKS.map((t) => t.ref.id)).size).toBe(4);
    expect(new Set(CRATE_TRACKS.map((t) => t.glyph)).size).toBe(4);
    for (const track of CRATE_TRACKS) {
      expect(['circle', 'triangle', 'square', 'star']).toContain(track.glyph);
    }
  });

  it('belongs to the crate source and the app', () => {
    for (const track of CRATE_TRACKS) {
      expect(track.ref.source).toBe('crate');
      expect(track.artist).toBe(BRAND.name);
      expect(track.title).toMatch(/^[A-Z][a-z]+$/);
      expect(track.title.length).toBeLessThanOrEqual(8);
    }
  });

  it('shares one tempo between 104 and 116 BPM', () => {
    expect(CRATE_BPM).toBeGreaterThanOrEqual(104);
    expect(CRATE_BPM).toBeLessThanOrEqual(116);
    for (const track of CRATE_TRACKS) expect(track.bpm).toBe(CRATE_BPM);
  });

  it('lasts exactly 16 bars of 4/4', () => {
    expect(CRATE_BARS).toBe(16);
    for (const track of CRATE_TRACKS) {
      expect(track.durationSec).toBe(loopSec(16, CRATE_BPM));
      expect(Math.round(track.durationSec! * 48000)).toBe(loopFrames(16, CRATE_BPM, 48000));
    }
  });

  it('has an arrangement for every song and no stray ones', () => {
    expect(Object.keys(SONGS).sort()).toEqual(CRATE_TRACKS.map((t) => t.ref.id).sort());
  });
});

describe('shared harmony', () => {
  it('stays inside C major (no sharps or flats)', () => {
    const cMajor = [0, 2, 4, 5, 7, 9, 11];
    for (const chord of PROGRESSION) {
      for (const midi of [chord.root, ...chord.voicing]) expect(cMajor).toContain(midi % 12);
    }
  });

  it('keeps a common tone (E) in every chord so changes stay smooth', () => {
    for (const chord of PROGRESSION) expect(chord.voicing.map((m) => m % 12)).toContain(4);
    expect(PENTATONIC).toContain(4);
  });

  it('changes chord every two bars and repeats every eight', () => {
    expect(chordAtBar(0)).toBe(chordAtBar(1));
    expect(chordAtBar(1)).not.toBe(chordAtBar(2));
    expect(chordAtBar(3)).toBe(chordAtBar(11));
    expect(chordAtBar(16)).toBe(chordAtBar(0));
  });
});
