import { STUDIO_COMING } from '@/config/studio';
import styles from './ModeSpec.module.css';

/**
 * What the Studio does not do yet, read from config/studio.ts. Like the list
 * under the decks, it shrinks as stages ship, so the screen never claims more
 * than exists.
 */
export function StudioSpec() {
  return (
    <section className={styles.spec} aria-labelledby="studio-spec-title">
      <h2 id="studio-spec-title" className={styles.title}>
        Still to come in the Studio
      </h2>
      <div className={styles.groups}>
        {STUDIO_COMING.map((stage) => (
          <div key={stage.stage} className={styles.group}>
            <h3>{stage.heading}</h3>
            <ul>
              {stage.items.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <span className={styles.milestone}>{stage.stage}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
