import { describe, expect, it } from 'vitest';
import { SequencerCore, stepDurationSec, swingDelaySec, withStep } from './core';
import { MAX_BPM, MAX_SWING, MIN_BPM, STEPS_PER_BAR } from './types';
import type { DrumPattern, PatternBars } from './types';

interface Hit {
  pad: number;
  velocity: number;
  time: number;
}

const T0 = 10;

/** A pattern with one hit on every step of pad 0, so each step shows up exactly once. */
function everyStep(bars: PatternBars = 1, pad = 0, pads = 2): DrumPattern {
  const steps = bars * STEPS_PER_BAR;
  const lanes: number[][] = [];
  for (let p = 0; p < pads; p += 1) lanes.push(new Array<number>(steps).fill(p === pad ? 1 : 0));
  return { bars, lanes };
}

/** Pad 0 marks the step: its velocity is (index + 1) / 100, so a hit says which step it was. */
function numbered(bars: PatternBars = 1, offset = 0): DrumPattern {
  const steps = bars * STEPS_PER_BAR;
  const lane: number[] = [];
  for (let i = 0; i < steps; i += 1) lane.push((offset + i + 1) / 100);
  return { bars, lanes: [lane] };
}

function stepOf(hit: Hit, offset = 0): number {
  return Math.round(hit.velocity * 100) - 1 - offset;
}

function collect(core: SequencerCore, until: number, bars?: number[]): Hit[] {
  const hits: Hit[] = [];
  core.collect(
    until,
    (pad, velocity, time) => hits.push({ pad, velocity, time }),
    (time) => bars?.push(time),
  );
  return hits;
}

function playing(pattern: DrumPattern, bpm = 120, swing = 0): SequencerCore {
  const core = new SequencerCore(pattern, bpm, swing);
  core.start(T0);
  return core;
}

describe('step times', () => {
  it('spaces sixteen steps to the bar at several tempos', () => {
    for (const bpm of [60, 90, 120, 128, 174, 180]) {
      const core = playing(everyStep(), bpm);
      const step = 60 / bpm / 4;
      expect(stepDurationSec(bpm)).toBeCloseTo(step, 12);
      const hits = collect(core, T0 + 16 * step - 1e-9);
      expect(hits).toHaveLength(16);
      hits.forEach((hit, i) => expect(hit.time).toBeCloseTo(T0 + i * step, 9));
    }
  });

  it('collects nothing before the first step and nothing while stopped', () => {
    const core = new SequencerCore(everyStep(), 120);
    expect(collect(core, 1e6)).toHaveLength(0);
    core.start(T0);
    expect(collect(core, T0)).toHaveLength(0);
    expect(collect(core, T0 + 1e-6)).toHaveLength(1);
  });

  it('clamps tempo and swing and ignores nonsense', () => {
    const core = new SequencerCore(everyStep());
    core.setTempo(10);
    expect(core.bpm).toBe(MIN_BPM);
    core.setTempo(500);
    expect(core.bpm).toBe(MAX_BPM);
    core.setTempo(Number.NaN);
    expect(core.bpm).toBe(MAX_BPM);
    core.setSwing(2);
    expect(core.swing).toBe(MAX_SWING);
    core.setSwing(-1);
    expect(core.swing).toBe(0);
  });
});

describe('swing', () => {
  it('delays every second sixteenth by swing * half a step', () => {
    const swing = 0.4;
    const core = playing(everyStep(), 120, swing);
    const step = stepDurationSec(120);
    const hits = collect(core, T0 + 16 * step);
    expect(hits).toHaveLength(16);
    hits.forEach((hit, i) => {
      const late = i % 2 === 1 ? swing * 0.5 * step : 0;
      expect(hit.time).toBeCloseTo(T0 + i * step + late, 9);
    });
    expect(swingDelaySec(3, swing, step)).toBeCloseTo(0.2 * step, 12);
    expect(swingDelaySec(4, swing, step)).toBe(0);
  });

  it('never lets a swung step overtake the next one', () => {
    const core = playing(everyStep(), 180, MAX_SWING);
    const hits = collect(core, T0 + 4);
    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i]!.time).toBeGreaterThan(hits[i - 1]!.time);
    }
  });
});

describe('patterns', () => {
  it('plays accents at their own velocities on the right steps', () => {
    const kick = [1, 0, 0, 0, 0.5, 0, 0, 0, 0.8, 0, 0, 0, 0.25, 0, 0, 0];
    const hat = [0, 0, 0.6, 0, 0, 0, 0.6, 0, 0, 0, 1, 0, 0, 0, 0.6, 0];
    const core = playing({ bars: 1, lanes: [kick, hat] }, 120);
    const step = stepDurationSec(120);
    const hits = collect(core, T0 + 16 * step - 1e-9);
    const expected: Hit[] = [];
    for (let i = 0; i < 16; i += 1) {
      if (kick[i]! > 0) expected.push({ pad: 0, velocity: kick[i]!, time: T0 + i * step });
      if (hat[i]! > 0) expected.push({ pad: 1, velocity: hat[i]!, time: T0 + i * step });
    }
    expect(hits).toHaveLength(expected.length);
    hits.forEach((hit, i) => {
      expect(hit.pad).toBe(expected[i]!.pad);
      expect(hit.velocity).toBe(expected[i]!.velocity);
      expect(hit.time).toBeCloseTo(expected[i]!.time, 9);
    });
  });

  it('treats missing lanes and short lanes as silence', () => {
    const core = playing({ bars: 1, lanes: [[1], []] }, 120);
    const hits = collect(core, T0 + 4 - 1e-9);
    expect(hits.every((hit) => hit.pad === 0)).toBe(true);
    // One hit per loop: a bar at 120 BPM is 2 s.
    expect(hits).toHaveLength(2);
  });

  it('wraps a two-bar pattern after 32 steps', () => {
    const core = playing(numbered(2), 120);
    const step = stepDurationSec(120);
    const hits = collect(core, T0 + 70 * step - 1e-9);
    expect(hits).toHaveLength(70);
    hits.forEach((hit, i) => expect(stepOf(hit)).toBe(i % 32));
    expect(hits[32]!.time).toBeCloseTo(T0 + 32 * step, 9);
  });
});

describe('chunking', () => {
  it('gives the same hits for one call or many small, uneven ones', () => {
    const pattern = numbered(2);
    const whole = collect(playing(pattern, 137, 0.37), T0 + 9);

    const chunked = playing(pattern, 137, 0.37);
    const pieces: Hit[] = [];
    let t = T0 - 0.5;
    let k = 0;
    while (t < T0 + 9) {
      t = Math.min(T0 + 9, t + 0.003 + ((k * 7919) % 97) / 1000);
      k += 1;
      pieces.push(...collect(chunked, t));
    }
    expect(pieces).toEqual(whole);
  });
});

describe('tempo changes while playing', () => {
  it('keeps every step once, in order, with the new spacing after the change', () => {
    const core = playing(numbered(1), 120);
    const old = stepDurationSec(120);
    const first = collect(core, T0 + 5 * old - 1e-9);
    expect(first.map((h) => stepOf(h))).toEqual([0, 1, 2, 3, 4]);

    core.setTempo(160);
    const fresh = stepDurationSec(160);
    const rest = collect(core, T0 + 5);
    const all = [...first, ...rest];
    all.forEach((hit, i) => expect(stepOf(hit)).toBe(i % 16));
    for (let i = 1; i < all.length; i += 1) {
      expect(all[i]!.time).toBeGreaterThan(all[i - 1]!.time);
    }
    // From the change on, steps are the new distance apart, and the gap across
    // the change is between the old and the new spacing (no jump).
    for (let i = 6; i < all.length; i += 1) {
      expect(all[i]!.time - all[i - 1]!.time).toBeCloseTo(fresh, 9);
    }
    const across = all[5]!.time - all[4]!.time;
    expect(across).toBeGreaterThanOrEqual(fresh - 1e-9);
    expect(across).toBeLessThanOrEqual(old + 1e-9);
  });

  it('keeps the playhead continuous through a change', () => {
    const core = playing(numbered(1), 90);
    collect(core, T0 + 0.5);
    const before = core.stepPosition(T0 + 0.5);
    core.setTempo(170);
    expect(core.stepPosition(T0 + 0.5)).toBeCloseTo(before, 9);
  });

  it('survives many small changes, like a dragged slider, without losing a step', () => {
    const core = playing(numbered(1), 100);
    const all: Hit[] = [];
    for (let i = 0; i < 200; i += 1) {
      all.push(...collect(core, T0 + i * 0.025 + 0.12));
      core.setTempo(100 + (i % 50));
    }
    all.forEach((hit, i) => expect(stepOf(hit)).toBe(i % 16));
    for (let i = 1; i < all.length; i += 1) {
      expect(all[i]!.time).toBeGreaterThan(all[i - 1]!.time);
    }
  });
});

describe('changing pattern', () => {
  it("'now' keeps the playhead and carries on with the new lanes", () => {
    const core = playing(numbered(1, 0), 120);
    const step = stepDurationSec(120);
    const first = collect(core, T0 + 6 * step - 1e-9);
    expect(first.map((h) => stepOf(h))).toEqual([0, 1, 2, 3, 4, 5]);
    core.setPattern(numbered(1, 50), 'now');
    expect(core.changePending(T0)).toBe(false);
    const next = collect(core, T0 + 9 * step - 1e-9);
    expect(next.map((h) => stepOf(h, 50))).toEqual([6, 7, 8]);
  });

  it("'now' wraps the position into a shorter pattern", () => {
    const core = playing(numbered(2, 0), 120);
    const step = stepDurationSec(120);
    collect(core, T0 + 20 * step - 1e-9);
    core.setPattern(numbered(1, 50), 'now');
    const next = collect(core, T0 + 30 * step - 1e-9);
    expect(next.map((h) => stepOf(h, 50))).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(core.stepPosition(T0 + 22.5 * step)).toBeCloseTo(6.5, 9);
  });

  it("'next-bar' lands exactly on the bar line and starts the new loop from its first step", () => {
    const core = playing(numbered(2, 0), 120);
    const step = stepDurationSec(120);
    collect(core, T0 + 5 * step - 1e-9);
    core.setPattern(numbered(1, 50), 'next-bar');
    expect(core.changePending(T0 + 5 * step)).toBe(true);

    const hits = collect(core, T0 + 24 * step - 1e-9);
    const old = hits.filter((h) => h.velocity < 0.5);
    const fresh = hits.filter((h) => h.velocity > 0.5);
    expect(old.map((h) => stepOf(h))).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(fresh.map((h) => stepOf(h, 50))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(fresh[0]!.time).toBeCloseTo(T0 + 16 * step, 9);

    // Collected ahead, but still pending until the bar line actually arrives.
    expect(core.changePending(T0 + 15.5 * step)).toBe(true);
    expect(core.changePending(T0 + 16 * step)).toBe(false);
    // The playhead shows the old loop until the bar line, then the new one.
    expect(core.stepPosition(T0 + 15.5 * step)).toBeCloseTo(15.5, 9);
    expect(core.stepPosition(T0 + 17.25 * step)).toBeCloseTo(1.25, 9);
  });

  it("'next-bar' when stopped applies at once", () => {
    const core = new SequencerCore(numbered(1, 0));
    const next = numbered(2, 50);
    core.setPattern(next, 'next-bar');
    expect(core.pattern).toBe(next);
    expect(core.changePending(0)).toBe(false);
  });

  it("'now' cancels a change waiting for its bar line", () => {
    const first = numbered(1, 0);
    const core = playing(first, 120);
    collect(core, T0 + 0.3);
    core.setPattern(numbered(1, 50), 'next-bar');
    core.setPattern(first, 'now');
    expect(core.changePending(T0 + 0.3)).toBe(false);
    const hits = collect(core, T0 + 4);
    expect(hits.every((h) => h.velocity < 0.5)).toBe(true);
  });

  it('never changes a pattern it was given', () => {
    const pattern = numbered(1);
    const frozen = JSON.stringify(pattern);
    const core = playing(pattern, 120);
    collect(core, T0 + 0.6);
    core.recordHit(1, 0.9, T0 + 0.6);
    core.setPattern(numbered(2), 'now');
    expect(JSON.stringify(pattern)).toBe(frozen);
  });
});

describe('recordHit', () => {
  it('returns null when stopped', () => {
    const core = new SequencerCore(everyStep());
    expect(core.recordHit(0, 1, 5)).toBeNull();
  });

  it('writes into the nearest step and returns a new pattern', () => {
    const empty = { bars: 1, lanes: [[], []] } satisfies DrumPattern;
    const core = playing(empty, 120);
    const step = stepDurationSec(120);
    collect(core, T0 + 4 * step);
    const recorded = core.recordHit(1, 0.7, T0 + 6.4 * step);
    expect(recorded).not.toBeNull();
    expect(recorded).not.toBe(empty);
    expect(recorded!.lanes[1]![6]).toBe(0.7);
    expect(recorded!.lanes[1]!.filter((v) => v > 0)).toHaveLength(1);
    expect(recorded!.lanes[1]).toHaveLength(16);
    expect(empty.lanes[1]).toHaveLength(0);
    expect(core.pattern).toBe(recorded);

    const later = core.recordHit(0, 1, T0 + 9.6 * step);
    expect(later!.lanes[0]![10]).toBe(1);
    expect(later!.lanes[1]![6]).toBe(0.7);
  });

  it('takes swing into account when choosing the step', () => {
    const core = playing({ bars: 1, lanes: [[]] }, 120, 0.6);
    const step = stepDurationSec(120);
    collect(core, T0 + 8 * step);
    // Step 5 sounds at 5.3 steps; 5.62 is nearer to it than to step 6.
    expect(core.recordHit(0, 1, T0 + 5.62 * step)!.lanes[0]![5]).toBe(1);
    // Straight, the same moment would go to step 6.
    core.setSwing(0);
    expect(core.recordHit(0, 0.5, T0 + 21.62 * step)!.lanes[0]![6]).toBe(0.5);
  });

  it('wraps past the last step to step 0', () => {
    const core = playing({ bars: 1, lanes: [[]] }, 120);
    const step = stepDurationSec(120);
    const recorded = core.recordHit(0, 1, T0 + 15.8 * step);
    expect(recorded!.lanes[0]![0]).toBe(1);
    expect(recorded!.lanes[0]![15]).toBe(0);
  });

  it('does not play the hit a second time when its step comes round', () => {
    const core = playing({ bars: 1, lanes: [[], []] }, 120);
    const step = stepDurationSec(120);
    collect(core, T0 + 3.9 * step);
    // The finger lands just before step 4, which has not been collected yet.
    core.recordHit(1, 1, T0 + 3.9 * step);
    const thisPass = collect(core, T0 + 16 * step - 1e-9);
    expect(thisPass.filter((h) => h.pad === 1)).toHaveLength(0);
    // From the next pass on, it is part of the loop.
    const nextPass = collect(core, T0 + 32 * step - 1e-9);
    const recorded = nextPass.filter((h) => h.pad === 1);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.time).toBeCloseTo(T0 + 20 * step, 9);
  });

  it('simply writes a hit whose step has already been collected', () => {
    const core = playing({ bars: 1, lanes: [[]] }, 120);
    const step = stepDurationSec(120);
    collect(core, T0 + 6 * step);
    core.recordHit(0, 1, T0 + 4.1 * step);
    const hits = collect(core, T0 + 32 * step - 1e-9);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.time).toBeCloseTo(T0 + 20 * step, 9);
  });

  it('adds a lane for a pad the pattern did not have', () => {
    const core = playing({ bars: 1, lanes: [] }, 120);
    const recorded = core.recordHit(3, 1, T0);
    expect(recorded!.lanes).toHaveLength(4);
    expect(recorded!.lanes[3]![0]).toBe(1);
  });

  it('withStep pads short lanes and copies', () => {
    const pattern: DrumPattern = { bars: 2, lanes: [[1, 0, 1]] };
    const next = withStep(pattern, 0, 20, 0.5);
    expect(next.lanes[0]).toHaveLength(32);
    expect(next.lanes[0]![2]).toBe(1);
    expect(next.lanes[0]![20]).toBe(0.5);
    expect(pattern.lanes[0]).toHaveLength(3);
  });
});

describe('start, stop and the playhead', () => {
  it('stop then start begins again at step 0', () => {
    const core = playing(numbered(1), 120);
    collect(core, T0 + 1.3);
    core.stop();
    expect(core.playing).toBe(false);
    expect(core.stepPosition(T0 + 1.3)).toBe(-1);
    expect(collect(core, T0 + 5)).toHaveLength(0);

    core.start(T0 + 20);
    const hits = collect(core, T0 + 20.2);
    expect(stepOf(hits[0]!)).toBe(0);
    expect(hits[0]!.time).toBeCloseTo(T0 + 20, 9);
    expect(core.stepPosition(T0 + 20)).toBe(0);
  });

  it('a change waiting for its bar line takes effect on stop', () => {
    const core = playing(numbered(1), 120);
    const next = numbered(2, 50);
    core.setPattern(next, 'next-bar');
    core.stop();
    expect(core.pattern).toBe(next);
    expect(core.changePending(0)).toBe(false);
  });

  it('reports a fractional position inside the loop', () => {
    const core = playing(numbered(2), 120);
    const step = stepDurationSec(120);
    expect(core.stepPosition(T0 - 0.02)).toBe(0);
    expect(core.stepPosition(T0 + 2.5 * step)).toBeCloseTo(2.5, 9);
    expect(core.stepPosition(T0 + 33.75 * step)).toBeCloseTo(1.75, 9);
    for (let t = T0; t < T0 + 20; t += 0.0137) {
      const x = core.stepPosition(t);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(32);
    }
  });
});

describe('bar lines', () => {
  it('reports each bar line once, on the beat, however the time is chopped', () => {
    const core = playing(numbered(2), 120);
    const bar = 16 * stepDurationSec(120);
    const bars: number[] = [];
    for (let t = T0; t < T0 + 4.5 * bar; t += 0.025) collect(core, t + 0.12, bars);
    const expected = [0, 1, 2, 3, 4].map((i) => T0 + i * bar);
    expect(bars).toHaveLength(expected.length);
    bars.forEach((time, i) => expect(time).toBeCloseTo(expected[i]!, 9));
  });
});

describe('beats', () => {
  interface Beat {
    time: number;
    downbeat: boolean;
  }

  function beatsOf(core: SequencerCore, until: number): Beat[] {
    const beats: Beat[] = [];
    for (let t = T0; t < until; t += 0.025) {
      core.collect(
        Math.min(t + 0.12, until),
        () => {},
        undefined,
        (time, downbeat) => beats.push({ time, downbeat }),
      );
    }
    return beats;
  }

  it('reports every beat once, on the grid, and marks the first of each bar', () => {
    const core = playing(numbered(2), 120);
    const beat = 4 * stepDurationSec(120);
    const beats = beatsOf(core, T0 + 8 * beat - 0.001);
    expect(beats).toHaveLength(8);
    beats.forEach(({ time, downbeat }, i) => {
      expect(time).toBeCloseTo(T0 + i * beat, 9);
      expect(downbeat).toBe(i % 4 === 0);
    });
  });

  it('keeps the beat in a loop with nothing in it', () => {
    const empty: DrumPattern = { bars: 1, lanes: [new Array<number>(STEPS_PER_BAR).fill(0)] };
    const core = playing(empty, 100);
    const beat = 4 * stepDurationSec(100);
    expect(beatsOf(core, T0 + 4 * beat - 0.001)).toHaveLength(4);
  });

  it('is not moved by swing', () => {
    const core = playing(numbered(1), 120);
    core.setSwing(MAX_SWING);
    const beat = 4 * stepDurationSec(120);
    const beats = beatsOf(core, T0 + 4 * beat - 0.001);
    beats.forEach(({ time }, i) => expect(time).toBeCloseTo(T0 + i * beat, 9));
  });
});
