import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';
import { BRAND } from './src/config/brand.ts';

// `npm run icons` regenerates every PNG/ICO in public/ from public/logo.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: BRAND.themeColor },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: BRAND.themeColor },
    },
  },
  images: ['public/logo.svg'],
});
