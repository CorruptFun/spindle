import { FULL_CAPABILITIES, LISTEN_ONLY_CAPABILITIES } from '@/engine/core/types';
import type { SourceDescriptor, SourceId } from './types';

/**
 * Every place music can come from, and what each one is allowed to do.
 *
 * The two streaming services are listen-only on purpose. Their audio is
 * encrypted end to end, and their developer terms do not let a third-party app
 * mix, alter or layer it. docs/STREAMING.md has the reasoning and the sources;
 * registry.test.ts stops anyone from quietly widening these.
 */
export const SOURCES: Readonly<Record<SourceId, SourceDescriptor>> = {
  local: {
    id: 'local',
    label: 'My files',
    audioPath: 'pcm',
    capabilities: FULL_CAPABILITIES,
    requires: ['Audio files you own (MP3, M4A/AAC, WAV, FLAC, OGG)'],
  },
  'apple-music': {
    id: 'apple-music',
    label: 'Apple Music',
    audioPath: 'opaque',
    capabilities: LISTEN_ONLY_CAPABILITIES,
    requires: ['An Apple Music subscription'],
  },
  spotify: {
    id: 'spotify',
    label: 'Spotify',
    audioPath: 'opaque',
    capabilities: LISTEN_ONLY_CAPABILITIES,
    requires: ['Spotify Premium', 'Being on the app’s short list of approved Spotify accounts'],
  },
};
