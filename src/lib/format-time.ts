/** Clock-style times for the screen. Pure, so the rules are tested once and shared. */

/** Seconds as m:ss, counting whole seconds. Minutes are not capped: a 75-minute mix reads 75:00. */
export function formatClock(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/**
 * Time left until the end, as m:ss. Rounds up, so the display only reaches
 * 0:00 when the track really has ended, and a fresh track shows its full length.
 */
export function formatRemaining(positionSec: number, durationSec: number): string {
  const left = durationSec - positionSec;
  if (!Number.isFinite(left) || left <= 0) return formatClock(0);
  // The tolerance stops float noise (199.9999999) from rounding up a whole second.
  return formatClock(Math.ceil(left - 1e-6));
}
