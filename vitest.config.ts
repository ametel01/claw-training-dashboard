import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    setupFiles: ['./test/setup/vitest.setup.ts'],
    environment: 'jsdom',
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server/src/**/*.ts', 'dashboard/src/**/*.ts'],
      exclude: ['src/main.tsx', '**/*.d.ts', '**/dist/**', 'dashboard/app.js'],
    },
  },
});
