import { loadRootEnv } from '../../packages/db/src/load-root-env';
import { defineConfig, devices } from '@playwright/test';

loadRootEnv();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
