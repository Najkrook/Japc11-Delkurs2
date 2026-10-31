import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/production',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PRODUCTION_TEST_URL || 'http://127.0.0.1:4178',
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: process.env.PRODUCTION_TEST_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4178 --strictPort',
        url: 'http://127.0.0.1:4178',
        reuseExistingServer: false,
      },
});
