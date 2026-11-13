import { clamp, faderToGain } from '@/lib/audio-math';
import { pcmFrames } from '../core/types';
import { glowLevel, latestHitAt, velocityGain } from './glow';
import { PAD_COUNT } from './types';
import type { PadBankControl, PadSound } from './types';

/** Same smoothing as the mixer's faders. */
const SMOOTHING_SECONDS = 0.008;

/** A choke, a voice cap or silence() fades a voice over this long: short, but not a click. */
const FADE_SEC = 0.005;

/** Most voices one pad may have ringing; the oldest is faded out to make room. */
const MAX_VOICES_PER_PAD = 8;

/**
 * Hit times remembered per pad for its light. Enough for every hit the
 * sequencer can schedule ahead in a background tab (1.5 s at 180 BPM is 18
 * sixteenths) plus the one that is sounding.
 */
const GLOW_SLOTS = 32;

interface Voice {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  readonly velocityGain: number;
  /** When the voice starts on the audio clock. */
  readonly start: number;
  /** When a fade-out begins; Infinity while none is planned. */
  fadeAt: number;
}

interface Pad {
  buffer: AudioBuffer | null;
  chokeGroup: number | undefined;
  readonly level: GainNode;
  /** Oldest first. Voices leave the list when they end. */
  readonly voices: Voice[];
  readonly hits: Float64Array;
  nextHit: number;
}

export class PadBank implements PadBankControl {
  readonly output: GainNode;

  private readonly context: BaseAudioContext;
  private readonly pads: Pad[] = [];

  constructor(context: BaseAudioContext) {
    this.context = context;

    this.output = context.createGain();
    this.output.gain.value = 1;
    // Stereo out whatever the sounds are: mono hits are spread to both sides.
    this.output.channelCount = 2;
    this.output.channelCountMode = 'explicit';
    this.output.channelInterpretation = 'speakers';

    for (let i = 0; i < PAD_COUNT; i += 1) {
      const level = context.createGain();
      level.gain.value = faderToGain(1);
      level.connect(this.output);
      this.pads.push({
        buffer: null,
        chokeGroup: undefined,
        level,
        voices: [],
        hits: new Float64Array(GLOW_SLOTS).fill(-Infinity),
        nextHit: 0,
      });
    }
  }

  setSound(pad: number, sound: PadSound | null): void {
    const target = this.pad(pad);
    if (!target) throw new RangeError(`There is no pad ${pad}`);
    if (!sound) {
      target.buffer = null;
      target.chokeGroup = undefined;
      return;
    }

    const { audio } = sound;
    if (audio.sampleRate !== this.context.sampleRate) {
      throw new RangeError(
        `Pad sound is at ${audio.sampleRate} Hz but the audio runs at ${this.context.sampleRate} Hz`,
      );
    }
    const channels = audio.channels.length;
    const frames = pcmFrames(audio);
    if (channels < 1 || channels > 2 || frames === 0) {
      throw new RangeError('A pad sound must be mono or stereo and not empty');
    }

    const buffer = this.context.createBuffer(channels, frames, audio.sampleRate);
    audio.channels.forEach((data, channel) => {
      buffer.getChannelData(channel).set(data.length > frames ? data.subarray(0, frames) : data);
    });
    target.buffer = buffer;
    target.chokeGroup = sound.chokeGroup;
  }

  trigger(pad: number, velocity = 1, when?: number): void {
    const target = this.pad(pad);
    if (!target?.buffer) return;
    const gain = velocityGain(velocity);
    if (gain <= 0) return;

    const now = this.context.currentTime;
    const start = when !== undefined && Number.isFinite(when) ? Math.max(when, now) : now;

    if (target.chokeGroup !== undefined) this.choke(target.chokeGroup, target, start);

    let ringing = 0;
    let oldest: Voice | null = null;
    for (const voice of target.voices) {
      if (voice.fadeAt !== Infinity) continue;
      ringing += 1;
      if (!oldest || voice.start < oldest.start) oldest = voice;
    }
    if (oldest && ringing >= MAX_VOICES_PER_PAD) this.fade(target, oldest, start);

    const source = this.context.createBufferSource();
    source.buffer = target.buffer;
    const hitGain = this.context.createGain();
    hitGain.gain.value = gain;
    source.connect(hitGain);
    hitGain.connect(target.level);

    const voice: Voice = { source, gain: hitGain, velocityGain: gain, start, fadeAt: Infinity };
    target.voices.push(voice);
    source.onended = () => {
      source.disconnect();
      hitGain.disconnect();
      const index = target.voices.indexOf(voice);
      if (index >= 0) target.voices.splice(index, 1);
    };
    source.start(start);

    target.hits[target.nextHit] = start;
    target.nextHit = (target.nextHit + 1) % GLOW_SLOTS;
  }

  glow(pad: number): number {
    const target = this.pad(pad);
    if (!target) return 0;
    const now = this.context.currentTime;
    return glowLevel(now - latestHitAt(target.hits, now));
  }

  setPadLevel(pad: number, position: number): void {
    const target = this.pad(pad);
    if (!target || !Number.isFinite(position)) return;
    target.level.gain.setTargetAtTime(
      faderToGain(clamp(position, 0, 1)),
      this.context.currentTime,
      SMOOTHING_SECONDS,
    );
  }

  silence(): void {
    const now = this.context.currentTime;
    for (const pad of this.pads) {
      for (const voice of pad.voices) this.fade(pad, voice, now);
    }
  }

  dispose(): void {
    for (const pad of this.pads) {
      for (const voice of pad.voices) {
        voice.source.onended = null;
        try {
          voice.source.stop();
        } catch {
          // Already stopped.
        }
        voice.source.disconnect();
        voice.gain.disconnect();
      }
      pad.voices.length = 0;
      pad.buffer = null;
      pad.level.disconnect();
    }
    this.output.disconnect();
  }

  private pad(pad: number): Pad | undefined {
    return Number.isInteger(pad) ? this.pads[pad] : undefined;
  }

  /** Fade out every voice of the other pads in `group`, from `at`. */
  private choke(group: number, hit: Pad, at: number): void {
    for (const pad of this.pads) {
      if (pad === hit || pad.chokeGroup !== group) continue;
      for (const voice of pad.voices) {
        // Only what is already sounding is cut off. A hit scheduled for later is left alone:
        // it is still to come, and a finger now has no business deleting it.
        if (voice.start < at) this.fade(pad, voice, at);
      }
    }
  }

  /**
   * Fade a voice out over FADE_SEC from `at`. A voice that would only start at
   * or after `at` never sounds, and its pad will not light for it.
   */
  private fade(pad: Pad, voice: Voice, at: number): void {
    if (voice.fadeAt <= at) return;
    voice.fadeAt = at;

    if (voice.start >= at) {
      // Stopping before the start time means the source plays nothing.
      voice.source.stop(at);
      const slot = pad.hits.indexOf(voice.start);
      if (slot >= 0) pad.hits[slot] = -Infinity;
      return;
    }

    const param = voice.gain.gain;
    // Any later fade is replaced by this earlier one.
    param.cancelScheduledValues(at);
    param.setValueAtTime(voice.velocityGain, at);
    param.linearRampToValueAtTime(0, at + FADE_SEC);
    voice.source.stop(at + FADE_SEC);
  }
}
