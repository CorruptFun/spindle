import { TrackLoadError, type LoadedTrack } from '../types';
import { renderCrateTrack as renderOnThisThread } from './render';
import { CRATE_TRACKS } from './tracks';

export interface RenderRequest {
  readonly request: number;
  readonly track: string;
  readonly sampleRate: number;
}

export interface RenderReply {
  readonly request: number;
  /** null when the song could not be rendered. */
  readonly channels: Float32Array[] | null;
}

let worker: Worker | null = null;
/** The worker could not start or crashed; render on this thread from now on. */
let workerUnusable = typeof Worker === 'undefined';
let nextRequest = 1;
const waiting = new Map<number, (channels: Float32Array[] | null) => void>();

function startWorker(): Worker | null {
  try {
    const started = new Worker(new URL('./render.worker.ts', import.meta.url), {
      type: 'module',
    });
    started.onmessage = (event: MessageEvent<RenderReply>) => {
      const resolve = waiting.get(event.data.request);
      waiting.delete(event.data.request);
      resolve?.(event.data.channels);
    };
    started.onerror = () => {
      workerUnusable = true;
      worker = null;
      started.terminate();
      // Whoever was waiting falls back to rendering on this thread.
      for (const resolve of waiting.values()) resolve(null);
      waiting.clear();
    };
    return started;
  } catch {
    workerUnusable = true;
    return null;
  }
}

/**
 * Renders one of CRATE_TRACKS at the audio context's sample rate, in a
 * background worker where the browser has one. The two channels are new arrays
 * the caller owns outright. Rejects with TrackLoadError('failed') for an
 * unknown id.
 */
export async function renderCrateTrack(id: string, sampleRate: number): Promise<LoadedTrack> {
  const meta = CRATE_TRACKS.find((track) => track.ref.id === id);
  if (!meta) throw new TrackLoadError('failed', id);

  if (!workerUnusable) worker ??= startWorker();
  const active = worker;
  if (!active) return renderOnThisThread(id, sampleRate);

  const channels = await new Promise<Float32Array[] | null>((resolve) => {
    const request = nextRequest;
    nextRequest += 1;
    waiting.set(request, resolve);
    active.postMessage({ request, track: id, sampleRate } satisfies RenderRequest);
  });

  // A worker that failed is not the end of the song: do the work here instead.
  if (!channels) return renderOnThisThread(id, sampleRate);
  return { meta, audio: { sampleRate, channels }, loop: true };
}
