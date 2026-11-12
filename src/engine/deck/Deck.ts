/**
 * A deck on the main thread: a thin shell that sends commands to the deck
 * player worklet and answers questions from the playhead estimate. The sound
 * and the record's angle both come from the worklet's one playhead, so they
 * cannot drift apart.
 */
import { pcmFrames, type DeckId, type PcmAudio } from '../core/types';
import workletUrl from '../worklets/deck-player.worklet.ts?worker&url';
import { DECK_PLAYER_PROCESSOR, type DeckCommand, type DeckEvent } from '../worklets/protocol';
import { MAX_SPEED } from './kernel';
import { PLAY_VELOCITY_DEG } from './platter';
import { Playhead } from './playhead';
import type { DeckControl, DeckLoadOptions } from './types';

const workletModules = new WeakMap<BaseAudioContext, Promise<void>>();

/**
 * Make the deck player available on `context`. Safe to call any number of
 * times; every Deck on that context needs it to have resolved first.
 */
export function loadDeckWorklet(context: BaseAudioContext): Promise<void> {
  let loading = workletModules.get(context);
  if (!loading) {
    loading = context.audioWorklet.addModule(workletUrl);
    workletModules.set(context, loading);
    // A failed load (offline mid-update, say) may be retried later.
    loading.catch(() => workletModules.delete(context));
  }
  return loading;
}

export class Deck implements DeckControl {
  readonly id: DeckId;
  readonly output: AudioWorkletNode;
  onEnded: (() => void) | null = null;

  private readonly sampleRate: number;
  private readonly playhead: Playhead;
  private motor = false;
  private seq = 0;

  /** `loadDeckWorklet(context)` must have resolved. */
  constructor(context: BaseAudioContext, id: DeckId) {
    this.id = id;
    this.sampleRate = context.sampleRate;
    this.playhead = new Playhead(context.sampleRate);
    this.output = new AudioWorkletNode(context, DECK_PLAYER_PROCESSOR, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.output.port.onmessage = (event: MessageEvent<DeckEvent>) => this.receive(event.data);
  }

  get loaded(): boolean {
    return this.playhead.isLoaded;
  }

  get motorOn(): boolean {
    return this.motor;
  }

  load(audio: PcmAudio, options?: DeckLoadOptions): void {
    const left = audio.channels[0];
    if (!left) throw new RangeError('A track needs at least one channel.');
    if (audio.sampleRate !== this.sampleRate) {
      throw new RangeError(
        `Track is at ${audio.sampleRate} Hz but the deck runs at ${this.sampleRate} Hz.`,
      );
    }
    let right = audio.channels[1] ?? null;
    // The same samples twice is mono, and one buffer cannot be transferred twice.
    if (right === left) right = null;

    const loop = options?.loop ?? false;
    const seq = this.nextSeq();
    // Measure before sending: moving the arrays to the audio thread empties them here.
    const frames = pcmFrames(audio);
    this.send({ type: 'load', left, right, loop, seq }, transferables(left, right));
    this.playhead.load(performance.now(), frames, loop, seq);
  }

  eject(): void {
    const seq = this.nextSeq();
    this.send({ type: 'eject', seq });
    this.playhead.eject(performance.now(), seq);
  }

  setMotor(on: boolean): void {
    this.motor = on;
    this.playhead.setMotor(on);
    this.send({ type: 'motor', on });
  }

  seek(positionSec: number): void {
    if (!this.loaded || !Number.isFinite(positionSec)) return;
    const frames = Math.min(Math.max(positionSec * this.sampleRate, 0), this.playhead.duration);
    const seq = this.nextSeq();
    this.send({ type: 'seek', frames, seq });
    this.playhead.seek(performance.now(), frames, seq);
  }

  positionSec(): number {
    return this.playhead.positionFrames(performance.now()) / this.sampleRate;
  }

  durationSec(): number {
    return this.playhead.duration / this.sampleRate;
  }

  angleDeg(): number {
    return this.playhead.angleDeg(performance.now());
  }

  isMoving(): boolean {
    return this.playhead.isMoving(performance.now());
  }

  grab(): void {
    if (this.playhead.isHeld) return;
    this.playhead.grab(performance.now());
    this.send({ type: 'grab' });
  }

  dragBy(deltaDeg: number): void {
    const deltaFrames = this.playhead.dragBy(deltaDeg);
    if (deltaFrames !== 0) this.send({ type: 'hand', deltaFrames });
  }

  release(throwVelocityDeg: number): void {
    if (!this.playhead.isHeld) return;
    const speed = Number.isFinite(throwVelocityDeg) ? throwVelocityDeg / PLAY_VELOCITY_DEG : 0;
    const velocity = Math.min(MAX_SPEED, Math.max(-MAX_SPEED, speed));
    this.playhead.release(performance.now(), velocity);
    this.send({ type: 'release', velocity });
  }

  dispose(): void {
    this.onEnded = null;
    this.send({ type: 'dispose' });
    this.output.port.onmessage = null;
    this.output.port.close();
    this.output.disconnect();
  }

  private receive(event: DeckEvent): void {
    if (event.type === 'state') {
      this.playhead.receive(performance.now(), event);
    } else {
      this.motor = false;
      this.playhead.ended();
      this.onEnded?.();
    }
  }

  private send(command: DeckCommand, transfer: Transferable[] = []): void {
    this.output.port.postMessage(command, transfer);
  }

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }
}

/** The distinct, transferable buffers behind the channels. Shared memory is passed as is. */
function transferables(left: Float32Array, right: Float32Array | null): Transferable[] {
  const buffers: Transferable[] = [];
  for (const channel of [left, right]) {
    const buffer = channel?.buffer;
    if (buffer instanceof ArrayBuffer && !buffers.includes(buffer)) buffers.push(buffer);
  }
  return buffers;
}
