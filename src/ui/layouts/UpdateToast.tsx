import { usePwa } from '@/state/pwa';
import styles from './UpdateToast.module.css';

/**
 * The one thing worth interrupting for: a new version has arrived. It never loads
 * by itself, because the reload would stop the music: Refresh is a choice.
 */
export function UpdateToast() {
  const needRefresh = usePwa((state) => state.needRefresh);
  const applyUpdate = usePwa((state) => state.applyUpdate);
  const dismiss = usePwa((state) => state.dismiss);

  if (!needRefresh) return null;

  return (
    <div className={styles.toast} role="status">
      <span>New version</span>
      <button type="button" className={styles.primary} onClick={applyUpdate}>
        Refresh
      </button>
      <button type="button" className={styles.quiet} onClick={dismiss}>
        Later
      </button>
    </div>
  );
}
