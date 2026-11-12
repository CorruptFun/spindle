import { BRAND } from '@/config/brand';
import { MODES } from '@/config/modes';
import { useSettings } from '@/state/settings';
import styles from './AppShell.module.css';
import { Booth } from './Booth';
import { ModeSpec } from './ModeSpec';
import { ModeSwitcher } from './ModeSwitcher';
import { UpdateToast } from './UpdateToast';

export function AppShell() {
  const mode = MODES[useSettings((state) => state.mode)];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={32} height={32} />
          <span>{BRAND.name}</span>
        </div>
        <ModeSwitcher />
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>{mode.tagline}</h1>
          <p>{mode.audience}</p>
        </div>
        <Booth mode={mode} />
        <ModeSpec mode={mode} />
      </main>

      <footer className={styles.footer}>
        Foundation build. The records spin; sound arrives in Milestone 1.
      </footer>

      <UpdateToast />
    </div>
  );
}
