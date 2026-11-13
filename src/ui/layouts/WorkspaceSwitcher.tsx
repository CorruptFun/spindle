import { useSettings, type Workspace } from '@/state/settings';
import styles from './ModeSwitcher.module.css';

const WORKSPACES: readonly { id: Workspace; name: string }[] = [
  { id: 'decks', name: 'Decks' },
  { id: 'studio', name: 'Studio' },
];

/** Chooses between the two rooms: playing records, and making beats. */
export function WorkspaceSwitcher() {
  const workspace = useSettings((state) => state.workspace);
  const setWorkspace = useSettings((state) => state.setWorkspace);

  return (
    <div className={styles.switcher} role="group" aria-label="Room">
      {WORKSPACES.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          className={`${styles.option} ${styles.withMark}`}
          aria-pressed={id === workspace}
          onClick={() => setWorkspace(id)}
        >
          <WorkspaceMark workspace={id} />
          {name}
        </button>
      ))}
    </div>
  );
}

/** A record for the decks, four pads for the Studio: readable without the word. */
function WorkspaceMark({ workspace }: { workspace: Workspace }) {
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      {workspace === 'decks' ? (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.5" fill="currentColor" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" fill="currentColor" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" fill="currentColor" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
