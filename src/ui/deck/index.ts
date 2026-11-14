/**
 * ui/deck: one deck on screen.
 *
 * Today: DeckUnit, the Platter (grab, spin, throw), the TrackStrip (what is
 * loaded, time left, progress; opens the song picker), the Waveform (the
 * whole track on canvas; tap or drag to move the needle), the WaveLane (a few
 * seconds of the track up close, scrolling past the needle; for screens with
 * room for it) and the booth's keyboard (keys).
 * Milestone 2: the close-up coloured by frequency, TempoFader.
 * Milestone 4: HotCues, LoopControls, BeatJump.
 */
export * from './DeckUnit';
export * from './Platter';
export * from './TrackStrip';
export * from './Waveform';
export * from './WaveLane';
