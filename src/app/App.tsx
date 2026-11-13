import { useEffect } from 'react';
import { useBooth } from '@/state/booth';
import { useStudio } from '@/state/studio';
import { AppShell } from '@/ui/layouts/AppShell';

/**
 * Composition root. Starts the audio engine as soon as the page is up (it
 * stays silent until the first touch), hands it to the Studio, and renders
 * the shell.
 */
export function App() {
  const boot = useBooth((state) => state.boot);
  const engine = useBooth((state) => state.engine);
  const attachStudio = useStudio((state) => state.attach);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (engine) attachStudio(engine);
  }, [engine, attachStudio]);

  return <AppShell />;
}
