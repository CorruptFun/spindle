import { describe, expect, it } from 'vitest';
import { trackInfoFromFileName as info } from './title';

describe('trackInfoFromFileName', () => {
  it('splits artist and title', () => {
    expect(info('Artist - Title.mp3')).toEqual({ title: 'Title', artist: 'Artist' });
  });
  it('strips a leading track number and splits', () => {
    expect(info('01 - Artist - Title.mp3')).toEqual({ title: 'Title', artist: 'Artist' });
  });
  it('handles an en dash', () => {
    expect(info('Artist – Title.flac')).toEqual({ title: 'Title', artist: 'Artist' });
  });
  it('handles an em dash', () => {
    expect(info('Artist — Title.ogg')).toEqual({ title: 'Title', artist: 'Artist' });
  });
  it('turns underscores into spaces and strips "07_"', () => {
    expect(info('07_my_song.wav')).toEqual({ title: 'my song', artist: '' });
  });
  it('strips "1-02 "', () => {
    expect(info('1-02 Song.m4a')).toEqual({ title: 'Song', artist: '' });
  });
  it('strips "1. "', () => {
    expect(info('1. Song.mp3')).toEqual({ title: 'Song', artist: '' });
  });
  it('strips "01 "', () => {
    expect(info('01 Song.mp3')).toEqual({ title: 'Song', artist: '' });
  });
  it('keeps dots inside the name', () => {
    expect(info('song.final.mix.mp3')).toEqual({ title: 'song.final.mix', artist: '' });
  });
  it('falls back to Untitled for a bare extension', () => {
    expect(info('.mp3')).toEqual({ title: 'Untitled', artist: '' });
  });
  it('falls back to Untitled for blanks plus extension', () => {
    expect(info('   .wav')).toEqual({ title: 'Untitled', artist: '' });
  });
  it('splits only at the first separator', () => {
    expect(info('Artist - Title - Remix.mp3')).toEqual({
      title: 'Title - Remix',
      artist: 'Artist',
    });
  });
  it('does not split on a hyphen without spaces', () => {
    expect(info('Jay-Z.mp3')).toEqual({ title: 'Jay-Z', artist: '' });
  });
  it('keeps unicode', () => {
    expect(info('Björk - Jóga.mp3')).toEqual({ title: 'Jóga', artist: 'Björk' });
    expect(info('宇多田ヒカリ - 光.m4a')).toEqual({
      title: '光',
      artist: '宇多田ヒカリ',
    });
  });
  it('collapses whitespace', () => {
    expect(info('  A   B  -   C   D .mp3')).toEqual({ title: 'C D', artist: 'A B' });
  });
  it('leaves a year-like name alone', () => {
    expect(info('1999.mp3')).toEqual({ title: '1999', artist: '' });
    expect(info('1999 Song.mp3')).toEqual({ title: '1999 Song', artist: '' });
  });
  it('keeps a number that is part of the title', () => {
    expect(info('99 Problems.mp3')).toEqual({ title: '99 Problems', artist: '' });
    expect(info('7 Rings.m4a')).toEqual({ title: '7 Rings', artist: '' });
    expect(info('50 Ways to Leave Your Lover.flac')).toEqual({
      title: '50 Ways to Leave Your Lover',
      artist: '',
    });
  });
  it('works without an extension', () => {
    expect(info('Just A Name')).toEqual({ title: 'Just A Name', artist: '' });
  });
  it('keeps a dotted title that is not an extension', () => {
    expect(info('Mr. Brightside.mp3')).toEqual({ title: 'Mr. Brightside', artist: '' });
  });
  it('falls back to the name when only a track number is left', () => {
    expect(info('01 .mp3')).toEqual({ title: '01', artist: '' });
  });
  it('uses underscores as spaces around the artist separator', () => {
    expect(info('03_The_Band_-_The_Song.mp3')).toEqual({ title: 'The Song', artist: 'The Band' });
  });
});
