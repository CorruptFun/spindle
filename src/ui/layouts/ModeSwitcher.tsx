import { MODE_ORDER, MODES } from '@/config/modes';
import { useSettings } from '@/state/settings';
import styles from './ModeSwitcher.module.css';

export function ModeSwitcher() {
  const mode = useSettings((state) => state.mode);
  const setMode = useSettings((state) => state.setMode);

  return (
    <div className={styles.switcher} role="group" aria-label="Skill level">
      {MODE_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={styles.option}
          aria-pressed={id === mode}
          onClick={() => setMode(id)}
        >
          {MODES[id].name}
        </button>
      ))}
    </div>
  );
}
