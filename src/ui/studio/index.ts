/**
 * ui/studio: the controls of the Studio, where beats are made. Presentational:
 * props in, callbacks out; the layout connects them to the stores.
 *
 * Today: the eight drum pads, the eight loops to hand, the layer keys, one
 * pad's step keys, the transport (play, record, tempo, swing, reset), the
 * song sheet and the kit picker. In the Studio the four colours mean the four drum families
 * (`familyStyle`). For a desk-sized screen there is also the grid of the
 * whole beat, the song as a strip and the workstation that arranges them, and
 * for a computer keyboard the key map (`keys.ts`) and its listener.
 */
export * from './BeatGrid';
export * from './KitPicker';
export * from './LayerStrip';
export * from './LoopPicture';
export * from './LoopSlots';
export * from './PadGrid';
export * from './SongSheet';
export * from './SongStrip';
export * from './StepRow';
export * from './TransportBar';
export * from './Workstation';
