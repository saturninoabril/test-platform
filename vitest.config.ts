import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import * as dotenv from 'dotenv';

// Load test-type-specific environment file if TEST_TYPE is set
const testType = process.env.TEST_TYPE;
if (testType && ['api', 'pages', 'e2e'].includes(testType)) {
  // Load test-type-specific environment
  const envPath = path.resolve(__dirname, `.env.test.${testType}`);
  dotenv.config({ path: envPath });
} else {
  // Fallback to .env.test for tests run directly
  dotenv.config({ path: path.resolve(__dirname, '.env.test') });
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30000, // 30 seconds for tests that make HTTP requests
    env: {
      // Make environment variables available to test code
      BASE_URL: process.env.BASE_URL || 'http://localhost:3001',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '5433',
      DB_USER: process.env.DB_USER || 'change_user',
      DB_PASSWORD: process.env.DB_PASSWORD || 'change_password',
      DB_NAME: process.env.DB_NAME || 'change_db',
      AUTH_SECRET: process.env.AUTH_SECRET || '',
      AUTH_URL: process.env.AUTH_URL || 'http://localhost:3001',
      JWT_SECRET: process.env.JWT_SECRET || '',
      JWT_ISSUER: process.env.JWT_ISSUER || 'test-platform',
      JWT_TOKEN: process.env.JWT_TOKEN || '',
      VALID_JWT_TOKEN: process.env.VALID_JWT_TOKEN || '',
      EXPIRED_JWT_TOKEN: process.env.EXPIRED_JWT_TOKEN || '',
      TEST_TYPE: process.env.TEST_TYPE || '',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/test-run/**',
      '**/tests/e2e/**', // Exclude Playwright E2E tests from Vitest
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/test-run/**',
        '**/*.config.ts',
        '**/*.test.ts',
        '**/scripts/**',
        'vitest.setup.ts',
        '**/test-data/**', // Exclude test fixture data
        '**/lib/processors/base.ts', // Exclude abstract base class
        '**/lib/db/**', // Exclude database schema and connection files
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
