import { useCallback, useEffect, useMemo } from 'react';
import type { ModeDefinition } from '@/config/modes';
import { DECK_IDS, type DeckId } from '@/engine/core/types';
import { crossfaderGains, defaultCrossfaderSide } from '@/engine/mixer/crossfader';
import { CRATE_TRACKS } from '@/sources/crate';
import { SOURCES } from '@/sources/registry';
import { useBooth } from '@/state/booth';
import { SongPicker } from '@/ui/browser/SongPicker';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { DeckUnit } from '@/ui/deck/DeckUnit';
import { ChannelFader } from '@/ui/mixer/ChannelFader';
import { Crossfader } from '@/ui/mixer/Crossfader';
import { deckStyle } from '@/ui/theme/deck-colors';
import styles from './Booth.module.css';

/** The instrument itself: decks on either side, the mixer between and below them. */
export function Booth({ mode }: { mode: ModeDefinition }) {
  const engine = useBooth((state) => state.engine);
  const engineFailed = useBooth((state) => state.engineFailed);
  const crossfader = useBooth((state) => state.crossfader);
  const setCrossfader = useBooth((state) => state.setCrossfader);

  const decks = DECK_IDS.slice(0, mode.deckCount);
  const left = decks.filter((deck) => defaultCrossfaderSide(deck) === 'a');
  const right = decks.filter((deck) => defaultCrossfaderSide(deck) === 'b');
  // Channel strips run in the order the decks sit on a wide screen: outer, inner | inner, outer.
  const strips = [...left].reverse().concat(right);

  const readMaster = useCallback(() => engine?.mixer.masterLevel() ?? 0, [engine]);

  const fitToMode = useBooth((state) => state.fitToMode);
  const showsChannelFaders = mode.id !== 'play';
  useEffect(() => {
    fitToMode(mode.deckCount, showsChannelFaders);
  }, [fitToMode, mode.deckCount, showsChannelFaders, engine]);

  if (engineFailed) {
    return (
      <section className={styles.unavailable} role="alert">
        <h2>The decks cannot start in this browser</h2>
        <p>Try a current version of Chrome, Edge, Safari or Firefox.</p>
      </section>
    );
  }

  return (
    <section className={styles.booth} data-mode={mode.id} aria-label="Booth">
      <div className={`${styles.side} ${styles.left}`}>
        {left.map((deck) => (
          <BoothDeck key={deck} deck={deck} canRewind={mode.id !== 'play'} />
        ))}
      </div>

      {showsChannelFaders && (
        <div className={styles.strips} role="group" aria-label="Channel faders">
          {strips.map((deck) => (
            <ChannelStrip key={deck} deck={deck} />
          ))}
        </div>
      )}

      <div className={`${styles.side} ${styles.right}`}>
        {right.map((deck) => (
          <BoothDeck key={deck} deck={deck} canRewind={mode.id !== 'play'} />
        ))}
      </div>

      <div className={styles.mixer}>
        <div className={styles.master}>
          <LevelMeter read={readMaster} label="Master level" orientation="horizontal" />
        </div>
        <Crossfader value={crossfader} onChange={setCrossfader} left={left} right={right} />
      </div>

      <BoothPicker />
    </section>
  );
}

/** One deck, connected to the engine and the store. */
function BoothDeck({ deck, canRewind }: { deck: DeckId; canRewind: boolean }) {
  const engine = useBooth((state) => state.engine);
  const track = useBooth((state) => state.tracks[deck]);
  const loading = useBooth((state) => state.loading[deck] !== null);
  const playing = useBooth((state) => state.playing[deck]);
  // How present the deck is in the mix: both decks are at full colour with the crossfader
  // centred (each gain is 1/√2 there) and fade beyond it, or as their own fader comes down.
  const presence = useBooth(
    (state) =>
      Math.min(1, crossfaderGains(state.crossfader)[defaultCrossfaderSide(deck)] * Math.SQRT2) *
      state.channelFaders[deck],
  );
  const togglePlay = useBooth((state) => state.togglePlay);
  const backToStart = useBooth((state) => state.backToStart);
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
      onDropData={(data) => void dropOnDeck(deck, data)}
    />
  );
}

/** One mixer channel: its level and its fader. */
function ChannelStrip({ deck }: { deck: DeckId }) {
  const engine = useBooth((state) => state.engine);
  const value = useBooth((state) => state.channelFaders[deck]);
  const setChannelFader = useBooth((state) => state.setChannelFader);
  const read = useCallback(() => engine?.mixer.channelLevel(deck) ?? 0, [engine, deck]);

  return (
    <div className={styles.strip} style={deckStyle(deck)}>
      <LevelMeter read={read} label={`Deck ${deck} level`} />
      <ChannelFader deck={deck} value={value} onChange={(next) => setChannelFader(deck, next)} />
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
