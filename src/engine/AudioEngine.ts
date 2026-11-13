import { DECK_IDS, type DeckId } from './core/types';
import { Deck, loadDeckWorklet } from './deck/Deck';
import type { DeckControl } from './deck/types';
import { Mixer } from './mixer/Mixer';
import type { MixerControl } from './mixer/types';
import { PadBank } from './sampler/PadBank';
import type { PadBankControl } from './sampler/types';
import { Sequencer } from './sequencer/Sequencer';
import type { SequencerControl } from './sequencer/types';

/**
 * The whole instrument: four decks and a bank of drum pads plugged into a
 * mixer, plugged into the speakers, with a sequencer to play the pads in time.
 */
export interface AudioEngine {
  readonly context: AudioContext;
  readonly mixer: MixerControl;
  deck(id: DeckId): DeckControl;
  readonly pads: PadBankControl;
  readonly sequencer: SequencerControl;
  /**
   * Browsers keep audio silent until the person touches the page. Call this
   * from a touch, click or key press; calling it again is harmless.
   */
  resume(): Promise<void>;
  /** True once sound can actually come out. */
  readonly running: boolean;
  dispose(): Promise<void>;
}

/**
 * Builds the engine. The audio context starts suspended, so this is safe to
 * call when the page loads; nothing is heard until `resume`.
 */
export async function createAudioEngine(
  deckIds: readonly DeckId[] = DECK_IDS,
): Promise<AudioEngine> {
  // A music app plays through the speaker even when an iPhone's ring switch is on silent.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';

  // 'interactive' asks for the shortest output delay the device can manage,
  // which is what makes a scratch, or a finger on a pad, feel attached to the sound.
  const context = new AudioContext({ latencyHint: 'interactive' });
  await loadDeckWorklet(context);

  const mixer = new Mixer(context, deckIds);
  const decks = new Map<DeckId, Deck>();
  for (const id of deckIds) {
    const deck = new Deck(context, id);
    deck.output.connect(mixer.input(id));
    decks.set(id, deck);
  }

  const pads = new PadBank(context);
  pads.output.connect(mixer.padsInput);
  // The metronome goes through the drums' channel, so it is metered and limited with them.
  const sequencer = new Sequencer(context, pads, mixer.padsInput);

  mixer.output.connect(context.destination);

  return {
    context,
    mixer,
    pads,
    sequencer,
    deck(id) {
      const deck = decks.get(id);
      if (!deck) throw new Error(`No deck ${id} in this engine`);
      return deck;
    },
    async resume() {
      // Not only 'suspended': after a phone call or another app's audio, Safari reports
      // 'interrupted'.
      if (context.state === 'running' || context.state === 'closed') return;
      try {
        await context.resume();
      } catch {
        // The browser refused because this was not a real touch; the next one will work.
      }
    },
    get running() {
      return context.state === 'running';
    },
    async dispose() {
      sequencer.dispose();
      pads.dispose();
      for (const deck of decks.values()) deck.dispose();
      mixer.dispose();
      await context.close();
    },
  };
}
