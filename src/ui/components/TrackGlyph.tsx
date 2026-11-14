import type { ReactNode } from 'react';
import type { TrackGlyph as Glyph } from '@/sources/types';
import styles from './TrackGlyph.module.css';

/*
 * Every shape here is drawn on one 24-unit grid and filled, then traced with a
 * 2-unit round-joined stroke of the same colour. The stroke gives every corner
 * the same soft radius and every shape the same weight. Sizes are optical, not
 * geometric: the square is drawn smaller than the circle and the triangle larger,
 * so all five look the same size side by side.
 */

const GLYPHS: Record<Glyph, ReactNode> = {
  circle: <circle cx="12" cy="12" r="8" />,
  square: <rect x="4.75" y="4.75" width="14.5" height="14.5" />,
  triangle: <path d="M12 4.5 21 20.5H3Z" />,
  star: (
    <path d="M12 2.7 14.88 8.74 21.51 9.61 16.66 14.21 17.88 20.79 12 17.6 6.12 20.79 7.34 14.21 2.49 9.61 9.12 8.74Z" />
  ),
  note: (
    <>
      <ellipse cx="8.9" cy="17.3" rx="4.2" ry="3.1" transform="rotate(-24 8.9 17.3)" />
      <path d="M12.2 17V4.2h.9c.4 2.6 1.9 3.6 3.5 4.7 1.7 1.2 3 2.6 2.6 5.6-.5-1.9-2.2-3.4-4.6-3.6h-.1V17Z" />
    </>
  ),
};

interface TrackGlyphProps {
  glyph: Glyph;
}

/** The shape that stands for a track, so it can be picked without reading. Sized by its parent. */
export function TrackGlyph({ glyph }: TrackGlyphProps) {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
      {GLYPHS[glyph]}
    </svg>
  );
}

/** Interface marks, drawn on the same grid and weight as the track glyphs. */
export type MarkName =
  'add' | 'clear' | 'close' | 'drop' | 'minus' | 'record' | 'reset' | 'song' | 'start' | 'undo';

const MARKS: Record<MarkName, ReactNode> = {
  add: <path d="M11.5 5h1v14h-1zM5 11.5h14v1H5z" />,
  // A bin: a lid with its knob, and the can below it.
  clear: <path d="M5 7h14v1H5zM10 4.5h4v1h-4zM7 10.5h1l.5 8h7l.5-8h1l-.6 9H7.6z" />,
  close: <path d="M11.5 5h1v14h-1zM5 11.5h14v1H5z" transform="rotate(45 12 12)" />,
  drop: <path d="M11.5 3.5h1v7h-1zM7.5 10.5h9L12 15zM4 15.5h1V19h14v-3.5h1V20H4z" />,
  minus: <path d="M5 11.5h14v1H5z" />,
  // Smaller than the circle glyph: it is a lamp on a button, not a shape that names something.
  record: <circle cx="12" cy="12" r="5.5" />,
  // Three quarters of a turn, running back towards the start, with its arrowhead at the top.
  reset: <path d="M12 4.5A7.5 7.5 0 1 1 4.5 12h1A6.5 6.5 0 1 0 12 5.5ZM8.5 5 12.5 2v6Z" />,
  // A row of loops: three small blocks standing on one line.
  song: (
    <path d="M4.25 6.5h2.5v5h-2.5zM10.75 6.5h2.5v5h-2.5zM17.25 6.5h2.5v5h-2.5zM4 16.5h16v1H4z" />
  ),
  start: <path d="M5 5.5h1v13H5zM19 5.5v13L9 12z" />,
  // A hook that turns back on itself, its arrowhead pointing the way it came.
  undo: <path d="M7 8.5h7.5a5 5 0 0 1 0 10H9v-1h5.5a4 4 0 0 0 0-8H7zM3.5 9 8 5.5v7z" />,
};

/** A small drawn mark (add, minus, close, drop, record, reset, song, undo, clear, back to start). Always next to a word or inside a named control. */
export function Mark({ name }: { name: MarkName }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
      {MARKS[name]}
    </svg>
  );
}
