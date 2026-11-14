/**
 * The booth's keyboard, as a table and the rules for when it applies. Pure: a
 * key press and what the screen is doing go in, what to do comes out, so the
 * rules can be tested without a browser. The booth owns the one listener.
 *
 * Left hand for deck A, right hand for deck B, and the row above for the two
 * outer decks:
 *
 *   S play / pause A    A back to the start of A
 *   K play / pause B    J back to the start of B
 *   W play / pause C    Q back to the start of C    (four decks only)
 *   O play / pause D    I back to the start of D    (four decks only)
 *   Space               play / pause the deck that was touched or keyed last
 *   Left, Right         nudge the crossfader
 */
import { DECK_IDS, type DeckId } from '@/engine/core/types';
import { clamp } from '@/lib/audio-math';

export type BoothKeyAction =
  | { readonly type: 'play'; readonly deck: DeckId }
  | { readonly type: 'start'; readonly deck: DeckId }
  | { readonly type: 'crossfade'; readonly direction: -1 | 1 }
  /** A held key repeating. It is still ours, so it must not reach a button, but there is nothing more to do. */
  | { readonly type: 'none' };

/** The parts of a keyboard event the rules read. */
export interface KeyPress {
  readonly key: string;
  /** Which physical key, e.g. `KeyS`. Used where the layout has no Latin letters. */
  readonly code?: string;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  /** The key is being held down and this is not its first event. */
  readonly repeat?: boolean;
  /** Part of typing with an input method, not a key press of its own. */
  readonly composing?: boolean;
}

/**
 * What has the focus, as far as keys go.
 * - `free`: nothing that wants keys of its own (the page, a button).
 * - `slider`: a fader or a waveform. Arrows and Space are its own.
 * - `typing`: somewhere a person types. Every key is its own.
 */
export type KeyFocus = 'free' | 'slider' | 'typing';

/** The parts of the focused element the rules read. */
export interface FocusedElement {
  readonly tagName: string;
  /** The `type` attribute of an input. */
  readonly type?: string | null;
  readonly role?: string | null;
  readonly editable?: boolean;
}

const TYPING_ROLES = ['textbox', 'searchbox', 'combobox', 'spinbutton', 'listbox'];

export function keyFocus(element: FocusedElement | null): KeyFocus {
  if (!element) return 'free';
  if (element.editable) return 'typing';
  const role = element.role?.toLowerCase() ?? '';
  if (role === 'slider') return 'slider';
  if (TYPING_ROLES.includes(role)) return 'typing';
  switch (element.tagName.toUpperCase()) {
    case 'INPUT':
      return element.type?.toLowerCase() === 'range' ? 'slider' : 'typing';
    case 'TEXTAREA':
    case 'SELECT':
      return 'typing';
    default:
      return 'free';
  }
}

export interface BoothKeyContext {
  /** Decks on screen: two, or four in Pro. */
  readonly deckCount: number;
  /** The deck that was touched or keyed last. */
  readonly lastDeck: DeckId;
  readonly focus: KeyFocus;
  /** A sheet is open over the booth. */
  readonly dialogOpen: boolean;
}

type DeckKey = { readonly deck: DeckId; readonly type: 'play' | 'start' };

const DECK_KEYS: Readonly<Record<string, DeckKey>> = {
  s: { deck: 'A', type: 'play' },
  a: { deck: 'A', type: 'start' },
  k: { deck: 'B', type: 'play' },
  j: { deck: 'B', type: 'start' },
  w: { deck: 'C', type: 'play' },
  q: { deck: 'C', type: 'start' },
  o: { deck: 'D', type: 'play' },
  i: { deck: 'D', type: 'start' },
};

/**
 * The letter a press stands for, lower case. The letter printed on the key
 * where there is one, so the keys are the ones the guide names on any layout;
 * on a keyboard without Latin letters, the key in that place.
 */
function letterOf(press: KeyPress): string | null {
  if (/^[a-z]$/i.test(press.key)) return press.key.toLowerCase();
  const placed = /^Key([A-Z])$/.exec(press.code ?? '');
  return placed?.[1]?.toLowerCase() ?? null;
}

function isSpace(press: KeyPress): boolean {
  return press.key === ' ' || press.key === 'Spacebar' || press.code === 'Space';
}

function isOnScreen(deck: DeckId, deckCount: number): boolean {
  return DECK_IDS.indexOf(deck) < deckCount;
}

/**
 * What a key press does in the booth, or null when the key is not ours and the
 * browser should have it. Whatever comes back that is not null has been
 * handled: the caller must stop it from also pressing a focused button.
 */
export function boothKeyAction(press: KeyPress, context: BoothKeyContext): BoothKeyAction | null {
  if (context.dialogOpen || context.focus === 'typing') return null;
  // With these held the key is a browser or system shortcut (Ctrl+S, Cmd+W).
  if (press.altKey || press.ctrlKey || press.metaKey || press.composing) return null;

  // Space plays and pauses wherever the focus is short of a text box. A fader or a waveform has
  // no use for it, and a mouse drag leaves the focus on one: Space must not go dead after that.
  if (isSpace(press)) {
    if (press.repeat) return { type: 'none' };
    const deck = isOnScreen(context.lastDeck, context.deckCount) ? context.lastDeck : 'A';
    return { type: 'play', deck };
  }

  // Arrows belong to a focused fader or waveform.
  if (context.focus === 'free') {
    // Holding an arrow slides the fader, so these do repeat.
    if (press.key === 'ArrowLeft') return { type: 'crossfade', direction: -1 };
    if (press.key === 'ArrowRight') return { type: 'crossfade', direction: 1 };
  }

  const letter = letterOf(press);
  const found = letter === null ? undefined : DECK_KEYS[letter];
  if (!found || !isOnScreen(found.deck, context.deckCount)) return null;
  return press.repeat ? { type: 'none' } : found;
}

/** How far one arrow key press moves the crossfader: twenty presses from end to end. */
export const CROSSFADER_KEY_STEP = 0.05;

/** Where the crossfader goes after one arrow key press. */
export function nudgedCrossfader(position: number, direction: -1 | 1): number {
  const from = Number.isFinite(position) ? position : 0.5;
  // Whole thousandths, so twenty steps of 0.05 land on exactly 0, 0.5 and 1.
  return clamp(Math.round((from + direction * CROSSFADER_KEY_STEP) * 1000) / 1000, 0, 1);
}
