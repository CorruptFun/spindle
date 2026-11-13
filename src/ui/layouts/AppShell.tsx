import { useEffect } from 'react';
import { BRAND } from '@/config/brand';
import { MODES } from '@/config/modes';
import { STUDIO_MODES } from '@/config/studio';
import { useBooth } from '@/state/booth';
import { useSettings } from '@/state/settings';
import { useStudio } from '@/state/studio';
import styles from './AppShell.module.css';
import { Booth } from './Booth';
import { ModeSpec } from './ModeSpec';
import { ModeSwitcher } from './ModeSwitcher';
import { Notice } from './Notice';
import { Studio } from './Studio';
import { StudioSpec } from './StudioSpec';
import { UpdateToast } from './UpdateToast';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export function AppShell() {
  const mode = MODES[useSettings((state) => state.mode)];
  const workspace = useSettings((state) => state.workspace);
  const engine = useBooth((state) => state.engine);
  const wake = useBooth((state) => state.wake);
  const fitToMode = useBooth((state) => state.fitToMode);
  const stopStudio = useStudio((state) => state.stop);

  // Only the room on screen makes sound: leaving the decks stops the records, and
  // leaving the Studio stops the loop. Nothing plays without a control to stop it.
  useEffect(() => {
    if (workspace === 'studio') fitToMode(0, true);
    else stopStudio();
  }, [workspace, engine, fitToMode, stopStudio]);

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

  const inStudio = workspace === 'studio';

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
        <div className={styles.brand}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={32} height={32} />
          <span>{BRAND.name}</span>
        </div>
        <div className={styles.switches}>
          <WorkspaceSwitcher />
          <ModeSwitcher />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>{inStudio ? STUDIO_MODES[mode.id].tagline : mode.tagline}</h1>
          <p>{mode.audience}</p>
        </div>
        {inStudio ? (
          <>
            <Studio mode={mode} />
            <StudioSpec />
          </>
        ) : (
          <>
            <Booth mode={mode} />
            <ModeSpec mode={mode} />
          </>
        )}
      </main>

      <Notice />
      <UpdateToast />
    </div>
  );
}
