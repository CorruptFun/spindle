/** Tempo and beat-grid arithmetic. Pure functions; the sync engine builds on these. */

export function beatDurationSec(bpm: number): number {
  return 60 / bpm;
}

/** Playback rate that makes a track at `trackBpm` play at `targetBpm`. */
export function rateForBpm(trackBpm: number, targetBpm: number): number {
  return targetBpm / trackBpm;
}

/** Tempo fader reading (e.g. +4 for "+4 %") to playback rate. */
export function pitchPercentToRate(percent: number): number {
  return 1 + percent / 100;
}

export function rateToPitchPercent(rate: number): number {
  return (rate - 1) * 100;
}

/** Key shift in semitones to a frequency ratio. +12 is one octave up. */
export function semitonesToRatio(semitones: number): number {
  return 2 ** (semitones / 12);
}

/**
 * The beat-grid line nearest to a position in the track: the heart of
 * quantize, which is what stops cues and loops from landing off the beat.
 * @param firstBeatSec where the first beat of the grid sits in the track.
 */
export function nearestBeatSec(positionSec: number, bpm: number, firstBeatSec = 0): number {
  const beat = beatDurationSec(bpm);
  return firstBeatSec + Math.round((positionSec - firstBeatSec) / beat) * beat;
}
