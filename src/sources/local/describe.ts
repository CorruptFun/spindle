import type { TrackMeta } from '../types';
import { trackInfoFromFileName } from './title';

/**
 * What can be said about a file before decoding it: enough to list it in the
 * picker and to recognise the same file again.
 */
export function describeAudioFile(file: File): TrackMeta {
  const { title, artist } = trackInfoFromFileName(file.name);
  return {
    ref: { source: 'local', id: `${file.name}:${file.size}:${file.lastModified}` },
    title,
    artist,
    glyph: 'note',
  };
}
