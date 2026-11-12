import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Folders that must run without a UI: no React, no stores, no components. */
const HEADLESS = ['lib', 'engine', 'analysis', 'sources', 'library', 'controllers'];

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
              group: ['@/sources/**', '@/library/**', '@/controllers/**', '@/analysis/**'],
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
