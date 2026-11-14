/**
 * The Studio on a computer keyboard: which key does what. Pure, so it can be
 * tested without a page; the Studio's one key listener asks it and then acts.
 */

/**
 * The key that plays each pad, in pad order. The pads sit four by two, and so
 * do these keys: A S D F over Z X C V.
 */
export const PAD_KEYS: readonly string[] = ['A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];

/** What a key press asks for. */
export type StudioKey =
  | { readonly kind: 'play' }
  | { readonly kind: 'record' }
  | { readonly kind: 'undo' }
  | { readonly kind: 'pad'; readonly pad: number }
  | { readonly kind: 'layer'; readonly layer: number };

/** The parts of a keyboard event the map reads. */
export interface KeyPress {
  /** What the key types: "a", "A", " ", "1". */
  readonly key: string;
  /** Where the key sits: "KeyA", "Space", "Digit1". */
  readonly code: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

/** What the skill mode has on screen. A key for something that is not there does nothing. */
export interface KeyFeatures {
  readonly record: boolean;
  readonly layers: boolean;
  readonly undo: boolean;
}

const LAYER_KEYS: readonly string[] = ['1', '2', '3', '4'];

/**
 * One name for a key: a lower-case letter, a digit or "space". The letter the
 * key types wins, so the key to press is the one printed with the letter shown
 * on the pad, on any keyboard. A key that types neither a plain letter nor a
 * digit (another alphabet, or a top row that needs Shift for its numbers) goes
 * by where it sits instead.
 */
function keyName(press: KeyPress): string | null {
  const { key, code } = press;
  if (key === ' ' || key === 'Spacebar') return 'space';
  if (/^[a-z0-9]$/i.test(key)) return key.toLowerCase();
  if (code === 'Space') return 'space';
  const placed = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  if (placed) return (placed[1] ?? placed[2] ?? '').toLowerCase() || null;
  return null;
}

/**
 * What a key press means in the Studio, or null when it is not one of ours.
 * Space plays and stops, R records, A S D F and Z X C V play the pads, 1 to 4
 * choose a layer, and Ctrl+Z (Cmd+Z on a Mac) undoes. With Alt, Ctrl or Cmd
 * held nothing else is ours: those belong to the browser.
 */
export function studioKey(press: KeyPress, features: KeyFeatures): StudioKey | null {
  const name = keyName(press);
  if (name === null) return null;

  if (press.ctrlKey || press.metaKey || press.altKey) {
    const undo = name === 'z' && !press.altKey && !press.shiftKey;
    return undo && features.undo ? { kind: 'undo' } : null;
  }

  if (name === 'space') return { kind: 'play' };
  if (name === 'r') return features.record ? { kind: 'record' } : null;

  const pad = PAD_KEYS.indexOf(name.toUpperCase());
  if (pad >= 0) return { kind: 'pad', pad };

  const layer = LAYER_KEYS.indexOf(name);
  if (layer >= 0) return features.layers ? { kind: 'layer', layer } : null;

  return null;
}

/** As much of an element as it takes to tell whether it wants the keys for itself. */
export interface KeyTarget {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
  getAttribute?(name: string): string | null;
}

const TYPING_TAGS: readonly string[] = ['input', 'textarea', 'select'];
const KEYED_ROLES: readonly string[] = ['slider', 'spinbutton', 'textbox'];

/**
 * Whether the thing with the focus uses the keyboard itself: somewhere to
 * type, a slider, or a spin button such as the tempo. The Studio's keys are
 * left alone there.
 */
export function takesKeys(target: KeyTarget | null | undefined): boolean {
  if (!target) return false;
  if (TYPING_TAGS.includes(target.tagName?.toLowerCase() ?? '')) return true;
  if (target.isContentEditable === true) return true;
  const role = target.getAttribute?.('role') ?? null;
  return role !== null && KEYED_ROLES.includes(role);
}
