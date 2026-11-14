import { describe, expect, it } from 'vitest';
import { addToSong, normalizeSong, removeFromSong } from './song';
import { SLOT_COUNT, SONG_MAX } from './types';

describe('addToSong', () => {
  it('puts the loop at the end, the same one as often as wanted', () => {
    let song: readonly number[] = [];
    song = addToSong(song, 2);
    song = addToSong(song, 0);
    song = addToSong(song, 2);
    expect(song).toEqual([2, 0, 2]);
  });

  it('never changes the list it was given', () => {
    const song = [1, 2];
    const next = addToSong(song, 3);
    expect(song).toEqual([1, 2]);
    expect(next).not.toBe(song);
  });

  it('stops at SONG_MAX', () => {
    let song: readonly number[] = [];
    for (let i = 0; i < SONG_MAX + 5; i += 1) song = addToSong(song, i % SLOT_COUNT);
    expect(song).toHaveLength(SONG_MAX);
    expect(addToSong(song, 0)).toBe(song);
  });

  it('ignores a slot that does not exist', () => {
    const song = [1];
    for (const bad of [-1, SLOT_COUNT, 1.5, Number.NaN, Infinity]) {
      expect(addToSong(song, bad)).toBe(song);
    }
  });
});

describe('removeFromSong', () => {
  it('takes out only the entry at that place', () => {
    expect(removeFromSong([4, 1, 4, 2], 2)).toEqual([4, 1, 2]);
    expect(removeFromSong([4, 1, 4, 2], 0)).toEqual([1, 4, 2]);
    expect(removeFromSong([3], 0)).toEqual([]);
  });

  it('ignores a place that is not in the song', () => {
    const song = [1, 2];
    for (const bad of [-1, 2, 0.5, Number.NaN]) expect(removeFromSong(song, bad)).toBe(song);
  });
});

describe('normalizeSong', () => {
  it('keeps a good song as it is', () => {
    expect(normalizeSong([0, 7, 7, 3])).toEqual([0, 7, 7, 3]);
  });

  it('drops anything that is not a slot number', () => {
    expect(normalizeSong([1, -1, 8, 2.5, '3', null, true, [], {}, 5])).toEqual([1, 5]);
  });

  it('keeps at most SONG_MAX entries', () => {
    expect(normalizeSong(new Array<number>(100).fill(1))).toHaveLength(SONG_MAX);
  });

  it('gives an empty song for anything that is not a list', () => {
    for (const value of [undefined, null, 'song', 4, { length: 2, 0: 1 }]) {
      expect(normalizeSong(value)).toEqual([]);
    }
  });
});
