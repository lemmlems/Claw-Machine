import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'claw-page-route',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/claw' || request.url === '/claw/') {
            request.url = '/claw.html';
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/activate': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
