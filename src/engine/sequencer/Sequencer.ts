import type { PadBankControl } from '../sampler/types';
import { PAD_COUNT } from '../sampler/types';
import { SequencerCore } from './core';
import { STEPS_PER_BAR } from './types';
import type { DrumPattern, SequencerControl } from './types';

/** How often the scheduler wakes while the page is visible. */
const TICK_MS = 25;
/** How far ahead hits are handed to the pads while visible: covers a late timer or two. */
const LOOKAHEAD_VISIBLE_SEC = 0.12;
/**
 * Hidden pages get their timers slowed to about once a second, so schedule
 * further ahead there or the beat would stutter. The cost is that an edit
 * made from a background tab is heard up to this late.
 */
const LOOKAHEAD_HIDDEN_SEC = 1.5;
/** The first step sounds this long after start(), so it is never scheduled in the past. */
const START_DELAY_SEC = 0.04;

function emptyPattern(): DrumPattern {
  const lanes: number[][] = [];
  for (let pad = 0; pad < PAD_COUNT; pad += 1) lanes.push(new Array<number>(STEPS_PER_BAR).fill(0));
  return { bars: 1, lanes };
}

/**
 * Plays drum loops on the pads in time. The timing lives in SequencerCore on
 * the audio clock; this shell wakes on a timer, asks the core for every hit
 * due before a short look-ahead horizon, and schedules those on the pads at
 * their exact times. Timer jitter therefore never reaches the beat.
 */
export class Sequencer implements SequencerControl {
  onBar: (() => void) | null = null;

  private readonly context: BaseAudioContext;
  private readonly pads: PadBankControl;
  private readonly core: SequencerCore;

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly barTimers = new Set<ReturnType<typeof setTimeout>>();
  private lookahead = LOOKAHEAD_VISIBLE_SEC;
  /** The latest bar line onBar has announced, so changePending agrees with what onBar said. */
  private announcedBar = -Infinity;

  private readonly emitHit = (pad: number, velocity: number, time: number): void => {
    this.pads.trigger(pad, velocity, time);
  };

  private readonly emitBar = (time: number): void => {
    const delayMs = Math.max(0, (time - this.context.currentTime) * 1000);
    const id = setTimeout(() => {
      this.barTimers.delete(id);
      this.announcedBar = time;
      this.onBar?.();
    }, delayMs);
    this.barTimers.add(id);
  };

  private readonly tick = (): void => {
    this.core.collect(this.context.currentTime + this.lookahead, this.emitHit, this.emitBar);
  };

  private readonly onVisibility = (): void => {
    this.lookahead =
      typeof document !== 'undefined' && document.hidden
        ? LOOKAHEAD_HIDDEN_SEC
        : LOOKAHEAD_VISIBLE_SEC;
    // Fill the longer horizon straight away, before the slowed timers kick in.
    if (this.core.playing) this.tick();
  };

  constructor(context: BaseAudioContext, pads: PadBankControl) {
    this.context = context;
    this.pads = pads;
    this.core = new SequencerCore(emptyPattern());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
      this.lookahead = document.hidden ? LOOKAHEAD_HIDDEN_SEC : LOOKAHEAD_VISIBLE_SEC;
    }
  }

  get playing(): boolean {
    return this.core.playing;
  }

  get bpm(): number {
    return this.core.bpm;
  }

  get swing(): number {
    return this.core.swing;
  }

  get pattern(): DrumPattern {
    return this.core.pattern;
  }

  get changePending(): boolean {
    return this.core.changePending(Math.max(this.context.currentTime, this.announcedBar));
  }

  start(): void {
    // Restarting while playing: drop what was already scheduled from the old pass.
    if (this.core.playing) this.pads.silence();
    this.halt();
    this.announcedBar = -Infinity;
    this.core.start(this.context.currentTime + START_DELAY_SEC);
    this.tick();
    this.timer = setInterval(this.tick, TICK_MS);
  }

  stop(): void {
    this.halt();
    this.core.stop();
    this.pads.silence();
  }

  setTempo(bpm: number): void {
    this.core.setTempo(bpm);
  }

  setSwing(amount: number): void {
    this.core.setSwing(amount);
  }

  setPattern(pattern: DrumPattern, when: 'now' | 'next-bar' = 'now'): void {
    this.core.setPattern(pattern, when);
  }

  recordHit(pad: number, velocity: number): DrumPattern | null {
    return this.core.recordHit(pad, velocity, this.context.currentTime);
  }

  stepPosition(): number {
    return this.core.stepPosition(this.context.currentTime);
  }

  dispose(): void {
    this.stop();
    this.onBar = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }

  private halt(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const id of this.barTimers) clearTimeout(id);
    this.barTimers.clear();
  }
}
