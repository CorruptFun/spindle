import type { ReactNode } from 'react';
import { Sheet } from '@/ui/components/Sheet';
import styles from './HelpSheet.module.css';

interface Tip {
  mark: ReactNode;
  text: string;
}

/** Small pictures for the guide, drawn on the same 24-unit grid as the app's other marks. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const TIPS: readonly Tip[] = [
  {
    mark: (
      <path
        fill="currentColor"
        d="M8.5 5.6v12.8a.6.6 0 0 0 .92.5l9.9-6.4a.6.6 0 0 0 0-1L9.42 5.1a.6.6 0 0 0-.92.5Z"
      />
    ),
    text: 'Press play to start a record.',
  },
  {
    mark: (
      <>
        <circle cx="12" cy="12" r="9" {...stroke} />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </>
    ),
    text: 'Drag a record to scratch it.',
  },
  {
    mark: (
      <>
        <path d="M3 12h18" {...stroke} />
        <rect x="9" y="6" width="6" height="12" rx="1.5" fill="currentColor" />
      </>
    ),
    text: 'Slide the fader to mix from one record to the other.',
  },
  {
    mark: <path d="M12 5v14M5 12h14" {...stroke} />,
    text: 'Tap the bar above a record to change the song or add your own music.',
  },
  {
    mark: (
      <>
        <rect x="4" y="14" width="4" height="6" rx="1" fill="currentColor" />
        <rect x="10" y="10" width="4" height="10" rx="1" fill="currentColor" />
        <rect x="16" y="5" width="4" height="15" rx="1" fill="currentColor" />
      </>
    ),
    text: 'Play, Mix and Pro show more controls as you learn.',
  },
  {
    mark: <path d="M12 4v10M8 10l4 4 4-4M5 19h14" {...stroke} />,
    text: 'To keep it as an app, choose Add to Home Screen in your browser.',
  },
];

interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
}

/** The guide. The instrument itself carries no explanations; they all live here. */
export function HelpSheet({ open, onClose }: HelpSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} heading="How to play">
      <ul className={styles.tips}>
        {TIPS.map((tip) => (
          <li key={tip.text} className={styles.tip}>
            <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
              {tip.mark}
            </svg>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>Your music stays on this device. Nothing is uploaded.</p>
    </Sheet>
  );
}
