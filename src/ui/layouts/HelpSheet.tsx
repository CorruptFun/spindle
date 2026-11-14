import type { ReactNode } from 'react';
import type { Workspace } from '@/state/settings';
import { Sheet } from '@/ui/components/Sheet';
import styles from './HelpSheet.module.css';
import { useIsDesktop } from './use-desktop';

interface Tip {
  mark: ReactNode;
  text: string;
  /** About a control that Play mode does not show. */
  beyondPlay?: boolean;
  /**
   * 'only': for a desk-sized screen, where the room is laid out differently and a
   * keyboard is to hand. 'never': describes the hand-held layout, so left out there.
   */
  desk?: 'only' | 'never';
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
/** Four layer boxes, the third one switched off. */
const LAYERS = (
  <>
    <rect x="2.5" y="7" width="4" height="10" rx="1" fill="currentColor" />
    <rect x="7.5" y="7" width="4" height="10" rx="1" fill="currentColor" />
    <rect x="12.75" y="7.25" width="3.5" height="9.5" rx="1" {...stroke} strokeWidth={1.5} />
    <rect x="17.5" y="7" width="4" height="10" rx="1" fill="currentColor" />
  </>
);
const CLEAR = (
  <>
    <path d="M5 7.5h14M10 4.5h4" {...stroke} />
    <path d="M7.5 10.5l.6 8.5h7.8l.6-8.5" {...stroke} />
  </>
);
/** Three loops in a row, standing on one line. */
const SONG = (
  <>
    <rect x="3" y="6" width="5" height="7" rx="1" fill="currentColor" />
    <rect x="9.5" y="6" width="5" height="7" rx="1" fill="currentColor" />
    <rect x="16" y="6" width="5" height="7" rx="1" fill="currentColor" />
    <path d="M3 17.5h18" {...stroke} />
  </>
);
/** One key of a keyboard. */
const KEY = (
  <>
    <rect x="4" y="5" width="16" height="14" rx="3" {...stroke} />
    <path d="M9 15h6" {...stroke} />
  </>
);
/** A grid of steps, some of them on. */
const GRID = (
  <>
    <rect x="3" y="5" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="10" y="5" width="4" height="4" rx="1" {...stroke} strokeWidth={1.5} />
    <rect x="17" y="5" width="4" height="4" rx="1" {...stroke} strokeWidth={1.5} />
    <rect x="3" y="15" width="4" height="4" rx="1" {...stroke} strokeWidth={1.5} />
    <rect x="10" y="15" width="4" height="4" rx="1" fill="currentColor" />
    <rect x="17" y="15" width="4" height="4" rx="1" fill="currentColor" />
  </>
);
/** A waveform either side of a line that marks now. */
const WAVE = (
  <>
    <path d="M3 12h2M6.5 9v6M9.5 7v10M14.5 8v8M17.5 10v4M19.5 12h1.5" {...stroke} />
    <path d="M12 4v16" {...stroke} strokeWidth={1.5} />
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
    {
      mark: WAVE,
      text: 'The big waveforms show what is coming. Drag one to move through the track.',
      beyondPlay: true,
      desk: 'only',
    },
    {
      mark: KEY,
      text: 'Keys: S plays the left record and A sends it back to the start. K and J do the same on the right.',
      desk: 'only',
    },
    {
      mark: KEY,
      text: 'Space plays or pauses the record you touched last. The arrow keys move the fader.',
      desk: 'only',
    },
    {
      mark: KEY,
      text: 'In Pro, W and Q work deck C, and O and I work deck D.',
      beyondPlay: true,
      desk: 'only',
    },
  ],
  studio: [
    { mark: PADS, text: 'Tap the pads to play the drums.' },
    { mark: PLAY, text: 'Press play to start a loop, then pick another. It changes on the beat.' },
    {
      mark: DOT,
      text: 'Pick a layer box, press record and play one sound. Pick the next box for the next sound.',
      beyondPlay: true,
    },
    {
      mark: LAYERS,
      text: 'Tap a layer box again to switch it off. The bin beside the boxes empties it.',
      beyondPlay: true,
    },
    {
      mark: STEPS,
      text: 'Tap a pad, then the step buttons, to change its rhythm.',
      beyondPlay: true,
      desk: 'never',
    },
    {
      mark: GRID,
      text: 'The grid is the whole beat: a row for each drum. Click a step to turn it on, again to make it louder, again to turn it off.',
      beyondPlay: true,
      desk: 'only',
    },
    {
      mark: CLEAR,
      text: 'Clear empties a loop so you can build your own. Undo takes the last change back.',
      beyondPlay: true,
    },
    {
      mark: SONG,
      text: 'Song puts loops in a row and plays them one after another.',
      beyondPlay: true,
      desk: 'never',
    },
    {
      mark: SONG,
      text: 'The song row plays loops one after another. The plus adds the loop you are on; click one in the row to take it out.',
      beyondPlay: true,
      desk: 'only',
    },
    {
      mark: KEY,
      text: 'Keys: Space plays and stops. A S D F and Z X C V play the pads.',
      desk: 'only',
    },
    {
      mark: KEY,
      text: 'R records. 1 to 4 choose a layer. Ctrl and Z takes the last change back.',
      beyondPlay: true,
      desk: 'only',
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
  const desk = useIsDesktop();
  const tips = [...TIPS[workspace], ...EVERYWHERE].filter(
    (tip) => !(simple && tip.beyondPlay) && tip.desk !== (desk ? 'never' : 'only'),
  );
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
