/**
 * sources/crate: the starter songs. Four original loops synthesised on the
 * device the first time they are needed, so the app makes good sound before
 * anyone adds a file, with nothing downloaded and nothing to license.
 *
 * All four share a tempo and a key family, so any two blend on the decks.
 */
export { CRATE_BARS, CRATE_BPM, CRATE_TRACKS } from './tracks';
export { renderCrateTrack } from './render-in-worker';
