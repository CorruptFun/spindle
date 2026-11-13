import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BRAND } from '@/config/brand';
import type { SkillMode } from '@/config/modes';

/** The two rooms of the app: playing records, and making beats. */
export type Workspace = 'decks' | 'studio';

interface SettingsState {
  mode: SkillMode;
  workspace: Workspace;
  setMode: (mode: SkillMode) => void;
  setWorkspace: (workspace: Workspace) => void;
}

/** Preferences that survive a restart. New here: start in Play, at the decks. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'play',
      workspace: 'decks',
      setMode: (mode) => set({ mode }),
      setWorkspace: (workspace) => set({ workspace }),
    }),
    { name: `${BRAND.storagePrefix}.settings.v1` },
  ),
);
