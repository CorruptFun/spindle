import { useEffect, useLayoutEffect, useRef } from 'react';
import { studioKey, takesKeys, type KeyFeatures } from './keys';

export interface StudioKeyActions {
  /** What the skill mode has on screen: a key for something that is not there does nothing. */
  features: KeyFeatures;
  onPlay: () => void;
  onRecord: () => void;
  onUndo: () => void;
  onLayer: (layer: number) => void;
  /** A pad's key went down, and later came back up. */
  onPadDown: (pad: number) => void;
  onPadUp: (pad: number) => void;
}

/** The focus is somewhere that uses the keyboard itself, or a sheet is open over the Studio. */
function keysAreElsewhere(event: KeyboardEvent): boolean {
  if (document.querySelector('dialog[open]')) return true;
  return event.target instanceof Element && takesKeys(event.target);
}

/**
 * The Studio's keys on a computer keyboard (the map is in `keys.ts`), for as
 * long as the Studio is on screen: one listener on the window for keys going
 * down, and with it one for keys coming up and one for the window losing the
 * keyboard, so a pad held down by its key is always let go.
 *
 * A key that is ours is ours alone: its default is cancelled, so Space on a
 * button that has the focus plays the loop and does not also press the button.
 */
export function useStudioKeys(enabled: boolean, actions: StudioKeyActions): void {
  const latest = useRef(actions);

  useLayoutEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    if (!enabled) return;

    /** Keys that went down as ours and have not come up yet, and the pad each holds down. */
    const down = new Map<string, number | null>();
    /** A key is known by where it sits, so it is the same key coming up whatever it types by then. */
    const nameOf = (event: KeyboardEvent) => event.code || event.key;

    // A key let go while something else has the keyboard never comes up here.
    const letGo = () => {
      for (const pad of down.values()) {
        if (pad !== null) latest.current.onPadUp(pad);
      }
      down.clear();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // While Cmd is held a Mac does not say when other keys come up: let go of them now.
      if (event.key === 'Meta') letGo();
      // Something with the focus has already used this press.
      if (event.defaultPrevented || event.isComposing) return;
      if (keysAreElsewhere(event)) return;
      const key = studioKey(event, latest.current.features);
      if (!key) return;

      event.preventDefault();
      // A held key is one press: a pad is not hit again, play does not flicker on and off.
      if (event.repeat) return;
      down.set(nameOf(event), key.kind === 'pad' ? key.pad : null);

      const act = latest.current;
      switch (key.kind) {
        case 'play':
          act.onPlay();
          break;
        case 'record':
          act.onRecord();
          break;
        case 'undo':
          act.onUndo();
          break;
        case 'layer':
          act.onLayer(key.layer);
          break;
        case 'pad':
          act.onPadDown(key.pad);
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const name = nameOf(event);
      const pad = down.get(name);
      if (pad === undefined) return;
      down.delete(name);
      // Some browsers press a focused button when Space comes up, not when it goes down.
      event.preventDefault();
      if (pad !== null) latest.current.onPadUp(pad);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', letGo);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', letGo);
      letGo();
    };
  }, [enabled]);
}
