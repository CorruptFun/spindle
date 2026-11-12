import { create } from 'zustand';
import { createAudioEngine, type AudioEngine } from '@/engine/AudioEngine';
import { DECK_IDS, type DeckId } from '@/engine/core/types';
import { clamp } from '@/lib/audio-math';
import { CRATE_TRACKS, renderCrateTrack } from '@/sources/crate';
import {
  audioFilesFromDataTransfer,
  decodeAudioFile,
  describeAudioFile,
  MAX_TRACK_SECONDS,
  pickAudioFiles,
} from '@/sources/local';
import {
  TrackLoadError,
  type LoadedTrack,
  type TrackLoadFailure,
  type TrackMeta,
  type TrackRef,
} from '@/sources/types';

type PerDeck<T> = Record<DeckId, T>;

function perDeck<T>(value: T): PerDeck<T> {
  return { A: value, B: value, C: value, D: value };
}

function sameTrack(a: TrackRef | null, b: TrackRef | null): boolean {
  return a !== null && b !== null && a.source === b.source && a.id === b.id;
}

const LOAD_PROBLEMS: Record<TrackLoadFailure, string> = {
  unsupported: 'That is not a kind of music file this app can play.',
  protected:
    'That song is copy-protected, so it cannot go on a deck. Songs bought from the iTunes Store work.',
  'too-long': `That track is longer than ${MAX_TRACK_SECONDS / 60} minutes, which is more than the app can hold.`,
  failed: 'Something went wrong reading that song.',
};

function describeProblem(error: unknown): string {
  return LOAD_PROBLEMS[error instanceof TrackLoadError ? error.reason : 'failed'];
}

/** The files behind "My music". Kept out of the store: a File is a handle, not state. */
const musicFiles = new Map<string, File>();

interface BoothState {
  /** null until the audio engine has started up. */
  engine: AudioEngine | null;
  /** The audio engine could not start on this device. */
  engineFailed: boolean;

  /** Whether each deck's motor is running. */
  playing: PerDeck<boolean>;
  /** What is on each deck. */
  tracks: PerDeck<TrackMeta | null>;
  /** The track each deck is busy loading, if any. */
  loading: PerDeck<TrackRef | null>;
  /** 0 = bottom, 1 = top. */
  channelFaders: PerDeck<number>;
  /** 0 = hard left, 0.5 = centre, 1 = hard right. */
  crossfader: number;

  /** Songs added from this device during this visit. */
  myMusic: readonly TrackMeta[];
  /** The deck the song picker is open for. */
  pickerDeck: DeckId | null;
  /** Something the person should know, in plain words, and the deck it is about. */
  notice: string | null;
  noticeDeck: DeckId | null;

  boot: () => Promise<void>;
  /** Call from any touch or key press: browsers keep audio off until then. */
  wake: () => void;
  togglePlay: (deck: DeckId) => void;
  backToStart: (deck: DeckId) => void;
  /**
   * Match the booth to what a skill mode shows: decks that are not on screen stop, and when
   * the channel faders are hidden they go back to full, so nothing plays or stays silent
   * without a control to change it.
   */
  fitToMode: (deckCount: number, showsChannelFaders: boolean) => void;
  setCrossfader: (position: number) => void;
  setChannelFader: (deck: DeckId, position: number) => void;
  openPicker: (deck: DeckId) => void;
  closePicker: () => void;
  dismissNotice: () => void;
  /** Put a known track on a deck. */
  pickTrack: (deck: DeckId, track: TrackMeta) => Promise<void>;
  /** Choose files from this device, add them to My music, and put the first on the deck. */
  addMusic: (deck: DeckId) => Promise<void>;
  /** Files were dropped on a deck. */
  dropOnDeck: (deck: DeckId, data: DataTransfer) => Promise<void>;
}

/** Closer to the end than this counts as having played out. */
const END_SLACK_SEC = 0.05;

let booting: Promise<void> | null = null;

/**
 * What the booth is doing, at human speed. The engine is the source of truth
 * for sound; this store mirrors the parts the screen needs to re-render for.
 * Anything that changes every frame is read from the engine directly.
 */
export const useBooth = create<BoothState>()((set, get) => {
  const setDeck = <K extends 'playing' | 'tracks' | 'loading' | 'channelFaders'>(
    key: K,
    deck: DeckId,
    value: BoothState[K][DeckId],
  ) => set((state) => ({ [key]: { ...state[key], [deck]: value } }) as Pick<BoothState, K>);

  /** Load whatever `produce` returns onto a deck. The latest choice for a deck wins. */
  const loadOnto = async (
    deck: DeckId,
    ref: TrackRef,
    produce: (engine: AudioEngine) => Promise<LoadedTrack>,
  ) => {
    const { engine } = get();
    if (!engine) return;

    setDeck('loading', deck, ref);
    set({ notice: null, noticeDeck: null });
    try {
      const track = await produce(engine);
      if (!sameTrack(get().loading[deck], ref)) return; // a newer choice took over
      engine.deck(deck).load(track.audio, { loop: track.loop });
      setDeck('tracks', deck, track.meta);
      setDeck('loading', deck, null);
      if (get().pickerDeck === deck) set({ pickerDeck: null });
    } catch (error) {
      // A file that cannot be played does not stay on the shelf.
      if (ref.source === 'local') {
        musicFiles.delete(ref.id);
        set((state) => ({ myMusic: state.myMusic.filter((known) => !sameTrack(known.ref, ref)) }));
      }
      if (!sameTrack(get().loading[deck], ref)) return;
      setDeck('loading', deck, null);
      set({ notice: describeProblem(error), noticeDeck: deck });
    }
  };

  const addFiles = (files: readonly File[]): TrackMeta[] => {
    const added = files.map((file) => {
      const meta = describeAudioFile(file);
      musicFiles.set(meta.ref.id, file);
      return meta;
    });
    set((state) => ({
      myMusic: [
        ...state.myMusic.filter((known) => !added.some((meta) => sameTrack(meta.ref, known.ref))),
        ...added,
      ],
    }));
    return added;
  };

  return {
    engine: null,
    engineFailed: false,
    playing: perDeck(false),
    tracks: perDeck<TrackMeta | null>(null),
    loading: perDeck<TrackRef | null>(null),
    channelFaders: perDeck(1),
    crossfader: 0.5,
    myMusic: [],
    pickerDeck: null,
    notice: null,
    noticeDeck: null,

    boot() {
      booting ??= (async () => {
        try {
          const engine = await createAudioEngine();
          for (const deck of DECK_IDS) {
            engine.deck(deck).onEnded = () => setDeck('playing', deck, false);
          }
          set({ engine });

          // Two starter songs go on straight away, so the very first tap makes sound.
          const [first, second] = CRATE_TRACKS;
          if (first) void get().pickTrack('A', first);
          if (second) void get().pickTrack('B', second);
        } catch {
          set({ engineFailed: true });
        }
      })();
      return booting;
    },

    wake() {
      void get().engine?.resume();
    },

    togglePlay(deck) {
      const { engine, tracks, loading, playing } = get();
      if (!engine) return;
      void engine.resume();

      // Play on an empty deck is a request for a song.
      if (!tracks[deck] && !loading[deck] && !playing[deck]) {
        set({ pickerDeck: deck });
        return;
      }
      const on = !playing[deck];
      const control = engine.deck(deck);
      // A track that has played out starts again from the top. (One that loops never rests at its end.)
      if (
        on &&
        control.durationSec() > 0 &&
        control.positionSec() >= control.durationSec() - END_SLACK_SEC
      ) {
        control.seek(0);
      }
      control.setMotor(on);
      setDeck('playing', deck, on);
    },

    backToStart(deck) {
      get().engine?.deck(deck).seek(0);
    },

    fitToMode(deckCount, showsChannelFaders) {
      const { engine, playing } = get();
      if (!engine) return;
      for (const deck of DECK_IDS.slice(deckCount)) {
        if (!playing[deck]) continue;
        engine.deck(deck).setMotor(false);
        setDeck('playing', deck, false);
      }
      if (!showsChannelFaders) {
        for (const deck of DECK_IDS) get().setChannelFader(deck, 1);
      }
    },

    setCrossfader(position) {
      const crossfader = clamp(position, 0, 1);
      get().engine?.mixer.setCrossfader(crossfader);
      set({ crossfader });
    },

    setChannelFader(deck, position) {
      const fader = clamp(position, 0, 1);
      get().engine?.mixer.setChannelFader(deck, fader);
      setDeck('channelFaders', deck, fader);
    },

    openPicker(deck) {
      set({ pickerDeck: deck, notice: null, noticeDeck: null });
    },

    closePicker() {
      set({ pickerDeck: null });
    },

    dismissNotice() {
      set({ notice: null, noticeDeck: null });
    },

    async pickTrack(deck, track) {
      if (track.ref.source === 'crate') {
        await loadOnto(deck, track.ref, (engine) =>
          renderCrateTrack(track.ref.id, engine.context.sampleRate),
        );
        return;
      }
      const file = musicFiles.get(track.ref.id);
      if (!file) {
        set({ notice: LOAD_PROBLEMS.failed, noticeDeck: deck });
        return;
      }
      await loadOnto(deck, track.ref, (engine) => decodeAudioFile(engine.context, file));
    },

    async addMusic(deck) {
      const [first] = addFiles(await pickAudioFiles());
      if (first) await get().pickTrack(deck, first);
    },

    async dropOnDeck(deck, data) {
      const files = audioFilesFromDataTransfer(data);
      if (files.length === 0) {
        set({ notice: LOAD_PROBLEMS.unsupported, noticeDeck: deck });
        return;
      }
      const [first] = addFiles(files);
      if (first) await get().pickTrack(deck, first);
    },
  };
});

// Development only: reach the live booth from the browser console as `__booth`.
if (import.meta.env.DEV) {
  Object.assign(globalThis, { __booth: useBooth });
}

// In development a code change replaces this module; close the old audio engine with it.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void useBooth.getState().engine?.dispose();
  });
}
