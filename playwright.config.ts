import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test file for test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright Configuration for API and E2E Testing
 *
 * - Chromium-only browser testing for speed and consistency
 * - Transaction rollback pattern for database isolation
 * - Test server at http://localhost:3001
 * - 4 parallel workers in CI, 2 locally
 * - 5-minute per-test timeout, 20-minute global timeout
 */
export default defineConfig({
  /* Global setup/teardown scripts */
  globalSetup: require.resolve('./scripts/test-setup.ts'),
  globalTeardown: require.resolve('./scripts/test-teardown.ts'),
  testDir: './tests/e2e',

  /* Maximum time one test can run for */
  timeout: 5 * 60 * 1000, // 5 minutes per test

  /* Maximum time for the entire test run */
  globalTimeout: 20 * 60 * 1000, // 20 minutes overall

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only (flaky test handling) */
  retries: process.env.CI ? 1 : 0,

  /* Serial execution for E2E tests to ensure database isolation */
  workers: 1,

  /* Reporter configuration */
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list'], ['github']]
    : [['html', { open: 'on-failure' }], ['list']],

  /* Shared settings for all projects */
  use: {
    /* Base URL for tests */
    baseURL: 'http://localhost:3001',

    /* Collect trace on failure */
    trace: 'retain-on-failure',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Video only on failure */
    video: 'retain-on-failure',

    /* Maximum time each action such as `click()` can take */
    actionTimeout: 10 * 1000,

    /* Navigation timeout */
    navigationTimeout: 30 * 1000,
  },

  /* Configure projects for Chromium only */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start server
    env: {
      PORT: '3001',
      NODE_ENV: 'test',
    },
  },
});
