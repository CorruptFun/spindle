import { AUDIO_ACCEPT, isAudioFile } from './accept';

/**
 * Opens the device's file picker. Resolves with the audio files chosen, or []
 * if cancelled. Browsers only allow this from a user gesture.
 */
export function pickAudioFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = AUDIO_ACCEPT;
    input.hidden = true;

    const finish = (files: File[]): void => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => {
      finish(Array.from(input.files ?? []).filter(isAudioFile));
    });
    input.addEventListener('cancel', () => {
      finish([]);
    });

    document.body.appendChild(input);
    input.click();
  });
}

/** Audio files in a drag-and-drop payload, in order. */
export function audioFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isAudioFile);
}
