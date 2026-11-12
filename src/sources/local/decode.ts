import type { PcmAudio } from '@/engine/core/types';
import { TrackLoadError, type LoadedTrack, type TrackLoadFailure } from '../types';
import { MAX_FILE_BYTES, MAX_TRACK_SECONDS, isAudioFile, isProtectedFile } from './accept';
import { describeAudioFile } from './describe';

function decodeFailure(error: unknown): TrackLoadFailure {
  const name = error instanceof Error ? error.name : '';
  return name === 'EncodingError' || name === 'NotSupportedError' ? 'unsupported' : 'failed';
}

/** Reads a file the listener owns and decodes it at the context's sample rate. */
export async function decodeAudioFile(context: BaseAudioContext, file: File): Promise<LoadedTrack> {
  if (isProtectedFile(file.name)) throw new TrackLoadError('protected', file.name);
  if (!isAudioFile(file)) throw new TrackLoadError('unsupported', file.name);
  // Checked before reading: decoding a very long file can take more memory than a tablet has.
  if (file.size > MAX_FILE_BYTES) throw new TrackLoadError('too-long', file.name);

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new TrackLoadError('failed', file.name);
  }

  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(bytes);
  } catch (error) {
    throw new TrackLoadError(decodeFailure(error), file.name);
  }

  if (buffer.duration > MAX_TRACK_SECONDS) throw new TrackLoadError('too-long', file.name);

  // Copies, not views: the engine owns these arrays and the AudioBuffer is discarded.
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) {
    const copy = new Float32Array(buffer.length);
    buffer.copyFromChannel(copy, c);
    channels.push(copy);
  }
  const audio: PcmAudio = { sampleRate: buffer.sampleRate, channels };

  return {
    meta: { ...describeAudioFile(file), durationSec: buffer.duration },
    audio,
    loop: false,
  };
}
