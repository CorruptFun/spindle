import type { KitMeta } from '@/studio/types';
import { TrackGlyph } from '@/ui/components/TrackGlyph';
import styles from './KitPicker.module.css';

interface KitPickerProps {
  kits: readonly KitMeta[];
  /** Kit id. */
  active: string;
  /** A kit is being prepared. */
  busy: boolean;
  showNames: boolean;
  onPick: (kitId: string) => void;
}

/**
 * Choosing a drum kit. One tile per kit, its shape first so it can be chosen
 * without reading. The chosen kit is a light cap; while it is being prepared
 * its shape breathes and the other tiles wait, the way the song picker does.
 */
export function KitPicker({ kits, active, busy, showNames, onPick }: KitPickerProps) {
  return (
    <div className={styles.kits} role="group" aria-label="Drum kit" data-names={showNames}>
      {kits.map((kit) => {
        const isActive = kit.id === active;
        return (
          <button
            key={kit.id}
            type="button"
            className={styles.tile}
            aria-pressed={isActive}
            aria-busy={isActive && busy}
            aria-disabled={busy && !isActive}
            aria-label={isActive && busy ? `${kit.name}, getting ready` : kit.name}
            onClick={() => {
              if (!busy && !isActive) onPick(kit.id);
            }}
          >
            <span className={styles.glyph} aria-hidden="true">
              <TrackGlyph glyph={kit.glyph} />
            </span>
            {showNames && (
              <span className={styles.name} aria-hidden="true">
                {kit.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
