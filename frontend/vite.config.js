import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to Vite; Vite forwards /event-api and
// /booking-api to the two microservices, so no CORS is needed. In Kubernetes
// nginx does the same job (see nginx/default.conf.template).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = (url) => ({
    target: url,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/(event|booking)-api/, ''),
  });
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/event-api': target(env.EVENT_URL || 'http://localhost:8081'),
        '/booking-api': target(env.BOOKING_URL || 'http://localhost:8082'),
      },
    },
  };
});
