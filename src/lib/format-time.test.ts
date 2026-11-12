import { describe, expect, it } from 'vitest';
import { formatClock, formatRemaining } from './format-time';

describe('formatClock', () => {
  it('pads seconds to two digits', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(600)).toBe('10:00');
  });

  it('counts whole seconds', () => {
    expect(formatClock(59.99)).toBe('0:59');
  });

  it('does not cap minutes', () => {
    expect(formatClock(75 * 60 + 3)).toBe('75:03');
  });

  it('shows nonsense as zero', () => {
    expect(formatClock(-3)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatRemaining', () => {
  it('shows the full length at the start', () => {
    expect(formatRemaining(0, 200)).toBe('3:20');
    expect(formatRemaining(0, 200.4)).toBe('3:21');
  });

  it('rounds up so 0:00 means the end', () => {
    expect(formatRemaining(199.5, 200)).toBe('0:01');
    expect(formatRemaining(200, 200)).toBe('0:00');
  });

  it('ignores float noise', () => {
    expect(formatRemaining(0.1 + 0.2 - 0.3, 200)).toBe('3:20');
  });

  it('never goes negative', () => {
    expect(formatRemaining(250, 200)).toBe('0:00');
    expect(formatRemaining(0, 0)).toBe('0:00');
    expect(formatRemaining(0, Number.NaN)).toBe('0:00');
  });
});
