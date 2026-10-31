import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/backend',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:5177', browserName: 'chromium' },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5177 --strictPort --mode test',
    url: 'http://127.0.0.1:5177',
    env: { VITE_FIREBASE_EMULATORS: 'true' },
    reuseExistingServer: false,
  },
});
