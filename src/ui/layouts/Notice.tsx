import { useBooth } from '@/state/booth';
import styles from './UpdateToast.module.css';

/**
 * Something the person should know, such as a file that could not be read.
 */
export function Notice() {
  const notice = useBooth((state) => state.notice);
  // The song picker shows a problem with its own deck itself.
  const shownInPicker = useBooth(
    (state) => state.pickerDeck !== null && state.pickerDeck === state.noticeDeck,
  );
  const dismiss = useBooth((state) => state.dismissNotice);

  if (!notice || shownInPicker) return null;

  return (
    <div className={styles.toast} role="alert">
      <span>{notice}</span>
      <button type="button" className={styles.primary} onClick={dismiss}>
        OK
      </button>
    </div>
  );
}
