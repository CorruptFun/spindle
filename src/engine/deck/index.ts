/**
 * engine/deck: one deck = one loaded track and its playhead.
 *
 * Today: the platter model (motor, inertia, hand).
 * Milestone 1: load decoded audio, play, pause, cue, seek.
 * Milestone 2: worklet-backed playhead that follows the platter (variable
 * speed, reverse, scratch, nudge, brake).
 * Milestone 4: hot cues, loops, rolls, beat jump, slip.
 */
export * from './platter';
