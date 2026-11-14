import { useSyncExternalStore } from 'react';

/**
 * A desk-sized screen: wide and tall enough to lay a room out as a workstation
 * rather than as an instrument held in the hands. Stylesheets write the same
 * words out in full (CSS cannot import a value), so change them together.
 */
export const DESKTOP_QUERY = '(min-width: 1280px) and (min-height: 720px)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(DESKTOP_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function isDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** Whether the screen is desk-sized right now. Follows the window as it is resized. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktop, () => false);
}
