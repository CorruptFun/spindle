import { describe, expect, it } from 'vitest';
import {
  barLeft,
  barLevels,
  barTop,
  layoutBars,
  positionAtX,
  positionText,
  splitAt,
  xAtPosition,
} from './waveform-draw';

describe('layoutBars', () => {
  it('fits whole bars at a fixed pitch and centres the leftover', () => {
    // 2 px bars, 1 px gaps: 100 px holds 33 bars (33 * 3 - 1 = 98 px), 1 px spare each side.
    const layout = layoutBars(100, 2, 1);
    expect(layout).toEqual({ count: 33, barPx: 2, pitchPx: 3, startPx: 1, spanPx: 98 });
    expect(barLeft(layout, 0)).toBe(1);
    expect(barLeft(layout, 32) + layout.barPx).toBe(99);
  });

  it('uses the whole width when it divides exactly', () => {
    // 4 px bars, 2 px gaps (a 2x screen): 6 * 50 - 2 = 298.
    expect(layoutBars(298, 4, 2)).toMatchObject({ count: 50, startPx: 0, spanPx: 298 });
  });

  it('keeps every bar on a whole pixel', () => {
    const layout = layoutBars(373.6, 2.4, 1.2);
    expect(layout.barPx).toBe(2);
    expect(layout.pitchPx).toBe(3);
    for (let i = 0; i < layout.count; i++) expect(Number.isInteger(barLeft(layout, i))).toBe(true);
    expect(barLeft(layout, layout.count - 1) + layout.barPx).toBeLessThanOrEqual(373);
  });

  it('has no bars in a lane too small for one', () => {
    expect(layoutBars(0, 2, 1)).toMatchObject({ count: 0, spanPx: 0 });
    expect(layoutBars(1, 2, 1)).toMatchObject({ count: 0, spanPx: 0 });
    expect(layoutBars(2, 2, 1)).toMatchObject({ count: 1, spanPx: 2, startPx: 0 });
  });
});

describe('barLevels', () => {
  it('keeps the loudest slice under each bar', () => {
    const peaks = new Float32Array([0.1, 0.5, 0.2, 0.2, 0.9, 0.3]);
    const out = new Float32Array(3);
    barLevels(peaks, out);
    expect(Array.from(out)).toEqual([0.5, 0.2, 0.9].map((p) => expect.closeTo(p, 6)));
  });

  it('repeats a slice across bars when there are more bars than slices', () => {
    const out = new Float32Array(4);
    barLevels(new Float32Array([0.25, 0.75]), out);
    expect(Array.from(out)).toEqual([0.25, 0.25, 0.75, 0.75]);
  });

  it('draws nothing from no data', () => {
    const out = new Float32Array(3).fill(0.5);
    barLevels(new Float32Array(0), out);
    expect(Array.from(out)).toEqual([0, 0, 0]);
  });
});

describe('barTop', () => {
  it('fills the lane at full scale and mirrors about the centre', () => {
    expect(barTop(1, 40)).toBe(0);
    expect(barTop(0.5, 40)).toBe(10); // 10 .. 30
    expect(barTop(0.5, 41)).toBe(10); // 10 .. 31, centred on pixel 20
  });

  it('keeps silence as a centred zero line', () => {
    expect(barTop(0, 40)).toBe(19); // 19 .. 21: two pixels, centred
    expect(barTop(0, 41)).toBe(20); // 20 .. 21: the middle pixel
    expect(barTop(-3, 40)).toBe(19);
    expect(barTop(NaN, 40)).toBe(19);
  });
});

describe('position and x', () => {
  const layout = layoutBars(100, 2, 1); // track runs from x = 1 to x = 99
  const duration = 200;

  it('maps the ends of the track to the ends of the bars', () => {
    expect(xAtPosition(layout, 0, duration)).toBe(1);
    expect(xAtPosition(layout, duration, duration)).toBe(99);
    expect(xAtPosition(layout, 100, duration)).toBe(50);
  });

  it('clamps positions outside the track', () => {
    expect(xAtPosition(layout, -5, duration)).toBe(1);
    expect(xAtPosition(layout, 500, duration)).toBe(99);
    expect(xAtPosition(layout, 10, 0)).toBe(1);
  });

  it('maps x back to a position, clamped to the track', () => {
    expect(positionAtX(layout, 1, duration)).toBe(0);
    expect(positionAtX(layout, 99, duration)).toBe(duration);
    expect(positionAtX(layout, 50, duration)).toBe(100);
    expect(positionAtX(layout, -40, duration)).toBe(0);
    expect(positionAtX(layout, 0, duration)).toBe(0);
    expect(positionAtX(layout, 100, duration)).toBe(duration);
    expect(positionAtX(layout, 50, 0)).toBe(0);
    expect(positionAtX(layoutBars(0, 2, 1), 50, duration)).toBe(0);
  });

  it('round-trips position to x and back', () => {
    for (const sec of [0, 0.5, 33.3, 100, 199.9, 200]) {
      expect(positionAtX(layout, xAtPosition(layout, sec, duration), duration)).toBeCloseTo(sec, 9);
    }
  });
});

describe('splitAt', () => {
  const layout = layoutBars(100, 2, 1); // bar i covers [1 + 3i, 3 + 3i)

  it('has played nothing at the start', () => {
    expect(splitAt(layout, 1)).toEqual({ played: 0, partialPx: 0 });
    expect(splitAt(layout, -10)).toEqual({ played: 0, partialPx: 0 });
  });

  it('splits the bar the playhead is inside', () => {
    expect(splitAt(layout, 2)).toEqual({ played: 0, partialPx: 1 });
    expect(splitAt(layout, 8.5)).toEqual({ played: 2, partialPx: 1.5 });
  });

  it('counts a bar as played once the playhead reaches its right edge or the gap', () => {
    expect(splitAt(layout, 3)).toEqual({ played: 1, partialPx: 0 });
    expect(splitAt(layout, 3.5)).toEqual({ played: 1, partialPx: 0 });
    expect(splitAt(layout, 4)).toEqual({ played: 1, partialPx: 0 });
  });

  it('has played everything at the end', () => {
    expect(splitAt(layout, 99)).toEqual({ played: 33, partialPx: 0 });
    expect(splitAt(layout, 500)).toEqual({ played: 33, partialPx: 0 });
  });

  it('agrees with the position mapping halfway through', () => {
    const x = xAtPosition(layout, 100, 200); // 50: inside bar 16 (49 .. 51)
    expect(splitAt(layout, x)).toEqual({ played: 16, partialPx: 1 });
  });
});

describe('positionText', () => {
  it('reads the position and the length', () => {
    expect(positionText(65.4, 200)).toBe('1:05 of 3:20');
    expect(positionText(-1, 200)).toBe('0:00 of 3:20');
    expect(positionText(900, 200)).toBe('3:20 of 3:20');
  });
});
