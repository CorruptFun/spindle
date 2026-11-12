/**
 * engine/deck: one deck = one loaded track and its playhead.
 *
 * Milestone 1: the platter model, and a deck whose playhead runs on the audio
 * thread and follows the record (play, pause, seek, scratch, reverse).
 * Milestone 2: nudge, tempo, brake.
 * Milestone 4: hot cues, loops, rolls, beat jump, slip.
 */
export * from './platter';
export * from './types';
export { Deck, loadDeckWorklet } from './Deck';
