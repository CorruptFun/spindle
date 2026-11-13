/** A short, soft blip: enough to follow, not enough to tire small ears. */
const CLICK_SEC = 0.05;
const ATTACK_SEC = 0.002;
/** Against a drum hit at full strength. */
const CLICK_LEVEL = 0.3;
/** The first beat of the bar is a fourth higher, so the top of the loop can be heard. */
const BEAT_HZ = 1320;
const DOWNBEAT_HZ = 1760;

/**
 * The metronome's sound. Something to play along to while recording, which a
 * loop that is still empty cannot give. Each click is its own short tone,
 * placed on the audio clock like a drum hit.
 */
export class Click {
  private readonly context: BaseAudioContext;
  private readonly output: AudioNode;
  /** Clicks scheduled or sounding, each with its envelope, so they can be cut off. */
  private readonly live = new Map<OscillatorNode, GainNode>();

  constructor(context: BaseAudioContext, output: AudioNode) {
    this.context = context;
    this.output = output;
  }

  at(time: number, downbeat: boolean): void {
    const start = Math.max(time, this.context.currentTime);
    const tone = this.context.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = downbeat ? DOWNBEAT_HZ : BEAT_HZ;

    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(CLICK_LEVEL, start + ATTACK_SEC);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + CLICK_SEC);

    tone.connect(envelope);
    envelope.connect(this.output);
    tone.onended = () => this.drop(tone);
    this.live.set(tone, envelope);
    tone.start(start);
    tone.stop(start + CLICK_SEC);
  }

  /** Cut off every click, including those scheduled a moment ahead. */
  silence(): void {
    for (const tone of [...this.live.keys()]) {
      try {
        tone.stop();
      } catch {
        // Not started yet in a browser that minds; disconnecting below is enough.
      }
      this.drop(tone);
    }
  }

  private drop(tone: OscillatorNode): void {
    const envelope = this.live.get(tone);
    if (!envelope) return;
    this.live.delete(tone);
    tone.onended = null;
    tone.disconnect();
    envelope.disconnect();
  }
}
