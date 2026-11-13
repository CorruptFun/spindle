import { registerSW } from 'virtual:pwa-register';
import { usePwa } from '@/state/pwa';

/** How often an app that is left open looks for a new version. */
const UPDATE_CHECK_MS = 30 * 60 * 1000;

/**
 * Registers the service worker. A new version waits until the listener taps
 * Refresh (ui/layouts/UpdateToast): reloading on our own could cut the music.
 */
export function initPwa(): void {
  const update = registerSW({
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onOfflineReady: () => usePwa.setState({ offlineReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      // A browser only looks for a new version when the app is opened from cold. An
      // installed app on a tablet is rarely closed, just put away and brought back, so it
      // could run an old version for days. Look whenever it returns to the screen, and
      // now and then while it stays open.
      const check = () => {
        if (!navigator.onLine) return;
        registration.update().catch(() => {
          // Offline after all, or the server is busy. The next check will do.
        });
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, UPDATE_CHECK_MS);
    },
  });

  usePwa.setState({ applyUpdate: () => void update(true) });
}
