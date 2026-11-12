/**
 * The deck player processor: a thin shell around the playback kernel. It owns
 * the kernel state and the track's sample arrays, turns messages into kernel
 * calls, and reports where the record is so the screen can follow it.
 */
import {
  createKernelState,
  kernelEject,
  kernelGrab,
  kernelHand,
  kernelLoad,
  kernelMoving,
  kernelRelease,
  kernelSeek,
  kernelSetMotor,
  renderKernel,
} from '../deck/kernel';
import {
  DECK_PLAYER_PROCESSOR,
  REPORT_INTERVAL_SEC,
  type DeckCommand,
  type DeckEndedEvent,
  type DeckStateReport,
} from './protocol';

const ENDED: DeckEndedEvent = { type: 'ended' };

class DeckPlayerProcessor extends AudioWorkletProcessor {
  private readonly state = createKernelState();
  /** Filled in place and posted; posting clones it, so it is safe to reuse. */
  private readonly report: DeckStateReport = {
    type: 'state',
    positionFrames: 0,
    travelFrames: 0,
    velocity: 0,
    moving: false,
    seq: 0,
  };
  private readonly reportInterval = Math.max(1, Math.round(REPORT_INTERVAL_SEC * sampleRate));
  private framesSinceReport = 0;
  private wasMoving = false;
  /** A command arrived: report on the next block even if the record is still. */
  private dirty = true;
  private alive = true;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<DeckCommand>) => this.handle(event.data);
  }

  private handle(command: DeckCommand): void {
    const state = this.state;
    switch (command.type) {
      case 'load':
        kernelLoad(state, command.left, command.right, command.loop, command.seq);
        break;
      case 'eject':
        kernelEject(state, command.seq);
        break;
      case 'seek':
        kernelSeek(state, command.frames, command.seq);
        break;
      case 'motor':
        kernelSetMotor(state, command.on);
        break;
      case 'grab':
        kernelGrab(state);
        break;
      case 'hand':
        kernelHand(state, command.deltaFrames);
        break;
      case 'release':
        kernelRelease(state, command.velocity);
        break;
      case 'dispose':
        // Drop the samples now: no fade is needed for a node that will never sound again.
        this.alive = false;
        state.left = null;
        state.right = null;
        state.pendingLeft = null;
        state.pendingRight = null;
        this.port.onmessage = null;
        break;
    }
    this.dirty = true;
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (!this.alive) return false;
    const output = outputs[0];
    const left = output?.[0];
    if (left === undefined) return true;
    const right = output?.[1] ?? left;
    const state = this.state;

    renderKernel(state, left, right, left.length, sampleRate);

    const moving = kernelMoving(state);
    this.framesSinceReport += left.length;
    const due = moving && this.framesSinceReport >= this.reportInterval;
    const cameToRest = this.wasMoving && !moving;
    if (due || cameToRest || this.dirty || state.ended) {
      const report = this.report;
      report.positionFrames = state.position;
      report.travelFrames = state.travel;
      report.velocity = state.velocity;
      report.moving = moving;
      report.seq = state.seq;
      this.port.postMessage(report);
      this.framesSinceReport = 0;
      this.dirty = false;
    }
    if (state.ended) {
      state.ended = false;
      this.port.postMessage(ENDED);
    }
    this.wasMoving = moving;
    return true;
  }
}

registerProcessor(DECK_PLAYER_PROCESSOR, DeckPlayerProcessor);
