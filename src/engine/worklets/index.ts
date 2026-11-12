/**
 * engine/worklets: code that runs on the audio thread.
 *
 * Milestone 1: the deck player processor (`deck-player.worklet.ts`): fractional
 * playhead, motor and inertia, scratch, reverse, throw, seek, loop. Its maths
 * lives in `engine/deck/kernel.ts`; `protocol.ts` types the messages.
 * Milestone 2: the meter processor. Milestone 3: time-stretch for key lock
 * (WebAssembly).
 *
 * Each processor is its own `*.worklet.ts` entry file, type-checked by
 * tsconfig.worklet.json (no DOM) and loaded with `audioWorklet.addModule` via a
 * `?worker&url` import. Processors may import pure, DOM-free modules (`lib`,
 * engine maths, their message types), which are bundled in, and must never
 * allocate inside `process()`.
 */
export {};
