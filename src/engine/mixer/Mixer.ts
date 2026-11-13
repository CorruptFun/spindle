import { clamp } from '@/lib/audio-math';
import type { DeckId } from '../core/types';
import type { CrossfaderCurve } from './crossfader';
import { peakOf } from './levels';
import { channelFaderGain, crossfadeGainFor, LIMITER, limiterMakeupGain } from './mix-law';
import type { MixerControl } from './types';

/** Time constant for parameter smoothing: fast enough to feel instant, slow enough to avoid zipper noise. */
const SMOOTHING_SECONDS = 0.008;

interface Meter {
  readonly analyser: AnalyserNode;
  readonly buffer: Float32Array<ArrayBuffer>;
}

interface Channel {
  readonly input: GainNode;
  readonly fader: GainNode;
  readonly crossfade: GainNode;
  readonly meter: Meter;
}

export class Mixer implements MixerControl {
  readonly output: GainNode;
  readonly padsInput: GainNode;

  private readonly context: BaseAudioContext;
  private readonly channels = new Map<DeckId, Channel>();
  private readonly sum: GainNode;
  private readonly masterVolume: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly masterMeter: Meter;
  private readonly padsMeter: Meter;

  private crossfaderPosition = 0.5;
  private crossfaderCurve: CrossfaderCurve = 'blend';

  constructor(context: BaseAudioContext, decks: readonly DeckId[]) {
    this.context = context;

    this.sum = context.createGain();
    this.masterVolume = context.createGain();
    this.masterVolume.gain.value = channelFaderGain(1);

    // A brick-wall style limiter so summed decks cannot clip the speakers.
    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.value = LIMITER.thresholdDb;
    this.limiter.knee.value = LIMITER.kneeDb;
    this.limiter.ratio.value = LIMITER.ratio;
    this.limiter.attack.value = LIMITER.attackSec;
    this.limiter.release.value = LIMITER.releaseSec;

    // Take the compressor's built-in make-up gain back out (see limiterMakeupGain).
    this.output = context.createGain();
    this.output.gain.value = 1 / limiterMakeupGain(LIMITER.thresholdDb, LIMITER.ratio);

    this.sum.connect(this.masterVolume);
    this.masterVolume.connect(this.limiter);
    this.limiter.connect(this.output);
    this.masterMeter = this.createMeter(this.output);

    // The pads join the sum directly, after the crossfader stage, so it never fades them.
    this.padsInput = context.createGain();
    this.padsInput.gain.value = channelFaderGain(1);
    this.padsInput.channelCount = 2;
    this.padsInput.channelCountMode = 'explicit';
    this.padsInput.channelInterpretation = 'speakers';
    this.padsInput.connect(this.sum);
    this.padsMeter = this.createMeter(this.padsInput);

    for (const deck of decks) {
      if (this.channels.has(deck)) continue;

      const input = context.createGain();
      input.gain.value = 1;
      input.channelCount = 2;
      input.channelCountMode = 'explicit';
      input.channelInterpretation = 'speakers';

      const fader = context.createGain();
      fader.gain.value = channelFaderGain(1);

      const crossfade = context.createGain();
      crossfade.gain.value = crossfadeGainFor(deck, this.crossfaderPosition, this.crossfaderCurve);

      input.connect(fader);
      fader.connect(crossfade);
      crossfade.connect(this.sum);

      this.channels.set(deck, { input, fader, crossfade, meter: this.createMeter(crossfade) });
    }
  }

  input(deck: DeckId): AudioNode {
    return this.channel(deck).input;
  }

  setChannelFader(deck: DeckId, position: number): void {
    const channel = this.channel(deck);
    this.glide(channel.fader.gain, channelFaderGain(clamp(position, 0, 1)));
  }

  setCrossfader(position: number): void {
    this.crossfaderPosition = clamp(position, 0, 1);
    this.applyCrossfader();
  }

  setCrossfaderCurve(curve: CrossfaderCurve): void {
    this.crossfaderCurve = curve;
    this.applyCrossfader();
  }

  setPadsLevel(position: number): void {
    if (!Number.isFinite(position)) return;
    this.glide(this.padsInput.gain, channelFaderGain(clamp(position, 0, 1)));
  }

  setMasterVolume(position: number): void {
    this.glide(this.masterVolume.gain, channelFaderGain(clamp(position, 0, 1)));
  }

  channelLevel(deck: DeckId): number {
    return this.read(this.channel(deck).meter);
  }

  padsLevel(): number {
    return this.read(this.padsMeter);
  }

  masterLevel(): number {
    return this.read(this.masterMeter);
  }

  dispose(): void {
    for (const [, channel] of this.channels) {
      channel.input.disconnect();
      channel.fader.disconnect();
      channel.crossfade.disconnect();
      channel.meter.analyser.disconnect();
    }
    this.padsInput.disconnect();
    this.padsMeter.analyser.disconnect();
    this.sum.disconnect();
    this.masterVolume.disconnect();
    this.limiter.disconnect();
    this.output.disconnect();
    this.masterMeter.analyser.disconnect();
  }

  private channel(deck: DeckId): Channel {
    const channel = this.channels.get(deck);
    if (!channel) throw new Error(`Mixer has no deck "${deck}"`);
    return channel;
  }

  private applyCrossfader(): void {
    for (const [deck, channel] of this.channels) {
      this.glide(
        channel.crossfade.gain,
        crossfadeGainFor(deck, this.crossfaderPosition, this.crossfaderCurve),
      );
    }
  }

  private glide(param: AudioParam, target: number): void {
    param.setTargetAtTime(target, this.context.currentTime, SMOOTHING_SECONDS);
  }

  /** The buffer is allocated once here so reading a meter never allocates. */
  private createMeter(tap: AudioNode): Meter {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0;
    tap.connect(analyser);
    return { analyser, buffer: new Float32Array(analyser.fftSize) };
  }

  private read(meter: Meter): number {
    meter.analyser.getFloatTimeDomainData(meter.buffer);
    return peakOf(meter.buffer);
  }
}
