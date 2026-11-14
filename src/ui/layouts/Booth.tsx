import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { ModeDefinition } from '@/config/modes';
import { DECK_IDS, type DeckId } from '@/engine/core/types';
import { crossfaderGains, defaultCrossfaderSide } from '@/engine/mixer/crossfader';
import { CRATE_TRACKS } from '@/sources/crate';
import { SOURCES } from '@/sources/registry';
import { useBooth } from '@/state/booth';
import { SongPicker } from '@/ui/browser/SongPicker';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { DeckUnit } from '@/ui/deck/DeckUnit';
import { boothKeyAction, keyFocus, nudgedCrossfader } from '@/ui/deck/keys';
import { WaveLane } from '@/ui/deck/WaveLane';
import { ChannelFader } from '@/ui/mixer/ChannelFader';
import { ChannelStrip } from '@/ui/mixer/ChannelStrip';
import { Crossfader } from '@/ui/mixer/Crossfader';
import { MixerUnit } from '@/ui/mixer/MixerUnit';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './Booth.module.css';
import { useIsDesktop } from './use-desktop';

/**
 * The instrument itself: decks on either side, the mixer between and below
 * them. On a desk-sized screen Mix and Pro are laid out as a DJ set-up: a
 * close-up waveform for every deck across the top, and the mixer as one unit
 * standing between the decks.
 */
export function Booth({ mode }: { mode: ModeDefinition }) {
  const engine = useBooth((state) => state.engine);
  const engineFailed = useBooth((state) => state.engineFailed);
  const crossfader = useBooth((state) => state.crossfader);
  const setCrossfader = useBooth((state) => state.setCrossfader);

  const decks = DECK_IDS.slice(0, mode.deckCount);
  const left = decks.filter((deck) => defaultCrossfaderSide(deck) === 'a');
  const right = decks.filter((deck) => defaultCrossfaderSide(deck) === 'b');
  // Channel strips run in the order the decks sit on a wide screen: outer, inner | inner, outer.
  // The close-up waveforms are stacked in the same order, which keeps A and B next to each other.
  const strips = [...left].reverse().concat(right);

  const readMaster = useCallback(() => engine?.mixer.masterLevel() ?? 0, [engine]);

  const fitToMode = useBooth((state) => state.fitToMode);
  const showsChannelFaders = mode.id !== 'play';
  useEffect(() => {
    fitToMode(mode.deckCount, showsChannelFaders);
  }, [fitToMode, mode.deckCount, showsChannelFaders, engine]);

  // Play is the same simple instrument at every size; only its stylesheet knows about desks.
  const desk = useIsDesktop() && showsChannelFaders;
  const deckLayout = desk ? (mode.deckCount > 2 ? 'narrow' : 'wide') : undefined;

  // The deck the space bar plays: whichever was touched or keyed last. Nothing on screen
  // shows it, so it is not state.
  const lastDeck = useRef<DeckId>('A');
  const touch = useCallback((deck: DeckId) => {
    lastDeck.current = deck;
  }, []);
  useBoothKeys(mode.deckCount, lastDeck);

  if (engineFailed) {
    return (
      <section className={styles.unavailable} role="alert">
        <h2>The decks cannot start in this browser</h2>
        <p>Try a current version of Chrome, Edge, Safari or Firefox.</p>
      </section>
    );
  }

  return (
    <section
      className={styles.booth}
      data-mode={mode.id}
      data-desk={desk || undefined}
      aria-label="Booth"
    >
      {desk && (
        <div className={styles.lanes} role="group" aria-label="Waveforms">
          {strips.map((deck) => (
            <BoothLane key={deck} deck={deck} onTouch={touch} />
          ))}
        </div>
      )}

      <div className={`${styles.side} ${styles.left}`}>
        {left.map((deck) => (
          <BoothDeck
            key={deck}
            deck={deck}
            canRewind={mode.id !== 'play'}
            desk={deckLayout}
            onTouch={touch}
          />
        ))}
      </div>

      {desk ? (
        <div className={styles.console}>
          <MixerUnit
            crossfader={crossfader}
            onCrossfader={setCrossfader}
            left={left}
            right={right}
            readMaster={readMaster}
          >
            {strips.map((deck) => (
              <BoothChannel key={deck} deck={deck} desk onTouch={touch} />
            ))}
          </MixerUnit>
        </div>
      ) : (
        showsChannelFaders && (
          <div className={styles.strips} role="group" aria-label="Channel faders">
            {strips.map((deck) => (
              <BoothChannel key={deck} deck={deck} onTouch={touch} />
            ))}
          </div>
        )
      )}

      <div className={`${styles.side} ${styles.right}`}>
        {right.map((deck) => (
          <BoothDeck
            key={deck}
            deck={deck}
            canRewind={mode.id !== 'play'}
            desk={deckLayout}
            onTouch={touch}
          />
        ))}
      </div>

      {!desk && (
        <div className={styles.mixer}>
          <div className={styles.master}>
            <LevelMeter read={readMaster} label="Master level" orientation="horizontal" />
          </div>
          <Crossfader value={crossfader} onChange={setCrossfader} left={left} right={right} />
        </div>
      )}

      <BoothPicker />
    </section>
  );
}

/**
 * The booth's keyboard (the keys and their rules are in ui/deck/keys). One
 * listener on the window for as long as the booth is on screen, so the keys
 * work wherever the focus happens to be.
 */
function useBoothKeys(deckCount: number, lastDeck: RefObject<DeckId>) {
  useEffect(() => {
    /** The space bar went down as one of ours, so its coming up is ours too. */
    let spaceTaken = false;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return; // a control has already used this key
      const focused = document.activeElement;
      const action = boothKeyAction(
        {
          key: event.key,
          code: event.code,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          repeat: event.repeat,
          composing: event.isComposing,
        },
        {
          deckCount,
          lastDeck: lastDeck.current,
          focus: keyFocus(
            focused && {
              tagName: focused.tagName,
              type: focused.getAttribute('type'),
              role: focused.getAttribute('role'),
              editable: focused instanceof HTMLElement && focused.isContentEditable,
            },
          ),
          dialogOpen: document.querySelector('dialog[open]') !== null,
        },
      );
      if (!action) return;

      // The key is ours: it must not also press whichever button has the focus.
      event.preventDefault();
      if (isSpaceBar(event)) spaceTaken = true;

      const booth = useBooth.getState();
      switch (action.type) {
        case 'play':
          lastDeck.current = action.deck;
          // On an empty deck this opens the song picker, as the play button does.
          booth.togglePlay(action.deck);
          break;
        case 'start':
          lastDeck.current = action.deck;
          booth.backToStart(action.deck);
          break;
        case 'crossfade':
          booth.setCrossfader(nudgedCrossfader(booth.crossfader, action.direction));
          break;
        case 'none':
          break;
      }
    };

    // Some browsers press a focused button when the space bar comes up, whatever was done
    // about it on the way down.
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceBar(event)) return;
      if (spaceTaken) event.preventDefault();
      spaceTaken = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [deckCount, lastDeck]);
}

function isSpaceBar(event: KeyboardEvent): boolean {
  return event.code === 'Space' || event.key === ' ';
}

/**
 * How present a deck is in the mix: both sides are at full colour with the crossfader
 * centred (each gain is 1/√2 there) and fade beyond it, or as the deck's own fader comes down.
 */
function presenceInMix(deck: DeckId, crossfader: number, channelFader: number): number {
  const side = crossfaderGains(crossfader)[defaultCrossfaderSide(deck)];
  return Math.min(1, side * Math.SQRT2) * channelFader;
}

interface BoothDeckProps {
  deck: DeckId;
  canRewind: boolean;
  desk: 'narrow' | 'wide' | undefined;
  onTouch: (deck: DeckId) => void;
}

/** One deck, connected to the engine and the store. */
function BoothDeck({ deck, canRewind, desk, onTouch }: BoothDeckProps) {
  const engine = useBooth((state) => state.engine);
  const track = useBooth((state) => state.tracks[deck]);
  const loading = useBooth((state) => state.loading[deck] !== null);
  const playing = useBooth((state) => state.playing[deck]);
  const presence = useBooth((state) =>
    presenceInMix(deck, state.crossfader, state.channelFaders[deck]),
  );
  const togglePlay = useBooth((state) => state.togglePlay);
  const backToStart = useBooth((state) => state.backToStart);
  const peaks = useBooth((state) => state.peaks[deck]);
  const seek = useBooth((state) => state.seek);
  const openPicker = useBooth((state) => state.openPicker);
  const dropOnDeck = useBooth((state) => state.dropOnDeck);

  return (
    <DeckUnit
      deck={deck}
      control={engine ? engine.deck(deck) : null}
      track={track}
      loading={loading}
      playing={playing}
      presence={presence}
      onTogglePlay={() => togglePlay(deck)}
      onBackToStart={canRewind ? () => backToStart(deck) : undefined}
      onChooseTrack={() => openPicker(deck)}
      peaks={peaks}
      onSeek={(positionSec) => seek(deck, positionSec)}
      onDropData={(data) => void dropOnDeck(deck, data)}
      desk={desk}
      onTouch={() => onTouch(deck)}
    />
  );
}

/** One deck's close-up waveform, connected to the engine and the store. */
function BoothLane({ deck, onTouch }: { deck: DeckId; onTouch: (deck: DeckId) => void }) {
  const engine = useBooth((state) => state.engine);
  const track = useBooth((state) => state.tracks[deck]);
  const loading = useBooth((state) => state.loading[deck] !== null);
  const detail = useBooth((state) => state.detail[deck]);
  const looping = useBooth((state) => state.looping[deck]);
  const playing = useBooth((state) => state.playing[deck]);
  const presence = useBooth((state) =>
    presenceInMix(deck, state.crossfader, state.channelFaders[deck]),
  );
  const seek = useBooth((state) => state.seek);

  // As on the deck itself: while a new song is loading there is nothing to show yet.
  const shown = engine !== null && track !== null && !loading;

  return (
    <WaveLane
      deck={deck}
      control={shown ? engine.deck(deck) : null}
      detail={shown ? detail : null}
      loop={looping}
      title={shown ? track.title : null}
      playing={playing}
      presence={presence}
      onSeek={(positionSec) => seek(deck, positionSec)}
      onTouch={() => onTouch(deck)}
    />
  );
}

interface BoothChannelProps {
  deck: DeckId;
  /** Part of the mixer unit on a desk-sized screen, where the unit decides its height. */
  desk?: boolean;
  onTouch: (deck: DeckId) => void;
}

/** One mixer channel: its level and its fader. */
function BoothChannel({ deck, desk = false, onTouch }: BoothChannelProps) {
  const engine = useBooth((state) => state.engine);
  const value = useBooth((state) => state.channelFaders[deck]);
  const setChannelFader = useBooth((state) => state.setChannelFader);
  const read = useCallback(() => engine?.mixer.channelLevel(deck) ?? 0, [engine, deck]);
  const onChange = (next: number) => setChannelFader(deck, next);
  const touched = () => onTouch(deck);

  if (desk) {
    return (
      <ChannelStrip
        deck={deck}
        value={value}
        onChange={onChange}
        readLevel={read}
        onTouch={touched}
      />
    );
  }

  return (
    <div
      className={styles.strip}
      style={deckStyle(deck)}
      onPointerDownCapture={touched}
      onKeyDownCapture={touched}
    >
      <LevelMeter read={read} label={`Deck ${deck} level`} />
      <ChannelFader deck={deck} value={value} onChange={onChange} />
    </div>
  );
}

function BoothPicker() {
  const pickerDeck = useBooth((state) => state.pickerDeck);
  const busy = useBooth((state) => (state.pickerDeck ? state.loading[state.pickerDeck] : null));
  const notice = useBooth((state) => (state.noticeDeck === state.pickerDeck ? state.notice : null));
  const myMusic = useBooth((state) => state.myMusic);
  const pickTrack = useBooth((state) => state.pickTrack);
  const addMusic = useBooth((state) => state.addMusic);
  const closePicker = useBooth((state) => state.closePicker);

  const sections = useMemo(
    () => [
      { label: SOURCES.crate.label, tracks: CRATE_TRACKS },
      { label: SOURCES.local.label, tracks: myMusic },
    ],
    [myMusic],
  );

  return (
    <SongPicker
      deck={pickerDeck}
      sections={sections}
      busy={busy}
      error={pickerDeck ? notice : null}
      onPick={(track) => {
        if (pickerDeck) void pickTrack(pickerDeck, track);
      }}
      onAddMusic={() => {
        if (pickerDeck) void addMusic(pickerDeck);
      }}
      onClose={closePicker}
    />
  );
}
