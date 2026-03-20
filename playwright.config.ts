import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/tests',
  outputDir: './reports/pw-results',
  fullyParallel: false, // Run sequentially so results save in order
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30000,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/pw-html', open: 'never' }],
  ],

  use: {
    baseURL: process.env.AUDIT_URL || 'http://localhost:3939',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to audit across browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
