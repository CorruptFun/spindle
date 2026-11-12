import { describe, expect, it } from 'vitest';
import { FULL_CAPABILITIES, type DeckCapabilities } from '@/engine/core/types';
import { SOURCES } from './registry';

/** Anything that needs the decoded samples, or that layers or alters the audio. */
const NEEDS_OWNED_AUDIO: readonly (keyof DeckCapabilities)[] = [
  'overlap',
  'tempo',
  'scratch',
  'keyLock',
  'eq',
  'fx',
  'waveform',
  'analysis',
  'cuesAndLoops',
  'record',
];

describe('source registry', () => {
  it('registers each source under its own id', () => {
    for (const [key, source] of Object.entries(SOURCES)) {
      expect(source.id).toBe(key);
    }
  });

  it('gives files the listener owns the full deck', () => {
    expect(SOURCES.local.audioPath).toBe('pcm');
    expect(SOURCES.local.capabilities).toEqual(FULL_CAPABILITIES);
  });

  it('never lets a protected stream be mixed, altered, analysed or recorded', () => {
    const streams = Object.values(SOURCES).filter((source) => source.audioPath === 'opaque');
    expect(streams.map((source) => source.id).sort()).toEqual(['apple-music', 'spotify']);

    for (const source of streams) {
      for (const capability of NEEDS_OWNED_AUDIO) {
        expect(source.capabilities[capability], `${source.id}.${capability}`).toBe(false);
      }
    }
  });
});
