import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const dashboardServerPort = Number(env.DASHBOARD_SERVER_PORT ?? '8788');
  const dashboardServerTarget = `http://127.0.0.1:${dashboardServerPort}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: dashboardServerTarget,
          changeOrigin: true,
        },
        '/data.json': {
          target: dashboardServerTarget,
          changeOrigin: true,
        },
      },
    },
    root: '.',
    build: {
      outDir: 'dist',
    },
  };
});
