import { create } from 'zustand';
import { BRAND } from '@/config/brand';
import type { AudioEngine } from '@/engine/AudioEngine';
import { STEPS_PER_BAR, type DrumPattern } from '@/engine/sequencer/types';
import {
  addToSong,
  clearLayer,
  clearLoop,
  defaultProject,
  factoryLoop,
  isLayerEmpty,
  isLoopEmpty,
  KITS,
  LAYER_COUNT,
  loopsEqual,
  mixLoop,
  parseProject,
  recordIntoLayer,
  removeFromSong,
  renderKit,
  serializeProject,
  setLayerMuted,
  toggleLayerStep,
  type StudioLoop,
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
  /** Every layer, as it was. */
  loop: StudioLoop;
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
  /** The layer that recording and step edits go into, 0..LAYER_COUNT-1. Not saved. */
  selectedLayer: number;
  /** Which bar of the loop the step editor shows. */
  bar: number;
  /**
   * A loop as it was before the last recording, clear (of a layer or the whole loop) or
   * reset, for Undo.
   * Undoing swaps it with the loop as it is, so a second Undo puts the change back.
   */
  undo: LoopSnapshot | null;
  /** The song is playing: its loops one after another, rather than one loop going round. */
  songPlaying: boolean;
  /** The song entry being heard, for the screen. -1 when the song is not playing. */
  songPosition: number;

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
  /** Choose the layer to record into. Choosing the one already chosen switches it off, or back on. */
  selectLayer: (layer: number) => void;
  /** Toggle a step of the selected pad, in the selected layer and the bar being shown. */
  toggleStep: (step: number) => void;
  setBar: (bar: number) => void;
  setTempo: (bpm: number) => void;
  setSwing: (swing: number) => void;
  pickKit: (kitId: string) => void;
  /** Put the current loop back the way it shipped. */
  resetLoop: () => void;
  /** Empty the current loop, every layer, to build one from nothing. */
  clearLoop: () => void;
  /** Empty the selected layer of the current loop, to record it again. */
  clearLayer: () => void;
  /** Take back the last recording, clear or reset of the current loop; again to put it back. */
  undoLoop: () => void;
  /** Put a loop at the end of the song. */
  addToSong: (slot: number) => void;
  /** Take the entry at this place out of the song. */
  removeFromSong: (index: number) => void;
  clearSong: () => void;
  /** Play the song from the top, or stop it. */
  toggleSong: () => void;
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
  const activeLoop = (project: StudioProject): StudioLoop =>
    project.slots[project.activeSlot] ?? defaultProject().slots[0]!;

  /** Change the project, keep it saved. */
  const update = (change: Partial<StudioProject>): StudioProject => {
    const project = { ...get().project, ...change };
    set({ project });
    saveSoon(project);
    return project;
  };

  /** Replace the loop in the active slot and let the sequencer carry on with its mix. */
  const replaceActiveLoop = (loop: StudioLoop): void => {
    const { project } = get();
    const slots = project.slots.map((slot, index) => (index === project.activeSlot ? loop : slot));
    update({ slots });
    engine?.sequencer.setPattern(mixLoop(loop), 'now');
    // Applying an edit drops any change that was waiting for the bar line: queue it again.
    const { queuedSlot } = get();
    const queued = queuedSlot === null ? undefined : slots[queuedSlot];
    if (queued) engine?.sequencer.setPattern(mixLoop(queued), 'next-bar');
  };

  /** Replace the loop in the active slot, keeping what was there for Undo. */
  const wipe = (loop: StudioLoop): void => {
    const { project } = get();
    const slot = project.activeSlot;
    set({ undo: { slot, loop: activeLoop(project) } });
    // Hits recorded after this belong with it: one Undo brings back the loop as it was before.
    takeSlot = get().recording ? slot : null;
    replaceActiveLoop(loop);
  };

  /** What the sequencer plays for the song: each entry's mix, in order. */
  const songMixes = (project: StudioProject): DrumPattern[] =>
    project.song.flatMap((slot) => {
      const loop = project.slots[slot];
      return loop ? [mixLoop(loop)] : [];
    });

  /**
   * Touching the loop leaves the song: the loop that is sounding stays the
   * active one and keeps going round, so the change is heard on it.
   */
  const leaveSong = (): void => {
    if (!get().songPlaying) return;
    engine?.sequencer.setChain(null);
    // The next entry may already be collected a moment ahead of the bar line the screen has
    // shown. Handing over the loop on screen keeps the sound and the screen in agreement;
    // when they already agree it carries on from the same step, unheard.
    engine?.sequencer.setPattern(mixLoop(activeLoop(get().project)), 'now');
    set({ songPlaying: false, songPosition: -1 });
  };

  /** A new song list. While the song plays it carries on with the new list; empty, it ends. */
  const changeSong = (song: readonly number[], moved?: (index: number) => number): void => {
    if (song === get().project.song) return;
    const project = update({ song });
    if (!get().songPlaying) return;
    if (song.length === 0) {
      leaveSong();
      return;
    }
    engine?.sequencer.setChain(songMixes(project), moved);
    // -1 for a moment when the entry being heard was itself taken out: nothing is ringed
    // until the next one begins.
    set({ songPosition: engine?.sequencer.chainPosition() ?? -1 });
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
    selectedLayer: 0,
    bar: 0,
    undo: null,
    songPlaying: false,
    songPosition: -1,

    attach(nextEngine) {
      if (engine === nextEngine) return;
      engine = nextEngine;
      const { project } = get();

      engine.mixer.setPadsLevel(PADS_LEVEL);
      engine.sequencer.setTempo(project.bpm);
      engine.sequencer.setSwing(project.swing);
      engine.sequencer.setPattern(mixLoop(activeLoop(project)), 'now');
      engine.sequencer.setClick(get().recording);
      // A queued loop becomes the current one when its bar line arrives.
      engine.sequencer.onBar = () => {
        // In a song, the loop on screen follows the one being heard.
        if (get().songPlaying) {
          const position = engine?.sequencer.chainPosition() ?? -1;
          const slot = get().project.song[position];
          if (position < 0 || position === get().songPosition || slot === undefined) return;
          if (slot !== get().project.activeSlot) update({ activeSlot: slot });
          set({ songPosition: position, bar: 0 });
          return;
        }
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
      const { project, selectedLayer } = get();
      const slot = project.activeSlot;
      const before = project.slots[slot];
      if (!recorded || !before) return;
      // The first hit of a recording: keep the loop as it was, every layer, so Undo takes the
      // whole recording back.
      if (takeSlot !== slot) {
        takeSlot = slot;
        set({ undo: { slot, loop: before } });
      }
      // The hit goes into the chosen layer only; the sequencer carries on with the new mix.
      replaceActiveLoop(
        recordIntoLayer(before, selectedLayer, pad, recorded.step, RECORDED_VELOCITY),
      );
    },

    togglePlay() {
      if (!engine) return;
      if (get().playing) {
        get().stop();
        return;
      }
      void engine.resume();
      // Play always means the loop on screen, never the song.
      engine.sequencer.setChain(null);
      engine.sequencer.setPattern(mixLoop(activeLoop(get().project)), 'now');
      engine.sequencer.start();
      set({ playing: true });
    },

    stop() {
      engine?.sequencer.stop();
      engine?.sequencer.setChain(null);
      setRecording(false);
      set({ playing: false, queuedSlot: null, songPlaying: false, songPosition: -1 });
    },

    toggleRecord() {
      const recording = !get().recording;
      if (recording) leaveSong();
      setRecording(recording);
      // Nothing can be recorded into a loop that is not running, so Record starts it.
      if (recording && !get().playing) get().togglePlay();
    },

    stopRecording() {
      if (get().recording) setRecording(false);
    },

    selectSlot(slot) {
      leaveSong();
      const { project, playing, queuedSlot } = get();
      const loop = project.slots[slot];
      if (!engine || !loop) return;

      if (!playing) {
        update({ activeSlot: slot });
        set({ bar: 0 });
        engine.sequencer.setPattern(mixLoop(loop), 'now');
        return;
      }
      // Tapping the loop that is already playing cancels a change that was waiting.
      if (slot === project.activeSlot) {
        if (queuedSlot !== null) {
          engine.sequencer.setPattern(mixLoop(activeLoop(project)), 'now');
          set({ queuedSlot: null });
        }
        return;
      }
      // While playing, a new loop comes in on the bar line so it lands in time.
      engine.sequencer.setPattern(mixLoop(loop), 'next-bar');
      set({ queuedSlot: slot });
    },

    selectLayer(layer) {
      if (!Number.isInteger(layer) || layer < 0 || layer >= LAYER_COUNT) return;
      const { project, selectedLayer } = get();
      if (layer !== selectedLayer) {
        set({ selectedLayer: layer });
        return;
      }
      // The chosen layer again: switch it off, or back on. Not something Undo takes back.
      leaveSong();
      const loop = activeLoop(project);
      const muted = loop.layers[layer]?.muted ?? false;
      replaceActiveLoop(setLayerMuted(loop, layer, !muted));
    },

    toggleStep(step) {
      leaveSong();
      const { project, selectedPad, selectedLayer, bar } = get();
      const loop = activeLoop(project);
      const next = toggleLayerStep(loop, selectedLayer, selectedPad, bar * STEPS_PER_BAR + step);
      if (next !== loop) replaceActiveLoop(next);
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
      leaveSong();
      const { project } = get();
      const factory = factoryLoop(project.activeSlot);
      if (factory && isLoopEdited(project, project.activeSlot)) wipe(factory);
    },

    clearLoop() {
      leaveSong();
      const current = activeLoop(get().project);
      if (!isLoopEmpty(current)) wipe(clearLoop(current));
    },

    clearLayer() {
      leaveSong();
      const { project, selectedLayer } = get();
      const current = activeLoop(project);
      const layer = current.layers[selectedLayer];
      if (layer && !isLayerEmpty(layer)) wipe(clearLayer(current, selectedLayer));
    },

    undoLoop() {
      leaveSong();
      const { undo, project } = get();
      if (!undo || undo.slot !== project.activeSlot) return;
      set({ undo: { slot: undo.slot, loop: activeLoop(project) } });
      // Whatever is recorded next is a new recording, with its own Undo.
      takeSlot = null;
      replaceActiveLoop(undo.loop);
    },

    addToSong(slot) {
      changeSong(addToSong(get().project.song, slot));
    },

    removeFromSong(index) {
      // Everything after the entry taken out moves down one place; the entry itself, if it is
      // the one being heard, plays to its end and the one that was after it comes next.
      changeSong(removeFromSong(get().project.song, index), (place) =>
        place >= index ? place - 1 : place,
      );
    },

    clearSong() {
      if (get().project.song.length > 0) changeSong([]);
    },

    toggleSong() {
      if (!engine) return;
      if (get().songPlaying) {
        get().stop();
        return;
      }
      const { project } = get();
      const first = project.song[0];
      if (first === undefined) return;
      // Whatever was playing stops; the song starts from its first entry.
      get().stop();
      void engine.resume();
      engine.sequencer.setChain(songMixes(project));
      engine.sequencer.start();
      if (first !== project.activeSlot) update({ activeSlot: first });
      set({ playing: true, songPlaying: true, songPosition: 0, queuedSlot: null, bar: 0 });
    },
  };
});

/** Whether Undo has something to take back in the loop on screen. */
export function canUndoLoop(undo: LoopSnapshot | null, project: StudioProject): boolean {
  return undo !== null && undo.slot === project.activeSlot;
}

/** Whether a slot's loop has been changed from the one it shipped with. */
export function isLoopEdited(project: StudioProject, slot: number): boolean {
  const factory = factoryLoop(slot);
  const current = project.slots[slot];
  return !factory || !current || !loopsEqual(factory, current);
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
