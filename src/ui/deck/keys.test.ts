import { describe, expect, it } from 'vitest';
import {
  boothKeyAction,
  CROSSFADER_KEY_STEP,
  keyFocus,
  nudgedCrossfader,
  type BoothKeyContext,
  type KeyPress,
} from './keys';

const TWO_DECKS: BoothKeyContext = {
  deckCount: 2,
  lastDeck: 'A',
  focus: 'free',
  dialogOpen: false,
};
const FOUR_DECKS: BoothKeyContext = { ...TWO_DECKS, deckCount: 4 };

function press(key: string, more: Partial<KeyPress> = {}): KeyPress {
  return { key, ...more };
}

describe('boothKeyAction', () => {
  it('gives the left hand deck A and the right hand deck B', () => {
    expect(boothKeyAction(press('s'), TWO_DECKS)).toEqual({ type: 'play', deck: 'A' });
    expect(boothKeyAction(press('a'), TWO_DECKS)).toEqual({ type: 'start', deck: 'A' });
    expect(boothKeyAction(press('k'), TWO_DECKS)).toEqual({ type: 'play', deck: 'B' });
    expect(boothKeyAction(press('j'), TWO_DECKS)).toEqual({ type: 'start', deck: 'B' });
  });

  it('adds the row above for decks C and D when four decks are on screen', () => {
    expect(boothKeyAction(press('w'), FOUR_DECKS)).toEqual({ type: 'play', deck: 'C' });
    expect(boothKeyAction(press('q'), FOUR_DECKS)).toEqual({ type: 'start', deck: 'C' });
    expect(boothKeyAction(press('o'), FOUR_DECKS)).toEqual({ type: 'play', deck: 'D' });
    expect(boothKeyAction(press('i'), FOUR_DECKS)).toEqual({ type: 'start', deck: 'D' });
  });

  it('leaves the keys of decks that are not on screen alone', () => {
    for (const key of ['w', 'q', 'o', 'i']) {
      expect(boothKeyAction(press(key), TWO_DECKS)).toBeNull();
    }
  });

  it('reads capitals the same way (Shift, Caps Lock)', () => {
    expect(boothKeyAction(press('S'), TWO_DECKS)).toEqual({ type: 'play', deck: 'A' });
    expect(boothKeyAction(press('K'), TWO_DECKS)).toEqual({ type: 'play', deck: 'B' });
  });

  it('goes by the letter printed on the key, and by its place where there are no Latin letters', () => {
    // A French keyboard: the key in the place of Q is printed A.
    expect(boothKeyAction(press('a', { code: 'KeyQ' }), FOUR_DECKS)).toEqual({
      type: 'start',
      deck: 'A',
    });
    // A Russian keyboard: the key in the place of S types ы.
    expect(boothKeyAction(press('ы', { code: 'KeyS' }), TWO_DECKS)).toEqual({
      type: 'play',
      deck: 'A',
    });
  });

  it('plays the deck that was touched or keyed last with the space bar', () => {
    expect(boothKeyAction(press(' '), TWO_DECKS)).toEqual({ type: 'play', deck: 'A' });
    expect(boothKeyAction(press(' '), { ...TWO_DECKS, lastDeck: 'B' })).toEqual({
      type: 'play',
      deck: 'B',
    });
    expect(boothKeyAction(press(' '), { ...FOUR_DECKS, lastDeck: 'D' })).toEqual({
      type: 'play',
      deck: 'D',
    });
    expect(boothKeyAction(press('Spacebar'), TWO_DECKS)).toEqual({ type: 'play', deck: 'A' });
    expect(boothKeyAction(press('Unidentified', { code: 'Space' }), TWO_DECKS)).toEqual({
      type: 'play',
      deck: 'A',
    });
  });

  it('falls back to deck A when the last deck is no longer on screen', () => {
    expect(boothKeyAction(press(' '), { ...TWO_DECKS, lastDeck: 'C' })).toEqual({
      type: 'play',
      deck: 'A',
    });
  });

  it('nudges the crossfader with the arrows', () => {
    expect(boothKeyAction(press('ArrowLeft'), TWO_DECKS)).toEqual({
      type: 'crossfade',
      direction: -1,
    });
    expect(boothKeyAction(press('ArrowRight'), TWO_DECKS)).toEqual({
      type: 'crossfade',
      direction: 1,
    });
    expect(boothKeyAction(press('ArrowUp'), TWO_DECKS)).toBeNull();
    expect(boothKeyAction(press('ArrowDown'), TWO_DECKS)).toBeNull();
  });

  it('acts once for a held key, but keeps hold of its repeats', () => {
    expect(boothKeyAction(press('s', { repeat: true }), TWO_DECKS)).toEqual({ type: 'none' });
    expect(boothKeyAction(press(' ', { repeat: true }), TWO_DECKS)).toEqual({ type: 'none' });
    // A held arrow slides the fader.
    expect(boothKeyAction(press('ArrowRight', { repeat: true }), TWO_DECKS)).toEqual({
      type: 'crossfade',
      direction: 1,
    });
  });

  it('does nothing while a sheet is open', () => {
    const open = { ...FOUR_DECKS, dialogOpen: true };
    for (const key of ['s', 'a', 'k', 'j', 'w', 'q', 'o', 'i', ' ', 'ArrowLeft', 'ArrowRight']) {
      expect(boothKeyAction(press(key), open)).toBeNull();
    }
  });

  it('does nothing where a person is typing', () => {
    const typing = { ...FOUR_DECKS, focus: 'typing' as const };
    for (const key of ['s', 'a', 'k', 'j', 'w', 'q', 'o', 'i', ' ', 'ArrowLeft', 'ArrowRight']) {
      expect(boothKeyAction(press(key), typing)).toBeNull();
    }
  });

  it('leaves the arrows to a focused fader, and keeps the letters and the space bar', () => {
    const onFader = { ...TWO_DECKS, focus: 'slider' as const };
    expect(boothKeyAction(press('ArrowLeft'), onFader)).toBeNull();
    expect(boothKeyAction(press('ArrowRight'), onFader)).toBeNull();
    // A drag leaves the focus on the fader; the space bar must still play and pause.
    expect(boothKeyAction(press(' '), onFader)).toEqual({ type: 'play', deck: 'A' });
    expect(boothKeyAction(press('Unidentified', { code: 'Space' }), onFader)).toEqual({
      type: 'play',
      deck: 'A',
    });
    expect(boothKeyAction(press('s'), onFader)).toEqual({ type: 'play', deck: 'A' });
    expect(boothKeyAction(press('j'), onFader)).toEqual({ type: 'start', deck: 'B' });
  });

  it('leaves browser and system shortcuts alone', () => {
    expect(boothKeyAction(press('s', { ctrlKey: true }), TWO_DECKS)).toBeNull();
    expect(boothKeyAction(press('w', { metaKey: true }), FOUR_DECKS)).toBeNull();
    expect(boothKeyAction(press('a', { altKey: true }), TWO_DECKS)).toBeNull();
    expect(boothKeyAction(press('ArrowLeft', { altKey: true }), TWO_DECKS)).toBeNull();
    expect(boothKeyAction(press(' ', { ctrlKey: true }), TWO_DECKS)).toBeNull();
  });

  it('ignores keys that are part of typing with an input method', () => {
    expect(boothKeyAction(press('s', { composing: true }), TWO_DECKS)).toBeNull();
  });

  it('ignores every other key', () => {
    for (const key of ['d', 'x', '1', 'Enter', 'Tab', 'Escape', 'Shift', 'Home', 'ss']) {
      expect(boothKeyAction(press(key), FOUR_DECKS)).toBeNull();
    }
    expect(boothKeyAction(press('1', { code: 'Digit1' }), FOUR_DECKS)).toBeNull();
  });
});

describe('keyFocus', () => {
  it('is free with nothing focused, or on the page or a button', () => {
    expect(keyFocus(null)).toBe('free');
    expect(keyFocus({ tagName: 'BODY' })).toBe('free');
    expect(keyFocus({ tagName: 'BUTTON', type: 'button' })).toBe('free');
    expect(keyFocus({ tagName: 'DIV', role: 'img' })).toBe('free');
  });

  it('knows a fader and a waveform as sliders', () => {
    expect(keyFocus({ tagName: 'INPUT', type: 'range' })).toBe('slider');
    expect(keyFocus({ tagName: 'input', type: 'RANGE' })).toBe('slider');
    expect(keyFocus({ tagName: 'DIV', role: 'slider' })).toBe('slider');
  });

  it('knows where a person types', () => {
    expect(keyFocus({ tagName: 'INPUT', type: 'text' })).toBe('typing');
    expect(keyFocus({ tagName: 'INPUT', type: 'number' })).toBe('typing');
    expect(keyFocus({ tagName: 'INPUT' })).toBe('typing');
    expect(keyFocus({ tagName: 'TEXTAREA' })).toBe('typing');
    expect(keyFocus({ tagName: 'SELECT' })).toBe('typing');
    expect(keyFocus({ tagName: 'DIV', role: 'spinbutton' })).toBe('typing');
    expect(keyFocus({ tagName: 'DIV', role: 'textbox' })).toBe('typing');
    expect(keyFocus({ tagName: 'DIV', editable: true })).toBe('typing');
  });
});

describe('nudgedCrossfader', () => {
  it('moves one step each way', () => {
    expect(CROSSFADER_KEY_STEP).toBe(0.05);
    expect(nudgedCrossfader(0.5, 1)).toBe(0.55);
    expect(nudgedCrossfader(0.5, -1)).toBe(0.45);
    expect(nudgedCrossfader(0.123, 1)).toBe(0.173);
  });

  it('stops at the ends', () => {
    expect(nudgedCrossfader(1, 1)).toBe(1);
    expect(nudgedCrossfader(0.98, 1)).toBe(1);
    expect(nudgedCrossfader(0, -1)).toBe(0);
    expect(nudgedCrossfader(0.02, -1)).toBe(0);
  });

  it('reaches the ends and the centre exactly', () => {
    let position = 0;
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      position = nudgedCrossfader(position, 1);
      seen.push(position);
    }
    expect(seen[9]).toBe(0.5);
    expect(seen[19]).toBe(1);
    for (let i = 0; i < 20; i++) position = nudgedCrossfader(position, -1);
    expect(position).toBe(0);
  });

  it('starts from the centre if the position is nonsense', () => {
    expect(nudgedCrossfader(NaN, 1)).toBe(0.55);
  });
});
