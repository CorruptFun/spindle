import { registerSW } from 'virtual:pwa-register';
import { usePwa } from '@/state/pwa';

/**
 * Registers the service worker. A new version waits until the listener taps
 * "Update" (ui/layouts/UpdateToast): reloading on our own could cut the music.
 */
export function initPwa(): void {
  const update = registerSW({
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onOfflineReady: () => usePwa.setState({ offlineReady: true }),
  });

  usePwa.setState({ applyUpdate: () => void update(true) });
}
