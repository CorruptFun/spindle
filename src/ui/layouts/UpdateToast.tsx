import { usePwa } from '@/state/pwa';
import styles from './UpdateToast.module.css';

export function UpdateToast() {
  const needRefresh = usePwa((state) => state.needRefresh);
  const offlineReady = usePwa((state) => state.offlineReady);
  const applyUpdate = usePwa((state) => state.applyUpdate);
  const dismiss = usePwa((state) => state.dismiss);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className={styles.toast} role="status">
      <span>{needRefresh ? 'A new version is ready.' : 'Ready to use without internet.'}</span>
      {needRefresh && (
        <button type="button" className={styles.primary} onClick={applyUpdate}>
          Update
        </button>
      )}
      <button type="button" className={styles.quiet} onClick={dismiss}>
        {needRefresh ? 'Later' : 'OK'}
      </button>
    </div>
  );
}
