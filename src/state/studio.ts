import { create } from 'zustand';
import { BRAND } from '@/config/brand';
import type { AudioEngine } from '@/engine/AudioEngine';
import { STEPS_PER_BAR, type DrumPattern } from '@/engine/sequencer/types';
import {
  defaultProject,
  emptyPattern,
  FACTORY_LOOPS,
  isEmptyPattern,
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
/** Where the drums sit in the mix. A busy loop at full level peaks above full scale and would lean on the limiter. */
const PADS_LEVEL = 0.85;
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

/** Write the beat now, without waiting. */
function saveNow(project: StudioProject): void {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(project));
  } catch {
    // Nothing to do: see loadProject.
  }
}

/** A loop as it was at some moment, and which slot it belongs to. */
export interface LoopSnapshot {
  slot: number;
  pattern: DrumPattern;
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
  /**
   * A loop as it was before the last recording, clear or reset, for Undo.
   * Undoing swaps it with the loop as it is, so a second Undo puts the change back.
   */
  undo: LoopSnapshot | null;

  /** Connect to the audio engine once it exists: load the kit and hand over the beat. */
  attach: (engine: AudioEngine) => void;
  hitPad: (pad: number) => void;
  togglePlay: () => void;
  /** Stop the loop. Used when the Studio leaves the screen. */
  stop: () => void;
  toggleRecord: () => void;
  /** Recording off. Used when the record button leaves the screen. */
  stopRecording: () => void;
  selectSlot: (slot: number) => void;
  /** Toggle a step of the selected pad in the bar being shown. */
  toggleStep: (step: number) => void;
  setBar: (bar: number) => void;
  setTempo: (bpm: number) => void;
  setSwing: (swing: number) => void;
  pickKit: (kitId: string) => void;
  /** Put the current loop back the way it shipped. */
  resetLoop: () => void;
  /** Empty the current loop, to build one from nothing. */
  clearLoop: () => void;
  /** Take back the last recording, clear or reset of the current loop; again to put it back. */
  undoLoop: () => void;
}

let engine: AudioEngine | null = null;
/**
 * The slot whose loop has already been kept for Undo during the recording in
 * progress. One recording is one thing to undo, however many hits it has.
 */
let takeSlot: number | null = null;

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
    // Applying an edit drops any change that was waiting for the bar line: queue it again.
    const { queuedSlot } = get();
    const queued = queuedSlot === null ? undefined : slots[queuedSlot];
    if (queued) engine?.sequencer.setPattern(queued, 'next-bar');
  };

  /** Replace the whole loop in the active slot, keeping what was there for Undo. */
  const wipe = (pattern: DrumPattern): void => {
    const { project } = get();
    const slot = project.activeSlot;
    set({ undo: { slot, pattern: activePattern(project) } });
    // Hits recorded after this belong with it: one Undo brings back the loop as it was before.
    takeSlot = get().recording ? slot : null;
    replaceActiveLoop(pattern);
  };

  /** Recording on or off. The click runs with it: an empty loop gives nothing to play along to. */
  const setRecording = (recording: boolean): void => {
    takeSlot = null;
    engine?.sequencer.setClick(recording);
    if (get().recording !== recording) set({ recording });
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
    undo: null,

    attach(nextEngine) {
      if (engine === nextEngine) return;
      engine = nextEngine;
      const { project } = get();

      engine.mixer.setPadsLevel(PADS_LEVEL);
      engine.sequencer.setTempo(project.bpm);
      engine.sequencer.setSwing(project.swing);
      engine.sequencer.setPattern(activePattern(project), 'now');
      engine.sequencer.setClick(get().recording);
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

      const { recording, playing, queuedSlot } = get();
      // While a loop change is waiting, the sequencer may already be on the new loop while
      // this store still points at the old one. A hit then would be written into the wrong
      // loop, so it is played but not recorded.
      if (!recording || !playing || queuedSlot !== null) return;
      const recorded = engine.sequencer.recordHit(pad, RECORDED_VELOCITY);
      if (recorded) {
        const { project } = get();
        const slot = project.activeSlot;
        const before = project.slots[slot];
        // The first hit of a recording: keep the loop as it was, so Undo takes the whole recording back.
        if (takeSlot !== slot && before) {
          takeSlot = slot;
          set({ undo: { slot, pattern: before } });
        }
        update({
          slots: project.slots.map((kept, index) => (index === slot ? recorded : kept)),
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
      setRecording(false);
      set({ playing: false, queuedSlot: null });
    },

    toggleRecord() {
      const recording = !get().recording;
      setRecording(recording);
      // Nothing can be recorded into a loop that is not running, so Record starts it.
      if (recording && !get().playing) get().togglePlay();
    },

    stopRecording() {
      if (get().recording) setRecording(false);
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
      const { project } = get();
      const factory = FACTORY_LOOPS[project.activeSlot];
      if (factory && isLoopEdited(project, project.activeSlot)) wipe(factory.pattern);
    },

    clearLoop() {
      const current = activePattern(get().project);
      if (!isEmptyPattern(current)) wipe(emptyPattern(current.bars));
    },

    undoLoop() {
      const { undo, project } = get();
      if (!undo || undo.slot !== project.activeSlot) return;
      set({ undo: { slot: undo.slot, pattern: activePattern(project) } });
      // Whatever is recorded next is a new recording, with its own Undo.
      takeSlot = null;
      replaceActiveLoop(undo.pattern);
    },
  };
});

/** Whether Undo has something to take back in the loop on screen. */
export function canUndoLoop(undo: LoopSnapshot | null, project: StudioProject): boolean {
  return undo !== null && undo.slot === project.activeSlot;
}

/** Whether a slot's loop has been changed from the one it shipped with. */
export function isLoopEdited(project: StudioProject, slot: number): boolean {
  const factory = FACTORY_LOOPS[slot];
  const current = project.slots[slot];
  return !factory || !current || !patternsEqual(factory.pattern, current);
}

// An app on a tablet is put away, not closed: keep the last edit when that happens.
if (typeof window !== 'undefined') {
  const keep = () => saveNow(useStudio.getState().project);
  window.addEventListener('pagehide', keep);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') keep();
  });
}

// Development only: reach the live Studio from the browser console as `__studio`.
if (import.meta.env.DEV) {
  Object.assign(globalThis, { __studio: useStudio });
}
