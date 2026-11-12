/** Value for `<input type="file" accept>`. Extensions cover systems that report no MIME type. */
export const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,.aif,.aiff';

/** Longest track the app will hold in memory, in seconds. */
/**
 * Largest file the app will open. Twelve minutes of uncompressed CD-quality audio is about
 * 130 MB; anything far beyond that is a long mix that would exhaust a phone or tablet.
 */
export const MAX_FILE_BYTES = 250 * 1024 * 1024;

export const MAX_TRACK_SECONDS = 12 * 60;

const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set([
  'mp3',
  'm4a',
  'aac',
  'wav',
  'flac',
  'ogg',
  'oga',
  'opus',
  'aif',
  'aiff',
  'm4p',
]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** True for audio by MIME type or, since many systems report none, by extension. */
export function isAudioFile(file: { readonly name: string; readonly type: string }): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.has(extensionOf(file.name));
}

/** `.m4p` is a copy-protected store or subscription download; it cannot be decoded. */
export function isProtectedFile(name: string): boolean {
  return extensionOf(name) === 'm4p';
}
