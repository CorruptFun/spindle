import type { PadBankControl } from '../sampler/types';
import { PAD_COUNT } from '../sampler/types';
import { Click } from './click';
import { SequencerCore } from './core';
import { STEPS_PER_BAR } from './types';
import type { DrumPattern, RecordedHit, SequencerControl } from './types';

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
/** Roughly how long a touch takes to reach the page on a tablet. */
const TOUCH_LAG_SEC = 0.02;

export class Sequencer implements SequencerControl {
  onBar: (() => void) | null = null;

  private readonly context: BaseAudioContext;
  private readonly pads: PadBankControl;
  private readonly core: SequencerCore;
  /** The metronome, when there is somewhere to send it. */
  private readonly click: Click | null;
  private clickOn = false;

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

  private readonly emitBeat = (time: number, downbeat: boolean): void => {
    if (this.clickOn) this.click?.at(time, downbeat);
  };

  private readonly tick = (): void => {
    this.core.collect(
      this.context.currentTime + this.lookahead,
      this.emitHit,
      this.emitBar,
      this.emitBeat,
    );
  };

  private readonly onVisibility = (): void => {
    this.lookahead =
      typeof document !== 'undefined' && document.hidden
        ? LOOKAHEAD_HIDDEN_SEC
        : LOOKAHEAD_VISIBLE_SEC;
    // Fill the longer horizon straight away, before the slowed timers kick in.
    if (this.core.playing) this.tick();
  };

  /** `clickOutput` is where the metronome is heard; without it there is no click. */
  constructor(context: BaseAudioContext, pads: PadBankControl, clickOutput?: AudioNode) {
    this.context = context;
    this.pads = pads;
    this.click = clickOutput ? new Click(context, clickOutput) : null;
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
    if (this.core.playing) {
      this.pads.silence();
      this.click?.silence();
    }
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
    this.click?.silence();
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

  setClick(on: boolean): void {
    this.clickOn = on;
    // Off means off now, not after the clicks already scheduled a moment ahead.
    if (!on) this.click?.silence();
  }

  recordHit(pad: number, velocity: number): RecordedHit | null {
    return this.core.recordHit(pad, velocity, this.context.currentTime - this.heardLag());
  }

  /**
   * How far what the person hears trails the audio clock, in seconds: the device's output
   * delay, plus a little for a touch to reach us. They tap along with what they hear, so a
   * recorded hit is placed that much earlier, or every hit would land late.
   */
  private heardLag(): number {
    const context = this.context as BaseAudioContext & {
      baseLatency?: number;
      outputLatency?: number;
    };
    const output = (context.baseLatency ?? 0) + (context.outputLatency ?? 0);
    return (Number.isFinite(output) ? output : 0) + TOUCH_LAG_SEC;
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
