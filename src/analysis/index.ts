/**
 * analysis: everything we learn about a track by listening to it. Pure
 * functions on decoded audio, so they can move into a Web Worker unchanged.
 *
 * Today: waveform peaks for the whole-track overview (computePeaks) and for the
 * close-up, scrolling waveform (computeDetailPeaks).
 * Milestone 2: the close-up in three frequency bands, run off the main thread.
 * Milestone 3: BPM, beat grid, musical key, loudness for auto-gain.
 *
 * Results are plain data, cached by the library so a track is analysed once.
 */
export * from './peaks';
