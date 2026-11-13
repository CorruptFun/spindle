import { describe, expect, it } from 'vitest';
import { padLight, TOUCH_FLASH_MS } from './pad-light';

describe('padLight', () => {
  it('is dark when nothing sounds and nothing was touched', () => {
    expect(padLight(0, Infinity)).toBe(0);
    expect(padLight(Number.NaN, Infinity)).toBe(0);
    expect(padLight(-1, Infinity)).toBe(0);
  });

  it('follows the sound', () => {
    expect(padLight(0.5, Infinity)).toBe(0.5);
    expect(padLight(3, Infinity)).toBe(1);
  });

  it('lights fully at the touch, even before any sound, and fades', () => {
    expect(padLight(0, 0)).toBe(1);
    // The animation frame can carry a timestamp from just before the touch.
    expect(padLight(0, -4)).toBe(1);
    expect(padLight(0, TOUCH_FLASH_MS / 2)).toBe(0.5);
    expect(padLight(0, TOUCH_FLASH_MS)).toBe(0);
  });

  it('shows the brighter of the two', () => {
    expect(padLight(0.9, TOUCH_FLASH_MS / 2)).toBe(0.9);
    expect(padLight(0.2, TOUCH_FLASH_MS / 2)).toBe(0.5);
  });

  it('rounds so tiny changes are not redrawn', () => {
    expect(padLight(0.123456, Infinity)).toBe(0.12);
  });
});
