import { create } from 'zustand';
import { BRAND } from '@/config/brand';
import type { AudioEngine } from '@/engine/AudioEngine';
import { STEPS_PER_BAR, type DrumPattern } from '@/engine/sequencer/types';
import {
  defaultProject,
  FACTORY_LOOPS,
  KITS,
  parseProject,
  patternsEqual,
  renderKit,
  serializeProject,
  toggleStep,
  type StudioProject,
} from '@/studio';

const STORAGE_KEY = `${BRAND.storagePrefix}.studio.v1`;
/** Wait for a pause in the edits before writing the beat to the device. */
const SAVE_DELAY_MS = 400;
/** How hard a recorded hit lands in the loop. */
const RECORDED_VELOCITY = 0.9;

function loadProject(): StudioProject {
  try {
    return parseProject(localStorage.getItem(STORAGE_KEY)) ?? defaultProject();
  } catch {
    // Storage can be switched off (private browsing); the beat then simply is not kept.
    return defaultProject();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function saveSoon(project: StudioProject): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeProject(project));
    } catch {
      // Nothing to do: see loadProject.
    }
  }, SAVE_DELAY_MS);
}

interface StudioState {
  /** The beat: kit, tempo, swing and the eight loops. Kept on the device between visits. */
  project: StudioProject;
  /** The kit's sounds are on the pads. */
  kitReady: boolean;
  playing: boolean;
  recording: boolean;
  /** A loop waiting for the next bar line. */
  queuedSlot: number | null;
  /** The pad whose steps are shown for editing. */
  selectedPad: number;
  /** Which bar of the loop the step editor shows. */
  bar: number;

  /** Connect to the audio engine once it exists: load the kit and hand over the beat. */
  attach: (engine: AudioEngine) => void;
  hitPad: (pad: number) => void;
  togglePlay: () => void;
  /** Stop the loop. Used when the Studio leaves the screen. */
  stop: () => void;
  toggleRecord: () => void;
  selectSlot: (slot: number) => void;
  /** Toggle a step of the selected pad in the bar being shown. */
  toggleStep: (step: number) => void;
  setBar: (bar: number) => void;
  setTempo: (bpm: number) => void;
  setSwing: (swing: number) => void;
  pickKit: (kitId: string) => void;
  /** Put the current loop back the way it shipped. */
  resetLoop: () => void;
}

let engine: AudioEngine | null = null;

/**
 * The Studio at human speed. The sequencer in the engine keeps the beat; this
 * store holds the beat's data, mirrors what the screen needs, and saves it.
 */
export const useStudio = create<StudioState>()((set, get) => {
  const activePattern = (project: StudioProject): DrumPattern =>
    project.slots[project.activeSlot] ?? defaultProject().slots[0]!;

  /** Change the project, keep it saved. */
  const update = (change: Partial<StudioProject>): StudioProject => {
    const project = { ...get().project, ...change };
    set({ project });
    saveSoon(project);
    return project;
  };

  /** Replace the loop in the active slot and let the sequencer carry on with it. */
  const replaceActiveLoop = (pattern: DrumPattern): void => {
    const { project } = get();
    const slots = project.slots.map((slot, index) =>
      index === project.activeSlot ? pattern : slot,
    );
    update({ slots });
    engine?.sequencer.setPattern(pattern, 'now');
  };

  const loadKit = (kitId: string): void => {
    if (!engine) return;
    const kit = KITS.some((known) => known.id === kitId) ? kitId : KITS[0]!.id;
    renderKit(kit, engine.context.sampleRate).forEach((sound, pad) => {
      engine?.pads.setSound(pad, sound);
    });
    set({ kitReady: true });
  };

  return {
    project: loadProject(),
    kitReady: false,
    playing: false,
    recording: false,
    queuedSlot: null,
    selectedPad: 0,
    bar: 0,

    attach(nextEngine) {
      if (engine === nextEngine) return;
      engine = nextEngine;
      const { project } = get();

      engine.sequencer.setTempo(project.bpm);
      engine.sequencer.setSwing(project.swing);
      engine.sequencer.setPattern(activePattern(project), 'now');
      // A queued loop becomes the current one when its bar line arrives.
      engine.sequencer.onBar = () => {
        const { queuedSlot } = get();
        if (queuedSlot === null || engine?.sequencer.changePending) return;
        update({ activeSlot: queuedSlot });
        set({ queuedSlot: null, bar: 0 });
      };
      loadKit(project.kitId);
    },

    hitPad(pad) {
      if (!engine) return;
      void engine.resume();
      engine.pads.trigger(pad);
      set({ selectedPad: pad });

      const { recording, playing } = get();
      if (!recording || !playing) return;
      const recorded = engine.sequencer.recordHit(pad, RECORDED_VELOCITY);
      if (recorded) {
        const { project } = get();
        update({
          slots: project.slots.map((slot, index) =>
            index === project.activeSlot ? recorded : slot,
          ),
        });
      }
    },

    togglePlay() {
      if (!engine) return;
      if (get().playing) {
        get().stop();
        return;
      }
      void engine.resume();
      engine.sequencer.setPattern(activePattern(get().project), 'now');
      engine.sequencer.start();
      set({ playing: true });
    },

    stop() {
      engine?.sequencer.stop();
      set({ playing: false, recording: false, queuedSlot: null });
    },

    toggleRecord() {
      set((state) => ({ recording: !state.recording }));
    },

    selectSlot(slot) {
      const { project, playing, queuedSlot } = get();
      const pattern = project.slots[slot];
      if (!engine || !pattern) return;

      if (!playing) {
        update({ activeSlot: slot });
        set({ bar: 0 });
        engine.sequencer.setPattern(pattern, 'now');
        return;
      }
      // Tapping the loop that is already playing cancels a change that was waiting.
      if (slot === project.activeSlot) {
        if (queuedSlot !== null) {
          engine.sequencer.setPattern(activePattern(project), 'now');
          set({ queuedSlot: null });
        }
        return;
      }
      // While playing, a new loop comes in on the bar line so it lands in time.
      engine.sequencer.setPattern(pattern, 'next-bar');
      set({ queuedSlot: slot });
    },

    toggleStep(step) {
      const { project, selectedPad, bar } = get();
      replaceActiveLoop(
        toggleStep(activePattern(project), selectedPad, bar * STEPS_PER_BAR + step),
      );
    },

    setBar(bar) {
      set({ bar });
    },

    setTempo(bpm) {
      engine?.sequencer.setTempo(bpm);
      update({ bpm: engine?.sequencer.bpm ?? bpm });
    },

    setSwing(swing) {
      engine?.sequencer.setSwing(swing);
      update({ swing: engine?.sequencer.swing ?? swing });
    },

    pickKit(kitId) {
      update({ kitId });
      loadKit(kitId);
    },

    resetLoop() {
      const factory = FACTORY_LOOPS[get().project.activeSlot];
      if (factory) replaceActiveLoop(factory.pattern);
    },
  };
});

/** Whether a slot's loop has been changed from the one it shipped with. */
export function isLoopEdited(project: StudioProject, slot: number): boolean {
  const factory = FACTORY_LOOPS[slot];
  const current = project.slots[slot];
  return !factory || !current || !patternsEqual(factory.pattern, current);
}
