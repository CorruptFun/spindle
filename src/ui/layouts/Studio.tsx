import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { KitPicker } from '@/ui/studio/KitPicker';
import { LayerStrip } from '@/ui/studio/LayerStrip';
import { LoopSlots } from '@/ui/studio/LoopSlots';
import { PadGrid } from '@/ui/studio/PadGrid';
import { SongSheet } from '@/ui/studio/SongSheet';
import { StepRow } from '@/ui/studio/StepRow';
import { TransportBar } from '@/ui/studio/TransportBar';
import styles from './Studio.module.css';

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

/** The drum machine: a kit, eight loops, eight pads, four layers, and the transport. */
export function Studio({ mode }: { mode: ModeDefinition }) {
  const features = STUDIO_MODES[mode.id];
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

  const readGlow = useCallback((pad: number) => engine?.pads.glow(pad) ?? 0, [engine]);
  const readStep = useCallback(() => engine?.sequencer.stepPosition() ?? -1, [engine]);
  const readLevel = useCallback(() => engine?.mixer.padsLevel() ?? 0, [engine]);

  if (engineFailed) {
    return (
      <section className={styles.unavailable} role="alert">
        <h2>The Studio cannot start in this browser</h2>
        <p>Try a current version of Chrome, Edge, Safari or Firefox.</p>
      </section>
    );
  }
  if (!kit || !loop) return null;

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
  const chosenLayer = layers[selectedLayer];

  return (
    <section className={styles.studio} data-mode={mode.id} aria-label="Studio">
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

      <div className={styles.pads}>
        <PadGrid
          pads={kit.pads}
          readGlow={readGlow}
          onHit={hitPad}
          running={playing}
          selected={features.stepEditor ? selectedPad : null}
          showNames={features.names}
        />
      </div>

      {features.stepEditor && editedPad && (
        <div className={styles.steps}>
          <StepRow
            pad={editedPad}
            steps={steps}
            otherSteps={otherSteps}
            headerSlot={
              features.layers ? (
                <LayerStrip
                  layers={layers}
                  selected={selectedLayer}
                  recording={recording}
                  canClear={chosenLayer !== undefined && !chosenLayer.empty}
                  onSelect={selectLayer}
                  onClear={clearLayer}
                />
              ) : undefined
            }
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
        <TransportBar
          playing={playing}
          recording={recording}
          bpm={project.bpm}
          swing={project.swing}
          showRecord={features.record}
          showTempo={features.tempo}
          showSwing={features.swing}
          showLoopTools={features.stepEditor}
          showSong={features.song}
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
