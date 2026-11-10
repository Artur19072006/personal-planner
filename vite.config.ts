import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['planner-favicon-v2-32.png', 'planner-apple-touch-v2-180.png'],
    manifest: {
      id: '/', name: 'Personal Planner', short_name: 'Planner', lang: 'ru',
      description: 'Задачи, проекты и занятия. Всё важное — на своём месте.',
      theme_color: '#365d49', background_color: '#f7f8fa', display: 'standalone',
      start_url: '/', scope: '/',
      icons: [
        { src: '/planner-icon-v2-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/planner-icon-v2-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/planner-icon-v2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'], navigateFallback: '/index.html', cleanupOutdatedCaches: true },
  })],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { database: ['dexie', 'dexie-react-hooks'], validation: ['zod'] } } } },
  test: { environment: 'node', include: ['src/**/*.test.ts'], setupFiles: ['src/test-setup.ts'] },
});
