import type { ReactNode } from 'react';
import type { Workspace } from '@/state/settings';
import { Sheet } from '@/ui/components/Sheet';
import styles from './HelpSheet.module.css';

interface Tip {
  mark: ReactNode;
  text: string;
  /** About a control that Play mode does not show. */
  beyondPlay?: boolean;
}

/** Small pictures for the guide, drawn on the same 24-unit grid as the app's other marks. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const PLAY = (
  <path
    fill="currentColor"
    d="M8.5 5.6v12.8a.6.6 0 0 0 .92.5l9.9-6.4a.6.6 0 0 0 0-1L9.42 5.1a.6.6 0 0 0-.92.5Z"
  />
);
const RECORD = (
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </>
);
const FADER = (
  <>
    <path d="M3 12h18" {...stroke} />
    <rect x="9" y="6" width="6" height="12" rx="1.5" fill="currentColor" />
  </>
);
const PLUS = <path d="M12 5v14M5 12h14" {...stroke} />;
const PADS = (
  <>
    <rect x="4" y="4" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" fill="currentColor" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor" />
  </>
);
const LOOP = (
  <path d="M17 4l3 3-3 3M20 7H8a4 4 0 0 0-4 4M7 20l-3-3 3-3M4 17h12a4 4 0 0 0 4-4" {...stroke} />
);
const DOT = <circle cx="12" cy="12" r="6" fill="currentColor" />;
const STEPS = (
  <>
    <rect x="3" y="9" width="4" height="6" rx="1" fill="currentColor" />
    <rect x="8.5" y="9" width="4" height="6" rx="1" {...stroke} strokeWidth={1.5} />
    <rect x="14" y="9" width="4" height="6" rx="1" fill="currentColor" />
    <path d="M21 9v6" {...stroke} />
  </>
);
const CLEAR = (
  <>
    <path d="M5 7.5h14M10 4.5h4" {...stroke} />
    <path d="M7.5 10.5l.6 8.5h7.8l.6-8.5" {...stroke} />
  </>
);
const LEVELS = (
  <>
    <rect x="4" y="14" width="4" height="6" rx="1" fill="currentColor" />
    <rect x="10" y="10" width="4" height="10" rx="1" fill="currentColor" />
    <rect x="16" y="5" width="4" height="15" rx="1" fill="currentColor" />
  </>
);
const INSTALL = <path d="M12 4v10M8 10l4 4 4-4M5 19h14" {...stroke} />;

const EVERYWHERE: readonly Tip[] = [
  { mark: LEVELS, text: 'Play, Mix and Pro show more controls as you learn.' },
  { mark: INSTALL, text: 'To keep it as an app, choose Add to Home Screen in your browser.' },
];

const TIPS: Readonly<Record<Workspace, readonly Tip[]>> = {
  decks: [
    { mark: PLAY, text: 'Press play to start a record.' },
    { mark: RECORD, text: 'Drag a record to scratch it.' },
    { mark: FADER, text: 'Slide the fader to mix from one record to the other.' },
    { mark: PLUS, text: 'Tap the bar above a record to change the song or add your own music.' },
  ],
  studio: [
    { mark: PADS, text: 'Tap the pads to play the drums.' },
    { mark: PLAY, text: 'Press play to start a loop, then pick another. It changes on the beat.' },
    {
      mark: DOT,
      text: 'Press record and play the pads to add your own hits. A click keeps the beat.',
      beyondPlay: true,
    },
    {
      mark: STEPS,
      text: 'Tap a pad, then the step buttons, to change its rhythm.',
      beyondPlay: true,
    },
    {
      mark: CLEAR,
      text: 'Clear empties a loop so you can build your own. Undo takes the last change back.',
      beyondPlay: true,
    },
    { mark: LOOP, text: 'The shapes at the top change the drum kit.' },
  ],
};

const HEADINGS: Readonly<Record<Workspace, string>> = {
  decks: 'How to play',
  studio: 'How to make a beat',
};

interface HelpSheetProps {
  /** Which room the guide is for. */
  workspace: Workspace;
  /** Play mode: leave out tips about controls it does not show. */
  simple: boolean;
  open: boolean;
  onClose: () => void;
}

/** The guide. The instrument itself carries no explanations; they all live here. */
export function HelpSheet({ workspace, simple, open, onClose }: HelpSheetProps) {
  const tips = [...TIPS[workspace], ...EVERYWHERE].filter((tip) => !(simple && tip.beyondPlay));
  return (
    <Sheet open={open} onClose={onClose} heading={HEADINGS[workspace]}>
      <ul className={styles.tips}>
        {tips.map((tip) => (
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
