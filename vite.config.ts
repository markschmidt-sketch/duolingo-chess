import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE lets the same build live at a subpath (e.g. GitHub Pages: /duolingo-chess/).
export default defineConfig({
  base: process.env.BASE ?? '/',
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Continue: Duolingo Chess',
        short_name: 'Continue',
        description: 'Read a Duolingo chess screenshot and finish the game against Stockfish, offline.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#131f24',
        theme_color: '#131f24',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,json,txt}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
