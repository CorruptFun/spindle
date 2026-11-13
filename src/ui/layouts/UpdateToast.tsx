import { usePwa } from '@/state/pwa';
import styles from './UpdateToast.module.css';

/**
 * Two things worth interrupting for: a new version has arrived, or the app has
 * finished saving itself for use without a connection. A new version never
 * loads by itself, because the reload would stop the music: Refresh is a choice.
 */
export function UpdateToast() {
  const needRefresh = usePwa((state) => state.needRefresh);
  const offlineReady = usePwa((state) => state.offlineReady);
  const applyUpdate = usePwa((state) => state.applyUpdate);
  const dismiss = usePwa((state) => state.dismiss);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className={styles.toast} role="status">
      <span>{needRefresh ? 'New version' : 'Works offline now'}</span>
      {needRefresh && (
        <button type="button" className={styles.primary} onClick={applyUpdate}>
          Refresh
        </button>
      )}
      <button type="button" className={styles.quiet} onClick={dismiss}>
        {needRefresh ? 'Later' : 'OK'}
      </button>
    </div>
  );
}
