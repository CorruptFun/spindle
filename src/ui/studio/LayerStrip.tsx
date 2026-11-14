import { Mark } from '@/ui/components/TrackGlyph';
import { familyStyle } from '@/ui/theme/family-colors';
import { layerLabel, type LayerSummary } from './layers-label';
import styles from './LayerStrip.module.css';

interface LayerStripProps {
  /** One per layer, in order. */
  layers: readonly LayerSummary[];
  /** The layer that recording and step edits go into. */
  selected: number;
  /** Record is on: the chosen box is the one being recorded into. */
  recording: boolean;
  /** The chosen layer has something in it, so the bin has something to empty. */
  canClear: boolean;
  /** Choosing the chosen layer again switches it off or back on; the store decides. */
  onSelect: (layer: number) => void;
  onClear: () => void;
}

/**
 * The layers of the loop, as a row of numbered keys with a bin at the end.
 * Each key carries a pip in the colour of every drum family it holds, so what
 * is in a layer can be seen without reading. The chosen key wears the ring the
 * chosen loop tile wears, red while recording; a switched-off key is dimmed.
 */
export function LayerStrip({
  layers,
  selected,
  recording,
  canClear,
  onSelect,
  onClear,
}: LayerStripProps) {
  return (
    <div className={styles.strip} role="group" aria-label="Layers">
      {layers.map((layer, index) => {
        const isSelected = index === selected;
        return (
          <button
            key={index}
            type="button"
            className={styles.layer}
            data-selected={isSelected}
            data-recording={isSelected && recording}
            data-muted={layer.muted}
            aria-pressed={isSelected}
            aria-label={layerLabel(index, layer)}
            onClick={() => onSelect(index)}
          >
            <span className={styles.face} aria-hidden="true">
              <span className={styles.number}>{index + 1}</span>
              {!layer.empty && layer.families.length > 0 && (
                <span className={styles.pips}>
                  {layer.families.map((family) => (
                    <span key={family} className={styles.pip} style={familyStyle(family)} />
                  ))}
                </span>
              )}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        className={styles.bin}
        aria-disabled={!canClear}
        aria-label="Clear this layer"
        onClick={() => {
          if (canClear) onClear();
        }}
      >
        <span className={styles.mark} aria-hidden="true">
          <Mark name="clear" />
        </span>
      </button>
    </div>
  );
}
