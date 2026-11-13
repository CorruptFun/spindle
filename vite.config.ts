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

/**
 * What the published page is allowed to load and talk to: itself, and nothing
 * else. The browser enforces it, so a mistake or a bad dependency cannot quietly
 * send anything to another server. Every `'self'` here is a promise in README's
 * privacy section; widen one only together with that text.
 *
 * Built pages only: the dev server needs inline scripts and a websocket for
 * hot reload. The host cannot send headers, so the policy travels as a meta tag
 * (which is why there is no frame-ancestors: browsers ignore it there).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "child-src 'self'",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  // Set BASE_PATH=/<repo>/ when hosting under a sub-path (see .env.example).
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    brandHtml(),
    contentSecurityPolicy(),
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
