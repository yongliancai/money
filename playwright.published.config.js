import { defineConfig, devices } from '@playwright/test';

// Explicit opt-in acceptance against this repository's public site. No persistent profile.
export default defineConfig({
  testDir: 'tests/published',
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: 'test-results/published',
  reporter: [
    ['list'],
    [
      'json',
      { outputFile: 'docs/evidence/batch1-release/published-results.json' },
    ],
  ],
  use: {
    baseURL: 'https://yongliancai.github.io/money/',
    timezoneId: 'Asia/Taipei',
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: ['chromium', 'webkit'].map((name) => ({
    name,
    use: { ...devices['iPhone 13'], browserName: name, deviceScaleFactor: 1 },
  })),
});
