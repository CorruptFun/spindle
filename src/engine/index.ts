/**
 * engine: the audio engine. Plain TypeScript on the Web Audio API.
 *
 * Hard rule (enforced by ESLint): nothing in here imports React, a state
 * library, or any UI/app code. The engine can be driven from a test, a MIDI
 * controller or a different UI without changes.
 */
export * from './AudioEngine';
export * from './core';
export * from './deck';
export * from './mixer';
export * from './sync';
