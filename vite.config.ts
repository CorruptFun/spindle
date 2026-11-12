import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { BRAND } from './src/config/brand.ts';

/** Fills the %APP_*% placeholders in index.html so the name lives in one file. */
function brandHtml(): Plugin {
  return {
    name: 'brand-html',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replaceAll('%APP_NAME%', BRAND.name)
          .replaceAll('%APP_DESCRIPTION%', BRAND.description)
          .replaceAll('%APP_THEME_COLOR%', BRAND.themeColor),
    },
  };
}

export default defineConfig({
  // Set BASE_PATH=/<repo>/ when hosting under a sub-path (see .env.example).
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    brandHtml(),
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a new version must never reload the page mid-mix.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: BRAND.name,
        short_name: BRAND.name,
        description: BRAND.description,
        theme_color: BRAND.themeColor,
        background_color: BRAND.themeColor,
        display: 'standalone',
        orientation: 'any',
        categories: ['music', 'entertainment', 'education'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
