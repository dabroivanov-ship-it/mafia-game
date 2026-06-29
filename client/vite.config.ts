import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-32x32.png'],
      manifest: {
        name: 'Мафия онлайн',
        short_name: 'Мафия',
        description: 'Онлайн-игра «Мафия» с чатом, комнатами и ролями',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'ru',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//],
      },
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'tiptap';
          }
          if (id.includes('socket.io-client') || id.includes('engine.io')) {
            return 'socket';
          }
          if (id.includes('dompurify')) {
            return 'dompurify';
          }
          if (id.includes('react-dom') || /[/\\]react[/\\]/.test(id)) {
            return 'react-vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
