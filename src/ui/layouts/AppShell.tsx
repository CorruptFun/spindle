import { useEffect, useState } from 'react';
import { BRAND } from '@/config/brand';
import { MODES } from '@/config/modes';
import { useBooth } from '@/state/booth';
import { useSettings } from '@/state/settings';
import styles from './AppShell.module.css';
import { Booth } from './Booth';
import { HelpSheet } from './HelpSheet';
import { ModeSwitcher } from './ModeSwitcher';
import { Notice } from './Notice';
import { UpdateToast } from './UpdateToast';

/**
 * The frame around the instrument: a slim bar with the skill switch and the
 * way to the guide, then the booth. Nothing else is on screen; anything that
 * needs explaining is behind the ? button.
 */
export function AppShell() {
  const mode = MODES[useSettings((state) => state.mode)];
  const wake = useBooth((state) => state.wake);
  const [helpOpen, setHelpOpen] = useState(false);

  // A file let go of anywhere but on a deck would otherwise make the browser open it in
  // place of the app, taking the music with it. Decks handle their own drops.
  useEffect(() => {
    const refuse = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', refuse);
    window.addEventListener('drop', refuse);
    return () => {
      window.removeEventListener('dragover', refuse);
      window.removeEventListener('drop', refuse);
    };
  }, []);

  return (
    // Browsers keep audio off until the page is touched, so the first touch or key press
    // anywhere switches it on. On a touch screen only the end of a touch counts, hence both.
    <div
      className={styles.shell}
      onPointerDownCapture={wake}
      onPointerUpCapture={wake}
      onClickCapture={wake}
      onKeyDownCapture={wake}
    >
      <header className={styles.header}>
        <img
          className={styles.logo}
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt={BRAND.name}
          width={32}
          height={32}
        />
        <ModeSwitcher />
        <button
          type="button"
          className={styles.help}
          aria-label="Help"
          aria-haspopup="dialog"
          onClick={() => setHelpOpen(true)}
        >
          ?
        </button>
      </header>

      <main className={styles.main}>
        <Booth mode={mode} />
      </main>

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Notice />
      <UpdateToast />
    </div>
  );
}
