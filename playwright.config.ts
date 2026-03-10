import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    headless: true,
    timezoneId: 'Asia/Manila',
  },
});
