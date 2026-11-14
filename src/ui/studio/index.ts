/**
 * ui/studio: the controls of the Studio, where beats are made. Presentational:
 * props in, callbacks out; the layout connects them to the stores.
 *
 * Today: the eight drum pads, the eight loops to hand, the layer keys, one
 * pad's step keys, the transport (play, record, tempo, swing, reset) and the
 * kit picker. In the Studio the four colours mean the four drum families
 * (`familyStyle`).
 */
export * from './KitPicker';
export * from './LayerStrip';
export * from './LoopSlots';
export * from './PadGrid';
export * from './StepRow';
export * from './TransportBar';
