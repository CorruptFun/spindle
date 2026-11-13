/**
 * synth: sounds made by code. Drums, basses, plucks, keys and the small DSP
 * kit they are built from, all plain TypeScript that fills sample arrays.
 *
 * Because every sound is synthesised, nothing is downloaded and nothing needs
 * a licence, and the output is identical in every browser and in Node tests.
 * The starter songs (sources/crate) and the drum kits (studio) both draw on it.
 *
 * Rules: no DOM and no Web Audio types (it runs in workers and in tests), and
 * it imports nothing from src/ except `lib`.
 */
export * from './drums';
export * from './dsp';
export * from './instruments';
export * from './rng';
