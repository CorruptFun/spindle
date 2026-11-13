/**
 * How long a touched pad stays lit by the touch alone. The engine's glow takes
 * over as soon as the sound starts; this only makes sure a finger always sees
 * its pad answer, even before the sound has been set up.
 */
export const TOUCH_FLASH_MS = 140;

/**
 * How lit a pad should be drawn: the brighter of the sound's glow and the
 * fading flash of the last touch. Rounded to hundredths, so the drawing loop
 * only writes to the page when the picture changes.
 */
export function padLight(glow: number, msSinceTouch: number): number {
  const sound = glow > 0 ? Math.min(1, glow) : 0;
  const touch = msSinceTouch >= TOUCH_FLASH_MS ? 0 : 1 - Math.max(0, msSinceTouch) / TOUCH_FLASH_MS;
  return Math.round(Math.max(sound, touch) * 100) / 100;
}
