import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BRAND } from '@/config/brand';
import type { SkillMode } from '@/config/modes';

interface SettingsState {
  mode: SkillMode;
  setMode: (mode: SkillMode) => void;
}

/** Preferences that survive a restart. New here: start in Play. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'play',
      setMode: (mode) => set({ mode }),
    }),
    { name: `${BRAND.storagePrefix}.settings.v1` },
  ),
);
