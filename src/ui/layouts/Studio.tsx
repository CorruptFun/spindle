import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModeDefinition } from '@/config/modes';
import { STUDIO_MODES } from '@/config/studio';
import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import { useBooth } from '@/state/booth';
import { canUndoLoop, isLoopEdited, useStudio } from '@/state/studio';
import {
  FACTORY_LOOPS,
  isLayerEmpty,
  isLoopEmpty,
  KITS,
  layerFamilies,
  mixLoop,
  otherLayersLane,
  type DrumPattern,
  type StudioLoop,
} from '@/studio';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { BeatGrid } from '@/ui/studio/BeatGrid';
import { PAD_KEYS } from '@/ui/studio/keys';
import { KitPicker } from '@/ui/studio/KitPicker';
import { LayerStrip } from '@/ui/studio/LayerStrip';
import { LoopSlots } from '@/ui/studio/LoopSlots';
import { PadGrid, type PadGridHandle } from '@/ui/studio/PadGrid';
import { SongSheet } from '@/ui/studio/SongSheet';
import { SongStrip } from '@/ui/studio/SongStrip';
import { StepRow } from '@/ui/studio/StepRow';
import { TransportBar } from '@/ui/studio/TransportBar';
import { useStudioKeys } from '@/ui/studio/use-studio-keys';
import { Workstation } from '@/ui/studio/Workstation';
import styles from './Studio.module.css';
import { useIsDesktop } from './use-desktop';

/**
 * Mixes, kept per loop. Loops are never changed in place, so a loop that has
 * not changed keeps the same mix, and its tile's picture is not drawn again.
 */
const mixes = new WeakMap<StudioLoop, DrumPattern>();

function mixOf(loop: StudioLoop): DrumPattern {
  let mix = mixes.get(loop);
  if (!mix) {
    mix = mixLoop(loop);
    mixes.set(loop, mix);
  }
  return mix;
}

/**
 * The drum machine: a kit, eight loops, eight pads, four layers, and the
 * transport. On a desk-sized screen Mix and Pro lay the same parts out as a
 * small workstation, with the whole beat as a grid and the song on screen.
 */
export function Studio({ mode }: { mode: ModeDefinition }) {
  const features = STUDIO_MODES[mode.id];
  const desktop = useIsDesktop();
  // The workstation is for the modes that edit steps. Play stays the instrument it is.
  const desk = desktop && features.stepEditor;
  const engine = useBooth((state) => state.engine);
  const engineFailed = useBooth((state) => state.engineFailed);

  const project = useStudio((state) => state.project);
  const kitReady = useStudio((state) => state.kitReady);
  const playing = useStudio((state) => state.playing);
  const recording = useStudio((state) => state.recording);
  const queuedSlot = useStudio((state) => state.queuedSlot);
  const selectedPad = useStudio((state) => state.selectedPad);
  const selectedLayer = useStudio((state) => state.selectedLayer);
  const bar = useStudio((state) => state.bar);
  const undo = useStudio((state) => state.undo);
  const songPlaying = useStudio((state) => state.songPlaying);
  const songPosition = useStudio((state) => state.songPosition);

  const hitPad = useStudio((state) => state.hitPad);
  const togglePlay = useStudio((state) => state.togglePlay);
  const toggleRecord = useStudio((state) => state.toggleRecord);
  const selectSlot = useStudio((state) => state.selectSlot);
  const selectLayer = useStudio((state) => state.selectLayer);
  const clearLayer = useStudio((state) => state.clearLayer);
  const toggleStep = useStudio((state) => state.toggleStep);
  const toggleStepAt = useStudio((state) => state.toggleStepAt);
  const setBar = useStudio((state) => state.setBar);
  const setTempo = useStudio((state) => state.setTempo);
  const setSwing = useStudio((state) => state.setSwing);
  const pickKit = useStudio((state) => state.pickKit);
  const resetLoop = useStudio((state) => state.resetLoop);
  const clearLoop = useStudio((state) => state.clearLoop);
  const undoLoop = useStudio((state) => state.undoLoop);
  const stopRecording = useStudio((state) => state.stopRecording);
  const addToSong = useStudio((state) => state.addToSong);
  const removeFromSong = useStudio((state) => state.removeFromSong);
  const clearSong = useStudio((state) => state.clearSong);
  const toggleSong = useStudio((state) => state.toggleSong);

  const [songOpen, setSongOpen] = useState(false);
  const openSong = useCallback(() => setSongOpen(true), []);
  const closeSong = useCallback(() => setSongOpen(false), []);

  // Recording must never stay on in a mode that shows no record button.
  useEffect(() => {
    if (!features.record) stopRecording();
  }, [features.record, stopRecording]);

  // At the desk the song is on screen. A sheet left open must not come back when the window shrinks.
  useEffect(() => {
    if (desk) setSongOpen(false);
  }, [desk]);

  const kit = KITS.find((known) => known.id === project.kitId) ?? KITS[0];
  const loop = project.slots[project.activeSlot];

  // Each tile pictures what its loop plays: the mix of its layers that are on.
  const slots = useMemo(
    () =>
      project.slots.map((slot, index) => ({
        name: FACTORY_LOOPS[index]?.name ?? `Loop ${index + 1}`,
        pattern: mixOf(slot),
        edited: isLoopEdited(project, index),
      })),
    [project],
  );

  const layers = useMemo(
    () =>
      (loop?.layers ?? []).map((layer) => ({
        empty: isLayerEmpty(layer),
        muted: layer.muted,
        families: layerFamilies(layer),
      })),
    [loop],
  );

  // For the grid of the whole beat: every pad's lane as the layers that are not chosen play it.
  const otherLanes = useMemo(
    () =>
      desk && loop
        ? (loop.layers[selectedLayer]?.pattern.lanes ?? []).map((_, pad) =>
            otherLayersLane(loop, selectedLayer, pad),
          )
        : [],
    [desk, loop, selectedLayer],
  );

  const readGlow = useCallback((pad: number) => engine?.pads.glow(pad) ?? 0, [engine]);
  const readStep = useCallback(() => engine?.sequencer.stepPosition() ?? -1, [engine]);
  const readLevel = useCallback(() => engine?.mixer.padsLevel() ?? 0, [engine]);

  // Hits that do not start on a pad (a key on the keyboard, a row's name in the grid) still go
  // through the pads, so the pad lights and goes down as if it had been touched.
  const pads = useRef<PadGridHandle>(null);
  const playPad = useCallback(
    (pad: number) => {
      if (pads.current) pads.current.hit(pad);
      else hitPad(pad);
    },
    [hitPad],
  );

  useStudioKeys(!engineFailed, {
    features: { record: features.record, layers: features.layers, undo: features.stepEditor },
    onPlay: togglePlay,
    onRecord: toggleRecord,
    // Only when the Undo cap would do something: Undo also leaves the song.
    onUndo: () => {
      if (canUndoLoop(undo, project)) undoLoop();
    },
    onLayer: selectLayer,
    onPadDown: (pad) => {
      if (pads.current) pads.current.press(pad);
      else hitPad(pad);
    },
    onPadUp: (pad) => pads.current?.release(pad),
  });

  if (engineFailed) {
    return (
      <section className={styles.unavailable} role="alert">
        <h2>The Studio cannot start in this browser</h2>
        <p>Try a current version of Chrome, Edge, Safari or Firefox.</p>
      </section>
    );
  }
  if (!kit || !loop) return null;

  const chosenLayer = layers[selectedLayer];

  const shelf = (
    <div className={styles.shelf}>
      <KitPicker
        kits={KITS}
        active={kit.id}
        busy={!kitReady}
        showNames={features.names}
        onPick={pickKit}
      />
      <LoopSlots
        slots={slots}
        active={project.activeSlot}
        queued={queuedSlot}
        playing={playing}
        showNames={features.names}
        onSelect={selectSlot}
      />
    </div>
  );

  const layerKeys = features.layers ? (
    <LayerStrip
      layers={layers}
      selected={selectedLayer}
      recording={recording}
      canClear={chosenLayer !== undefined && !chosenLayer.empty}
      onSelect={selectLayer}
      onClear={clearLayer}
    />
  ) : undefined;

  /** The transport, with or without the cap that opens the song sheet. */
  const transport = (showSong: boolean) => (
    <TransportBar
      playing={playing}
      recording={recording}
      bpm={project.bpm}
      swing={project.swing}
      showRecord={features.record}
      showTempo={features.tempo}
      showSwing={features.swing}
      showLoopTools={features.stepEditor}
      showSong={showSong}
      songPlaying={songPlaying}
      canUndo={canUndoLoop(undo, project)}
      canClear={!isLoopEmpty(loop)}
      canReset={isLoopEdited(project, project.activeSlot)}
      onTogglePlay={togglePlay}
      onToggleRecord={toggleRecord}
      onTempoChange={setTempo}
      onSwingChange={setSwing}
      onUndo={undoLoop}
      onClear={clearLoop}
      onReset={resetLoop}
      onSong={openSong}
    />
  );

  if (desk) {
    return (
      <section className={styles.studio} data-mode={mode.id} data-desk="true" aria-label="Studio">
        <Workstation
          shelf={shelf}
          song={
            features.song ? (
              // The song's tiles share the loop tiles' cached mixes.
              <SongStrip
                loops={slots}
                song={project.song}
                position={songPosition}
                playing={songPlaying}
                current={project.activeSlot}
                onAdd={addToSong}
                onRemove={removeFromSong}
                onClear={clearSong}
                onTogglePlay={toggleSong}
              />
            ) : undefined
          }
          beat={
            <BeatGrid
              pads={kit.pads}
              lanes={loop.layers[selectedLayer]?.pattern.lanes ?? []}
              otherLanes={otherLanes}
              bars={loop.bars}
              bar={bar}
              onBarChange={setBar}
              selected={selectedPad}
              headerSlot={layerKeys}
              readStep={readStep}
              running={playing}
              onHit={playPad}
              onToggle={toggleStepAt}
            />
          }
          pads={
            <PadGrid
              ref={pads}
              pads={kit.pads}
              readGlow={readGlow}
              onHit={hitPad}
              running={playing}
              selected={selectedPad}
              showNames={features.names}
              compact
              keyCaps={PAD_KEYS}
            />
          }
          // The song is on screen here, so the transport needs no way to it.
          transport={transport(false)}
          meter={<LevelMeter read={readLevel} label="Drums level" />}
        />
      </section>
    );
  }

  // A one-bar loop has no second bar to show.
  const shownBar = Math.min(bar, loop.bars - 1);
  const editedPad = kit.pads[selectedPad];
  const from = shownBar * STEPS_PER_BAR;
  // The keys show the chosen layer; what the other layers play on this pad is outlined.
  const steps = (loop.layers[selectedLayer]?.pattern.lanes[selectedPad] ?? []).slice(
    from,
    from + STEPS_PER_BAR,
  );
  const otherSteps = otherLayersLane(loop, selectedLayer, selectedPad).slice(
    from,
    from + STEPS_PER_BAR,
  );

  return (
    <section className={styles.studio} data-mode={mode.id} aria-label="Studio">
      {shelf}

      <div className={styles.pads}>
        <PadGrid
          ref={pads}
          pads={kit.pads}
          readGlow={readGlow}
          onHit={hitPad}
          running={playing}
          selected={features.stepEditor ? selectedPad : null}
          showNames={features.names}
          // Only a desk-sized screen is likely to have a keyboard in front of it.
          keyCaps={desktop ? PAD_KEYS : undefined}
        />
      </div>

      {features.stepEditor && editedPad && (
        <div className={styles.steps}>
          <StepRow
            pad={editedPad}
            steps={steps}
            otherSteps={otherSteps}
            headerSlot={layerKeys}
            bar={shownBar}
            bars={loop.bars}
            onBarChange={setBar}
            readStep={readStep}
            running={playing}
            onToggle={toggleStep}
          />
        </div>
      )}

      <div className={styles.transport}>
        {transport(features.song)}
        <div className={styles.meter}>
          <LevelMeter read={readLevel} label="Drums level" orientation="horizontal" />
        </div>
      </div>

      {features.song && (
        // The song's tiles share the loop tiles' cached mixes.
        <SongSheet
          open={songOpen}
          onClose={closeSong}
          loops={slots}
          song={project.song}
          position={songPosition}
          playing={songPlaying}
          onAdd={addToSong}
          onRemove={removeFromSong}
          onClear={clearSong}
          onTogglePlay={toggleSong}
        />
      )}
    </section>
  );
}
