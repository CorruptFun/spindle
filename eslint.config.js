import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Folders that must run without a UI: no React, no stores, no components. */
const HEADLESS = [
  'lib',
  'synth',
  'engine',
  'studio',
  'analysis',
  'sources',
  'library',
  'controllers',
];

const noUiImports = {
  group: [
    'react',
    'react-dom',
    'react-dom/*',
    'zustand',
    'zustand/*',
    '@/ui/**',
    '@/app/**',
    '@/state/**',
  ],
  message: 'This folder must stay free of UI and state-library code (docs/ARCHITECTURE.md).',
};

/** Every way a page can send data to a server. */
const NETWORK_APIS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'RTCPeerConnection'];
const NO_NETWORK =
  'The app does not talk to any server (README, "Privacy"). Do not add network code without changing that promise.';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'public'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    // Privacy: the app works entirely on the device. Nothing in src/ may open a network
    // connection, so adding one is a deliberate, reviewed change to this list (and to the
    // content security policy in vite.config.ts and the privacy section of the README).
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NETWORK_APIS.map((name) => ({ name, message: NO_NETWORK })),
      ],
      'no-restricted-properties': [
        'error',
        ...NETWORK_APIS.flatMap((property) =>
          ['window', 'globalThis', 'self'].map((object) => ({
            object,
            property,
            message: NO_NETWORK,
          })),
        ),
        { object: 'navigator', property: 'sendBeacon', message: NO_NETWORK },
      ],
    },
  },

  {
    files: HEADLESS.map((folder) => `src/${folder}/**/*.ts`),
    rules: { 'no-restricted-imports': ['error', { patterns: [noUiImports] }] },
  },

  {
    // The engine and lib sit at the bottom: they know nothing about where music comes from.
    files: ['src/lib/**/*.ts', 'src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noUiImports,
            {
              group: [
                '@/sources/**',
                '@/library/**',
                '@/controllers/**',
                '@/analysis/**',
                '@/studio/**',
                '@/synth/**',
              ],
              message: 'engine and lib may only import from lib and engine.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
