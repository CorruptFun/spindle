import type { ModeDefinition } from '@/config/modes';
import styles from './ModeSpec.module.css';

/**
 * What this skill mode will carry once it is built, read straight from
 * config/modes.ts. It shrinks as controls move from this list into the booth.
 */
export function ModeSpec({ mode }: { mode: ModeDefinition }) {
  const groups: readonly (readonly [string, readonly string[]])[] = [
    ['On each deck', mode.deck],
    ['On the mixer', mode.mixer],
    ['Around the booth', mode.extras],
  ];

  return (
    <section className={styles.spec} aria-labelledby="mode-spec-title">
      <h2 id="mode-spec-title" className={styles.title}>
        Planned for {mode.name} mode
      </h2>
      <div className={styles.groups}>
        {groups.map(([heading, items]) => (
          <div key={heading} className={styles.group}>
            <h3>{heading}</h3>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
