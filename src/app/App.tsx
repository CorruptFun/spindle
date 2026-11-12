import { AppShell } from '@/ui/layouts/AppShell';

/**
 * Composition root: the only place that wires the engine, sources, library and
 * controllers to the UI. Today it renders the shell; providers and the engine
 * bootstrap join it in Milestone 1.
 */
export function App() {
  return <AppShell />;
}
