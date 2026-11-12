/**
 * Renders starter songs off the main thread, so the screen stays responsive
 * while a song is being synthesised (about half a second on a laptop, several
 * times that on a phone).
 */
import { renderCrateTrack } from './render';
import type { RenderReply, RenderRequest } from './render-in-worker';

// This file is type-checked with the page's types, where `self` is a Window.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage(message: RenderReply, transfer: Transferable[]): void;
};

scope.onmessage = (event) => {
  const { request, track, sampleRate } = event.data;
  renderCrateTrack(track, sampleRate).then(
    (rendered) => {
      const channels = [...rendered.audio.channels];
      // Moved, not copied: the page takes the samples over.
      scope.postMessage(
        { request, channels },
        channels.map((channel) => channel.buffer as ArrayBuffer),
      );
    },
    () => scope.postMessage({ request, channels: null }, []),
  );
};
