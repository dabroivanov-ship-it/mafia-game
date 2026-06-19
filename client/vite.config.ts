import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
