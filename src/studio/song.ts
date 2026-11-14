/**
 * A song: the loops to play one after another, as slot numbers in playing
 * order. The same loop may come round many times. Lists are never changed in
 * place: every edit makes a new one.
 */
import { SLOT_COUNT, SONG_MAX } from './types';

function isSlot(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SLOT_COUNT;
}

/** The song with `slot` played last. Unchanged when the song is full or there is no such slot. */
export function addToSong(song: readonly number[], slot: number): readonly number[] {
  if (song.length >= SONG_MAX || !isSlot(slot)) return song;
  return [...song, slot];
}

/** The song without its entry at `index`. Unchanged when there is no such entry. */
export function removeFromSong(song: readonly number[], index: number): readonly number[] {
  if (!Number.isInteger(index) || index < 0 || index >= song.length) return song;
  return song.filter((_, i) => i !== index);
}

/** A song as read back from storage: real slot numbers only, at most SONG_MAX. Anything else is dropped. */
export function normalizeSong(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const song: number[] = [];
  for (const entry of value as unknown[]) {
    if (song.length >= SONG_MAX) break;
    if (isSlot(entry)) song.push(entry);
  }
  return song;
}
