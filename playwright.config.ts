import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'outputs/playwright-report' }],
  ],
  outputDir: 'outputs/test-results',
  use: {
    baseURL: process.env.RIFT_TEST_URL || 'http://127.0.0.1:5187',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: process.env.RIFT_TEST_URL
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 5187 --strictPort',
        url: 'http://127.0.0.1:5187',
        reuseExistingServer: false,
        timeout: 30000,
      },
});
