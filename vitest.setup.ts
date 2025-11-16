import { beforeAll, afterEach, vi } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Environment is already loaded by vitest.config.ts based on TEST_TYPE
// Only load .env.test as fallback if TEST_TYPE is not set (direct test execution)
if (!process.env.TEST_TYPE) {
  dotenv.config({ path: path.resolve(__dirname, '.env.test') });
}

// Mock server-only to allow importing server components in tests
vi.mock('server-only', () => ({}));

// Suppress console output during tests to keep test output clean
// These are restored after each test
beforeAll(() => {
  // Mock console methods to prevent cluttering test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  // Clear mock call history after each test
  vi.clearAllMocks();
});

// Note: If you need to see console output for debugging a specific test, you can:
// 1. Temporarily restore console in that test:
//    beforeEach(() => {
//      vi.restoreAllMocks();
//    });
//
// 2. Or run tests with --reporter=verbose flag:
//    npm test -- --reporter=verbose
