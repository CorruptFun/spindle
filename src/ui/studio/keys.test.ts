import { describe, expect, it } from 'vitest';
import { PAD_KEYS, studioKey, takesKeys, type KeyFeatures, type KeyPress } from './keys';

const ALL: KeyFeatures = { record: true, layers: true, undo: true };
const NONE: KeyFeatures = { record: false, layers: false, undo: false };

/** A key press with no modifiers held, unless the test says so. */
function press(key: string, code: string, held: Partial<KeyPress> = {}): KeyPress {
  return { key, code, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...held };
}

describe('studioKey', () => {
  it('plays and stops with Space', () => {
    expect(studioKey(press(' ', 'Space'), ALL)).toEqual({ kind: 'play' });
    // Play is in every mode.
    expect(studioKey(press(' ', 'Space'), NONE)).toEqual({ kind: 'play' });
    // An old name for the same key.
    expect(studioKey(press('Spacebar', ''), ALL)).toEqual({ kind: 'play' });
  });

  it('records with R, where there is a record button', () => {
    expect(studioKey(press('r', 'KeyR'), ALL)).toEqual({ kind: 'record' });
    expect(studioKey(press('r', 'KeyR'), NONE)).toBeNull();
  });

  it('plays the top row of pads with A S D F and the bottom row with Z X C V', () => {
    expect(PAD_KEYS).toEqual(['A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V']);
    PAD_KEYS.forEach((letter, pad) => {
      const lower = letter.toLowerCase();
      expect(studioKey(press(lower, `Key${letter}`), ALL)).toEqual({ kind: 'pad', pad });
      // The pads are in every mode.
      expect(studioKey(press(lower, `Key${letter}`), NONE)).toEqual({ kind: 'pad', pad });
    });
  });

  it('does not mind Caps Lock or Shift', () => {
    expect(studioKey(press('A', 'KeyA'), ALL)).toEqual({ kind: 'pad', pad: 0 });
    expect(studioKey(press('V', 'KeyV', { shiftKey: true }), ALL)).toEqual({ kind: 'pad', pad: 7 });
    expect(studioKey(press('R', 'KeyR', { shiftKey: true }), ALL)).toEqual({ kind: 'record' });
  });

  it('chooses a layer with 1 to 4, where there are layers', () => {
    ['1', '2', '3', '4'].forEach((digit, layer) => {
      expect(studioKey(press(digit, `Digit${digit}`), ALL)).toEqual({ kind: 'layer', layer });
      expect(studioKey(press(digit, `Numpad${digit}`), ALL)).toEqual({ kind: 'layer', layer });
      expect(studioKey(press(digit, `Digit${digit}`), NONE)).toBeNull();
    });
    expect(studioKey(press('5', 'Digit5'), ALL)).toBeNull();
    expect(studioKey(press('0', 'Digit0'), ALL)).toBeNull();
  });

  it('undoes with Ctrl+Z or Cmd+Z, where there is an undo button', () => {
    expect(studioKey(press('z', 'KeyZ', { ctrlKey: true }), ALL)).toEqual({ kind: 'undo' });
    expect(studioKey(press('z', 'KeyZ', { metaKey: true }), ALL)).toEqual({ kind: 'undo' });
    expect(studioKey(press('Z', 'KeyZ', { ctrlKey: true }), ALL)).toEqual({ kind: 'undo' });
    expect(studioKey(press('z', 'KeyZ', { ctrlKey: true }), NONE)).toBeNull();
    // Redo elsewhere; here Undo itself puts a change back, so this is left alone.
    expect(studioKey(press('Z', 'KeyZ', { ctrlKey: true, shiftKey: true }), ALL)).toBeNull();
    expect(studioKey(press('z', 'KeyZ', { ctrlKey: true, altKey: true }), ALL)).toBeNull();
  });

  it('leaves every other combination with Alt, Ctrl or Cmd to the browser', () => {
    for (const held of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(studioKey(press(' ', 'Space', held), ALL)).toBeNull();
      expect(studioKey(press('r', 'KeyR', held), ALL)).toBeNull();
      expect(studioKey(press('a', 'KeyA', held), ALL)).toBeNull();
      expect(studioKey(press('1', 'Digit1', held), ALL)).toBeNull();
    }
    // Z without Ctrl is a pad; with Alt it is nothing.
    expect(studioKey(press('z', 'KeyZ'), ALL)).toEqual({ kind: 'pad', pad: 4 });
    expect(studioKey(press('z', 'KeyZ', { altKey: true }), ALL)).toBeNull();
  });

  it('goes by the letter a key types, wherever it sits on the keyboard', () => {
    // A French keyboard: the key that types "a" sits where Q does on an English one.
    expect(studioKey(press('a', 'KeyQ'), ALL)).toEqual({ kind: 'pad', pad: 0 });
    expect(studioKey(press('q', 'KeyA'), ALL)).toBeNull();
    expect(studioKey(press('z', 'KeyW', { ctrlKey: true }), ALL)).toEqual({ kind: 'undo' });
  });

  it('goes by where a key sits when it types no plain letter or digit', () => {
    // Another alphabet on the same keys.
    expect(studioKey(press('ф', 'KeyA'), ALL)).toEqual({ kind: 'pad', pad: 0 });
    expect(studioKey(press('к', 'KeyR'), ALL)).toEqual({ kind: 'record' });
    // A top row that needs Shift for its numbers.
    expect(studioKey(press('&', 'Digit1'), ALL)).toEqual({ kind: 'layer', layer: 0 });
    expect(studioKey(press('!', 'Digit1', { shiftKey: true }), ALL)).toEqual({
      kind: 'layer',
      layer: 0,
    });
  });

  it('ignores every other key', () => {
    for (const [key, code] of [
      ['Enter', 'Enter'],
      ['Tab', 'Tab'],
      ['Escape', 'Escape'],
      ['ArrowLeft', 'ArrowLeft'],
      ['Shift', 'ShiftLeft'],
      ['q', 'KeyQ'],
      ['g', 'KeyG'],
      ['F1', 'F1'],
      [',', 'Comma'],
      ['', ''],
    ] as const) {
      expect(studioKey(press(key, code), ALL)).toBeNull();
    }
  });
});

describe('takesKeys', () => {
  const element = (tagName: string, role: string | null = null, editable = false) => ({
    tagName,
    isContentEditable: editable,
    getAttribute: (name: string) => (name === 'role' ? role : null),
  });

  it('is true where something is typed', () => {
    expect(takesKeys(element('INPUT'))).toBe(true);
    expect(takesKeys(element('TEXTAREA'))).toBe(true);
    expect(takesKeys(element('SELECT'))).toBe(true);
    expect(takesKeys(element('DIV', null, true))).toBe(true);
    expect(takesKeys(element('DIV', 'textbox'))).toBe(true);
  });

  it('is true on a slider and on a spin button such as the tempo', () => {
    expect(takesKeys(element('DIV', 'slider'))).toBe(true);
    expect(takesKeys(element('DIV', 'spinbutton'))).toBe(true);
  });

  it('is false on buttons, on the page itself and on nothing', () => {
    expect(takesKeys(element('BUTTON'))).toBe(false);
    expect(takesKeys(element('DIV', 'group'))).toBe(false);
    expect(takesKeys(element('BODY'))).toBe(false);
    expect(takesKeys({})).toBe(false);
    expect(takesKeys(null)).toBe(false);
    expect(takesKeys(undefined)).toBe(false);
  });
});
