/**
 * sources/local: audio files the listener owns, played with full decks.
 * Files stay on the device; nothing is uploaded.
 *
 * Milestone 1: file picker and drag-and-drop, decode to PCM.
 * Milestone 3: copy imports into the origin-private file system so the library
 * survives a restart without re-picking files.
 */
export {
  AUDIO_ACCEPT,
  MAX_FILE_BYTES,
  MAX_TRACK_SECONDS,
  isAudioFile,
  isProtectedFile,
} from './accept';
export { trackInfoFromFileName } from './title';
export { decodeAudioFile } from './decode';
export { describeAudioFile } from './describe';
export { pickAudioFiles, audioFilesFromDataTransfer } from './pick';
