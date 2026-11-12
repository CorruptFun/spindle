/**
 * engine/worklets: code that runs on the audio thread.
 *
 * Milestone 2: the deck player processor (fractional playhead, variable speed,
 * reverse, scratch) and the meter processor. Milestone 3: time-stretch for key
 * lock (WebAssembly).
 *
 * Each processor is its own entry file loaded with `audioWorklet.addModule`.
 * Processors cannot import from the rest of src/ except `lib` and their own
 * shared message types, and must never allocate inside `process()`.
 */
export {};
