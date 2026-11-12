import { isBuilt, type ModeControl, type ModeDefinition } from '@/config/modes';
import styles from './ModeSpec.module.css';

/**
 * What this skill mode still has coming, read straight from config/modes.ts.
 * Controls leave this list when their milestone ships and they appear in the
 * booth instead, so the screen never claims more than exists.
 */
export function ModeSpec({ mode }: { mode: ModeDefinition }) {
  const groups = (
    [
      ['On each deck', mode.deck],
      ['On the mixer', mode.mixer],
      ['Around the booth', mode.extras],
    ] as const
  )
    .map(([heading, items]) => [heading, items.filter((item) => !isBuilt(item))] as const)
    .filter(([, items]) => items.length > 0);

  if (groups.length === 0) return null;

  return (
    <section className={styles.spec} aria-labelledby="mode-spec-title">
      <h2 id="mode-spec-title" className={styles.title}>
        Still to come in {mode.name} mode
      </h2>
      <div className={styles.groups}>
        {groups.map(([heading, items]) => (
          <div key={heading} className={styles.group}>
            <h3>{heading}</h3>
            <ul>
              {items.map((item) => (
                <ComingItem key={item.label} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ComingItem({ item }: { item: ModeControl }) {
  return (
    <li>
      <span>{item.label}</span>
      <span className={styles.milestone}>M{item.milestone}</span>
    </li>
  );
}
