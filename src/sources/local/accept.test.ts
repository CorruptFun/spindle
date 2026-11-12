import { describe, expect, it } from 'vitest';
import { AUDIO_ACCEPT, MAX_TRACK_SECONDS, isAudioFile, isProtectedFile } from './accept';

describe('isAudioFile', () => {
  it('accepts by MIME type alone', () => {
    expect(isAudioFile({ name: 'mystery', type: 'audio/mpeg' })).toBe(true);
    expect(isAudioFile({ name: 'x.bin', type: 'audio/x-whatever' })).toBe(true);
  });

  it('accepts by extension alone', () => {
    for (const ext of ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus', 'aif', 'aiff']) {
      expect(isAudioFile({ name: `song.${ext}`, type: '' })).toBe(true);
    }
  });

  it('ignores extension case', () => {
    expect(isAudioFile({ name: 'SONG.MP3', type: '' })).toBe(true);
    expect(isAudioFile({ name: 'Song.FlAc', type: '' })).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAudioFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isAudioFile({ name: 'notes.txt', type: '' })).toBe(false);
    expect(isAudioFile({ name: 'mp3', type: '' })).toBe(false);
    expect(isAudioFile({ name: 'clip.mp4', type: 'video/mp4' })).toBe(false);
  });

  it('treats .m4p as audio and as protected', () => {
    expect(isAudioFile({ name: 'bought.m4p', type: '' })).toBe(true);
    expect(isProtectedFile('bought.m4p')).toBe(true);
    expect(isProtectedFile('BOUGHT.M4P')).toBe(true);
    expect(isProtectedFile('free.m4a')).toBe(false);
  });
});

describe('AUDIO_ACCEPT', () => {
  it('lists every extension and the audio MIME wildcard', () => {
    const parts = AUDIO_ACCEPT.split(',');
    expect(parts).toContain('audio/*');
    for (const ext of ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus', 'aif', 'aiff']) {
      expect(parts).toContain(`.${ext}`);
    }
  });
});

describe('MAX_TRACK_SECONDS', () => {
  it('is twelve minutes', () => {
    expect(MAX_TRACK_SECONDS).toBe(720);
  });
});
