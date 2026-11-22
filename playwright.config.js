import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server/src/index.js',
    url: 'http://127.0.0.1:3101/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3101',
      APP_ORIGIN: 'http://127.0.0.1:3101',
      AI_MODE: 'demo',
      DB_PATH: ':memory:',
      PUSH_MODE: 'disabled',
    },
    timeout: 30000,
  },
});
