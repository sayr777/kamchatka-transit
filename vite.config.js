import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { weatherProxyPlugin } from './vite-plugins/weatherProxy.js';

export default defineConfig({
  plugins: [
    weatherProxyPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/weather/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'yandex-weather-api',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [200] },
              networkTimeoutSeconds: 8,
            },
          },
          {
            urlPattern: /\/gtfs_.*\.zip$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gtfs-feeds',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Камчатка.Транспорт',
        short_name: 'КамТранспорт',
        description: 'Расписание автобусов Петропавловска-Камчатского',
        theme_color: '#FC3F1D',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('maplibre-gl')) return 'maplibre';
          if (id.includes('@deck.gl')) return 'deckgl';
          if (id.includes('react-dom') || id.includes('react/')) return 'react';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['maplibre-gl'],
  },
});
