import { useEffect } from 'react';
import { useBooth } from '@/state/booth';
import { AppShell } from '@/ui/layouts/AppShell';

/**
 * Composition root. Starts the audio engine as soon as the page is up (it
 * stays silent until the first touch) and renders the shell.
 */
export function App() {
  const boot = useBooth((state) => state.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  return <AppShell />;
}
