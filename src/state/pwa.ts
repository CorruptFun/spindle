import { create } from 'zustand';

interface PwaState {
  /** A newer version has been downloaded and is waiting. */
  needRefresh: boolean;
  /** Everything is cached; the app now works without a connection. */
  offlineReady: boolean;
  /** Switch to the waiting version. Reloads the page, so only on the listener's say-so. */
  applyUpdate: () => void;
  dismiss: () => void;
}

export const usePwa = create<PwaState>()((set) => ({
  needRefresh: false,
  offlineReady: false,
  applyUpdate: () => {},
  dismiss: () => set({ needRefresh: false, offlineReady: false }),
}));
