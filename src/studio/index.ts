/**
 * studio: making music, as opposed to playing records. Plain data and pure
 * functions; the engine makes the sound and the screen is in ui/studio.
 *
 * Today: drum kits (synthesised from `synth`), eight ready-made loops, each
 * built from four layers, the edits a person can make to a loop, and saving a
 * beat on the device, and a song: loops chained one after another.
 * Later (docs/PLAN.md, Studio track): melodic instruments, a song timeline,
 * recording, and exporting.
 */
export * from './types';
export * from './kits';
export * from './layers';
export * from './loops';
export * from './pattern';
export * from './project';
export * from './song';
