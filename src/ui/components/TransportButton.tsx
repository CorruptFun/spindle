import styles from './TransportButton.module.css';

interface TransportButtonProps {
  playing: boolean;
  /** What this button controls, for screen readers: "deck A". */
  target: string;
  onToggle: () => void;
}

/** Play / pause. Takes its colour from the surrounding deck (`--deck`). */
export function TransportButton({ playing, target, onToggle }: TransportButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={playing}
      aria-label={`Play ${target}`}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {playing ? (
          <>
            <rect x="6.5" y="5.5" width="4" height="13" rx="1" />
            <rect x="13.5" y="5.5" width="4" height="13" rx="1" />
          </>
        ) : (
          <path d="M8.5 5.6v12.8a.6.6 0 0 0 .92.5l9.9-6.4a.6.6 0 0 0 0-1L9.42 5.1a.6.6 0 0 0-.92.5Z" />
        )}
      </svg>
    </button>
  );
}
