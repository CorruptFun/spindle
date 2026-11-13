import { useCallback, useEffect, useMemo } from 'react';
import type { ModeDefinition } from '@/config/modes';
import { STUDIO_MODES } from '@/config/studio';
import { STEPS_PER_BAR } from '@/engine/sequencer/types';
import { useBooth } from '@/state/booth';
import { canUndoLoop, isLoopEdited, useStudio } from '@/state/studio';
import { FACTORY_LOOPS, isEmptyPattern, KITS } from '@/studio';
import { LevelMeter } from '@/ui/components/LevelMeter';
import { KitPicker } from '@/ui/studio/KitPicker';
import { LoopSlots } from '@/ui/studio/LoopSlots';
import { PadGrid } from '@/ui/studio/PadGrid';
import { StepRow } from '@/ui/studio/StepRow';
import { TransportBar } from '@/ui/studio/TransportBar';
import styles from './Studio.module.css';

/** The drum machine: a kit, eight loops, eight pads, and the transport. */
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
  const bar = useStudio((state) => state.bar);
  const undo = useStudio((state) => state.undo);

  const hitPad = useStudio((state) => state.hitPad);
  const togglePlay = useStudio((state) => state.togglePlay);
  const toggleRecord = useStudio((state) => state.toggleRecord);
  const selectSlot = useStudio((state) => state.selectSlot);
  const toggleStep = useStudio((state) => state.toggleStep);
  const setBar = useStudio((state) => state.setBar);
  const setTempo = useStudio((state) => state.setTempo);
  const setSwing = useStudio((state) => state.setSwing);
  const pickKit = useStudio((state) => state.pickKit);
  const resetLoop = useStudio((state) => state.resetLoop);
  const clearLoop = useStudio((state) => state.clearLoop);
  const undoLoop = useStudio((state) => state.undoLoop);
  const stopRecording = useStudio((state) => state.stopRecording);

  // Recording must never stay on in a mode that shows no record button.
  useEffect(() => {
    if (!features.record) stopRecording();
  }, [features.record, stopRecording]);

  const kit = KITS.find((known) => known.id === project.kitId) ?? KITS[0];
  const pattern = project.slots[project.activeSlot];

  const slots = useMemo(
    () =>
      project.slots.map((slot, index) => ({
        name: FACTORY_LOOPS[index]?.name ?? `Loop ${index + 1}`,
        pattern: slot,
        edited: isLoopEdited(project, index),
      })),
    [project],
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
  if (!kit || !pattern) return null;

  // A one-bar loop has no second bar to show.
  const shownBar = Math.min(bar, pattern.bars - 1);
  const editedPad = kit.pads[selectedPad];
  const steps = (pattern.lanes[selectedPad] ?? []).slice(
    shownBar * STEPS_PER_BAR,
    (shownBar + 1) * STEPS_PER_BAR,
  );

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
            bar={shownBar}
            bars={pattern.bars}
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
          canUndo={canUndoLoop(undo, project)}
          canClear={!isEmptyPattern(pattern)}
          canReset={isLoopEdited(project, project.activeSlot)}
          onTogglePlay={togglePlay}
          onToggleRecord={toggleRecord}
          onTempoChange={setTempo}
          onSwingChange={setSwing}
          onUndo={undoLoop}
          onClear={clearLoop}
          onReset={resetLoop}
        />
        <div className={styles.meter}>
          <LevelMeter read={readLevel} label="Drums level" orientation="horizontal" />
        </div>
      </div>
    </section>
  );
}
