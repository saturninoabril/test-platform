/**
 * Global Test Teardown Script
 *
 * Runs once after all tests to clean up resources:
 * 1. Close database pool
 * 2. Clean up any lingering connections
 */

import { closeGlobalTestPool } from '../tests/e2e/fixtures/index';

async function globalTeardown(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Running global test teardown...');
  console.log('='.repeat(60));

  try {
    // Close database pool
    await closeGlobalTestPool();
    console.log('✓ Database pool closed');

    console.log('='.repeat(60));
    console.log('✓ Global test teardown complete');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('='.repeat(60));
    console.error('✗ Global test teardown failed:', error);
    console.error('='.repeat(60));
    throw error;
  }
}

export default globalTeardown;
