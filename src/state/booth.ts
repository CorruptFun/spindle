import { create } from 'zustand';
import type { DeckId } from '@/engine/core/types';
import { clamp } from '@/lib/audio-math';

interface BoothState {
  /** Whether each deck's motor is running. */
  playing: Record<DeckId, boolean>;
  /** 0 = hard left, 0.5 = centre, 1 = hard right. */
  crossfader: number;
  togglePlay: (deck: DeckId) => void;
  setCrossfader: (position: number) => void;
}

/**
 * What the booth is doing right now, at human speed. Until the engine exists
 * (Milestone 1) this store is the source of truth; after that it mirrors the
 * engine and these actions become engine commands.
 */
export const useBooth = create<BoothState>()((set) => ({
  playing: { A: false, B: false, C: false, D: false },
  crossfader: 0.5,
  togglePlay: (deck) =>
    set((state) => ({ playing: { ...state.playing, [deck]: !state.playing[deck] } })),
  setCrossfader: (position) => set({ crossfader: clamp(position, 0, 1) }),
}));
