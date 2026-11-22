import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/pages',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/pages',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/pages', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3201/money/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    { name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: [
    {
      command: 'node scripts/pages-server.mjs',
      url: 'http://127.0.0.1:3201/money/',
      env: { PORT: '3201', STATIC_DIR: 'dist-pages' },
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/pages-server.mjs',
      url: 'http://127.0.0.1:3202/money/',
      env: { PORT: '3202', STATIC_DIR: '.tmp/pages-connected' },
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/pages-api-fixture.mjs',
      url: 'http://127.0.0.1:3301/api/health',
      env: {
        PORT: '3301',
        APP_ORIGIN: 'http://127.0.0.1:3202',
        DB_PATH: ':memory:',
        AI_MODE: 'demo',
        PUSH_MODE: 'disabled',
      },
      reuseExistingServer: false,
    },
  ],
});
